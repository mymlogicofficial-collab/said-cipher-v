// Standalone server for Railway deployment
// Cipher backend API server

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const filesRouter = require("./SAID-Cipher/server/routes/files");
const chatRouter = require("./SAID-Cipher/server/routes/chat");
const systemRouter = require("./SAID-Cipher/server/routes/system");
const cradle = require("./SAID-Cipher/server/services/ai-cradle");
const { provider: openaiProvider } = require("./SAID-Cipher/server/services/openai-provider");

cradle.registerProvider("openai", openaiProvider);

const app = express();
const PORT = process.env.PORT || 9471;

app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "cipher-backend" });
});

// API routes
app.use("/api/files", filesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/system", systemRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[CIPHER] Backend running on http://0.0.0.0:${PORT}`);
  console.log(`[CIPHER] Health check: http://0.0.0.0:${PORT}/health`);
});

