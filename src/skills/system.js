
export const systemSkill = {
    name: 'system',
    description: 'Core system commands for memory and help',
    tools: [
        {
            type: "function",
            function: {
                name: "clear_memory",
                description: "Clear the conversation memory/history. Use this when the user says /clear, /start, or 'forget everything'.",
                parameters: { type: "object", properties: {} }
            }
        },
        {
            type: "function",
            function: {
                name: "get_help",
                description: "Get help on how to use the bot and list capabilities.",
                parameters: { type: "object", properties: {} }
            }
        }
    ],
    handlers: {
        'clear_memory': async ({ env, chatId }) => {
            // Delete the chat history from KV
            await env.CHAT_HISTORY.delete(`chat:${chatId}`);
            return "Memory cleared! I have forgotten our previous conversation.";
        },
        'get_help': async () => {
            return `I am Clawbot! 🦞

I can:
- 🐙 Manage GitHub: "List my repos", "Check issues in react"
- 🌐 Browse the Web: "Read https://example.com"
- 🧠 Remember Context: I recall our chat (until you clear it)

Try saying: "What are the latest issues in facebook/react?"`;
        }
    }
};
