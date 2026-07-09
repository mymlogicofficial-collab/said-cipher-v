// AI Cradle — provider registry for S.A.I.D. Cipher
// Supports dynamic provider switching (Ollama local / OpenAI cloud)

const providers = {};
let defaultProvider = null;

function registerProvider(name, provider) {
  providers[name] = provider;
  if (!defaultProvider) defaultProvider = name; // first registered = default
  console.log("[Cradle] Registered provider:", name);
}

function setDefaultProvider(name) {
  if (providers[name]) {
    defaultProvider = name;
  } else {
    console.warn("[Cradle] Cannot set default — provider not registered:", name);
  }
}

function getDefaultProvider() {
  return defaultProvider;
}

function getProvider(name) {
  return providers[name] || null;
}

function listProviders() {
  return Object.keys(providers).map((name) => ({
    name,
    active: name === defaultProvider,
  }));
}

async function chat(messages, options = {}) {
  const providerName = options.provider || defaultProvider || Object.keys(providers)[0];
  const provider = providers[providerName];
  if (!provider) throw new Error("No AI provider available. Configure Ollama or set an API key in settings.");
  return provider.chat(messages, options);
}

async function streamChat(messages, onChunk, options = {}) {
  const providerName = options.provider || defaultProvider || Object.keys(providers)[0];
  const provider = providers[providerName];
  if (!provider) throw new Error("No AI provider available. Configure Ollama or set an API key in settings.");
  if (provider.streamChat) return provider.streamChat(messages, onChunk, options);
  // fallback: non-streaming
  const result = await provider.chat(messages, options);
  onChunk(result);
  return result;
}

module.exports = { registerProvider, setDefaultProvider, getDefaultProvider, getProvider, listProviders, chat, streamChat };
