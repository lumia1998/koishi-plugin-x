import { Context, Schema, h, Session } from 'koishi'
import type { ChatLunaChatModel } from 'koishi-plugin-chatluna/lib/llm-core/platform/model'
import type { ComputedRef } from 'koishi-plugin-chatluna'

export const name = 'x'
export const inject = ['puppeteer', 'chatluna']

declare module 'koishi' {
  interface Context {
    puppeteer: any
    chatluna: any
  }
}

export interface Config {
  detectXLinks: boolean
  enableTranslation: boolean
  model: string
  translationPrompt: string
  cookies: string
}

const DEFAULT_PROMPT = '你是精通多国与互联网文化的推文翻译专家。请将输入内容翻译为简体中文，仅输出译文，不要附加解释。可适度润色，但需保留原文格式（换行、段落、标点）。保留网址、emoji、#话题标签原样，不翻译人名或其代称。正确理解常见缩写与梗语。若内容为空、仅含链接、仅占位符或无有效文本，请不要翻译并直接输出空内容。请翻译：{text}'

export const Config: Schema<Config> = Schema.object({
  detectXLinks: Schema.boolean().default(true).description('是否自动解析聊天中的 x.com / twitter.com 链接'),
  enableTranslation: Schema.boolean().default(true).description('是否使用 ChatLuna 翻译推文内容'),
  model: Schema.dynamic('model').description('使用的大语言模型名称 (需要通过 ChatLuna 先配置并启用)'),
  translationPrompt: Schema.string().role('textarea').default(DEFAULT_PROMPT).description('传递给 ChatLuna 的翻译提示词，可以使用 {text} 作为推文占位符'),
  cookies: Schema.string().required().role('secret').description('Twitter/X 登录 Cookie (auth_token)，用于浏览器登录并解析截图')
}).description('基础设置')

export function apply(ctx: Context, config: Config) {
  let chatLunaModel: ComputedRef<ChatLunaChatModel>

  const loadModel = async () => {
    try {
      if (config.enableTranslation && config.model) {
        chatLunaModel = await ctx.chatluna.createChatModel(config.model)
      }
    } catch (e) {
      ctx.logger('twitter-ultimate').error('加载 ChatLuna 模型时出错：', e)
    }
  }

  // 动态导入 modelSchema
  import('koishi-plugin-chatluna/utils/schema' as any).then(({ modelSchema }) => {
    modelSchema(ctx)
  }).catch(err => {
    ctx.logger('twitter-ultimate').error('Failed to load chatluna modelSchema', err)
  })

  ctx.on('ready', async () => {
    await loadModel()
  })

  // 核心功能 1: 自动解析链接
  if (config.detectXLinks) {
    ctx.middleware(async (session, next) => {
      const content = session.content || ''
      const twitterRegex = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/
      const match = content.match(twitterRegex)
      
      if (match) {
        const url = match[0]
        const tweetId = match[1]
        try {
          await session.send('🔍 正在获取推文内容')
          await processTweet(session, ctx, config, tweetId, chatLunaModel, url)
        } catch (e) {
          ctx.logger('twitter-ultimate').error(e)
          await session.send(`解析推文失败: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      return next()
    })
  }

  // 核心功能 2: 手动指令
  ctx.command('twitter <url:string>', '解析并翻译推文')
    .alias('x')
    .action(async ({ session }, url) => {
      if (!session) return
      if (!url) return '请输入推特链接'
      const match = url.match(/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/)
      if (!match) return '不是有效的推文链接！'
      
      try {
        await session.send('🔍 正在获取推文内容')
        await processTweet(session, ctx, config, match[1], chatLunaModel, url)
        return
      } catch (e) {
        ctx.logger('twitter-ultimate').error(e)
        return `解析推文失败: ${e instanceof Error ? e.message : String(e)}`
      }
    })
}

// 核心链路：抓取 -> 翻译 -> 截图渲染 -> 发送消息
async function processTweet(session: Session, ctx: Context, config: Config, tweetId: string, chatLunaModel?: ComputedRef<ChatLunaChatModel>, originalUrl?: string) {
  const tweetUrl = originalUrl || `https://x.com/i/status/${tweetId}`
  
  if (!config.cookies) {
    throw new Error('未配置 Twitter/X 登录 Cookie (auth_token)，请在插件设置中填入 Cookie。')
  }
  
  ctx.logger('twitter-ultimate').info('启动浏览器进行推特页面截图与内容抓取...')
  const scraped = await scrapeTweetWithCookie(ctx, tweetUrl, config.cookies)
  const tweetText = scraped.text
  const screenshotBuf = scraped.screenshot
  const mediaUrls = scraped.mediaUrls

  let translatedText = ''
  if (config.enableTranslation && tweetText) {
    if (chatLunaModel && chatLunaModel.value) {
      try {
        translatedText = await translate(tweetText, ctx, config, chatLunaModel)
      } catch (e) {
        ctx.logger('twitter-ultimate').warn('翻译失败: ' + e)
      }
    }
  }

  if (!screenshotBuf) {
    throw new Error('未能生成推文截图')
  }

  // 4. 发送结果：图片与视频分开发送
  await session.send(h.image(screenshotBuf, 'image/png'))

  // 发送翻译
  if (translatedText) {
    await session.send(`📝 AI 翻译:\n${translatedText}`)
  }

  // 发送视频 (只发送主推文内的视频)
  const videos = mediaUrls.filter((url: string) => url.includes('.mp4') || url.includes('video.twimg.com'))
  for (const v of videos) {
    await session.send(h.video(v))
  }
}

// 模拟 xanalyse 浏览器登录截图与内容提取 (加入重试机制 + vxtwitter API 获取媒体)
async function scrapeTweetWithCookie(ctx: Context, url: string, cookies: string, maxRetries = 3) {
  let attempts = 0
  let page: any
  while (attempts < maxRetries) {
    try {
      page = await ctx.puppeteer.page()
      await page.setCookie({
        name: 'auth_token',
        value: cookies,
        domain: '.x.com',
        path: '/',
        httpOnly: true,
        secure: true
      })
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36")
      await page.setDefaultNavigationTimeout(60000)
      await page.setDefaultTimeout(60000)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      
      // 等待推文容器渲染
      await page.waitForSelector('article', { timeout: 30000 })
      
      // 等待图片加载
      await page.evaluate(async () => {
        const article = document.querySelector('article[data-testid="tweet"]') || document.querySelector('article')
        if (!article) return
        const imgs = Array.from(article.querySelectorAll('img'))
        await Promise.all(imgs.map(img => {
          if (img.complete && (img as HTMLImageElement).naturalWidth > 0) return Promise.resolve()
          return new Promise(resolve => {
            img.onload = img.onerror = resolve
          })
        }))
      })

      const element = await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 })
      if (!element) {
        throw new Error('未能找到推文容器')
      }

      // 检查是否为受保护账号
      const isProtected = await page.evaluate(() => {
        return !!document.querySelector('[aria-label="受保护账号"]')
      })

      // 获取正文
      const textContent = await element.evaluate((el: any) => {
        const textEl = el.querySelector('div[data-testid="tweetText"]')
        return textEl ? textEl.textContent || '' : ''
      })

      // 截图逻辑 (直接从页面裁切)
      let screenshotBuffer: Buffer
      try {
        const box = await element.boundingBox()
        if (box) {
          const imgs = await element.$$('img')
          let avatarBox = null
          for (const img of imgs) {
            try {
              const ibox = await img.boundingBox()
              if (!ibox) continue
              const relTop = ibox.y - box.y
              if (ibox.width <= 96 && relTop >= 0 && relTop <= 96) {
                avatarBox = ibox
                break
              }
            } catch (__) {}
          }
          let leftMost = box.x
          let topMost = box.y
          let rightMost = box.x + box.width
          let bottomMost = box.y + box.height
          if (avatarBox) {
            leftMost = Math.min(leftMost, avatarBox.x)
            topMost = Math.min(topMost, avatarBox.y)
            rightMost = Math.max(rightMost, avatarBox.x + avatarBox.width)
            bottomMost = Math.max(bottomMost, avatarBox.y + avatarBox.height)
          }
          const pad = 12
          const x = Math.max(0, Math.floor(leftMost - pad))
          const y = Math.max(0, Math.floor(topMost - pad))
          const width = Math.ceil(rightMost - leftMost + pad * 2)
          const height = Math.ceil(bottomMost - topMost + pad * 2)
          screenshotBuffer = await page.screenshot({ clip: { x, y, width, height }, type: "webp" })
        } else {
          screenshotBuffer = await element.screenshot({ type: "webp" })
        }
      } catch (e) {
        screenshotBuffer = await element.screenshot({ type: "webp" })
      }

      // 获取媒体列表：如果是受保护账号，不获取视频。否则调用 vxtwitter API。
      let mediaUrls: string[] = []
      if (!isProtected) {
        const apiUrl = url.replace(/(twitter\.com|x\.com)/, 'api.vxtwitter.com')
        try {
          const apiResponse = await ctx.http.get(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          })
          if (apiResponse && apiResponse.media_extended) {
            mediaUrls = apiResponse.media_extended.map((m: any) => m.url)
          }
        } catch (apiErr) {
          ctx.logger('twitter-ultimate').warn('请求 vxtwitter API 提取媒体直链失败:', apiErr)
        }
      }

      return {
        text: textContent,
        screenshot: screenshotBuffer,
        mediaUrls: mediaUrls
      }
    } catch (e) {
      attempts++
      ctx.logger('twitter-ultimate').warn(`浏览器截图第 ${attempts} 次尝试失败: ${e instanceof Error ? e.message : String(e)}`)
      if (page) await page.close().catch(() => {})
      if (attempts >= maxRetries) throw e
      // 等待 3 秒后重试
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
  throw new Error('未能生成推文截图')
}

async function translate(text: string, ctx: Context, config: Config, chatLunaModel: ComputedRef<ChatLunaChatModel>) {
  const { HumanMessage } = await import('@langchain/core/messages')
  const promptTemplate = config.translationPrompt || DEFAULT_PROMPT
  const response = await chatLunaModel.value.invoke([
    new HumanMessage(promptTemplate.replace('{text}', text)) as any
  ])
  if (response && response.content) {
    return typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)
  }
  throw new Error('模型未返回任何内容')
}
