
import { fetchFileContent, updateFileContent } from '../github.js';

export const selfImprovementSkill = {
    name: 'self_improvement',
    description: 'Ability to read and modify bot source code',
    tools: [
        {
            type: "function",
            function: {
                name: "read_file",
                description: "Read a file from the bot's source code to understand how it works.",
                parameters: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "Path to file (e.g. src/index.js)" },
                        owner: { type: "string", description: "Repo owner (optional, defaults to current context)" },
                        repo: { type: "string", description: "Repo name (optional, defaults to current context)" }
                    },
                    required: ["path"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "modify_file",
                description: "Modify a file in the bot's source code. Use this to add features or fix bugs.",
                parameters: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "Path to file (e.g. src/skills/new_skill.js)" },
                        content: { type: "string", description: "The FULL new content of the file" },
                        message: { type: "string", description: "Commit message explaining the change" },
                        owner: { type: "string", description: "Repo owner (optional)" },
                        repo: { type: "string", description: "Repo name (optional)" }
                    },
                    required: ["path", "content", "message"]
                }
            }
        }
    ],
    handlers: {
        'read_file': async ({ args, env, chatId }) => {
            // Determine repo. Try arg -> kv -> hardcoded fallback?
            // For now, rely on KV or fail.
            const defaultRepo = await env.CHAT_HISTORY.get(`repo:${chatId}`);
            const owner = args.owner || (defaultRepo ? defaultRepo.split('/')[0] : 'Codesait');
            const repo = args.repo || (defaultRepo ? defaultRepo.split('/')[1] : 'clawbot-telegram');

            if (!owner || !repo) {
                return "⚠️ I don't know which repo to read. Please set a default repo with /setrepo or provide owner/repo.";
            }

            try {
                const content = await fetchFileContent(owner, repo, args.path, env.GITHUB_TOKEN);
                return `📄 Content of ${args.path}:\n\n${content.slice(0, 10000)}`; // Limit length
            } catch (e) {
                return `Error reading file: ${e.message}`;
            }
        },
        'modify_file': async ({ args, env, chatId }) => {
            const defaultRepo = await env.CHAT_HISTORY.get(`repo:${chatId}`);
            const owner = args.owner || (defaultRepo ? defaultRepo.split('/')[0] : 'Codesait');
            const repo = args.repo || (defaultRepo ? defaultRepo.split('/')[1] : 'clawbot-telegram');

            if (!owner || !repo) {
                return "⚠️ I don't know which repo to modify. Please set a default repo with /setrepo or provide owner/repo.";
            }

            try {
                const res = await updateFileContent(owner, repo, args.path, args.content, args.message, env.GITHUB_TOKEN);
                return `✅ Successfully updated ${args.path}!\nCommit: ${res.commit.html_url}\n\n⚠️ Note: You may need to redeploy the bot for changes to take effect.`;
            } catch (e) {
                return `Error modifying file: ${e.message}`;
            }
        }
    }
};
