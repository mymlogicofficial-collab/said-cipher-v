const OpenAI = require("openai");

// OpenRouter API compatible with OpenAI SDK
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.io/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://mymlogic.com",
    "X-Title": "S.A.I.D. Cipher",
  },
});

const provider = {
  name: "openrouter",
  capabilities: ["chat", "image-generation", "audio-transcription", "image-analysis", "text-to-speech"],

  async chat(messages, options = {}) {
    // Default to Claude 3.5 Sonnet on OpenRouter (excellent quality/cost ratio)
    const model = options.model || "anthropic/claude-3.5-sonnet";
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await openai.chat.completions.create({
      model,
      messages: formattedMessages,
      max_tokens: options.maxTokens || 4096,
    });

    return {
      content: response.choices[0]?.message?.content || "",
      model: response.model,
      usage: response.usage,
    };
  },

  async generateImage(prompt, options = {}) {
    // OpenRouter doesn't have native image generation, fallback to DALL-E via OpenAI
    // For production, consider using a dedicated image service or OpenRouter's available models
    if (!process.env.OPENAI_API_KEY) {
      return {
        error: true,
        message: "Image generation requires OPENAI_API_KEY. Set it in environment variables.",
      };
    }

    const openaiDirect = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openaiDirect.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: options.size || "1024x1024",
    });

    const imageData = response.data[0];
    return {
      b64_json: imageData.b64_json || null,
      url: imageData.url || null,
    };
  },

  async transcribeAudio(audioBuffer, options = {}) {
    // OpenRouter doesn't have audio transcription, use OpenAI's Whisper
    if (!process.env.OPENAI_API_KEY) {
      return {
        error: true,
        message: "Audio transcription requires OPENAI_API_KEY. Set it in environment variables.",
      };
    }

    const openaiDirect = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { toFile } = require("openai");
    const file = await toFile(audioBuffer, "audio.wav");
    const response = await openaiDirect.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return { text: response.text };
  },

  async analyzeImage(imageBuffer, prompt, options = {}) {
    // Use Claude 3.5 Sonnet on OpenRouter for image analysis (excellent vision capabilities)
    const base64 = imageBuffer.toString("base64");
    const response = await openai.chat.completions.create({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });
    return { content: response.choices[0]?.message?.content || "" };
  },

  async textToSpeech(text, options = {}) {
    // OpenRouter doesn't have TTS, use OpenAI's TTS
    if (!process.env.OPENAI_API_KEY) {
      return {
        error: true,
        message: "Text-to-speech requires OPENAI_API_KEY. Set it in environment variables.",
      };
    }

    const openaiDirect = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const voice = options.voice || "alloy";
    const model = options.model || "tts-1";
    const speed = options.speed || 1.0;

    const response = await openaiDirect.audio.speech.create({
      model,
      voice,
      input: text,
      speed,
    });

    // Convert response to base64 for JSON transport
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      audio_base64: base64,
      format: "mp3",
      voice,
      model,
    };
  },
};

module.exports = { provider, openai };

