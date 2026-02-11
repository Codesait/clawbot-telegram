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

### 3. Configure Security (IMPORTANT!)

#### a) Set Webhook Secret
Generate a random secret token:
```bash
openssl rand -hex 32
```

Store it as a Wrangler secret:
```bash
npx wrangler secret put TELEGRAM_SECRET_TOKEN
# Paste the generated token
```

#### b) Set User Allowlist (Optional but Recommended)
Get your Telegram Chat ID by sending `/start` to your bot and checking the logs with `npx wrangler tail`.

Then set the allowlist:
```bash
npx wrangler secret put ALLOWED_CHAT_IDS
# Enter your chat ID, e.g: 1537482744
# For multiple users: 1537482744,987654321,111222333
```

**⚠️ If you skip this step, anyone can use your bot and consume your OpenAI credits!**

### 4. Deploy
```bash
npm run deploy
```

### 5. Set Telegram Webhook with Secret
```bash
# Replace WORKER_URL, BOT_TOKEN, and SECRET_TOKEN with your values
curl -F "url=https://your-worker.workers.dev" \
     -F "secret_token=YOUR_SECRET_TOKEN_FROM_STEP_3" \
     https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook
```

## Security Features

- ✅ **Webhook Secret Validation** - Prevents fake messages from unauthorized sources
- ✅ **User Allowlist** - Restricts bot access to specific Telegram users
- ✅ **Rate Limiting** - 10 requests per minute per user
- ✅ **Input Validation** - Sanitizes and validates all inputs
- ✅ **Secrets Management** - All API keys stored as Cloudflare secrets
- ✅ **Data Expiration** - Chat history auto-expires after 7 days

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

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Author

**Wisdom Uzoma (Melasin)**
- GitHub: [@Codesait](https://github.com/Codesait)
- Instagram: [@melasin.dev](https://instagram.com/melasin.dev)

