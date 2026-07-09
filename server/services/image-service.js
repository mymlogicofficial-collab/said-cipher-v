// Image generation via OpenRouter
const OpenAI = require("openai");

function getClient() {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "HTTP-Referer": "https://mymlogic.com", "X-Title": "S.A.I.D. Cipher" },
  });
}

const IMAGE_MODELS = [
  { id: "black-forest-labs/flux-1.1-pro", name: "FLUX 1.1 Pro", quality: "High quality" },
  { id: "black-forest-labs/flux-1.1-pro:free", name: "FLUX 1.1 Pro (Free)", quality: "Free tier" },
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)", quality: "Fast + free" },
  { id: "openai/dall-e-3", name: "DALL-E 3", quality: "OpenAI premium" },
];

async function generateImage(prompt, options = {}) {
  const client = getClient();
  if (!client) throw new Error("No API key configured.");

  const model = options.model || "black-forest-labs/flux-1.1-pro:free";

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
  });

  const msg = response.choices[0].message;
  const images = msg.images || [];
  const text = msg.content || "";

  return { images, text, model };
}

module.exports = { generateImage, IMAGE_MODELS };
