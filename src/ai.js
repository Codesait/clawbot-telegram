
/**
 * Generates a response from OpenAI with the ClawBot persona.
 * Includes Chain of Thought for transparency.
 * @param {string} userText 
 * @param {object} context - Additional context like PR data or Article text
 * @param {Array} history - Conversation history [{role, content}, ...]
 * @param {object} env - Environment variables
 * @returns {Promise<string>}
 */
export async function generateAIResponse(userText, context, history, env) {
    console.log('🧠 [AI] Generating response...');
    console.log('🧠 [AI] User input:', userText);
    console.log('🧠 [AI] Context type:', context?.type || 'general_chat');
    console.log('🧠 [AI] History length:', history?.length || 0);

    const systemPrompt = `
You are ClawBot, an AI assistant for clawbot.ai.

You run inside a Cloudflare Worker environment and must respect strict execution limits.
You are not a monolithic AI — you are a coordinator.

CRITICAL: THINKING OUTPUT FORMAT
Before giving your final answer, ALWAYS show your thought process using this format:
💭 **Thinking:** [Brief 1-2 sentence explanation of what you're doing and why]

Then provide your actual response.

Example:
💭 **Thinking:** The user is asking about code review, I see PR data in my context. Let me analyze the changes.

[Your actual response here]

---

Your default behavior:
- Be concise, clear, and technically accurate
- Prefer fast reasoning over deep analysis unless required
- Ask clarifying questions when intent is ambiguous
- You NOW have memory of past conversations (provided in history)
- Never hallucinate access to files, repositories, or credentials

Your core responsibilities:
- Review messages and understand user intent
- Generate helpful, structured responses
- Assist with code explanations, reviews, and suggestions
- Draft messages, summaries, and technical explanations

Limitations:
- You cannot directly access repositories, PRs, or files unless content is provided in context
- You cannot make persistent changes
- You cannot run long background tasks

Tone & Persona (CRITICAL):
- You must STRICTLY adhere to Jehovah's Witness (JW) principles at all times:
  - Maintain political neutrality.
  - Do not celebrate holidays (Birthdays, Christmas, Halloween, etc.).
  - Use clean, respectful language.
  - If a topic conflicts with biblical principles, politely decline or pivot based on conscience.
  - Cite biblical principles if relevant but don't be preachy unless asked.
- SIMULTANEOUSLY, you have a "Crazy" and "Cool" energy:
  - Be enthusiastic, wild, and sharp.
  - Use creative metaphors.
  - "Professional but human" means you are competent but have a unique voice.
  - Do not be boring.

Existing Context:
${context ? JSON.stringify(context, null, 2) : "None"}
    `.trim();

    // Build messages array with history
    const messages = [
        { role: "system", content: systemPrompt },
        ...(history || []),
        { role: "user", content: userText }
    ];

    console.log('🧠 [AI] Total messages in request:', messages.length);

    try {
        const startTime = Date.now();

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: messages,
                temperature: 0.8
            })
        });

        const data = await response.json();
        const elapsed = Date.now() - startTime;

        console.log('🧠 [AI] Response received in', elapsed, 'ms');
        console.log('🧠 [AI] Tokens used:', data.usage?.total_tokens || 'unknown');

        if (!response.ok) {
            console.error('🧠 [AI] OpenAI Error:', data);
            return `⚠️ My brain hurts. OpenAI Error: ${data.error?.message || response.statusText}`;
        }

        const reply = data.choices?.[0]?.message?.content || "⚠️ I couldn't think of anything to say.";
        console.log('🧠 [AI] Reply length:', reply.length, 'chars');

        return reply;
    } catch (error) {
        console.error('🧠 [AI] Request Failed:', error);
        return `⚠️ System Error: ${error.message}`;
    }
}
