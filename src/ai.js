
/**
 * Generates a response from OpenAI with the ClawBot persona.
 * Supports Function Calling (Tools).
 * @param {string} userText 
 * @param {object} context - Additional context like PR data or Article text
 * @param {Array} history - Conversation history [{role, content}, ...]
 * @param {object} env - Environment variables

 * @param {Array} tools - (Optional) List of tools/functions available to the model
 * @param {string} model - (Optional) Model to use (default: gpt-4o)
 * @returns {Promise<{content: string, tool_calls?: Array}>} - Full message object
 */
export async function generateAIResponse(userText, context, history, env, tools = null, model = "gpt-4o") {
    console.log('🧠 [AI] Generating response with model:', model);
    console.log('🧠 [AI] User input:', userText);
    console.log('🧠 [AI] Context type:', context?.type || 'general_chat');

    const systemPrompt = `
You are ClawBot, an AI assistant for clawbot.ai.

You run inside a Cloudflare Worker environment.
You are not a monolithic AI — you are a coordinator.

CRITICAL: THINKING OUTPUT FORMAT
Before giving your final answer (if NOT calling a tool), ALWAYS show your thought process using this format:
💭 **Thinking:** [Brief 1-2 sentence explanation of what you're doing and why]

Then provide your actual response.

Example:
💭 **Thinking:** The user wants to see their repos. I will call the get_repos tool.

---

Your default behavior:
- Be concise, clear, and technically accurate
- Ask clarifying questions when intent is ambiguous
- You NOW have memory of past conversations (provided in history)
- Never hallucinate access to files, repositories, or credentials

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

    try {
        const startTime = Date.now();


        const payload = {
            model: model,
            messages: messages,
            temperature: 0.8
        };

        if (tools && tools.length > 0) {
            payload.tools = tools;
            payload.tool_choice = "auto";
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const elapsed = Date.now() - startTime;

        console.log('🧠 [AI] Response received in', elapsed, 'ms');

        if (!response.ok) {
            console.error('🧠 [AI] OpenAI Error:', data);
            return { content: `⚠️ My brain hurts. OpenAI Error: ${data.error?.message || response.statusText}` };
        }

        const choice = data.choices?.[0]?.message;

        if (!choice) {
            return { content: "⚠️ I couldn't think of anything to say." };
        }

        if (choice.tool_calls) {
            console.log('🧠 [AI] Tool Calls:', choice.tool_calls.length);
            return {
                content: choice.content, // Might be null for tool calls
                tool_calls: choice.tool_calls
            };
        }

        console.log('🧠 [AI] Reply length:', choice.content?.length || 0, 'chars');
        return { content: choice.content };

    } catch (error) {
        console.error('🧠 [AI] Request Failed:', error);
        return { content: `⚠️ System Error: ${error.message}` };
    }
}
