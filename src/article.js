
import { stripHtml } from './utils.js';

/**
 * Fetches and extracts main text from an article URL.
 * Has a 15 second timeout to prevent hanging.
 * @param {string} url 
 * @returns {Promise<string>}
 */
export async function fetchArticle(url) {
    console.log('📰 [ARTICLE] Fetching:', url);

    // Create abort controller with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ClawBot/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            console.log('📰 [ARTICLE] HTTP Error:', res.status);
            return `Failed to fetch article. Status: ${res.status}`;
        }

        const html = await res.text();
        console.log('📰 [ARTICLE] HTML received, length:', html.length);

        // Very basic extraction: 
        // 1. Try to find <article> content
        // 2. Fallback to body
        // 3. Strip tags

        const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        const contentHtml = articleMatch ? articleMatch[1] : html;

        let text = stripHtml(contentHtml);

        // Cleanup whitespace
        text = text.replace(/\s+/g, ' ').trim();

        // Truncate if too long (OpenAI token limits)
        const maxLength = 8000;
        if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '... [Truncated]';
        }

        console.log('📰 [ARTICLE] Text extracted, length:', text.length);
        return text;
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            console.error('📰 [ARTICLE] Timeout after 15 seconds');
            return 'Error: Request timed out after 15 seconds';
        }

        console.error('📰 [ARTICLE] Error:', error);
        return `Error fetching article: ${error.message}`;
    }
}
