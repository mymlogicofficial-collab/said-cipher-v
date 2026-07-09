const express = require("express");
const cors = require("cors");
const path = require("path");

const filesRouter = require("./routes/files");
const chatRouter = require("./routes/chat");
const systemRouter = require("./routes/system");
const cradle = require("./services/ai-cradle");
const { provider: openaiProvider } = require("./services/openai-provider");

cradle.registerProvider("openai", openaiProvider);

function createServer(port = 9471) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  app.use("/api/files", filesRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/system", systemRouter);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1", () => {
      console.log("[SERVER] API running on http://127.0.0.1:" + port);
      resolve(server);
    });
    server.on("error", reject);
  });
}

module.exports = { createServer };
