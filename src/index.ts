import { Context, Schema, h, Logger } from 'koishi'
import type { ChatLunaChatModel } from 'koishi-plugin-chatluna/lib/llm-core/platform/model'
import type { ComputedRef } from 'koishi-plugin-chatluna'

export const name = 'x'

export const logger = new Logger('x')

export const inject = { required: ['puppeteer'], optional: ['chatluna'] }

const DEFAULT_PROMPT = '你是精通多国与互联网文化的推文翻译专家。请将输入内容翻译为简体中文，仅输出译文，不要附加解释。可适度润色，但需保留原文格式（换行、段落、标点）。保留网址、emoji 原样。不翻译人名或其代称。正确理解互联网常见缩写与梗语。不要输出任何 hashtag/#话题标签。若内容为空、仅含链接、仅含 hashtag、仅占位符或无有效文本，请不要翻译并直接输出空内容。请翻译：{text}'

export interface Config {
  cookies: string
  fetchRetries: number
  whe_translate?: boolean
  model?: string
  prompt?: string
  translateRetries?: number
  outputLogs?: boolean
  detectXLinks?: boolean
  useForward?: boolean
}

export const Config = Schema.intersect([
  Schema.object({
    cookies: Schema.string().required().description('Twitter/X 登录 Cookie (auth_token)'),
    fetchRetries: Schema.number().min(1).default(3).description('抓取推文失败时的重试次数')
  }).description('基础设置'),

  Schema.object({
    whe_translate: Schema.boolean().default(false).description('是否启用推文翻译（通过 ChatLuna 调用大模型）')
  }).description('翻译设置'),

  Schema.union([
    Schema.object({
      whe_translate: Schema.const(true).required(),
      model: Schema.dynamic('model').description('使用的大语言模型名称 (需要通过 ChatLuna 先配置好)'),
      prompt: Schema.string().role('textarea').default(DEFAULT_PROMPT).description('翻译使用的提示词，使用{text}表示需要翻译的文本'),
      translateRetries: Schema.number().min(1).default(3).description('翻译接口失败时的重试次数')
    }),
    Schema.object({}),
  ]),

  Schema.object({
    outputLogs: Schema.boolean().default(true).description('日志调试模式'),
    detectXLinks: Schema.boolean().default(true).description('是否启用 X/Twitter 链接检测'),
    useForward: Schema.boolean().default(false).description('是否使用合并转发形式发送（仅 QQ/OneBot 平台有效）')
  }).description('调试设置'),
]) as unknown as Schema<Config>

declare module 'koishi' {
  interface Context {
    chatluna: any
    puppeteer: any
  }
}

interface ProcessedTweetMessage {
  parts: (h | string)[]
}

function removeHashtags(text: string) {
  return text
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function getTweetScreenshot(puppeteer, url: string, cookie?: string, outputLogs?: boolean): Promise<Buffer> {
  const page = await puppeteer.page()
  try {
    if (outputLogs) logger.info(`开始截取真实 X 推文: ${url}`)
    if (cookie) {
      await page.setCookie({
        name: 'auth_token',
        value: cookie,
        domain: '.x.com',
        path: '/',
        httpOnly: true,
        secure: true
      })
    }
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
    const tweetElement = await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 })
    if (!tweetElement) throw new Error('无法在页面上定位到推文元素')
    if (outputLogs) logger.info('已定位真实推文元素，开始截图')
    return await tweetElement.screenshot({ type: 'png' })
  } finally {
    await page.close().catch(() => { })
  }
}

export async function apply(ctx: Context, config: Config) {
  let chatLunaModel: ComputedRef<ChatLunaChatModel>

  const loadModel = async () => {
    try {
      if (config.whe_translate && config.model) {
        if (!ctx.chatluna) {
          logger.warn('已启用翻译，但 ChatLuna 服务不可用。请安装并启用 koishi-plugin-chatluna。')
          return
        }
        chatLunaModel = await ctx.chatluna.createChatModel(config.model)
      }
    } catch (e) {
      logger.error('加载 ChatLuna 模型时出错：', e)
    }
  }

  ctx.on('ready', async () => {
    await loadModel()
  })

  async function sendProcessedTweet(sessionParam, message: ProcessedTweetMessage) {
    const finalParts = message.parts.filter(Boolean)

    if (!finalParts.length) {
      await sessionParam.send("推文内容为空")
      return
    }

    if (config.useForward) {
      await sessionParam.send(h('figure', {}, finalParts))
      return
    }

    for (const part of finalParts) {
      await sessionParam.send(part)
    }
  }

  async function downloadImageElement(imageUrl: string) {
    const response = await ctx.http.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    return h.image(response, 'image/jpeg')
  }

  async function downloadVideoElement(videoUrl: string, timeout?: number) {
    const videoResponse = await ctx.http.get(videoUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout
    })
    return h.video(videoResponse, 'video/mp4')
  }

  async function retryMediaElement<T>(label: string, url: string, task: () => Promise<T>, maxRetries = 3) {
    let attempts = 0
    while (attempts < maxRetries) {
      try {
        return await task()
      } catch (error) {
        attempts++
        logger.error(`${label}失败，正在尝试第 ${attempts} 次重试: ${url}`, error)
        if (attempts >= maxRetries) {
          logger.error(`${label}失败，已达最大重试次数: ${url}`, error)
          return null
        }
      }
    }
    return null
  }

  async function buildTweetMessage(tpTweet, tweetWord: string, altOriginalText: string): Promise<ProcessedTweetMessage> {
    const parts: (h | string)[] = []
    let hasRenderedPreview = false

    if (tpTweet.url) {
      try {
        const screenshotBuffer = await getTweetScreenshot(ctx.puppeteer, tpTweet.url, config.cookies, config.outputLogs)
        parts.push(h.image(screenshotBuffer, 'image/png'))
        hasRenderedPreview = true
      } catch (err) {
        logger.warn('真实推文截图失败，降级使用已有截图或文字媒体模式:', err)
      }
    }

    if (!parts.length && tpTweet.screenshotBuffer) {
      parts.push(h.image(tpTweet.screenshotBuffer, "image/webp"))
      hasRenderedPreview = true
    }

    if (!parts.length && tweetWord) {
      parts.push(tweetWord + altOriginalText)
    }

    if (hasRenderedPreview && config.whe_translate === true && (tweetWord || altOriginalText)) {
      parts.push(tweetWord + altOriginalText)
    }

    const videoUrls = (tpTweet.videoUrls && tpTweet.videoUrls.length)
      ? tpTweet.videoUrls
      : (tpTweet.mediaUrls || []).filter((u) => u.endsWith('.mp4'))

    if (!parts.length) {
      const mediaUrls = tpTweet.mediaUrls || []
      const imageUrls = mediaUrls.filter((u) => !u.endsWith('.mp4'))
      const imageElements = await Promise.all(imageUrls.map((imageUrl) =>
        retryMediaElement('请求图片', imageUrl, () => downloadImageElement(imageUrl))
      ))
      parts.push(...imageElements.filter((img) => img !== null))
    }

    for (const videoUrl of videoUrls) {
      const videoElement = await retryMediaElement('请求视频', videoUrl, () => downloadVideoElement(videoUrl, 60000))
      if (videoElement) {
        parts.push(videoElement)
        if (config.outputLogs) logger.info(`成功请求视频文件: ${videoUrl}`)
      }
    }

    return { parts }
  }

  // 可复用的处理函数：根据 url 获取推文内容并通过 session 发送结果
  async function processTwitterUrl(sessionParam, urlParam) {
    try {
      const url = (urlParam || '').trim()
      if (!url) {
        await sessionParam.send("您输入的url为空")
        return
      }
      await sessionParam.send("正在获取推文内容...")
      logger.info("开始请求的推文连接：", url)
      const tpTweet = await getTimePushedTweet(ctx, ctx.puppeteer, url, config)
      if (!tpTweet) {
        const failMsg = "获取推文失败，请稍后重试"
        if (config.outputLogs) {
          logger.error(failMsg, { url })
        }
        await sessionParam.send(failMsg)
        return
      }
      const tweetText = tpTweet.word_content ?? ''

      // 构建 ALT 原文显示部分
      let altOriginalText = ""
      if (tpTweet.altTexts && tpTweet.altTexts.length > 0) {
        altOriginalText = "\n" + tpTweet.altTexts.map((alt, i) => `[图片${tpTweet.altTexts.length > 1 ? (i + 1) : ""}描述原文: ${alt}]`).join("\n")
      }

      // 根据config决定是否翻译推文
      let tweetWord
      if (config.whe_translate === true && config.model) {
        try {
          const translation_result = await translate(tweetText, ctx, config, chatLunaModel)
          if (config.outputLogs) {
            logger.info("手动查询翻译结果：", translation_result)
          }
          tweetWord = translation_result
        } catch (err) {
          logger.error("手动翻译失败，返回原文：", err)
          tweetWord = tweetText
        }
      } else {
        tweetWord = tweetText
      }

      const message = await buildTweetMessage(tpTweet, tweetWord, altOriginalText)
      await sendProcessedTweet(sessionParam, message)
    } catch (error) {
      await sessionParam.send("获取推文内容失败")
      logger.info("获取推文过程失败", error)
    }
  }

  ctx.command('x [...arg]', '根据url获得推文信息')
    .action(async ({ session }, ...arg) => {
      const url = arg.join(' ').trim()
      await processTwitterUrl(session, url)
    })

  // X/Twitter 链接识别
  const _urlRe = /((https?:\/\/)?[^\s'"\)]+\.[^\s'"\)]+)/g
  const extractUrls = (text: string) => {
    const matches = text.match(_urlRe) || []
    return matches.map((m) => m.replace(/[。，？！\.,!?，。？！、]+$/g, ""))
  }

  const isXDomain = (urlStr: string) => {
    try {
      const u = new URL(urlStr.includes('://') ? urlStr : 'https://' + urlStr)
      const hn = (u.hostname || "").toLowerCase()
      return hn === 't.co' || hn === 'x.com' || hn.endsWith('.x.com') || hn.endsWith('.twitter.com') || hn === 'twitter.com' || hn === 'm.twitter.com' || hn === 'mobile.twitter.com'
    } catch (e) {
      return false
    }
  }

  const isXTweetUrl = (urlStr: string) => {
    try {
      const u = new URL(urlStr.includes('://') ? urlStr : 'https://' + urlStr)
      return isXDomain(u.toString()) && /\/(?:i\/)?status\/\d+/i.test(u.pathname)
    } catch (e) {
      return false
    }
  }

  const expandShortLink = async (url: string) => {
    try {
      const res = await ctx.http.get(url, { redirect: 'manual' } as any)
      return (res && res.headers && res.headers.location) || url
    } catch (err: any) {
      try {
        if (err && err.response && err.response.headers && err.response.headers.location) {
          return err.response.headers.location
        }
      } catch (__) { }
      return url
    }
  }

  // 中间件：在每条会话内容中检测 X/Twitter 链接
  ctx.middleware(async (session2, next) => {
    try {
      if (!config || config.detectXLinks === false) return next()
      const text = session2.content || ''
      if (!text) return next()
      const candidates = extractUrls(text)
      if (!candidates.length) return next()
      const found: string[] = []
      for (const c of candidates) {
        const normalized = c.startsWith('http') ? c : 'https://' + c
        if (/^https?:\/\/t\.co\//i.test(normalized)) {
          const exp = await expandShortLink(normalized)
          if (isXTweetUrl(exp)) found.push(exp)
        } else if (isXTweetUrl(normalized)) {
          found.push(normalized)
        }
      }
      if (found.length) {
        logger.info('检测到 X/Twitter 链接:', found)
        for (const link of found) {
          try {
            await processTwitterUrl(session2, link)
          } catch (e) {
            logger.error('处理检测到的 X/Twitter 链接时出错', e)
          }
        }
      }
    } catch (err) {
      logger.error('X/Twitter 链接检测失败', err)
    }
    return next()
  })
}

async function getTimePushedTweet(ctx, pptr, url, config, maxRetries?: number) {
  const retryLimit = Math.max(1, Number.isFinite(maxRetries) ? maxRetries : (config.fetchRetries ?? 3))

  // 第一阶段：优先尝试 fxtwitter API
  const fxUrl = url.replace(/(twitter\.com|x\.com)/, 'api.fxtwitter.com')
  let apiAttempts = 0
  while (apiAttempts < retryLimit) {
    try {
      if (config.outputLogs) logger.info(`尝试 fxtwitter API (${apiAttempts + 1}/${retryLimit}): ${fxUrl}`)
      const apiResponse = await ctx.http.get(fxUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 10000
      })

      if (apiResponse && apiResponse.tweet) {
        const tweet = apiResponse.tweet
        let altTexts: string[] = []
        let mediaUrls: string[] = []
        let videoUrls: string[] = [] // 单独保存视频URL
        let imageUrls: string[] = [] // 单独保存图片URL
        let videoThumbnails: { [url: string]: string } = {} // 视频URL -> 缩略图URL
        let mediaDimensions: { [url: string]: { width?: number; height?: number } } = {}

        // 提取媒体和 alt 文本
        if (tweet.media && tweet.media.all && Array.isArray(tweet.media.all) && tweet.media.all.length > 0) {
          for (const media of tweet.media.all) {
            if (media.url) {
              mediaUrls.push(media.url)

              // 按类型分类
              if (media.type === 'video') {
                videoUrls.push(media.url)
                mediaDimensions[media.url] = { width: media.width, height: media.height }
                if (media.thumbnail_url) {
                  videoThumbnails[media.url] = media.thumbnail_url
                }
              } else if (media.type === 'photo') {
                imageUrls.push(media.url)
                mediaDimensions[media.url] = { width: media.width, height: media.height }
              }
            }
          }

          // 提取 alt 文本
          altTexts = tweet.media.all
            .filter(m => m.altText && m.altText.trim())
            .map(m => m.altText.trim())
        }

        // 构建文本内容
        let wordContent = tweet.text || ""

        // Alt 文本追加
        if (altTexts.length > 0) {
          wordContent += "\n\n" + altTexts.map((alt, i) =>
            `[图片${altTexts.length > 1 ? (i + 1) : ""}描述: ${alt}]`
          ).join("\n")
        }

        // 提取博主信息
        const authorName = tweet.author?.name || tweet.author?.screen_name || "未知用户"
        const screenName = tweet.author?.screen_name || ""
        const avatarUrl = tweet.author?.avatar_url || ""

        // API 成功，不需要截图
        if (config.outputLogs) logger.info('fxtwitter API 获取成功')
        return {
          url,
          word_content: wordContent,
          altTexts: altTexts,
          mediaUrls: mediaUrls,
          imageUrls: imageUrls, // 图片URL列表
          videoUrls: videoUrls, // 视频URL列表
          screenshotBuffer: null,
          authorAvatar: avatarUrl,
          authorName: authorName,
          screenName: screenName,
          videoThumbnails: videoThumbnails, // 视频缩略图映射
          mediaDimensions: mediaDimensions,
          fromAPI: true // 标记来自 API
        }
      } else {
        throw new Error('API 响应中缺少 tweet 对象')
      }
    } catch (err) {
      apiAttempts++
      logger.warn(`fxtwitter API 请求失败 (${apiAttempts}/${retryLimit}):`, err.message || err)
      if (apiAttempts >= retryLimit) {
        logger.warn('fxtwitter API 重试次数已用尽，降级使用 puppeteer 截图')
        break
      }
      // 指数退避
      await new Promise(resolve => setTimeout(resolve, 1000 * apiAttempts))
    }
  }

  // 第二阶段：fxtwitter API 失败，降级使用 puppeteer 截图
  logger.info('开始使用 puppeteer 截图模式')
  let page
  let attempts = 0
  while (attempts < retryLimit) {
    try {
      page = await pptr.page()

      await page.setCookie({
        name: 'auth_token',
        value: `${config.cookies}`,
        domain: '.x.com',
        path: '/',
        httpOnly: true,
        secure: true
      })
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36")

      await page.setDefaultNavigationTimeout(60000)
      await page.setDefaultTimeout(60000)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

      try {
        await page.waitForSelector('article', { timeout: 30000 })
      } catch (e) {
        // 等待 article 超时，截图和保存HTML调试
        if (config.outputLogs) {
          try {
            await page.screenshot({ type: 'png', fullPage: true })
            const html = await page.content()
            logger.error('等待 article 超时，已保存调试截图（页面可能需要代理或 Cookie 失效）')
            logger.error('页面 HTML 长度:', html.length)
            logger.error('页面 title:', await page.title())
            // 检查是否有登录提示或错误信息
            const bodyText = await page.evaluate(() => document.body?.innerText || '')
            logger.error('页面文本内容（前500字符）:', bodyText.substring(0, 500))
          } catch { /* ignore */ }
        }
        throw new Error('无法找到推文容器，可能是页面加载失败、需要代理或 Cookie 失效')
      }

      // 等待媒体加载（图片+视频），最多等待 10 秒
      await page.evaluate(async () => {
        const article = document.querySelector('article[data-testid="tweet"]') || document.querySelector('article')
        if (!article) return

        // 等待图片加载
        const imgs = Array.from(article.querySelectorAll('img')) as HTMLImageElement[]
        await Promise.all(imgs.map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve()
          return new Promise(resolve => {
            img.onload = img.onerror = resolve
            setTimeout(resolve, 5000) // 超时保护
          })
        }))

        // 等待视频缩略图加载（检查 video 元素和转圈动画消失）
        const videos = Array.from(article.querySelectorAll('video'))
        await Promise.all(videos.map(video => {
          if (video.readyState >= 2) return Promise.resolve() // HAVE_CURRENT_DATA
          return new Promise(resolve => {
            video.onloadeddata = resolve
            setTimeout(resolve, 5000) // 超时保护
          })
        }))
      }).catch(() => {
        // 媒体加载超时也继续，避免卡死
        if (config.outputLogs) logger.warn('媒体加载超时，继续截图')
      })

      // 额外等待 1 秒让动画稳定
      await new Promise(r => setTimeout(r, 1000))

      const isProtected = await page.evaluate(() => {
        return !!document.querySelector('[aria-label="受保护账号"]')
      })

      const element = await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 })
      if (!element) {
        throw new Error('未能找到推文容器')
      }

      let screenshotBuffer
      try {
        try {
          await page.waitForFunction((sel) => {
            const a = document.querySelector(sel)
            if (!a) return false
            const imgs = Array.from(a.querySelectorAll('img')) as HTMLImageElement[]
            return imgs.every((img) => img.complete && img.naturalWidth > 0)
          }, { timeout: 8000 }, 'article[data-testid="tweet"]')
        } catch (__) { }

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
            } catch (__) { }
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

      if (isProtected) {
        const word_content = await page.evaluate(() => {
          const el = document.querySelector('div[data-testid="tweetText"]')
          return el ? el.textContent.trim() : ''
        })
        return {
          url,
          word_content: `${word_content}\n（注：此账号为受保护账号，故不提供具体媒体内容）`,
          altTexts: [],
          mediaUrls: [],
          screenshotBuffer
        }
      } else {
        const apiUrl = url.replace(/(twitter\.com|x\.com)/, 'api.vxtwitter.com')
        let vxApiAttempts = 0
        while (vxApiAttempts < retryLimit) {
          try {
            const apiResponse = await ctx.http.get(apiUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            })
            let altTexts: string[] = []
            if (apiResponse.media_extended && apiResponse.media_extended.length > 0) {
              altTexts = apiResponse.media_extended
                .filter((m) => m.altText && m.altText.trim())
                .map((m) => m.altText.trim())
            }
            let wordContentForTranslation = apiResponse.text || ""
            if (altTexts.length > 0) {
              wordContentForTranslation += "\n\n" + altTexts.map((alt, i) => `[图片${altTexts.length > 1 ? (i + 1) : ""}描述: ${alt}]`).join("\n")
            }
            return {
              url,
              word_content: wordContentForTranslation,
              altTexts: altTexts,
              mediaUrls: apiResponse.media_extended ? apiResponse.media_extended.map(m => m.url) : [],
              screenshotBuffer
            }
          } catch (err) {
            vxApiAttempts++
            logger.error(`请求 vxtwitter API 失败，正在尝试第 ${vxApiAttempts} 次重试...`, err)
            if (vxApiAttempts >= retryLimit) {
              return {
                url,
                word_content: '',
                altTexts: [],
                mediaUrls: [],
                screenshotBuffer
              }
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * vxApiAttempts))
          }
        }
      }
    } catch (error) {
      attempts++
      logger.error(`获取推文内容失败，正在尝试第 ${attempts} 次重试...`, error)
      if (attempts >= retryLimit) {
        logger.error(`获取推文内容失败，已达最大重试次数。推文链接：${url}`, error)
        return {
          url,
          word_content: '',
          altTexts: [],
          mediaUrls: [],
          screenshotBuffer: null
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * attempts))
    } finally {
      if (page) await page.close().catch(() => { })
    }
  }
}

async function translate(text: string, ctx, config, chatLunaModel?: ComputedRef<ChatLunaChatModel>) {
  const { HumanMessage } = await import('@langchain/core/messages')
  const promptTemplate = (config.prompt && config.prompt.trim()) ? config.prompt : DEFAULT_PROMPT
  const textWithoutHashtags = removeHashtags(text)
  if (!textWithoutHashtags) return ''
  const prompt = [
    '输入中的 hashtag/#话题标签已经被移除。输出中也不要添加任何 hashtag/#话题标签。',
    promptTemplate.replace('{text}', textWithoutHashtags)
  ].join('\n')
  const retryLimit = Math.max(1, config.translateRetries ?? 3)
  let attempts = 0
  while (attempts < retryLimit) {
    try {
      if (!chatLunaModel || !chatLunaModel.value) {
        throw new Error('ChatLuna 聊天模型未加载完成或不可用')
      }
      const response = await chatLunaModel.value.invoke([
        new HumanMessage(prompt)
      ])
      if (config.outputLogs) {
        logger.info('翻译api返回结果：', response)
      }
      if (response && response.content) {
        const translation = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content)
        return removeHashtags(translation)
      } else {
        throw new Error('模型未返回任何内容')
      }
    } catch (err) {
      attempts++
      logger.error(`翻译失败，正在尝试第 ${attempts} 次重试...`, err)
      if (attempts >= retryLimit) {
        logger.error('翻译失败，请检查 ChatLuna 配置是否正确：', err)
        return '翻译失败，请检查 ChatLuna 配置是否正确'
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
    }
  }
}
