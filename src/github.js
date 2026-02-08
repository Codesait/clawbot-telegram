
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
 * Fetches a list of open issues from a repo.
 * @param {string} owner 
 * @param {string} repo 
 * @param {string} token 
 * @returns {Promise<string>} Formatted list of issues
 */
export async function fetchIssues(owner, repo, token) {
    const headers = {
        'User-Agent': 'ClawBot-Worker',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`
    };

    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&sort=updated&per_page=5`;
        console.log(`Searching GitHub issues: ${url}`);

        const res = await fetch(url, { headers });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`GitHub API Error (${res.status}): ${errorText}`);
        }

        const issues = await res.json();

        if (!issues || issues.length === 0) {
            return "No open issues found.";
        }

        return issues.map(i => {
            const type = i.pull_request ? '[PR]' : '[Issue]';
            return `#${i.number} ${type} ${i.title} (by ${i.user.login})`;
        }).join('\n');

    } catch (error) {
        console.error('Error fetching issues:', error);
        return `Failed to fetch issues. Error: ${error.message}`;
    }
}

/**
 * Fetches details of a single issue.
 * @param {string} owner 
 * @param {string} repo 
 * @param {string} issueNumber 
 * @param {string} token 
 * @returns {Promise<string|object>} Formatted issue details or raw object
 */
export async function fetchIssue(owner, repo, issueNumber, token) {
    const headers = {
        'User-Agent': 'ClawBot-Worker',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`
    };

    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, { headers });
        if (!res.ok) throw new Error(`GitHub API Error: ${res.statusText}`);
        const issue = await res.json();

        return {
            title: issue.title,
            body: issue.body,
            state: issue.state,
            url: issue.html_url,
            author: issue.user.login,
            number: issue.number,
            is_pr: !!issue.pull_request
        };
    } catch (error) {
        console.error('Error fetching issue:', error);
        throw error;
    }
}

/**
 * Creates a comment on an issue or PR.
 * @param {string} owner 
 * @param {string} repo 
 * @param {string} issueNumber 
 * @param {string} body 
 * @param {string} token 
 * @returns {Promise<boolean>} Success status
 */
export async function createComment(owner, repo, issueNumber, body, token) {
    const headers = {
        'User-Agent': 'ClawBot-Worker',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ body })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to comment: ${error}`);
        }
        return true;
    } catch (error) {
        console.error('Error creating comment:', error);
        throw error;
    }
}

/**
 * Updates the state of an issue (open/closed).
 * @param {string} owner 
 * @param {string} repo 
 * @param {string} issueNumber 
 * @param {string} state - 'open' or 'closed'
 * @param {string} token 
 * @returns {Promise<boolean>} Success status
 */
export async function updateIssueState(owner, repo, issueNumber, state, token) {
    const headers = {
        'User-Agent': 'ClawBot-Worker',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ state })
        });

        if (!res.ok) {
            throw new Error(`Failed to update issue: ${res.statusText}`);
        }
        return true;
    } catch (error) {
        console.error('Error updating issue:', error);
        throw error;
    }
}


/**
 * Fetches the user's repositories sorted by updated date.
 * @param {string} token 
 * @returns {Promise<string>} Formatted list of repos
 */
export async function fetchUserRepos(token) {
    const headers = {
        'User-Agent': 'ClawBot-Worker',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`
    };

    try {
        // Fetch repositories (sorted by updated, descending)
        const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=10&type=all', { headers });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`GitHub API Error (${res.status}): ${errorText}`);
        }

        const repos = await res.json();

        if (!repos || repos.length === 0) {
            return "No repositories found.";
        }

        return repos.map(r => `📂 ${r.full_name} (${r.private ? '🔒' : 'Pb'})`).join('\n');

    } catch (error) {
        console.error('Error fetching repos:', error);
        return `Failed to fetch repositories. Error: ${error.message}`;
    }
}


/**
 * Fetches file content from GitHub
 * @param {string} owner 
 * @param {string} repo 
 * @param {string} path 
 * @param {string} token 
 * @returns {Promise<string>} File content
 */
export async function fetchFileContent(owner, repo, path, token) {
    const headers = {
        'User-Agent': 'ClawBot-Worker',
        'Authorization': `token ${token}`
    };

    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`);
        const data = await res.json();
        // Content is base64 encoded
        if (data.encoding === 'base64') {
            return atob(data.content.replace(/\n/g, ''));
        }
        return data.content || "";
    } catch (e) {
        throw new Error(`Error fetching file content: ${e.message}`);
    }
}

/**
 * Updates a file in GitHub
 * @param {string} owner 
 * @param {string} repo 
 * @param {string} path 
 * @param {string} content 
 * @param {string} message 
 * @param {string} token 
 * @returns {Promise<object>} Commit data
 */
export async function updateFileContent(owner, repo, path, content, message, token) {
    const headers = {
        'User-Agent': 'ClawBot-Worker',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        // 1. Get current file SHA
        const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
        if (!getRes.ok) throw new Error(`File not found for update: ${path}`);
        const getData = await getRes.json();
        const sha = getData.sha;

        // 2. Update file
        const body = {
            message: message,
            content: btoa(content),
            sha: sha
        };

        const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body)
        });

        if (!putRes.ok) {
            const err = await putRes.text();
            throw new Error(`Failed to update file: ${err}`);
        }

        return await putRes.json();
    } catch (e) {
        throw new Error(`Error updating file: ${e.message}`);
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
