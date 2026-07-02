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
  cookies?: string
}

const DEFAULT_PROMPT = '你是精通多国与互联网文化的推文翻译专家。请将输入内容翻译为简体中文，仅输出译文，不要附加解释。可适度润色，但需保留原文格式（换行、段落、标点）。保留网址、emoji、#话题标签原样，不翻译人名或其代称。正确理解常见缩写与梗语。若内容为空、仅含链接、仅占位符或无有效文本，请不要翻译并直接输出空内容。请翻译：{text}'

export const Config: Schema<Config> = Schema.object({
  detectXLinks: Schema.boolean().default(true).description('是否自动解析聊天中的 x.com / twitter.com 链接'),
  enableTranslation: Schema.boolean().default(true).description('是否使用 ChatLuna 翻译推文内容'),
  model: Schema.dynamic('model').description('使用的大语言模型名称 (需要通过 ChatLuna 先配置并启用)'),
  translationPrompt: Schema.string().role('textarea').default(DEFAULT_PROMPT).description('传递给 ChatLuna 的翻译提示词，可以使用 {text} 作为推文占位符'),
  cookies: Schema.string().role('secret').description('Twitter/X 登录 Cookie (auth_token)，用于 API 解析失败时通过浏览器截图进行兜底')
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
      const twitterRegex = /https?:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/
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
      const match = url.match(/(?:twitter\.com|x\.com|mobile\.twitter\.com|mobile\.x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/)
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
  let tweetUrl = originalUrl || `https://x.com/i/status/${tweetId}`
  tweetUrl = tweetUrl.replace('mobile.twitter.com', 'twitter.com').replace('mobile.x.com', 'x.com')
  let tweetText = ''
  let translatedText = ''
  let screenshotBuf: Buffer | null = null
  let mediaUrls: string[] = []
  let isApiSuccess = false

  // 1. 尝试使用 API 模式 (vxtwitter)
  try {
    const response = await ctx.http.get(`https://api.vxtwitter.com/i/status/${tweetId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    
    if (response && response.tweet) {
      const tweet = response.tweet
      tweetText = tweet.text || ''
      mediaUrls = (tweet.media?.all || []).map((m: any) => m.url)
      
      // 本地 HTML 渲染截图 (API模式下不需要登录，只绘制图片)
      const avatarUrl = tweet.author?.avatar_url || ''
      const authorName = tweet.author?.name || 'Unknown'
      const screenName = tweet.author?.screen_name || 'unknown'
      
      // AI 翻译
      if (config.enableTranslation && tweetText) {
        if (chatLunaModel && chatLunaModel.value) {
          try {
            translatedText = await translate(tweetText, ctx, config, chatLunaModel)
          } catch (e) {
            ctx.logger('twitter-ultimate').warn('翻译失败: ' + e)
          }
        }
      }

      // 本地渲染时排除视频文件，仅绘制图片
      const mediaElements = mediaUrls
        .filter((url: string) => !url.includes('.mp4') && !url.includes('video.twimg.com'))
        .map((url: string) => `<img src="${url}" style="max-width: 100%; border-radius: 12px; margin-top: 8px;">`)
        .join('')

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f3f5; padding: 20px; display: flex; justify-content: center; }
            .card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 500px; width: 100%; }
            .header { display: flex; align-items: center; margin-bottom: 16px; }
            .avatar { width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; }
            .names { display: flex; flex-direction: column; }
            .name { font-weight: bold; font-size: 16px; color: #0f1419; }
            .handle { color: #536471; font-size: 14px; }
            .content { font-size: 16px; color: #0f1419; white-space: pre-wrap; line-height: 1.5; margin-bottom: 12px; }
            .media { display: flex; flex-direction: column; gap: 8px; }
            .footer { margin-top: 16px; color: #536471; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card" id="tweet-card">
            <div class="header">
              <img class="avatar" src="${avatarUrl}" />
              <div class="names">
                <span class="name">${authorName}</span>
                <span class="handle">@${screenName}</span>
              </div>
            </div>
            <div class="content">${tweetText}</div>
            <div class="media">
              ${mediaElements}
            </div>
            <div class="footer">Koishi Twitter Ultimate (API Mode)</div>
          </div>
        </body>
        </html>
      `

      screenshotBuf = await ctx.puppeteer.render(html, {
        waitUntil: 'networkidle0'
      })
      isApiSuccess = true
    }
  } catch (e) {
    ctx.logger('twitter-ultimate').warn(`API 模式解析失败，将尝试使用 Cookie 浏览器截图进行兜底。错误原因: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 3. API 失败时，使用 Cookie 浏览器截图进行兜底 (xanalyse 方式)
  if (!isApiSuccess) {
    if (!config.cookies) {
      throw new Error('API 解析失败，且未配置用于浏览器兜底的 Cookie (auth_token)，请在插件设置中填入 Cookie。')
    }
    
    ctx.logger('twitter-ultimate').info('启动浏览器进行推特页面截图与内容抓取...')
    const scraped = await scrapeTweetWithCookie(ctx, tweetUrl, config.cookies)
    tweetText = scraped.text
    screenshotBuf = scraped.screenshot
    mediaUrls = scraped.mediaUrls

    // 再次翻译
    if (config.enableTranslation && tweetText) {
      if (chatLunaModel && chatLunaModel.value) {
        try {
          translatedText = await translate(tweetText, ctx, config, chatLunaModel)
        } catch (e) {
          ctx.logger('twitter-ultimate').warn('翻译失败: ' + e)
        }
      }
    }
  }

  if (!screenshotBuf) {
    throw new Error('未能生成推文截图')
  }

  // 4. 分开三条消息发送（截图 -> 内容翻译 -> 视频）
  // 消息 1: 截图
  await session.send(h.image(screenshotBuf, 'image/png'))

  // 消息 2: 内容翻译
  if (translatedText) {
    await session.send(translatedText)
  }

  // 消息 3: 视频
  const videos = mediaUrls.filter((url: string) => url.includes('.mp4') || url.includes('video.twimg.com'))
  for (const v of videos) {
    await session.send(h.video(v))
  }
}

// 模拟 xanalyse 浏览器登录截图与内容提取 (加入重试与 Cookie 失效检测)
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
      
      // 检测 Cookie 是否过期/失效
      const currentUrl = page.url()
      const hasLoginButton = await page.evaluate(() => {
        return !!(document.querySelector('div[data-testid="loginButton"]') || 
                  document.querySelector('a[href*="/login"]') ||
                  document.querySelector('div[data-testid="signupButton"]'))
      })
      
      if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/login') || hasLoginButton) {
        throw new Error('Cookie已失效，已过期，请重新获取并在插件设置中配置！')
      }

      // 1. 等待真实的推文容器加载
      const element = await page.waitForSelector('article[data-testid="tweet"]', { timeout: 30000 })
      if (!element) {
        throw new Error('未能找到推文容器')
      }

      // 给 React 初始渲染 1.5 秒缓冲区
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 2. 等待推文内容完全渲染（包含头像、无加载圈、且所有已渲染的图片均加载完成）
      try {
        await page.waitForFunction((sel: string) => {
          const a = document.querySelector(sel)
          if (!a) return false
          
          // 确保不是空壳（至少渲染了头像或正文/媒体区域）
          const hasAvatar = !!a.querySelector('[data-testid="Tweet-User-Avatar"]') || a.querySelectorAll('img').length > 0
          const hasContent = !!a.querySelector('[data-testid="tweetText"]') || !!a.querySelector('[data-testid="tweetPhoto"]') || !!a.querySelector('[data-testid="videoPlayer"]')
          if (!hasAvatar && !hasContent) return false

          // 确保没有加载指示器（加载圈）
          const progressbar = a.querySelector('[role="progressbar"]')
          if (progressbar) return false

          // 确保所有已存在图片均已加载完成（主推文一定包含至少一张头像图片）
          const imgs = Array.from(a.querySelectorAll('img')) as HTMLImageElement[]
          if (imgs.length === 0) return false
          
          return imgs.every((img) => img.complete && img.naturalWidth > 0)
        }, { timeout: 15000 }, 'article[data-testid="tweet"]')
      } catch (err) {
        ctx.logger('twitter-ultimate').warn('等待推文完全渲染超时，将直接执行后续流程')
      }

      // 给重绘（Paint）预留一个 500ms 的短暂稳定时间
      await new Promise(resolve => setTimeout(resolve, 500))

      // 3. 检查是否为受保护账号
      const isProtected = await page.evaluate(() => {
        return !!document.querySelector('[aria-label="受保护账号"]')
      })

      // 获取正文 (仅从主推文中获取，避免主推文无文字时误抓下方回复的文字)
      const textContent = await element.evaluate((el: any) => {
        const textEl = el.querySelector('div[data-testid="tweetText"]')
        return textEl ? textEl.textContent || '' : ''
      })

      // 4. 截图逻辑 (直接从页面裁切)
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

      // 获取媒体列表：如果是受保护账号，不获取视频。否则在浏览器内调用 vxtwitter API（避免 Node 请求时被 Cloudflare 拦截，同时避开页面 DOM 的 blob: 视频链接）
      let mediaUrls: string[] = []
      if (!isProtected) {
        const apiUrl = url.replace(/(twitter\.com|x\.com)/, 'api.vxtwitter.com')
        try {
          const apiPage = await page.browser().newPage()
          await apiPage.setUserAgent(await page.evaluate(() => navigator.userAgent))
          await apiPage.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
          const bodyText = await apiPage.evaluate(() => document.body.innerText)
          await apiPage.close()
          
          const apiResponse = JSON.parse(bodyText)
          if (apiResponse && apiResponse.media_extended) {
            mediaUrls = apiResponse.media_extended.map((m: any) => m.url)
          }
        } catch (apiErr) {
          ctx.logger('twitter-ultimate').warn('在浏览器内请求 vxtwitter API 失败:', apiErr)
        }
      }

      return {
        text: textContent,
        screenshot: screenshotBuffer,
        mediaUrls: mediaUrls
      }
    } catch (e) {
      // 如果检测到 Cookie 过期错误，不要进行无意义的重试，直接抛出异常给用户
      if (e instanceof Error && e.message.includes('Cookie已失效')) {
        if (page) await page.close().catch(() => {})
        throw e
      }
      
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
