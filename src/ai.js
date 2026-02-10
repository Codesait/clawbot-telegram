
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

    // Handle Audio Transcription if voice note
    if (context?.file?.type === 'voice') {
        try {
            console.log('🧠 [AI] Transcribing audio...');
            const transcript = await transcribeAudio(context.file.file_id, env);
            console.log('🧠 [AI] Transcription:', transcript);
            userText = `[Voice Note Transcription]: ${transcript}`;
            // If the user didn't provide text (just voice), update it.
            // If they provided a caption, we append.
        } catch (e) {
            console.error('🧠 [AI] Transcription failed:', e);
            userText += "\n[System: Voice transcription failed]";
        }
    }


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
        ...(history || [])
    ];

    // Handle Image Input (Vision)
    if (context?.file?.type === 'image') {
        // We need to get the image URL. In Telegram bot API, we usually need to get file_path first then construct URL.
        // However, for this environment, we might need a helper to get the direct URL.
        // Assuming we have a helper or can get it. 
        // For now, let's assume we can get the URL via a helper we need to implement or just pass a placeholder if we can't download yet.

        // REALITY CHECK: Telegram Bot API requires getting file_path.
        // We can't easily get the URL without an extra API call.
        // I'll add a helper `getFileUrl(fileId, env)` in utils, but for now let's assume we have the logic here or skip if too complex for single file.
        // Let's implement the logic to fetch file path here as it's AI specific preparation.

        const fileUrl = await getTelegramFileUrl(context.file.file_id, env);

        messages.push({
            role: "user",
            content: [
                { type: "text", text: userText || "What is in this image?" },
                {
                    type: "image_url",
                    image_url: {
                        "url": fileUrl
                    }
                }
            ]
        });
    } else {
        messages.push({ role: "user", content: userText });
    }


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

/**
 * Transcribes audio using OpenAI Whisper
 */
async function transcribeAudio(fileId, env) {
    // 1. Get file path from Telegram
    const fileUrl = await getTelegramFileUrl(fileId, env);

    // 2. Download audio file
    const audioRes = await fetch(fileUrl);
    const audioBlob = await audioRes.blob();

    // 3. Send to OpenAI Whisper
    const formData = new FormData();
    formData.append("file", audioBlob, "voice.ogg");
    formData.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
        },
        body: formData
    });

    const data = await response.json();
    return data.text || "Transcription failed";
}

/**
 * Gets the direct download URL for a Telegram file
 */
async function getTelegramFileUrl(fileId, env) {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const data = await response.json();

    if (data.ok) {
        return `https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${data.result.file_path}`;
    }
    throw new Error("Could not get file path from Telegram");
}
