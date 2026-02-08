
import { generateAIResponse } from './ai.js';
import { parseCommand, extractUrl } from './utils.js';

// Import Skills
import { githubSkill } from './skills/github.js';
import { browserSkill } from './skills/browser.js';
import { systemSkill } from './skills/system.js';
import { selfImprovementSkill } from './skills/self_improvement.js';

// Aggregate Skills
const SKILLS = [
	githubSkill,
	browserSkill,
	systemSkill,
	selfImprovementSkill
];

// Flatten tools and handlers
const TOOLS = SKILLS.flatMap(s => s.tools);
const HANDLERS = Object.assign({}, ...SKILLS.map(s => s.handlers));

const MAX_HISTORY = 10;

/**
 * Gets chat history from KV
 */
async function getChatHistory(chatId, env) {
	try {
		const data = await env.CHAT_HISTORY.get(`chat:${chatId}`, { type: 'json' });
		return data || [];
	} catch (e) {
		console.error('Error reading chat history:', e);
		return [];
	}
}

/**
 * Saves chat history to KV
 */
async function saveChatHistory(chatId, history, env) {
	try {
		const trimmedHistory = history.slice(-MAX_HISTORY);
		await env.CHAT_HISTORY.put(`chat:${chatId}`, JSON.stringify(trimmedHistory), {
			expirationTtl: 60 * 60 * 24 * 7
		});
	} catch (e) {
		console.error('Error saving chat history:', e);
	}
}

export default {
	async fetch(request, env) {
		if (request.method !== "POST") {
			return new Response("OK");
		}

		let update;
		try {
			update = await request.json();
		} catch (e) {
			return new Response("Bad Request", { status: 400 });
		}

		const message = update.message;
		if (!message || !message.text) {
			return new Response("No message");
		}

		const chatId = message.chat.id;
		const text = message.text;

		console.log('📥 [REQUEST] Chat ID:', chatId);
		console.log('📥 [REQUEST] Text:', text);

		let replyText = "";
		let context = {};
		let history = await getChatHistory(chatId, env);

		// 1. Check for basic /clear or /start commands for immediate action
		// (Optional: move this to system.js if we want pure AI)
		if (text === '/start' || text === '/clear') {
			history = [];
			if (text === '/start') {
				replyText = "Hello! I am Clawbot (Refactored 🦞). I am ready to help with GitHub, Browsing, and Self-Improvement.";
			} else {
				replyText = "🧹 Memory cleared.";
			}
		} else {
			// 2. AI Processing with Tools
			try {
				// Determine if we need to inject context from URLs
				const detectedUrl = extractUrl(text);
				if (detectedUrl) {
					// Note: We could use the Browser Skill here, but for now let's just pass the URL to the AI context formatting
					// Actually, better to let the AI call 'browse_page' if it wants.
					// But for "Review this PR", we might want to pre-fetch context.
					// For pure "Clawbot", we let the AI decide.
					// However, to keep it snappy, if it looks like a PR link, we might pre-fetch?
					// Let's stick to pure AI + Tools for consistency. The AI has 'browse_page'.
				}

				// Default to Smart Model
				const model = "gpt-4o";

				const aiRes = await generateAIResponse(text, context, history, env, TOOLS, model);

				if (aiRes.tool_calls) {
					replyText = "⚙️ Working on it...";

					for (const toolCall of aiRes.tool_calls) {
						const fnName = toolCall.function.name;
						const fnArgs = JSON.parse(toolCall.function.arguments);
						let toolResult = "";

						console.log(`🛠 [TOOL] Executing ${fnName}`, fnArgs);

						const handler = HANDLERS[fnName];
						if (handler) {
							try {
								toolResult = await handler({
									args: fnArgs,
									env,
									chatId,
									history
								});
							} catch (e) {
								toolResult = `Error executing ${fnName}: ${e.message}`;
							}
						} else {
							toolResult = `Error: Tool ${fnName} not found.`;
						}

						// Recursively call AI with tool result
						context = { type: 'tool_result', result: toolResult };

						// We intentionally don't pass tools in the follow-up to prevent infinite loops for now
						// usage: user -> ai -> tool -> ai -> user
						const finalRes = await generateAIResponse(
							`I executed ${fnName}. Result:\n${toolResult}\n\nNow validly answer the user's request.`,
							context,
							history,
							env,
							null, // No tools for final response
							model
						);
						replyText = finalRes.content;
					}
				} else {
					replyText = aiRes.content;
				}

				// Append to history
				history.push({ role: 'user', content: text });
				history.push({ role: 'assistant', content: replyText });

			} catch (error) {
				console.error("Handler Error:", error);
				replyText = "⚠️ I crashed! Something went wrong.";
			}
		}

		await saveChatHistory(chatId, history, env);

		await fetch(
			`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: chatId,
					text: replyText,
					parse_mode: 'Markdown'
				})
			}
		);

		return new Response("OK");
	}
};
