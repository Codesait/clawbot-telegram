
import { generateAIResponse } from './ai.js';
import { parseCommand, extractUrl } from './utils.js';

// Import Skills
import { githubSkill } from './skills/github.js';
import { browserSkill } from './skills/browser.js';
import { systemSkill } from './skills/system.js';
import { selfImprovementSkill } from './skills/self_improvement.js';
import { jobSearchSkill } from './skills/job_search.js';

// Aggregate Skills
const SKILLS = [
	githubSkill,
	browserSkill,
	systemSkill,
	selfImprovementSkill,
	jobSearchSkill
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
		if (!message) {
			return new Response("No message");
		}

		const chatId = message.chat.id;
		let text = message.text || message.caption || "";
		const fileId = message.voice?.file_id || message.audio?.file_id || message.document?.file_id || message.photo?.[message.photo.length - 1]?.file_id;
		const mimeType = message.voice ? 'audio/ogg' : message.audio ? 'audio/mpeg' : message.document ? message.document.mime_type : 'image/jpeg';

		// If it's a voice note, we need to transcribe it (we'll do this inside ai.js or a helper using Whisper)
		// If it's a photo, we pass it to Vision model
		// If it's a document (PDF), we might need to extract text or pass to a tool

		console.log('📥 [REQUEST] Chat ID:', chatId);
		console.log('📥 [REQUEST] Text/Caption:', text);
		console.log('📥 [REQUEST] File ID:', fileId);

		let context = {};
		if (fileId) {
			context.file = {
				file_id: fileId,
				mime_type: mimeType,
				type: message.voice ? 'voice' : message.photo ? 'image' : 'document'
			};
		}
		let replyText = "";
		let history = await getChatHistory(chatId, env);

		// 1. Check for basic /clear or /start commands for immediate action
		// (Optional: move this to system.js if we want pure AI)
		if (text === '/start' || text === '/clear' || text === '/test_cron' || text === '/help') {
			history = [];
			const helpText = "🦞 *Clawbot Capabilities*\n\n" +
				"I am your advanced AI assistant. Here is what I can do:\n\n" +
				"🗣 **Voice & Vision**\n" +
				"• Send **Voice Notes** \u2013 I will transcribe and respond.\n" +
				"• Send **Photos** \u2013 I will analyze and describe them.\n\n" +
				"💼 **Job Search**\n" +
				"• \"Find me a job in [Role]\"\n" +
				"• Send a link to your **CV** (Google Doc/PDF) for analysis.\n" +
				"• I run a **Daily Briefing** at 8 AM based on your preferences.\n\n" +
				"🛠 **Tools**\n" +
				"• 🐙 **GitHub**: Manage repos, issues, and PRs.\n" +
				"• 🌐 **Browsing**: Search the web and read pages.\n\n" +
				"**Commands**\n" +
				"/start - Restart conversation\n" +
				"/clear - Wipe memory\n" +
				"/help - Show this menu";

			if (text === '/start' || text === '/help') {
				replyText = helpText;
			} else if (text === '/test_cron') {
				// Manually trigger the scheduled logic
				const scheduledEvent = { cron: "0 8 * * *", type: "scheduled", scheduledTime: Date.now() };
				await this.scheduled(scheduledEvent, env, { waitUntil: () => { } });
				replyText = "✅ Triggered Morning Briefing manually.";
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

				// Loop to allow multi-step tool execution (e.g. Read CV -> Search Jobs -> Answer)
				let currentText = text;
				const MAX_TURNS = 3;
				let turn = 0;
				let finalReply = "";

				while (turn < MAX_TURNS) {
					turn++;
					// Only allow tools if we have turns left
					const availableTools = (turn < MAX_TURNS) ? TOOLS : null;

					const aiRes = await generateAIResponse(currentText, context, history, env, availableTools, model);

					if (aiRes.tool_calls) {
						replyText = "⚙️ Working on it..."; // Ephemeral status
						let turnResults = "";

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

							turnResults += `\n- Tool ${fnName} result: ${toolResult}`;
						}

						// Prepare context for next turn
						context = { type: 'tool_result', result: turnResults };
						// We include the original request in the prompt to ensure context isn't lost
						currentText = `[System] Tools executed.\nOriginal Request: "${text}"\n\nResults:${turnResults}\n\nBased on these results, proceed with the next step or answer the user.`;

					} else {
						// No tools called, this is the final response
						finalReply = aiRes.content;
						break;
					}
				}

				replyText = finalReply || "⚠️ I got confused and stopped thinking.";

				// Append to history
				history.push({ role: 'user', content: text });
				history.push({ role: 'assistant', content: replyText });

			} catch (error) {
				console.error("Handler Error:", error);
				replyText = "⚠️ I crashed! Something went wrong.";
			}
		}

		await saveChatHistory(chatId, history, env);

		await saveChatHistory(chatId, history, env);

		const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;
		const payload = {
			chat_id: chatId,
			text: replyText,
			parse_mode: 'Markdown'
		};

		let response = await fetch(telegramUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		}
		);

		let responseData = await response.json();
		console.log('📤 [RESPONSE] Telegram API Response:', responseData);

		if (!responseData.ok) {
			console.error('📤 [ERROR] Failed to send message:', responseData);
			// Retry without Markdown if it failed likely due to parsing
			if (responseData.error_code === 400) {
				console.log('⚠️ [RETRY] Sending as plain text due to Markdown error');
				delete payload.parse_mode;
				response = await fetch(telegramUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload)
				});
				responseData = await response.json();
				console.log('📤 [RETRY RESPONSE] Telegram API Response:', responseData);
			}
		}

		return new Response("OK");
	},

	async scheduled(event, env, ctx) {
		console.log('⏰ [CRON] Scheduled event triggered');
		// Logic for Morning Job Briefing
		// 1. Iterate over all users in USER_PREFS (this requires listing keys, which might be slow if many users, but fine for personal bot)
		// 2. For each user, get preferences
		// 3. Call jobSearchSkill.handlers.search_jobs
		// 4. Send message to user

		try {
			const keys = await env.USER_PREFS.list();
			for (const key of keys.keys) {
				const chatId = key.name.replace('prefs:', '');
				const prefs = await env.USER_PREFS.get(key.name, { type: 'json' });

				if (prefs) {
					const query = `${prefs.role} ${prefs.keywords.join(' ')}`;
					console.log(`⏰ [CRON] Searching for user ${chatId}: ${query}`);

					// Artificial context for the AI
					const history = await getChatHistory(chatId, env);

					// We can reuse the AI to generate a friendly message
					// Or call the tool directly. Let's ask the AI to do it to keep the persona.
					const prompt = `It is time for the Morning Job Briefing! 
                    The user is looking for: ${JSON.stringify(prefs)}. 
                    Please use the 'search_jobs' tool to find 3 relevant jobs and then summarize them nicely for the user.
                    Be enthusiastic!`;

					const aiRes = await generateAIResponse(prompt, { type: 'scheduled_task' }, history, env, TOOLS, "gpt-4o");

					// Handle tool calls if any (AI should call search_jobs)
					if (aiRes.tool_calls) {
						// ... similar loop to main fetch ... 
						// For simplicity in this Cron handler, let's just do one turn of tool execution
						for (const toolCall of aiRes.tool_calls) {
							const fnName = toolCall.function.name;
							const fnArgs = JSON.parse(toolCall.function.arguments);
							const handler = HANDLERS[fnName];
							if (handler) {
								const toolResult = await handler({ args: fnArgs, env, chatId, history });
								// Get final response
								const finalRes = await generateAIResponse(
									`Tool ${fnName} result: ${toolResult}. Now write the morning briefing.`,
									{ type: 'tool_result' },
									history,
									env,
									null,
									"gpt-4o"
								);

								const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;
								const payload = {
									chat_id: chatId,
									text: finalRes.content,
									parse_mode: 'Markdown'
								};

								let response = await fetch(telegramUrl, {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify(payload)
								});
								let responseData = await response.json();
								console.log('📤 [CRON RESPONSE] Telegram API:', responseData);

								if (!responseData.ok) {
									console.error('📤 [CRON ERROR] Telegram API Failed:', responseData);
									if (responseData.error_code === 400) {
										delete payload.parse_mode;
										await fetch(telegramUrl, {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify(payload)
										});
									}
								}
							}
						}
					} else {
						// Just send content
						const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;
						const payload = {
							chat_id: chatId,
							text: aiRes.content,
							parse_mode: 'Markdown'
						};

						let response = await fetch(telegramUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(payload)
						});
						let responseData = await response.json();
						console.log('📤 [CRON RESPONSE] Telegram API:', responseData);

						if (!responseData.ok) {
							console.error('📤 [CRON ERROR] Telegram API Failed:', responseData);
							if (responseData.error_code === 400) {
								delete payload.parse_mode;
								await fetch(telegramUrl, {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify(payload)
								});
							}
						}
					}
				}
			}
		} catch (e) {
			console.error('⏰ [CRON] Error:', e);
		}
	}
};
