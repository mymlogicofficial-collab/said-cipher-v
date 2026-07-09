const express = require("express");
const router = express.Router();
const os = require("os");
const cradle = require("../services/ai-cradle");
const guardian = require("../services/guardian");

router.get("/info", (req, res) => {
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    nodeVersion: process.version,
  });
});

router.get("/ai/providers", (req, res) => {
  res.json({ providers: cradle.listProviders() });
});

router.post("/ai/provider", (req, res) => {
  try {
    cradle.setActive(req.body.name);
    res.json({ active: req.body.name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/protected", (req, res) => {
  res.json({ protectedPaths: guardian.getProtectedPaths() });
});

module.exports = router;
