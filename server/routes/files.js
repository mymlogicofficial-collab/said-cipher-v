const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const multer = require("multer");
const router = express.Router();

const upload = multer({ dest: os.tmpdir() });

function safePath(base, rel) {
  const full = path.resolve(base, rel || ".");
  if (!full.startsWith(base)) throw new Error("Access denied");
  return full;
}

router.get("/list", (req, res) => {
  try {
    const base = req.query.path || os.homedir();
    const entries = fs.readdirSync(base, { withFileTypes: true });
    res.json({
      path: base,
      entries: entries.map((e) => ({
        name: e.name,
        isDir: e.isDirectory(),
        size: e.isFile() ? fs.statSync(path.join(base, e.name)).size : 0,
      })),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/read", (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: "No path" });
    const content = fs.readFileSync(filePath, "utf8");
    res.json({ content, path: filePath });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/write", (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: "No path" });
    fs.writeFileSync(filePath, content, "utf8");
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/delete", (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: "No path" });
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/upload", upload.array("files"), (req, res) => {
  try {
    const dest = req.body.dest || os.homedir();
    const results = [];
    for (const file of req.files) {
      const target = path.join(dest, file.originalname);
      fs.renameSync(file.path, target);
      results.push({ name: file.originalname, path: target });
    }
    res.json({ success: true, files: results });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
