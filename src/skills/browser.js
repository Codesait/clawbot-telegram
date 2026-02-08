
import { browsePage } from '../browser.js';
import { fetchArticle } from '../article.js';

export const browserSkill = {
    name: 'browser',
    description: 'Web browsing capabilities',
    tools: [
        {
            type: "function",
            function: {
                name: "browse_page",
                description: "Browse a web page to read its content. Use this when the user asks to read, summarize, or analyze a URL.",
                parameters: {
                    type: "object",
                    properties: {
                        url: { type: "string", description: "The URL to browse" }
                    },
                    required: ["url"]
                }
            }
        }
    ],
    handlers: {
        'browse_page': async ({ args, env }) => {
            const url = args.url;
            console.log('🌐 [SKILL:Browser] Browsing:', url);

            // 1. Try Puppeteer Browsing
            const pageData = await browsePage(url, env);

            if (!pageData.error) {
                return `Browsed content from ${url}:\nTitle: ${pageData.title}\n\n${pageData.text.slice(0, 5000)}...`;
            }

            console.log('🌐 [SKILL:Browser] Failed, falling back to fast fetch');

            // 2. Fallback to Fast Fetch
            try {
                const fallbackText = await fetchArticle(url);
                if (fallbackText.startsWith('Failed') || fallbackText.startsWith('Error')) {
                    return `⚠️ Couldn't load the page. The site might be blocking bots. Error: ${pageData.text}`;
                }
                return `(Fetched via Fast Mode) Content from ${url}:\n\n${fallbackText.slice(0, 5000)}...`;
            } catch (e) {
                return `Error fetching page: ${e.message}`;
            }
        }
    }
};
