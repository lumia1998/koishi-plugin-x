# koishi-plugin-x

[![npm](https://img.shields.io/npm/v/koishi-plugin-x.svg)](https://www.npmjs.com/package/koishi-plugin-x)

推特 (X.com / Twitter.com) 终极解析与智能翻译插件。结合了网页截图渲染与 ChatLuna 大语言模型翻译，支持多流派输出，自动解决各类聊天适配器的限制。

## 🌟 特性

- **🚀 混合解析架构**：首选使用免登录的 `vxtwitter` 公共 API 解析，极速稳定。当 API 失效或面对敏感/受保护推文时，自动无缝切换到 Puppeteer 浏览器 + Cookie 兜底登录抓取。
- **📸 精美推文截图**：在 API 模式下生成本地渲染卡片，在兜底模式下直接对推特页面进行精确边界裁切截图，原汁原味呈现推特质感。
- **🤖 智能 AI 翻译**：集成 **ChatLuna** 翻译引擎。采用专门针对推特和互联网语境优化的提示词，不仅能够准确翻译全球各语种，还能精准理解推特中的俚语、常见缩写与梗。
- **🔒 Cookie 失效主动感知**：在浏览器兜底截图时，如果登录 Cookie (`auth_token`) 已过期或失效，前台与日志会抛出明确指示，方便管理员及时更新。
- **🎯 纯净发帖人提取**：不论是 API 解析还是原网页 DOM 兜底分析，视频和正文获取范围均已严格锁定在主推文容器内，彻底屏蔽评论区网友回复的表情包 (GIF) 与推荐推文的视频干扰。
- **💬 消息多段拆分发送**：针对含有视频的推文，系统会自动拆分为三条独立消息分发（截图 ➡️ 翻译文本 ➡️ 视频直链），有效解决 QQ 频道/群聊等平台单消息不支持图文 + 视频共存的适配痛点。
- **📱 移动端分享链兼容**：自动感应并完美解析 `mobile.x.com` 与 `mobile.twitter.com` 格式的分享链接，在底层进行域名标准化清洗，保障渲染成功率。

## ⚙️ 安装与配置

### 依赖项需求
本插件强依赖以下两个 Koishi 插件服务：
1. **`puppeteer`**：用于兜底原网页登录截图与 API 模式本地卡片绘制。
2. **`chatluna`**：用于调用大语言模型进行推文翻译。

### 插件设置
在 Koishi 控制面板中启用本插件后，请配置以下参数：

- **detectXLinks** (`boolean`, 默认: `true`)：是否自动解析聊天中出现的 x.com 或 twitter.com 链接。
- **enableTranslation** (`boolean`, 默认: `true`)：是否使用 ChatLuna 翻译推文正文。
- **model** (`string`)：用于翻译的 ChatLuna 大语言模型名称（需先在 ChatLuna 中启用对应平台和模型）。
- **translationPrompt** (`string`)：传递给 ChatLuna 的自定义翻译提示词模板，可用 `{text}` 作为推文内容占位符。
- **cookies** (`string`, role: `secret`)：Twitter/X 的登录 Cookie（即 Cookie 中的 `auth_token` 值），用于 API 解析失败时通过浏览器登录进行兜底截图。

## 📖 使用指南

### 1. 自动感应解析
在群聊或私聊中，当用户发送推特/X 链接时，插件会自动捕获并开始解析：
> **用户**：这篇推文写得真好：https://x.com/elonmusk/status/123456789
>
> **机器人**：🔍 正在获取推文内容
> *(随后分别发送三条消息：卡片截图 ➡️ AI 翻译 ➡️ 推文中包含的视频)*

### 2. 主动指令解析
你也可以使用手动指令进行查询：
```bash
twitter https://x.com/elonmusk/status/123456789
# 或者简写为
x https://x.com/elonmusk/status/123456789
```

## 📄 开源协议

MIT License
