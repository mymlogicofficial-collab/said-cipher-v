const express = require("express");
const cors = require("cors");
const path = require("path");

const filesRouter  = require("./routes/files");
const chatRouter   = require("./routes/chat");
const systemRouter = require("./routes/system");
const mediaRouter  = require("./routes/media");
const { router: adminRouter } = require("./routes/admin");
const cradle       = require("./services/ai-cradle");
const { provider: openaiProvider }  = require("./services/openai-provider");
const { provider: ollamaProvider, ping: ollamaPing, getConfig: ollamaConfig } = require("./services/ollama-provider");

// ── Register providers ────────────────────────────────────────────────────────
cradle.registerProvider("openai", openaiProvider);
cradle.registerProvider("ollama", ollamaProvider);

// Auto-detect engine on startup — prefer local if Ollama is alive
async function detectEngine() {
  const status = await ollamaPing();
  if (status.ok) {
    cradle.setDefaultProvider("ollama");
    const cfg = ollamaConfig();
    console.log(`[Cradle] Ollama detected ✓ — model: ${cfg.model}, models available: ${status.models.join(", ") || "none"}`);
  } else {
    cradle.setDefaultProvider("openai");
    console.log("[Cradle] Ollama not found — defaulting to OpenRouter/OpenAI");
  }
}

function createServer(port = 9471) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // ── Health check endpoint ────────────────────────────────────────────────
  app.get("/health", (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/files",  filesRouter);
  app.use("/api/chat",   chatRouter);
  app.use("/api/system", systemRouter);
  app.use("/api/media",  mediaRouter);
  app.use("/api/admin",  adminRouter);

  // ── Engine status endpoint ────────────────────────────────────────────────
  app.get("/api/engine/status", async (req, res) => {
    const ollama = await ollamaPing();
    const cfg = ollamaConfig();
    res.json({
      activeProvider: cradle.getDefaultProvider(),
      ollama: { available: ollama.ok, host: cfg.host, port: cfg.port, model: cfg.model, models: ollama.models },
      openai: { available: !!(process.env.OPEN_ROUTER_API_KEY || process.env.OPENAI_API_KEY) },
    });
  });

  // ── Engine switch endpoint ────────────────────────────────────────────────
  app.post("/api/engine/set", (req, res) => {
    const { provider, model } = req.body;
    if (![\"openai\", \"ollama\"].includes(provider)) {
      return res.status(400).json({ error: "Unknown provider" });
    }
    cradle.setDefaultProvider(provider);
    if (model) process.env.OLLAMA_MODEL = model;
    console.log(`[Cradle] Provider switched to: ${provider}${model ? " / " + model : ""}`);
    res.json({ ok: true, activeProvider: provider, model: model || ollamaConfig().model });
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, "0.0.0.0", async () => {
      console.log("[SERVER] API running on http://0.0.0.0:" + port);
      await detectEngine();
      resolve(server);
    });
    server.on("error", reject);
  });
}

module.exports = { createServer };

