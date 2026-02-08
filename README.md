# ClawBot Telegram Bot

A powerful AI assistant running on Cloudflare Workers with browser capabilities, memory, and Jehovah's Witness values.

## Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat** | Powered by GPT-4o with a unique "crazy but wholesome" persona |
| 🧠 **Memory** | Remembers last 10 messages per conversation |
| 🌐 **Browser Rendering** | Can browse JavaScript-heavy pages like a human |
| 📝 **Article Review** | Summarizes and analyzes articles |
| 🔍 **PR Review** | Reviews GitHub Pull Requests |
| ⛪ **JW Values** | Strictly adheres to Jehovah's Witness principles |

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Start fresh conversation | `/start` |
| `/clear` | Clear conversation memory | `/clear` |
| `/browse <url>` | Browse page with real browser | `/browse https://example.com` |
| `/review <url>` | Review article (fast fetch) | `/review https://blog.example.com/post` |
| `/pr <url>` | Review GitHub PR | `/pr https://github.com/org/repo/pull/123` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                        │
├─────────────────────────────────────────────────────────────┤
│  src/index.js     - Main entry point, command dispatcher    │
│  src/ai.js        - OpenAI integration with persona         │
│  src/browser.js   - Puppeteer browser rendering             │
│  src/article.js   - Fast article fetching                   │
│  src/github.js    - GitHub PR fetching                      │
│  src/utils.js     - Helper functions                        │
├─────────────────────────────────────────────────────────────┤
│                      Bindings                                │
│  CHAT_HISTORY (KV)  - Stores conversation history           │
│  BROWSER            - Puppeteer browser sessions            │
├─────────────────────────────────────────────────────────────┤
│                      Secrets                                 │
│  OPENAI_API_KEY     - OpenAI API key                        │
│  TELEGRAM_TOKEN     - Telegram Bot Token                    │
│  GITHUB_TOKEN       - GitHub Personal Access Token          │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Clone & Install
```bash
git clone <repo>
cd clawbot-telegram
npm install
```

### 2. Set Secrets
```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TELEGRAM_TOKEN
npx wrangler secret put GITHUB_TOKEN
```

### 3. Deploy
```bash
npm run deploy
```

### 4. Set Telegram Webhook
```bash
curl -F "url=https://clawbot-telegram.chiemela-dev.workers.dev" \
     https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook
```

## Development

### Local Development
```bash
npm run dev
```

### View Logs
```bash
npx wrangler tail
```

### Log Format
- `📥 [REQUEST]` - Incoming Telegram messages
- `📜 [HISTORY]` - Chat memory operations
- `🧠 [AI]` - AI processing
- `🌐 [BROWSER]` - Browser rendering
- `📸 [SCREENSHOT]` - Screenshot capture

## Configuration

### wrangler.jsonc
```jsonc
{
  "name": "clawbot-telegram",
  "main": "src/index.js",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    { "binding": "CHAT_HISTORY", "id": "..." }
  ],
  "browser": {
    "binding": "BROWSER"
  }
}
```

## AI Persona

The bot has a unique persona:
- **Enthusiastic & Sharp** - High energy, creative metaphors
- **JW Principles** - Political neutrality, no holidays, clean language
- **Transparent Thinking** - Shows thought process with `💭 **Thinking:**`

## License

Private - All rights reserved.
