const express = require("express");
const router = express.Router();

// Simple in-memory admin store — replace with database later
let adminAccounts = {
  admin: "SECUSTOMS_25" 
};

let sessions = new Map();

// Middleware to check admin auth
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"] || req.body.token;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.adminUser = sessions.get(token);
  next();
}

// Login endpoint
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }
  
  if (adminAccounts[username] !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessions.set(token, { username, loginTime: Date.now() });
  
  res.json({ ok: true, token, username });
});

// Logout endpoint
router.post("/logout", (req, res) => {
  const token = req.headers["x-admin-token"] || req.body.token;
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

// Check admin status
router.get("/status", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token && sessions.has(token)) {
    const admin = sessions.get(token);
    res.json({ authenticated: true, username: admin.username });
  } else {
    res.json({ authenticated: false });
  }
});

// Create new admin account (requires existing admin)
router.post("/create-account", requireAdmin, (req, res) => {
  const { newUsername, newPassword } = req.body;
  if (!newUsername || !newPassword) {
    return res.status(400).json({ error: "Missing username or password" });
  }
  if (adminAccounts[newUsername]) {
    return res.status(400).json({ error: "Username already exists" });
  }
  
  adminAccounts[newUsername] = newPassword;
  res.json({ ok: true, message: `Admin account "${newUsername}" created` });
});

module.exports = { router, requireAdmin };
