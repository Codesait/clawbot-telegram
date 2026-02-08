
import { generateAIResponse } from './ai.js';
import { fetchPR, parseGitHubPRUrl } from './github.js';
import { fetchArticle } from './article.js';
import { browsePage } from './browser.js';
import { parseCommand, isValidUrl, extractUrl } from './utils.js';

const MAX_HISTORY = 10; // Keep last 10 messages (5 user + 5 assistant)

/**
 * Gets chat history from KV
 * @param {string} chatId 
 * @param {object} env 
 * @returns {Promise<Array>}
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
 * @param {string} chatId 
 * @param {Array} history 
 * @param {object} env 
 */
async function saveChatHistory(chatId, history, env) {
	try {
		// Keep only last MAX_HISTORY messages
		const trimmedHistory = history.slice(-MAX_HISTORY);
		await env.CHAT_HISTORY.put(`chat:${chatId}`, JSON.stringify(trimmedHistory), {
			expirationTtl: 60 * 60 * 24 * 7 // Keep for 7 days
		});
	} catch (e) {
		console.error('Error saving chat history:', e);
	}
}

export default {
	async fetch(request, env) {
		// Handle only POST requests from Telegram
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
		const { command, args } = parseCommand(text);

		// === Dev Logging ===
		console.log('📥 [REQUEST] Chat ID:', chatId);
		console.log('📥 [REQUEST] Text:', text);
		console.log('📥 [REQUEST] Command:', command || 'none');
		console.log('📥 [REQUEST] Args:', args);

		let replyText = "";
		let context = {};
		let history = [];

		// Get existing chat history
		history = await getChatHistory(chatId, env);
		console.log('📜 [HISTORY] Loaded', history.length, 'messages');

		try {
			// === Command Handling ===
			if (command === 'start') {
				console.log('🚀 [CMD] /start - Clearing history');
				replyText = "Hello! I am Melasin. I'm a bit crazy, strict about my values, and ready to help! Send me a PR or article to review, or just chat.";
				// Clear history on /start for a fresh conversation
				history = [];
			}

			else if (command === 'clear') {
				// Clear conversation history
				history = [];
				replyText = "🧹 Memory cleared! Fresh start.";
			}

			else if (command === 'browse') {
				// Use browser rendering to fetch a page
				console.log('🌐 [CMD] /browse - Using browser');
				const url = args[0];
				if (!url || !isValidUrl(url)) {
					replyText = "Please provide a valid URL. Example: /browse https://example.com";
				} else {
					const pageData = await browsePage(url, env);

					// Check if browser failed
					if (pageData.error) {
						console.log('🌐 [BROWSER] Failed, falling back to fast fetch');
						// Fallback to fast fetch
						const fallbackText = await fetchArticle(url);
						if (fallbackText.startsWith('Failed') || fallbackText.startsWith('Error')) {
							replyText = `⚠️ Couldn't load the page. The site might be blocking bots or too slow.\n\nError: ${pageData.text}`;
						} else {
							context = {
								type: 'article_review',
								content: fallbackText,
								url: url,
								note: 'Fetched with fast method (browser timed out)'
							};
							replyText = await generateAIResponse(`I fetched this page: ${url}. Analyze the content.`, context, history, env);
						}
					} else {
						context = {
							type: 'browser_page',
							title: pageData.title,
							content: pageData.text,
							url: pageData.url
						};
						replyText = await generateAIResponse(`I browsed this page with a real browser: ${url}. The page title is "${pageData.title}". Analyze the content.`, context, history, env);
					}
				}
			}

			else if (command === 'pr') {
				const url = args[0];
				if (!url || !isValidUrl(url)) {
					replyText = "Please provide a valid GitHub PR URL. Example: /pr https://github.com/owner/repo/pull/123";
				} else {
					const prInfo = parseGitHubPRUrl(url);
					if (prInfo) {
						const prData = await fetchPR(prInfo.owner, prInfo.repo, prInfo.pullNumber, env.GITHUB_TOKEN);
						context = { type: 'pr_review', content: prData };
						replyText = await generateAIResponse("Please review this PR. Be critical but helpful.", context, history, env);
					} else {
						replyText = "Invalid GitHub PR URL format.";
					}
				}
			}

			else if (command === 'review') {
				const url = args[0];
				if (!url || !isValidUrl(url)) {
					replyText = "Please provide a valid article URL.";
				} else {
					const articleText = await fetchArticle(url);
					context = { type: 'article_review', content: articleText };
					replyText = await generateAIResponse("Review this article. Summarize it and give your unique take.", context, history, env);
				}
			}

			else {
				// === General Chat ===
				// Check if there's a URL in the message and fetch it if so
				const detectedUrl = extractUrl(text);
				if (detectedUrl) {
					// Check if it's a GitHub PR
					const prInfo = parseGitHubPRUrl(detectedUrl);
					if (prInfo) {
						const prData = await fetchPR(prInfo.owner, prInfo.repo, prInfo.pullNumber, env.GITHUB_TOKEN);
						context = { type: 'pr_review', content: prData };
						replyText = await generateAIResponse(`The user sent a PR link: ${detectedUrl}. Review it.`, context, history, env);
					} else {
						// Assume it's an article/page
						const articleText = await fetchArticle(detectedUrl);
						context = { type: 'article_review', content: articleText };
						replyText = await generateAIResponse(`The user sent a link: ${detectedUrl}. Analyze the content provided in context.`, context, history, env);
					}
				} else {
					replyText = await generateAIResponse(text, null, history, env);
				}
			}

			// Update history with user message and assistant response
			if (command !== 'clear') {
				history.push({ role: 'user', content: text });
				history.push({ role: 'assistant', content: replyText });
			}

		} catch (error) {
			console.error("Handler Error:", error);
			replyText = "⚠️ I crashed! Something went wrong.";
		}

		// Save updated history
		await saveChatHistory(chatId, history, env);

		// === Reply to Telegram ===
		await fetch(
			`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: chatId,
					text: replyText
				})
			}
		);

		return new Response("OK");
	}
};
