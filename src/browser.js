
import puppeteer from '@cloudflare/puppeteer';

/**
 * Fetches a page using a real browser (Puppeteer).
 * Executes JavaScript and returns rendered HTML content.
 * @param {string} url - URL to browse
 * @param {object} env - Environment with BROWSER binding
 * @returns {Promise<{text: string, title: string, screenshot?: string}>}
 */
export async function browsePage(url, env) {
    console.log('🌐 [BROWSER] Launching browser for:', url);
    const startTime = Date.now();

    let browser = null;

    try {
        // Launch browser using Cloudflare's binding
        browser = await puppeteer.launch(env.BROWSER);
        console.log('🌐 [BROWSER] Browser launched');

        const page = await browser.newPage();

        // Set a reasonable viewport
        await page.setViewport({ width: 1280, height: 800 });

        // Set user agent to look like a real browser
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('🌐 [BROWSER] Navigating to:', url);

        // Navigate with timeout - use 'domcontentloaded' for faster response on slow sites
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        // Wait a bit for dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 2000));


        console.log('🌐 [BROWSER] Page loaded');

        // Get page title
        const title = await page.title();

        // Extract main text content
        const text = await page.evaluate(() => {
            // Remove script and style elements
            const scripts = document.querySelectorAll('script, style, noscript, iframe');
            scripts.forEach(el => el.remove());

            // Try to find main content areas
            const mainContent = document.querySelector('main, article, [role="main"], .content, #content');
            if (mainContent) {
                return mainContent.innerText;
            }

            // Fallback to body
            return document.body.innerText;
        });

        const elapsed = Date.now() - startTime;
        console.log('🌐 [BROWSER] Content extracted in', elapsed, 'ms');
        console.log('🌐 [BROWSER] Text length:', text.length, 'chars');

        // Truncate if too long
        const maxLength = 8000;
        const truncatedText = text.length > maxLength
            ? text.substring(0, maxLength) + '... [Truncated]'
            : text;

        return {
            title,
            text: truncatedText,
            url,
            renderedWith: 'browser'
        };

    } catch (error) {
        console.error('🌐 [BROWSER] Error:', error);
        return {
            title: 'Error',
            text: `Failed to browse page: ${error.message}`,
            url,
            error: true
        };
    } finally {
        if (browser) {
            await browser.close();
            console.log('🌐 [BROWSER] Browser closed');
        }
    }
}

/**
 * Takes a screenshot of a page.
 * @param {string} url - URL to screenshot
 * @param {object} env - Environment with BROWSER binding
 * @returns {Promise<ArrayBuffer>}
 */
export async function screenshotPage(url, env) {
    console.log('📸 [SCREENSHOT] Taking screenshot of:', url);

    let browser = null;

    try {
        browser = await puppeteer.launch(env.BROWSER);
        const page = await browser.newPage();

        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        const screenshot = await page.screenshot({ type: 'png' });
        console.log('📸 [SCREENSHOT] Screenshot taken');

        return screenshot;

    } catch (error) {
        console.error('📸 [SCREENSHOT] Error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
