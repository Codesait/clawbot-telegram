
/**
 * Fetches PR details from GitHub.
 * @param {string} owner 
 * @param {string} repo 
 * @param {string} pullNumber 
 * @param {string} token 
 * @returns {Promise<string>} Formatted PR details
 */
export async function fetchPR(owner, repo, pullNumber, token) {
    const headers = {
        'User-Agent': 'ClawBot-Worker',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`
    };

    try {
        const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, { headers });
        if (!prRes.ok) throw new Error(`GitHub API Error: ${prRes.statusText}`);
        const pr = await prRes.json();

        // Fetch files to get a sense of the changes (limit to top 5 files to avoid overload)
        const filesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`, { headers });
        const files = filesRes.ok ? await filesRes.json() : [];
        const fileList = files.map(f => `- ${f.filename} (${f.status})`).slice(0, 10).join('\n');

        return `
Title: ${pr.title}
Author: ${pr.user.login}
State: ${pr.state}
Description: ${pr.body}

Files Changed (Top 10):
${fileList}

Ref: ${pr.html_url}
        `.trim();
    } catch (error) {
        console.error('Error fetching PR:', error);
        return `Failed to fetch PR details. Error: ${error.message}`;
    }
}

/**
 * Extracts owner, repo, and pr number from a GitHub URL
 * @param {string} url
 * @returns {{owner: string, repo: string, pullNumber: string}|null}
 */
export function parseGitHubPRUrl(url) {
    try {
        const u = new URL(url);
        // Path format: /owner/repo/pull/number
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 4 && parts[2] === 'pull') {
            return {
                owner: parts[0],
                repo: parts[1],
                pullNumber: parts[3]
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}
