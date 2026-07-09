// OpenRouter provider for S.A.I.D. Cipher
// Uses OpenAI-compatible API via OpenRouter
const OpenAI = require("openai");

let client = null;

function getClient() {
  if (!client) {
    const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) return null;
    client = new OpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://mymlogic.com",
        "X-Title": "S.A.I.D. Cipher",
      },
    });
  }
  return client;
}

async function chat(messages, options = {}) {
  const c = getClient();
  if (!c) throw new Error("No API key found. Set OPENROUTER_API_KEY in your environment.");
  const response = await c.chat.completions.create({
    model: options.model || "openai/gpt-4o",
    messages,
    temperature: options.temperature ?? 0.7,
  });
  return response.choices[0].message.content;
}

async function streamChat(messages, onChunk, options = {}) {
  const c = getClient();
  if (!c) throw new Error("No API key found. Set OPENROUTER_API_KEY in your environment.");
  const stream = await c.chat.completions.create({
    model: options.model || "openai/gpt-4o",
    messages,
    stream: true,
    temperature: options.temperature ?? 0.7,
  });
  let full = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) { full += text; onChunk(text); }
  }
  return full;
}

module.exports = { provider: { chat, streamChat } };
