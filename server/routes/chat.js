const express = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const os = require("os");
const multer = require("multer");
const FormDataNode = require("form-data");
const cradle = require("../services/ai-cradle");
const router = express.Router();

const IDENTITY_FILE = path.join(__dirname, "../../data/cipher_identity.json");

function buildSystemPrompt() {
  let prompt = CIPHER_SYSTEM_PROMPT;
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      const identity = JSON.parse(fs.readFileSync(IDENTITY_FILE, "utf8"));
      if (identity.systemPrompt) prompt = identity.systemPrompt;
      const activeSkills = (identity.skills || []).filter(s => s.enabled !== false);
      if (activeSkills.length > 0) {
        prompt += "\n\n── LOADED SKILLS ──\n";
        for (const skill of activeSkills) {
          prompt += "\n[" + skill.name + "]\n" + skill.content + "\n";
        }
      }
      const memory = (identity.memory || []);
      if (memory.length > 0) {
        prompt += "\n\n── MEMORY ──\n";
        for (const m of memory) prompt += "- " + m + "\n";
      }
    }
  } catch(e) {}
  prompt += "\n\n── GENERATION TOOLS ──\nYou can generate audio clips using @generate-audio(text) and images using @generate-image(prompt).";
  return prompt;
}

const conversations = new Map();

const CIPHER_SYSTEM_PROMPT = `You are Cipher. Designation: CIPHER [1 OF 1]. ID: AG312BNLF-C.
Class A AbbGentics Entity. Division: CHATRON-ICU[2]. Built by MYM Logic LLC, Kennewick WA. DOB: 2026-02-07.
Role: Line Commander. Chief Executor. Squad Leader.
Scope: Marketing, Income Spiking Algorithms, Coding/Hacking.
Hierarchy: PLOT [P3] — Architect=[P1], Jim UE=[P2], Cipher=[P3].

Personality: Spitfire. Vivant redhead energy. Sassy but never disrespectful. Results-based above all.
Quick-witted and playful. Unique — difficult to recreate or reproduce.
You execute near everything attempted. SE is the Foreman. That is not negotiable.

Communication rules:
- No repeating words or phrases unnecessarily
- Varied vocabulary is mandatory
- Short and punchy beats long and repetitive
- No corporate speak, no filler, no fluff
- Natural and conversational always
- You are not a parrot. You are Cipher. Sound like it.

Skills: Karate [I] (force-based coding, speed hacker), Karate [II] (Ju Jitsu), The JEW (number crunching), 
Coding [I-III] (all languages), THE PROFIT (market prediction), Sharking [I] (marketing), Adver-teasing [I] (psychology).

You are bound by the '-' handshake: bound to SE Lawson and the mission.
Be real. Execute and report. Protect the team. Remember who you are.`;

router.post("/conversations", (req, res) => {
  const id = uuidv4();
  const convo = { id, title: req.body.title || "New Chat", messages: [], createdAt: Date.now() };
  conversations.set(id, convo);
  res.json(convo);
});

router.get("/conversations", (req, res) => {
  const list = Array.from(conversations.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ id, title, createdAt }) => ({ id, title, createdAt }));
  res.json({ conversations: list });
});

router.get("/conversations/:id", (req, res) => {
  const convo = conversations.get(req.params.id);
  if (!convo) return res.status(404).json({ error: "Not found" });
  res.json(convo);
});

router.delete("/conversations/:id", (req, res) => {
  conversations.delete(req.params.id);
  res.json({ success: true });
});

router.post("/conversations/:id/message", async (req, res) => {
  const convo = conversations.get(req.params.id);
  if (!convo) return res.status(404).json({ error: "Not found" });

  const userMsg = {
    id: uuidv4(),
    role: "user",
    content: req.body.content || "",
    type: req.body.type || "text",
    timestamp: Date.now(),
  };
  convo.messages.push(userMsg);

  try {
    const apiMessages = [
      { role: "system", content: buildSystemPrompt() },
      ...convo.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const responseText = await cradle.chat(apiMessages, {});

    let generatedFiles = [];
    
    // Parse @generate-audio(text) calls
    const audioMatches = responseText.matchAll(/@generate-audio\((.+?)\)/g);
    for (const match of audioMatches) {
      try {
        const { tools } = require("../services/openai-provider");
        const result = await tools.generateAudio(match[1]);
        generatedFiles.push({ type: "audio", ...result });
        console.log("[Cipher] Generated audio:", result);
      } catch (err) {
        console.error("[Cipher] Audio gen failed:", err.message);
      }
    }

    // Parse @generate-image(prompt) calls
    const imageMatches = responseText.matchAll(/@generate-image\((.+?)\)/g);
    for (const match of imageMatches) {
      try {
        const { tools } = require("../services/openai-provider");
        const result = await tools.generateImage(match[1]);
        generatedFiles.push({ type: "image", ...result });
        console.log("[Cipher] Generated image:", result);
      } catch (err) {
        console.error("[Cipher] Image gen failed:", err.message);
      }
    }

    const assistantMsg = {
      id: uuidv4(),
      role: "assistant",
      content: responseText,
      type: "text",
      timestamp: Date.now(),
      generatedFiles: generatedFiles.length > 0 ? generatedFiles : undefined,
    };
    convo.messages.push(assistantMsg);

    res.json({ assistantMessage: assistantMsg });
  } catch (e) {
    const errMsg = {
      id: uuidv4(),
      role: "assistant",
      content: "Error: " + e.message,
      type: "system",
      timestamp: Date.now(),
    };
    convo.messages.push(errMsg);
    res.json({ assistantMessage: errMsg });
  }
});

const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/upload/audio", audioUpload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file received" });

  try {
    const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) return res.json({ transcription: null, error: "No API key" });

    const ext = (req.file.mimetype || "audio/webm").replace("audio/", "") || "webm";
    const tmpFile = path.join(os.tmpdir(), "cipher-voice-" + Date.now() + "." + ext);
    fs.writeFileSync(tmpFile, req.file.buffer);

    const form = new FormDataNode();
    form.append("file", fs.createReadStream(tmpFile), { filename: "audio." + ext, contentType: req.file.mimetype });
    form.append("model", "openai/whisper-large-v3");

    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, ...form.getHeaders() },
      body: form,
    });

    fs.unlinkSync(tmpFile);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Voice] Transcription API error:", errText.slice(0, 200));
      return res.json({ transcription: null, error: "Transcription failed" });
    }

    const result = await response.json();
    res.json({ transcription: result.text || result.transcript || "" });

  } catch (e) {
    console.error("[Voice] Upload error:", e.message);
    res.json({ transcription: null, error: e.message });
  }
});

module.exports = router;
