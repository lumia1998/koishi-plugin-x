"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
exports.name = 'x';
exports.inject = ['puppeteer', 'chatluna'];
const DEFAULT_PROMPT = '你是精通多国与互联网文化的推文翻译专家。请将输入内容翻译为简体中文，仅输出译文，不要附加解释。可适度润色，但需保留原文格式（换行、段落、标点）。保留网址、emoji、#话题标签原样，不翻译人名或其代称。正确理解常见缩写与梗语。若内容为空、仅含链接、仅占位符或无有效文本，请不要翻译并直接输出空内容。请翻译：{text}';
exports.Config = koishi_1.Schema.object({
    detectXLinks: koishi_1.Schema.boolean().default(true).description('是否自动解析聊天中的 x.com / twitter.com 链接'),
    enableTranslation: koishi_1.Schema.boolean().default(true).description('是否使用 ChatLuna 翻译推文内容'),
    model: koishi_1.Schema.dynamic('model').description('使用的大语言模型名称 (需要通过 ChatLuna 先配置并启用)'),
    translationPrompt: koishi_1.Schema.string().role('textarea').default(DEFAULT_PROMPT).description('传递给 ChatLuna 的翻译提示词，可以使用 {text} 作为推文占位符'),
    cookies: koishi_1.Schema.string().role('secret').description('Twitter/X 登录 Cookie (auth_token)，用于 API 解析失败时通过浏览器截图进行兜底'),
    apiProvider: koishi_1.Schema.union([
        koishi_1.Schema.const('vxtwitter').description('vxtwitter'),
        koishi_1.Schema.const('fxtwitter').description('fxtwitter'),
    ]).role('radio').default('vxtwitter').description('API 提供商，vxtwitter 兼容性好，fxtwitter 支持长推文正文。'),
    downloadOriginalImage: koishi_1.Schema.boolean().default(false).description('是否下载原图（最高画质）'),
    logDetails: koishi_1.Schema.boolean().default(false).description('是否在控制台输出详细的调试日志')
}).description('基础设置');
function apply(ctx, config) {
    let chatLunaModel;
    const loadModel = async () => {
        try {
            if (config.enableTranslation && config.model) {
                chatLunaModel = await ctx.chatluna.createChatModel(config.model);
            }
        }
        catch (e) {
            ctx.logger('twitter-ultimate').error('加载 ChatLuna 模型时出错：', e);
        }
    };
    // 动态导入 modelSchema
    Promise.resolve(`${'koishi-plugin-chatluna/utils/schema'}`).then(s => __importStar(require(s))).then(({ modelSchema }) => {
        modelSchema(ctx);
    }).catch(err => {
        ctx.logger('twitter-ultimate').error('Failed to load chatluna modelSchema', err);
    });
    ctx.on('ready', async () => {
        await loadModel();
    });
    // 核心功能 1: 自动解析链接
    if (config.detectXLinks) {
        ctx.middleware(async (session, next) => {
            const content = session.content || '';
            const twitterRegex = /https?:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/;
            const match = content.match(twitterRegex);
            if (match) {
                const url = match[0];
                const tweetId = match[1];
                try {
                    await session.send('🔍 正在获取推文内容');
                    await processTweet(session, ctx, config, tweetId, chatLunaModel, url);
                }
                catch (e) {
                    ctx.logger('twitter-ultimate').error(e);
                    await session.send(`解析推文失败: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            return next();
        });
    }
    // 核心功能 2: 手动指令
    ctx.command('twitter <url:string>', '解析并翻译推文')
        .alias('x')
        .action(async ({ session }, url) => {
        if (!session)
            return;
        if (!url)
            return '请输入推特链接';
        const match = url.match(/(?:twitter\.com|x\.com|mobile\.twitter\.com|mobile\.x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/);
        if (!match)
            return '不是有效的推文链接！';
        try {
            await session.send('🔍 正在获取推文内容');
            await processTweet(session, ctx, config, match[1], chatLunaModel, url);
            return;
        }
        catch (e) {
            ctx.logger('twitter-ultimate').error(e);
            return `解析推文失败: ${e instanceof Error ? e.message : String(e)}`;
        }
    });
}
// 核心链路：抓取 -> 翻译 -> 截图渲染 -> 发送消息
async function processTweet(session, ctx, config, tweetId, chatLunaModel, originalUrl) {
    let tweetUrl = originalUrl || `https://x.com/i/status/${tweetId}`;
    tweetUrl = tweetUrl.replace('mobile.twitter.com', 'twitter.com').replace('mobile.x.com', 'x.com');
    let tweetText = '';
    let translatedText = '';
    let avatarUrl = '';
    let authorName = 'Unknown';
    let screenName = 'unknown';
    let screenshotBuf = null;
    let mediaUrls = [];
    let isApiSuccess = false;
    let modeLabel = 'API Mode';
    // 1. 尝试使用 API 模式 (多级 API 兜底：优先首选，失败后切换备选)
    const providers = config.apiProvider === 'fxtwitter' ? ['fxtwitter', 'vxtwitter'] : ['vxtwitter', 'fxtwitter'];
    for (const provider of providers) {
        try {
            const apiUrl = `https://api.${provider}.com/i/status/${tweetId}`;
            if (config.logDetails)
                ctx.logger('twitter-ultimate').info(`[API模式] 正在尝试请求 ${provider} API: ${apiUrl}`);
            const response = await ctx.http.get(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (response) {
                const tweet = response.tweet || response.data?.tweet || response.data || response || {};
                const extractedScreenName = tweet.author?.screen_name || tweet.user?.screen_name || tweet.user_screen_name || 'unknown';
                // 校验 API 返回的数据是否有效，防止拿回 Cloudflare 拦截页面或空包时误判成功
                if (extractedScreenName === 'unknown' && !tweet.text && !tweet.raw_text) {
                    throw new Error(`API ${provider} 返回的数据为空或被拦截`);
                }
                tweetText = String(tweet.text || tweet.raw_text?.text || '');
                const mediaItems = tweet.media?.all || tweet.media?.photos || (Array.isArray(tweet.media) ? tweet.media : []) || response.media_extended || [];
                mediaUrls = mediaItems.map((m) => {
                    let mediaUrl = typeof m === 'string' ? m : (m.url || m.url_original || '');
                    if (!mediaUrl)
                        return '';
                    const type = m.type === 'photo' ? 'image' : inferMediaType(mediaUrl, m.type);
                    if (type === 'image' && config.downloadOriginalImage) {
                        mediaUrl = normalizeTwitterImageUrl(mediaUrl, true);
                    }
                    return mediaUrl;
                }).filter(Boolean);
                avatarUrl = tweet.author?.avatar_url || tweet.user?.avatar_url || tweet.user_profile_image_url || '';
                authorName = tweet.author?.name || tweet.user?.name || tweet.user_name || 'Unknown';
                screenName = extractedScreenName;
                isApiSuccess = true;
                modeLabel = `API Mode - ${provider}`;
                if (config.logDetails)
                    ctx.logger('twitter-ultimate').info(`[API模式] ${provider} 解析成功。`);
                break;
            }
        }
        catch (e) {
            ctx.logger('twitter-ultimate').warn(`[API模式] ${provider} 尝试失败，错误原因: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    // 2. API 失败时，使用 Cookie 浏览器抓取内容进行兜底
    if (!isApiSuccess) {
        if (!config.cookies) {
            throw new Error('API 解析失败，且未配置用于浏览器兜底的 Cookie (auth_token)，请在插件设置中填入 Cookie。');
        }
        ctx.logger('twitter-ultimate').info('启动浏览器进行推特内容抓取...');
        const scraped = await scrapeTweetWithCookie(ctx, config, tweetUrl, config.cookies);
        tweetText = scraped.text;
        avatarUrl = scraped.avatarUrl;
        authorName = scraped.authorName;
        screenName = scraped.screenName;
        mediaUrls = scraped.mediaUrls;
        modeLabel = 'Browser Mode';
    }
    // 3. AI 翻译
    if (config.enableTranslation && tweetText) {
        if (chatLunaModel && chatLunaModel.value) {
            try {
                translatedText = await translate(tweetText, ctx, config, chatLunaModel);
            }
            catch (e) {
                ctx.logger('twitter-ultimate').warn('翻译失败: ' + e);
            }
        }
    }
    // 4. 本地 HTML 渲染截图 (统一在本地合成卡片并渲染截图)
    // 本地渲染时排除视频文件，仅绘制图片
    const mediaElements = mediaUrls
        .filter((url) => !isVideoUrl(url))
        .map((url) => `<img src="${url}" style="max-width: 100%; border-radius: 12px; margin-top: 8px;">`)
        .join('');
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
        <div class="footer">Koishi Twitter Ultimate (${modeLabel})</div>
      </div>
    </body>
    </html>
  `;
    screenshotBuf = await ctx.puppeteer.render(html, async (page) => {
        await page.evaluate(async () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            await Promise.all(imgs.map(img => {
                if (img.complete)
                    return;
                return new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));
        });
        const body = await page.$('body');
        const clip = body ? await body.boundingBox() : null;
        return page.screenshot({ clip });
    });
    if (!screenshotBuf) {
        throw new Error('未能生成推文截图');
    }
    // 5. 分开三条消息发送（截图 -> 内容翻译 -> 视频）
    // 消息 1: 截图
    await session.send(koishi_1.h.image(screenshotBuf, 'image/png'));
    // 消息 2: 内容翻译
    if (translatedText) {
        await session.send(translatedText);
    }
    // 消息 3: 视频
    const videos = mediaUrls.filter((url) => isVideoUrl(url));
    for (const v of videos) {
        await session.send(koishi_1.h.video(v));
    }
}
// 模拟 xanalyse 浏览器登录并抓取内容 (加入重试与 Cookie 失效检测)
async function scrapeTweetWithCookie(ctx, config, url, cookies, maxRetries = 3) {
    let attempts = 0;
    let page;
    while (attempts < maxRetries) {
        try {
            page = await ctx.puppeteer.page();
            const captured = new Map();
            const addMedia = (mediaUrl, type) => {
                mediaUrl = sanitizeMediaUrl(mediaUrl);
                if (!mediaUrl || mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:'))
                    return;
                if (!/pbs\.twimg\.com|video\.twimg\.com/i.test(mediaUrl))
                    return;
                const mediaType = type || inferMediaType(mediaUrl);
                const normalized = mediaType === 'image' ? normalizeTwitterImageUrl(mediaUrl, !!config.downloadOriginalImage) : mediaUrl;
                const key = getMediaKey(normalized);
                if (!captured.has(key)) {
                    captured.set(key, { url: normalized, type: mediaType });
                    if (config.logDetails) {
                        ctx.logger('twitter-ultimate').info(`[浏览器拦截] 捕获媒体: ${normalized} (${mediaType})`);
                    }
                }
            };
            page.on('response', (response) => {
                try {
                    const responseUrl = response.url();
                    if (!/pbs\.twimg\.com|video\.twimg\.com/i.test(responseUrl))
                        return;
                    addMedia(responseUrl, inferMediaType(responseUrl));
                }
                catch { }
            });
            await page.setCookie({
                name: 'auth_token',
                value: cookies,
                domain: '.x.com',
                path: '/',
                httpOnly: true,
                secure: true
            });
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36");
            await page.setDefaultNavigationTimeout(60000);
            await page.setDefaultTimeout(60000);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            // 检测 Cookie 是否过期/失效
            const currentUrl = page.url();
            const hasLoginButton = await page.evaluate(() => {
                return !!(document.querySelector('div[data-testid="loginButton"]') ||
                    document.querySelector('a[href*="/login"]') ||
                    document.querySelector('div[data-testid="signupButton"]'));
            });
            if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/login') || hasLoginButton) {
                throw new Error('Cookie已失效，已过期，请重新获取并在插件设置中配置！');
            }
            // 1. 等待真实的推文容器加载
            const element = await page.waitForSelector('article[data-testid="tweet"]', { timeout: 30000 });
            if (!element) {
                throw new Error('未能找到推文容器');
            }
            // 给 React 初始渲染 1.5 秒缓冲区
            await new Promise(resolve => setTimeout(resolve, 1500));
            // 2. 等待推文内容完全渲染（包含头像、无加载圈、且所有已渲染的图片均加载完成）
            try {
                await page.waitForFunction((sel) => {
                    const a = document.querySelector(sel);
                    if (!a)
                        return false;
                    const hasAvatar = !!a.querySelector('[data-testid="Tweet-User-Avatar"]') || a.querySelectorAll('img').length > 0;
                    const hasContent = !!a.querySelector('[data-testid="tweetText"]') || !!a.querySelector('[data-testid="tweetPhoto"]') || !!a.querySelector('[data-testid="videoPlayer"]');
                    if (!hasAvatar && !hasContent)
                        return false;
                    const progressbar = a.querySelector('[role="progressbar"]');
                    if (progressbar)
                        return false;
                    const imgs = Array.from(a.querySelectorAll('img'));
                    if (imgs.length === 0)
                        return false;
                    return imgs.every((img) => img.complete && img.naturalWidth > 0);
                }, { timeout: 15000 }, 'article[data-testid="tweet"]');
            }
            catch (err) {
                ctx.logger('twitter-ultimate').warn('等待推文完全渲染超时，将直接执行后续流程');
            }
            // 给重绘（Paint）预留一个 500ms 的短暂稳定时间
            await new Promise(resolve => setTimeout(resolve, 500));
            // 获取正文与 DOM 中的媒体链接/头像/作者信息 (加入 DOM 文字清洗和克隆降级机制)
            const tweetId = url.match(/\/status\/(\d+)/)?.[1];
            const scrapedData = await page.evaluate((targetTweetId) => {
                const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
                let article = null;
                for (const item of articles) {
                    const text = item.textContent || '';
                    if (/(promoted|推广|广告)/i.test(text))
                        continue;
                    if (!targetTweetId || item.querySelector(`a[href*="/status/${targetTweetId}"]`)) {
                        article = item;
                        break;
                    }
                }
                if (!article)
                    return null;
                // 提取头像地址 (从 Tweet-User-Avatar 中提取，如果不存在则从 img[src*="profile_images"] 提取)
                const avatarImgEl = article.querySelector('[data-testid="Tweet-User-Avatar"] img, [data-testid="User-Name"] img');
                const avatarUrl = avatarImgEl ? (avatarImgEl.getAttribute('src') || '') : '';
                // 提取作者昵称和用户名 (从 User-Name 中提取)
                const userNameEl = article.querySelector('[data-testid="User-Name"]');
                let authorName = 'Unknown';
                let screenName = 'unknown';
                if (userNameEl) {
                    const spans = Array.from(userNameEl.querySelectorAll('span'));
                    if (spans.length > 0) {
                        authorName = spans[0].textContent?.trim() || 'Unknown';
                    }
                    const links = Array.from(userNameEl.querySelectorAll('a'));
                    for (const link of links) {
                        const href = link.getAttribute('href') || '';
                        if (href && href !== '/') {
                            screenName = href.replace(/^\//, '');
                            break;
                        }
                    }
                }
                const urls = [];
                article.querySelectorAll('[data-testid="tweetPhoto"] img').forEach((img) => {
                    if (img.src)
                        urls.push(img.src);
                    const rawSrc = img.getAttribute('src');
                    if (rawSrc)
                        urls.push(rawSrc);
                    const srcset = img.getAttribute('srcset');
                    if (srcset)
                        urls.push(...srcset.split(',').map((item) => item.trim().split(/\s+/)[0]).filter(Boolean));
                });
                article.querySelectorAll('video, [data-testid="videoPlayer"] video, [data-testid="gifPlayable"] video, source').forEach((node) => {
                    if (node.src)
                        urls.push(node.src);
                    const rawSrc = node.getAttribute('src');
                    if (rawSrc)
                        urls.push(rawSrc);
                });
                const html = article.innerHTML.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
                for (const item of html.match(/https:\/\/pbs\.twimg\.com\/media\/[^"'< >]+/g) || [])
                    urls.push(item);
                for (const item of html.match(/https:\/\/video\.twimg\.com\/[^"'< >]+/g) || [])
                    urls.push(item);
                const textEl = article.querySelector('[data-testid="tweetText"]');
                const getFallbackText = () => {
                    const clone = article.cloneNode(true);
                    clone.querySelectorAll([
                        '[data-testid="User-Name"]',
                        '[data-testid="tweetPhoto"]',
                        '[data-testid="videoPlayer"]',
                        '[data-testid="gifPlayable"]',
                        '[data-testid="socialContext"]',
                        '[role="group"]',
                        'time',
                        'svg',
                        'img',
                        'video',
                        'source',
                    ].join(',')).forEach(node => node.remove());
                    return Array.from(clone.querySelectorAll('div[lang], span[lang], [dir="auto"]'))
                        .map(node => node.textContent?.trim() || '')
                        .filter(text => text && !/^[@\d\s.,:：]+$/.test(text))
                        .join('\n')
                        .trim();
                };
                const text = textEl?.textContent?.trim() || getFallbackText();
                return {
                    text,
                    urls,
                    avatarUrl,
                    authorName,
                    screenName
                };
            }, tweetId);
            let textContent = '';
            let mediaUrls = [];
            if (scrapedData) {
                textContent = scrapedData.text;
                const domKeys = new Set();
                for (const rawUrl of scrapedData.urls || []) {
                    const candidates = rawUrl.includes(',')
                        ? rawUrl.split(',').map((item) => item.trim().split(/\s+/)[0]).filter(Boolean)
                        : [rawUrl];
                    for (const candidate of candidates) {
                        const mediaUrl = sanitizeMediaUrl(candidate);
                        const mediaType = inferMediaType(mediaUrl);
                        const normalized = mediaType === 'image' ? normalizeTwitterImageUrl(mediaUrl, !!config.downloadOriginalImage) : mediaUrl;
                        domKeys.add(getMediaKey(normalized));
                        addMedia(mediaUrl, mediaType);
                    }
                }
                mediaUrls = Array.from(captured.entries())
                    .filter(([key]) => domKeys.has(key))
                    .map(([, value]) => value.url);
                if (config.logDetails) {
                    ctx.logger('twitter-ultimate').info(`[浏览器解析] 匹配DOM后过滤出的媒体列表: ${JSON.stringify(mediaUrls)}`);
                }
            }
            await page.close().catch(() => { });
            return {
                text: textContent,
                avatarUrl: scrapedData?.avatarUrl || '',
                authorName: scrapedData?.authorName || 'Unknown',
                screenName: scrapedData?.screenName || 'unknown',
                mediaUrls: mediaUrls
            };
        }
        catch (e) {
            if (e instanceof Error && e.message.includes('Cookie已失效')) {
                if (page)
                    await page.close().catch(() => { });
                throw e;
            }
            attempts++;
            ctx.logger('twitter-ultimate').warn(`浏览器获取内容第 ${attempts} 次尝试失败: ${e instanceof Error ? e.message : String(e)}`);
            if (page)
                await page.close().catch(() => { });
            if (attempts >= maxRetries)
                throw e;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    throw new Error('未能获取推文详情');
}
async function translate(text, ctx, config, chatLunaModel) {
    const { HumanMessage } = await Promise.resolve().then(() => __importStar(require('@langchain/core/messages')));
    const promptTemplate = config.translationPrompt || DEFAULT_PROMPT;
    const response = await chatLunaModel.value.invoke([
        new HumanMessage(promptTemplate.replace('{text}', text))
    ]);
    if (response && response.content) {
        return typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
    }
    throw new Error('模型未返回任何内容');
}
function normalizeTwitterImageUrl(url, useOriginal) {
    if (!useOriginal)
        return url;
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.endsWith('pbs.twimg.com'))
            return url;
        if (!parsed.pathname.includes('/media/'))
            return url;
        parsed.searchParams.set('name', 'orig');
        return parsed.toString();
    }
    catch {
        return url;
    }
}
function inferMediaType(url, fallback = 'image') {
    const lower = url.toLowerCase();
    if (lower.includes('tweet_video') || lower.includes('animated_gif'))
        return 'gif';
    if (lower.includes('video.twimg.com') || lower.includes('.mp4') || lower.includes('.m3u8'))
        return 'video';
    if (lower.includes('.gif'))
        return 'gif';
    return fallback;
}
function getMediaKey(url) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.endsWith('pbs.twimg.com') && parsed.pathname.includes('/media/')) {
            const path = parsed.pathname.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
            return (parsed.origin + path).toLowerCase();
        }
        if (parsed.hostname.endsWith('video.twimg.com'))
            return (parsed.origin + parsed.pathname).toLowerCase();
        return (parsed.origin + parsed.pathname + parsed.search).toLowerCase();
    }
    catch {
        return url.toLowerCase();
    }
}
function sanitizeMediaUrl(url) {
    return url.trim()
        .replace(/&amp;/g, '&')
        .replace(/\\u002F/g, '/')
        .replace(/\\\//g, '/')
        .replace(/[),.;\]]+$/g, '');
}
function isVideoUrl(url) {
    const lower = url.toLowerCase();
    return lower.includes('video.twimg.com') || lower.includes('.mp4') || lower.includes('.m3u8') || lower.includes('tweet_video');
}
