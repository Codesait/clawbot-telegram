
import { fetchUserRepos, fetchIssues, fetchIssue, createComment, updateIssueState, fetchPR, parseGitHubPRUrl, fetchFileContent, createIssue, fetchRepoTree } from '../github.js';

export const githubSkill = {
    name: 'github',
    description: 'GitHub integration for managing repos and issues',
    tools: [
        {
            type: "function",
            function: {
                name: "get_repos",
                description: "Get list of user's recently updated repositories",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "get_issues",
                description: "Get open issues for a repository",
                parameters: {
                    type: "object",
                    properties: {
                        owner: { type: "string", description: "Repository owner (e.g. facebook)" },
                        repo: { type: "string", description: "Repository name (e.g. react)" }
                    },
                    required: ["owner", "repo"]
                }
            }
        },

        {
            type: "function",
            function: {
                name: "set_repo",
                description: "Set the default repository for this chat context",
                parameters: {
                    type: "object",
                    properties: {
                        repo: { type: "string", description: "Full repository name (e.g. facebook/react)" }
                    },
                    required: ["repo"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "get_repo_readme",
                description: "Get the README file content of a repository. Use this to explain what a repo does.",
                parameters: {
                    type: "object",
                    properties: {
                        owner: { type: "string", description: "Repository owner" },
                        repo: { type: "string", description: "Repository name" }
                    },
                    required: ["owner", "repo"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "create_issue",
                description: "Create a new issue in a GitHub repository.",
                parameters: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "Title of the issue" },
                        body: { type: "string", description: "Body/Description of the issue" },
                        owner: { type: "string", description: "Repository owner (optional, uses context default)" },
                        repo: { type: "string", description: "Repository name (optional, uses context default)" }
                    },
                    required: ["title", "body"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "close_issue",
                description: "Close a GitHub issue. Use this when the user asks to close/resolve an issue.",
                parameters: {
                    type: "object",
                    properties: {
                        issue_number: { type: "number", description: "Issue number to close (e.g. 42)" },
                        owner: { type: "string", description: "Repository owner (optional, uses context default)" },
                        repo: { type: "string", description: "Repository name (optional, uses context default)" }
                    },
                    required: ["issue_number"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "list_files",
                description: "List all files in a repository recursively. Use this to scan the codebase structure before reading specific files.",
                parameters: {
                    type: "object",
                    properties: {
                        owner: { type: "string", description: "Repository owner" },
                        repo: { type: "string", description: "Repository name" }
                    },
                    required: ["owner", "repo"]
                }
            }
        }
    ],
    handlers: {
        'get_repos': async ({ env }) => {
            return await fetchUserRepos(env.GITHUB_TOKEN);
        },
        'get_issues': async ({ args, env }) => {
            return await fetchIssues(args.owner, args.repo, env.GITHUB_TOKEN);
        },

        'set_repo': async ({ args, env, chatId }) => {
            await env.CHAT_HISTORY.put(`repo:${chatId}`, args.repo);
            return `Default repository set to ${args.repo}`;
        },
        'get_repo_readme': async ({ args, env }) => {
            try {
                // Try fetching README.md (common case)
                const content = await fetchFileContent(args.owner, args.repo, 'README.md', env.GITHUB_TOKEN);
                return `📄 README for ${args.owner}/${args.repo}:\n\n${content.slice(0, 5000)}...`;
            } catch (e) {
                // Determine if it was a 404 (maybe main vs master, or lower case)
                return `⚠️ Could not fetch README: ${e.message}. Is the repo public and does it have a README.md?`;
            }
        },
        'create_issue': async ({ args, env, chatId }) => {
            let owner = args.owner;
            let repo = args.repo;

            if (!owner || !repo) {
                const defaultRepo = await env.CHAT_HISTORY.get(`repo:${chatId}`);
                if (defaultRepo) {
                    [owner, repo] = defaultRepo.split('/');
                }
            }

            if (!owner || !repo) {
                return "⚠️ I need a repository to create an issue in. Please specify owner/repo or set a default with /setrepo.";
            }

            try {
                const issue = await createIssue(owner, repo, args.title, args.body, env.GITHUB_TOKEN);
                return `✅ Issue created! #${issue.number}\nLink: ${issue.html_url}`;
            } catch (e) {
                return `Error creating issue: ${e.message}`;
            }
        },
        'close_issue': async ({ args, env, chatId }) => {
            let owner = args.owner;
            let repo = args.repo;

            if (!owner || !repo) {
                const defaultRepo = await env.CHAT_HISTORY.get(`repo:${chatId}`);
                if (defaultRepo) {
                    [owner, repo] = defaultRepo.split('/');
                }
            }

            if (!owner || !repo) {
                return "⚠️ I need a repository to close an issue in. Please specify owner/repo or set a default with set_repo.";
            }

            try {
                await updateIssueState(owner, repo, args.issue_number.toString(), 'closed', env.GITHUB_TOKEN);
                return `✅ Issue #${args.issue_number} has been closed in ${owner}/${repo}`;
            } catch (e) {
                return `Error closing issue: ${e.message}`;
            }
        },
        'list_files': async ({ args, env }) => {
            try {
                const files = await fetchRepoTree(args.owner, args.repo, env.GITHUB_TOKEN);
                return `📂 File list for ${args.owner}/${args.repo}:\n\n${files}`;
            } catch (e) {
                return `⚠️ Could not list files: ${e.message}`;
            }
        }
    }
};
