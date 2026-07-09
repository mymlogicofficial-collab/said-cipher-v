const express = require("express");
const os = require("os");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const cradle = require("../services/ai-cradle");

router.get("/info", (req, res) => {
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    nodeVersion: process.version,
    totalMemGB: (os.totalmem() / 1073741824).toFixed(2),
  });
});

router.get("/metrics", (req, res) => {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const t in cpu.times) totalTick += cpu.times[t];
    totalIdle += cpu.times.idle;
  }
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  res.json({
    timestamp: Date.now(),
    cpu: parseFloat(((1 - totalIdle / totalTick) * 100).toFixed(1)),
    memory: {
      percent: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
      usedGB: parseFloat((usedMem / 1073741824).toFixed(2)),
      totalGB: parseFloat((totalMem / 1073741824).toFixed(2)),
    },
    load: {
      one: parseFloat(os.loadavg()[0].toFixed(2)),
      five: parseFloat(os.loadavg()[1].toFixed(2)),
      fifteen: parseFloat(os.loadavg()[2].toFixed(2)),
    },
    uptime: os.uptime(),
    cpuCount: cpus.length,
  });
});

router.get("/ai/providers", (req, res) => {
  const providers = cradle.listProviders();
  res.json({ providers });
});

router.get("/protected", (req, res) => {
  res.json({
    protectedPaths: [
      os.homedir() + "/Documents",
      os.homedir() + "/Desktop",
      os.homedir() + "/Downloads",
    ],
  });
});

module.exports = router;

// ── Identity / Skills control ─────────────────────────────────────────────────

const IDENTITY_FILE = path.join(__dirname, "../../data/cipher_identity.json");

function loadIdentity() {
  try {
    if (fs.existsSync(IDENTITY_FILE)) return JSON.parse(fs.readFileSync(IDENTITY_FILE, "utf8"));
  } catch(e) {}
  return {
    systemPrompt: "",
    skills: [],
    memory: []
  };
}

function saveIdentity(data) {
  const dir = path.dirname(IDENTITY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(IDENTITY_FILE, JSON.stringify(data, null, 2));
}

router.get("/identity", (req, res) => {
  res.json(loadIdentity());
});

router.post("/identity", (req, res) => {
  const current = loadIdentity();
  const updated = { ...current, ...req.body };
  saveIdentity(updated);
  res.json({ ok: true });
});

router.post("/identity/skill", (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: "name and content required" });
  const identity = loadIdentity();
  const idx = identity.skills.findIndex(s => s.name === name);
  if (idx >= 0) identity.skills[idx].content = content;
  else identity.skills.push({ name, content, enabled: true });
  saveIdentity(identity);
  res.json({ ok: true, skills: identity.skills });
});

router.delete("/identity/skill/:name", (req, res) => {
  const identity = loadIdentity();
  identity.skills = identity.skills.filter(s => s.name !== req.params.name);
  saveIdentity(identity);
  res.json({ ok: true });
});

router.patch("/identity/skill/:name/toggle", (req, res) => {
  const identity = loadIdentity();
  const skill = identity.skills.find(s => s.name === req.params.name);
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  skill.enabled = !skill.enabled;
  saveIdentity(identity);
  res.json({ ok: true, enabled: skill.enabled });
});
