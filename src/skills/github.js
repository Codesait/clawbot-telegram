

import { fetchUserRepos, fetchIssues, fetchIssue, createComment, updateIssueState, fetchPR, parseGitHubPRUrl, fetchFileContent } from '../github.js';

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
        }
    }
};
