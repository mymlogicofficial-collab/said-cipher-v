const express = require("express");
const router = express.Router();
const fileService = require("../services/file-service");

router.get("/list", (req, res) => {
  try {
    const entries = fileService.listDirectory(req.query.path || ".");
    res.json({ entries });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/read", (req, res) => {
  try {
    const file = fileService.readFile(req.query.path);
    res.json(file);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/write", (req, res) => {
  try {
    const result = fileService.writeFile(req.body.path, req.body.content);
    res.json(result);
  } catch (e) {
    const status = e.code === "CORE_PROTECTED" ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.post("/mkdir", (req, res) => {
  try {
    const result = fileService.createDirectory(req.body.path);
    res.json(result);
  } catch (e) {
    const status = e.code === "CORE_PROTECTED" ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
});

router.delete("/delete", (req, res) => {
  try {
    const result = fileService.deleteFile(req.body.path);
    res.json(result);
  } catch (e) {
    const status = e.code === "CORE_PROTECTED" ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
});

module.exports = router;
