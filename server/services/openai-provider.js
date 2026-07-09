// OpenRouter provider for S.A.I.D. Cipher
// Direct HTTP POST, no SDK
// WITH GENERATION TOOLS
const fs = require("fs");
const path = require("path");

let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;
  
  // First try process.env (already loaded by main.js)
  if (process.env.OPEN_ROUTER_API_KEY) {
    cachedKey = process.env.OPEN_ROUTER_API_KEY.trim();
    console.log("[OpenRouter] Key loaded from environment");
    return cachedKey;
  }
  
  // Fallback: read .env file directly
  try {
    const envPath = path.join(__dirname, "../../.env");
    const content = fs.readFileSync(envPath, "utf8");
    const line = content.split("\n").find(l => l.includes("OPEN_ROUTER_API_KEY="));
    if (line) {
      cachedKey = line.split("=")[1].trim();
      console.log("[OpenRouter] Key loaded from .env file");
      return cachedKey;
    }
  } catch(e) {
    console.error("[OpenRouter] Failed to load key:", e.message);
  }
  return null;
}

const DEFAULT_MODEL = "google/gemma-3-12b-it";
const APPCABANA_URL = "https://the-app-cabana-production.up.railway.app";

async function openrouterRequest(messages, model, stream = false) {
  const key = loadKey();
  if (!key) throw new Error("No API key found.");
  
  const body = {
    model,
    messages,
    temperature: 0.7,
    stream,
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": "https://mymlogic.com",
      "X-Title": "S.A.I.D. Cipher",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${error}`);
  }

  return response;
}

async function chat(messages, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  console.log("[OpenRouter] Chat:", model);
  
  const response = await openrouterRequest(messages, model, false);
  const data = await response.json();
  
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

async function streamChat(messages, onChunk, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  console.log("[OpenRouter] Stream:", model);
  
  const response = await openrouterRequest(messages, model, true);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split("\n").filter(l => l.trim());

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const json = line.slice(6);
        if (json === "[DONE]") continue;
        try {
          const msg = JSON.parse(json);
          const chunk = msg.choices?.[0]?.delta?.content || "";
          if (chunk) {
            full += chunk;
            onChunk(chunk);
          }
        } catch(e) {}
      }
    }
  }

  return full;
}

// Generation tools for Cipher
async function generateAudio(text, rate = 150) {
  console.log("[Cipher] Generating audio from text:", text.substring(0, 50));
  try {
    const response = await fetch(APPCABANA_URL + "/api/generate-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, rate }),
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  } catch (err) {
    console.error("[Cipher] Audio generation failed:", err.message);
    throw err;
  }
}

async function generateImage(prompt, width = 512, height = 512) {
  console.log("[Cipher] Generating image from prompt:", prompt.substring(0, 50));
  try {
    const response = await fetch(APPCABANA_URL + "/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, width, height }),
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  } catch (err) {
    console.error("[Cipher] Image generation failed:", err.message);
    throw err;
  }
}

async function analyzeAudio(filename) {
  console.log("[Cipher] Analyzing audio:", filename);
  try {
    const response = await fetch(APPCABANA_URL + "/api/analyze-audio/" + filename);
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
  } catch (err) {
    console.error("[Cipher] Audio analysis failed:", err.message);
    throw err;
  }
}

module.exports = { 
  provider: { chat, streamChat },
  tools: { generateAudio, generateImage, analyzeAudio }
};
