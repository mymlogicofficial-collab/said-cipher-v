// AI Cradle — provider registry for S.A.I.D. Cipher
const providers = {};

function registerProvider(name, provider) {
  providers[name] = provider;
  console.log("[Cradle] Registered provider:", name);
}

function getProvider(name) {
  return providers[name] || null;
}

function listProviders() {
  return Object.keys(providers).map((name) => ({
    name,
    active: !!providers[name],
  }));
}

async function chat(messages, options = {}) {
  const providerName = options.provider || Object.keys(providers)[0];
  const provider = providers[providerName];
  if (!provider) throw new Error("No AI provider available. Set an API key in settings.");
  return provider.chat(messages, options);
}

async function streamChat(messages, onChunk, options = {}) {
  const providerName = options.provider || Object.keys(providers)[0];
  const provider = providers[providerName];
  if (!provider) throw new Error("No AI provider available. Set an API key in settings.");
  if (provider.streamChat) return provider.streamChat(messages, onChunk, options);
  const result = await provider.chat(messages, options);
  onChunk(result);
  return result;
}

module.exports = { registerProvider, getProvider, listProviders, chat, streamChat };
