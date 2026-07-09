const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const provider = {
  name: "openai",
  capabilities: ["chat", "image-generation", "audio-transcription", "image-analysis"],

  async chat(messages, options = {}) {
    const model = options.model || "gpt-4o";
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
    const response = await openai.images.generate({
      model: "gpt-image-1",
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
    const { toFile } = require("openai");
    const file = await toFile(audioBuffer, "audio.wav");
    const response = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });
    return { text: response.text };
  },

  async analyzeImage(imageBuffer, prompt, options = {}) {
    const base64 = imageBuffer.toString("base64");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64," + base64 },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });
    return { content: response.choices[0]?.message?.content || "" };
  },
};

module.exports = { provider, openai };
