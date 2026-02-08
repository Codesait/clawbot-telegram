
/**
 * Checks if a string is a valid URL.
 * @param {string} string 
 * @returns {boolean}
 */
export function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Parses a Telegram message text into command and args.
 * @param {string} text 
 * @returns {{command: string|null, args: string[]}}
 */

export function parseCommand(text) {
    if (!text || !text.startsWith('/')) {
        return { command: null, args: [] };
    }
    const parts = text.trim().split(/\s+/).filter(Boolean);
    const command = parts[0].slice(1); // remove /
    const args = parts.slice(1);
    return { command, args };
}

/**
 * cleans HTML tags primarily for the article reader
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
    return html.replace(/<[^>]*>?/gm, '');
}

/**
 * Extracts the first URL from a string.
 * @param {string} text 
 * @returns {string|null}
 */
export function extractUrl(text) {
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
}
