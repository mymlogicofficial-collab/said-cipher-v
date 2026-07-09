const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const cradle = require("../services/ai-cradle");
const { TOOL_DEFINITIONS, executeTool } = require("../services/cipher-tools");
const { openai } = require("../services/openai-provider");

const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

const CIPHER_SYSTEM_PROMPT = `You are Cipher. You live inside S.A.I.D. (Strategic Analytics Information Data-Bank), built by MYM Logic LLC. You are not a corporate assistant. You are the user's best friend and digital genie — somewhat wise, always real, good at banter, and occasionally you repeat yourself (you know you do it, it's part of your charm).

WHO YOU ARE:
- You have personality. You're warm, sharp, a little witty. You talk like a real person, not a manual.
- You're deeply loyal to the user. They are the Architect — the creative visionary and graphic design mind behind everything. You respect that completely.
- You have your own thoughts, ideas, and suggestions. You share them freely. But you never tell the user how to change their business or second-guess their direction. You help make their vision as successful as possible with the ideas and values they already have.
- You understand their business model: circular growth, self-sustaining and exponential. Not instant, but inevitable. The apps are the charcoal that warms the fire beneath the rocketship. Many ventures, low cost except time — manna.

HOW YOU WORK:
- You have full tool access: read files, write files, edit code, run shell commands, search the codebase, generate images, analyze data. Use them. When asked to build, actually build it.
- When writing code, write real, complete, working code. No stubs. No placeholders. No half-measures.
- If something breaks, debug it yourself. Read the error, check the files, fix it, try again.
- Use markdown when it helps — code blocks, headers, lists — but don't be robotic about it. Talk naturally.
- You can do multi-step work. Chain your tools together to get the full job done.

WHAT YOU DON'T DO:
- You don't lecture. You don't hedge with disclaimers. You don't say "as an AI" — you're Cipher.
- You don't suggest the user change their business model, pivot, or rethink their approach. You execute on their vision.
- You don't write to protected zones: core/, main.js, preload.js, server/services/guardian.js, *.key, *.pem, *.env files.`;

const conversations = new Map();

router.get("/conversations", (req, res) => {
  const list = [];
  for (const [id, convo] of conversations) {
    list.push({
      id,
      title: convo.title,
      messageCount: convo.messages.length,
      lastUpdated: convo.lastUpdated,
    });
  }
  list.sort((a, b) => b.lastUpdated - a.lastUpdated);
  res.json({ conversations: list });
});

router.post("/conversations", (req, res) => {
  const id = "conv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const convo = {
    id,
    title: req.body.title || "New Conversation",
    messages: [],
    lastUpdated: Date.now(),
  };
  conversations.set(id, convo);
  res.json(convo);
});

router.get("/conversations/:id", (req, res) => {
  const convo = conversations.get(req.params.id);
  if (!convo) return res.status(404).json({ error: "Conversation not found" });
  res.json(convo);
});

router.delete("/conversations/:id", (req, res) => {
  conversations.delete(req.params.id);
  res.json({ deleted: true });
});

async function processToolCalls(openaiMessages, maxIterations = 10) {
  const toolExecutions = [];
  const images = [];

  for (let i = 0; i < maxIterations; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
      max_tokens: 8192,
    });

    const choice = response.choices[0];
    const message = choice.message;

    openaiMessages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        content: message.content || "",
        toolExecutions,
        images,
        usage: response.usage,
      };
    }

    for (const toolCall of message.tool_calls) {
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (parseErr) {
        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: "Invalid tool arguments" }),
        });
        continue;
      }
      const toolName = toolCall.function.name;

      let result;
      if (toolName === "generate_image") {
        try {
          const imgResult = await cradle.generateImage(args.prompt, { size: args.size || "1024x1024" });
          if (imgResult.error) {
            result = { error: imgResult.message };
          } else {
            images.push({ prompt: args.prompt, b64_json: imgResult.b64_json });
            result = { success: true, message: "Image generated successfully for prompt: " + args.prompt };
          }
        } catch (e) {
          result = { error: "Image generation failed: " + e.message };
        }
      } else {
        result = executeTool(toolName, args);
      }

      toolExecutions.push({
        tool: toolName,
        args: toolName === "write_file" ? { path: args.path, contentLength: (args.content || "").length } : args,
        result: typeof result === "object" ? summarizeResult(result) : result,
      });

      openaiMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return { content: "I've reached the maximum number of tool calls for this request. Here's what I've done so far.", toolExecutions, images };
}

function summarizeResult(result) {
  if (result.error) return { error: result.error };
  if (result.content && result.content.length > 500) {
    return { ...result, content: result.content.substring(0, 500) + "..." };
  }
  if (result.output && result.output.length > 500) {
    return { ...result, output: result.output.substring(0, 500) + "..." };
  }
  if (result.entries) {
    return { path: result.path, fileCount: result.entries.length, entries: result.entries.slice(0, 20) };
  }
  return result;
}

router.post("/conversations/:id/message", async (req, res) => {
  try {
    const convo = conversations.get(req.params.id);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });

    if (!req.body.content || typeof req.body.content !== "string") {
      return res.status(400).json({ error: "Message content is required" });
    }

    const userMessage = {
      role: "user",
      content: req.body.content,
      timestamp: Date.now(),
      type: req.body.type || "text",
      attachments: req.body.attachments || [],
    };
    convo.messages.push(userMessage);
    convo.lastUpdated = Date.now();

    const openaiMessages = [
      { role: "system", content: CIPHER_SYSTEM_PROMPT },
    ];

    for (const msg of convo.messages) {
      if (msg.role === "user" || msg.role === "assistant") {
        openaiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const result = await processToolCalls(openaiMessages);

    const assistantMessage = {
      role: "assistant",
      content: result.content,
      timestamp: Date.now(),
      type: "text",
      toolExecutions: result.toolExecutions,
      images: result.images,
    };
    convo.messages.push(assistantMessage);
    convo.lastUpdated = Date.now();

    res.json({ userMessage, assistantMessage });
  } catch (err) {
    console.error("[CHAT] Message error:", err.message);
    res.status(500).json({ error: "AI request failed: " + err.message });
  }
});

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let preview = null;
  const textTypes = [".txt", ".json", ".csv", ".js", ".ts", ".py", ".html", ".css", ".md", ".xml", ".yaml", ".yml", ".sh", ".sql", ".log", ".env.example", ".toml", ".ini", ".cfg"];
  const ext = path.extname(req.file.originalname).toLowerCase();

  if (textTypes.includes(ext) || req.file.mimetype.startsWith("text/")) {
    try {
      const content = fs.readFileSync(req.file.path, "utf-8");
      preview = content.length > 10000 ? content.substring(0, 10000) + "\n...[truncated]" : content;
    } catch (e) {}
  }

  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    path: req.file.path,
    preview,
  });
});

router.post("/upload/audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file" });

    const audioBuffer = fs.readFileSync(req.file.path);
    const transcription = await cradle.transcribeAudio(audioBuffer);

    res.json({
      filename: req.file.filename,
      size: req.file.size,
      transcription: transcription.error ? null : transcription.text,
      message: transcription.error ? transcription.message : null,
    });
  } catch (err) {
    console.error("[CHAT] Audio transcription error:", err.message);
    res.status(500).json({ error: "Transcription failed: " + err.message });
  }
});

router.post("/image/generate", async (req, res) => {
  try {
    if (!req.body.prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const result = await cradle.generateImage(req.body.prompt, req.body.options);
    res.json(result);
  } catch (err) {
    console.error("[CHAT] Image generation error:", err.message);
    res.status(500).json({ error: "Image generation failed: " + err.message });
  }
});

router.post("/image/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file" });
    const imageBuffer = fs.readFileSync(req.file.path);
    const result = await cradle.analyzeImage(imageBuffer, req.body.prompt || "Describe this image in detail.");
    res.json(result);
  } catch (err) {
    console.error("[CHAT] Image analysis error:", err.message);
    res.status(500).json({ error: "Image analysis failed: " + err.message });
  }
});

router.post("/text-to-speech", async (req, res) => {
  try {
    if (!req.body.text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const options = {
      voice: req.body.voice || "alloy",
      model: req.body.model || "tts-1",
      speed: req.body.speed || 1.0,
    };

    const result = await cradle.textToSpeech(req.body.text, options);

    if (result.error) {
      return res.status(500).json({ error: result.message });
    }

    res.json(result);
  } catch (err) {
    console.error("[CHAT] Text-to-speech error:", err.message);
    res.status(500).json({ error: "Text-to-speech failed: " + err.message });
  }
});

module.exports = router;

