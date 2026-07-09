const express = require("express");
const router = express.Router();
const { generateImage, IMAGE_MODELS } = require("../services/image-service");
const { textToSpeech, analyzeAudio, transcribeAudio, VOICES } = require("../services/audio-service");
const { generateVideo, VIDEO_MODELS } = require("../services/video-service");

// ── IMAGE ──────────────────────────────────────────────
router.post("/image/generate", async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });
    const result = await generateImage(prompt, { model });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/image/models", (req, res) => {
  res.json({ models: IMAGE_MODELS });
});

// ── AUDIO / TTS ────────────────────────────────────────
router.post("/audio/tts", async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });
    const result = await textToSpeech(text, { voice });
    res.json({ audio: result.base64, mimeType: result.mimeType });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/audio/analyze", async (req, res) => {
  try {
    const { audio, prompt, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: "Audio data required" });
    const result = await analyzeAudio(audio, prompt || "Analyze this audio in detail.", mimeType);
    res.json({ analysis: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/audio/transcribe", async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: "Audio data required" });
    const text = await transcribeAudio(audio, mimeType || "audio/mp3");
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/audio/voices", (req, res) => {
  res.json({ voices: VOICES });
});

// ── VIDEO ──────────────────────────────────────────────
router.post("/video/generate", async (req, res) => {
  try {
    const { prompt, model, frames } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });
    const result = await generateVideo(prompt, { model, frames });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/video/models", (req, res) => {
  res.json({ models: VIDEO_MODELS });
});

module.exports = router;
