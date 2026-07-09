// TTS + audio analysis via OpenRouter/OpenAI
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const os = require("os");

function getClient() {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "HTTP-Referer": "https://mymlogic.com", "X-Title": "S.A.I.D. Cipher" },
  });
}

// For TTS, OpenRouter proxies to OpenAI — use OpenAI directly for /audio/speech
function getOpenAIDirectClient() {
  // OpenRouter TTS endpoint is at /api/v1/audio/speech
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "HTTP-Referer": "https://mymlogic.com", "X-Title": "S.A.I.D. Cipher" },
  });
}

const VOICES = [
  { id: "alloy", name: "Alloy", desc: "Neutral, versatile" },
  { id: "echo", name: "Echo", desc: "Male, smooth" },
  { id: "fable", name: "Fable", desc: "Warm, expressive" },
  { id: "onyx", name: "Onyx", desc: "Deep, authoritative" },
  { id: "nova", name: "Nova", desc: "Female, friendly" },
  { id: "shimmer", name: "Shimmer", desc: "Female, clear" },
];

async function textToSpeech(text, options = {}) {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No API key configured.");

  const voice = options.voice || "nova";
  const model = "openai/tts-1";

  // Use fetch directly — OpenRouter TTS endpoint
  const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://mymlogic.com",
      "X-Title": "S.A.I.D. Cipher",
    },
    body: JSON.stringify({ model, input: text, voice }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error("TTS failed: " + err);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const tmpFile = path.join(os.tmpdir(), "cipher-tts-" + Date.now() + ".mp3");
  fs.writeFileSync(tmpFile, buffer);
  return { path: tmpFile, base64: buffer.toString("base64"), mimeType: "audio/mpeg" };
}

async function analyzeAudio(base64Audio, prompt = "Analyze this audio", mimeType = "audio/mp3") {
  const client = getClient();
  if (!client) throw new Error("No API key configured.");

  const response = await client.chat.completions.create({
    model: "openai/gpt-4o-audio-preview",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "input_audio", input_audio: { data: base64Audio, format: mimeType.replace("audio/", "") } },
      ],
    }],
  });

  return response.choices[0].message.content;
}

async function transcribeAudio(base64Audio, mimeType = "audio/mp3") {
  // Use Whisper via direct fetch to OpenRouter
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No API key configured.");

  // Write temp file then transcribe
  const ext = mimeType.replace("audio/", "") || "mp3";
  const tmpFile = path.join(os.tmpdir(), "cipher-audio-" + Date.now() + "." + ext);
  fs.writeFileSync(tmpFile, Buffer.from(base64Audio, "base64"));

  const FormData = require("form-data");
  const form = new FormData();
  form.append("file", fs.createReadStream(tmpFile), { filename: "audio." + ext, contentType: mimeType });
  form.append("model", "openai/whisper-large-v3");

  const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, ...form.getHeaders() },
    body: form,
  });

  fs.unlinkSync(tmpFile);
  if (!response.ok) throw new Error("Transcription failed: " + await response.text());
  const result = await response.json();
  return result.text || result.transcript || "";
}

module.exports = { textToSpeech, analyzeAudio, transcribeAudio, VOICES };
