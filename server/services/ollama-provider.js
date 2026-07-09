// Ollama Provider — S.A.I.D. Cipher
// Runs 100% locally. No API key. No data leaves the machine.
// Requires Ollama running: https://ollama.com

const http = require("http");
const https = require("https");

function getConfig() {
  return {
    host: process.env.OLLAMA_HOST || "127.0.0.1",
    port: parseInt(process.env.OLLAMA_PORT || "11434", 10),
    model: process.env.OLLAMA_MODEL || "gemma3:12b",
  };
}

// Low-level fetch — no external deps, uses Node built-ins only
function ollamaRequest(path, body, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const cfg = getConfig();
    const payload = JSON.stringify(body);
    const isHttps = cfg.host.startsWith("https://");
    const cleanHost = cfg.host.replace(/^https?:\/\//, "");
    const lib = isHttps ? https : http;

    const req = lib.request(
      { hostname: cleanHost, port: cfg.port, path, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error("Ollama parse error: " + data)); }
        });
      }
    );
    req.on("error", (e) => reject(new Error("Ollama connection failed: " + e.message + " — is Ollama running? (ollama serve)")));
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("Ollama timeout after " + timeoutMs + "ms — model may be running on CPU only")); });
    req.write(payload);
    req.end();
  });
}

function ollamaStreamRequest(path, body, onChunk) {
  return new Promise((resolve, reject) => {
    const cfg = getConfig();
    const payload = JSON.stringify({ ...body, stream: true });
    const isHttps = cfg.host.startsWith("https://");
    const cleanHost = cfg.host.replace(/^https?:\/\//, "");
    const lib = isHttps ? https : http;

    const req = lib.request(
      { hostname: cleanHost, port: cfg.port, path, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => {
        let full = "";
        res.on("data", (chunk) => {
          const lines = chunk.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              const token = parsed?.message?.content || "";
              if (token) { full += token; onChunk(token); }
              if (parsed.done) resolve(full);
            } catch {}
          }
        });
        res.on("end", () => resolve(full));
      }
    );
    req.on("error", (e) => reject(new Error("Ollama stream failed: " + e.message)));
    req.write(payload);
    req.end();
  });
}

async function ping() {
  const cfg = getConfig();
  return new Promise((resolve) => {
    const cleanHost = cfg.host.replace(/^https?:\/\//, "");
    const req = http.request(
      { hostname: cleanHost, port: cfg.port, path: "/api/tags", method: "GET" },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve({ ok: true, models: JSON.parse(data).models?.map(m => m.name) || [] }); }
          catch { resolve({ ok: false, models: [] }); }
        });
      }
    );
    req.on("error", () => resolve({ ok: false, models: [] }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ ok: false, models: [] }); });
    req.end();
  });
}

async function chat(messages, options = {}) {
  const cfg = getConfig();
  const model = options.model || cfg.model;
  const result = await ollamaRequest("/api/chat", {
    model,
    stream: false,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    options: {
      num_predict: options.num_predict || 512,
      temperature: options.temperature || 0.7,
    }
  }, options.timeoutMs || 90000);
  if (result.error) throw new Error("Ollama error: " + result.error);
  return result.message?.content || "";
}

async function streamChat(messages, onChunk, options = {}) {
  const cfg = getConfig();
  const model = options.model || cfg.model;
  return ollamaStreamRequest("/api/chat", {
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  }, onChunk);
}

module.exports = { provider: { chat, streamChat }, ping, getConfig };
