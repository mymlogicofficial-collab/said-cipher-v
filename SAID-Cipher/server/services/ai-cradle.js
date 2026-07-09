const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../../core/config.json");

class AICradle {
  constructor() {
    this.providers = {};
    this.activeProvider = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      this.activeProvider = config.ai.defaultProvider;
    } catch (e) {
      this.activeProvider = null;
    }
  }

  registerProvider(name, handler) {
    this.providers[name] = handler;
  }

  getProvider(name) {
    return this.providers[name || this.activeProvider] || null;
  }

  listProviders() {
    return Object.keys(this.providers).map((name) => ({
      name,
      active: name === this.activeProvider,
      capabilities: this.providers[name].capabilities || [],
    }));
  }

  setActive(name) {
    if (!this.providers[name]) {
      throw new Error("Provider not registered: " + name);
    }
    this.activeProvider = name;
  }

  async chat(messages, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider) {
      return {
        error: true,
        message: "No AI provider configured. Add an API key to enable AI capabilities.",
      };
    }
    return provider.chat(messages, options);
  }

  async generateImage(prompt, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider || !provider.generateImage) {
      return {
        error: true,
        message: "No image generation provider configured.",
      };
    }
    return provider.generateImage(prompt, options);
  }

  async transcribeAudio(audioBuffer, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider || !provider.transcribeAudio) {
      return {
        error: true,
        message: "No audio transcription provider configured.",
      };
    }
    return provider.transcribeAudio(audioBuffer, options);
  }

  async analyzeImage(imageBuffer, prompt, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider || !provider.analyzeImage) {
      return {
        error: true,
        message: "No image analysis provider configured.",
      };
    }
    return provider.analyzeImage(imageBuffer, prompt, options);
  }

  async textToSpeech(text, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider || !provider.textToSpeech) {
      return {
        error: true,
        message: "No text-to-speech provider configured.",
      };
    }
    return provider.textToSpeech(text, options);
  }
}

const cradle = new AICradle();

module.exports = cradle;

