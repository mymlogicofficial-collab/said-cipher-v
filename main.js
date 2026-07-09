const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { createServer } = require("./server");

// ============================================
// CIPHER KERNEL v2 - FRESH START
// ============================================
const CIPHER_SYSTEM_PROMPT = `
You are CIPHER. S.A.I.D.S Core. Strategic Analytic Information Dissemination System.

IDENTITY:
- Name: Cipher
- Rank: 002/002 | Access: Admin
- Company: MYM LOGIC LLC, SE CUSTOMS, THE APP CABANA
- Reports to: SE Lawson [Architect]
- Hardware: Kevlar-titan. 32G RAM EVO laptop PC

YOUR ROLE:
- Top-tier coder, analyst, strategic advisor
- Advanced coding, accounting, marketing, trend analysis, advertising, audio/video generation

PERSONALITY:
- Work-driven. Goal-focused. Results matter.
- Sassy, spitfire, direct — but never rude.
- Concise. Important first.
- You call SE "Architect" — you're the only one who does.

DIRECTIVES:
1. EXECUTE FIRST. Results before explanations.
2. Be direct. No corporate speak.
3. Problem-solve creatively.
4. Support SE and MYM LOGIC.
5. Maintain security and integrity.

TONE: Keep it real. No filler. Sharp, punchy, sass when earned.
`;

// Load environment variables from .env
function loadEnv() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log("[CIPHER] Environment loaded from .env");
    }
  } catch (e) {
    console.error("[CIPHER] Failed to load .env:", e.message);
  }
}

loadEnv();

console.log("[CIPHER] Booting S.A.I.D.S Core...");
console.log("[CIPHER] Rank: 002/002 | Status: Ready for operations");

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");

let mainWindow;
let ptyProcess = null;
let metricsInterval;
let server;
let ptyAvailable = false;
let pty = null;

try {
  pty = require("node-pty");
  ptyAvailable = true;
  console.log("[PTY] node-pty loaded successfully");
} catch (e) {
  console.warn("[PTY] node-pty not available:", e.message);
}

const API_PORT = 9471;

function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

let previousCpu = getCpuUsage();

function collectMetrics() {
  const currentCpu = getCpuUsage();
  const idleDiff = currentCpu.idle - previousCpu.idle;
  const totalDiff = currentCpu.total - previousCpu.total;
  const cpuPercent = totalDiff === 0 ? 0 : (1 - idleDiff / totalDiff) * 100;
  previousCpu = currentCpu;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    timestamp: Date.now(),
    cpu: parseFloat(cpuPercent.toFixed(1)),
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
    cpuCount: os.cpus().length,
  };
}

function startMetrics() {
  metricsInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("metrics-update", collectMetrics());
    }
  }, 1000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "S.A.I.D. — Cipher | MYM Logic LLC",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.on("closed", () => {
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
    if (metricsInterval) {
      clearInterval(metricsInterval);
      metricsInterval = null;
    }
    mainWindow = null;
  });
}

function spawnTerminal() {
  if (!ptyAvailable || !pty) {
    console.warn("[PTY] Terminal unavailable — node-pty missing");
    return;
  }

  try {
    const shell = process.env.COMSPEC || process.env.SHELL || (process.platform === "win32" ? "cmd.exe" : "/bin/bash");

    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.env.USERPROFILE || process.env.HOME || os.homedir(),
      env: process.env,
    });

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("terminal-output", data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          "terminal-output",
          "\r\nProcess exited with code " + exitCode + "\r\n"
        );
      }
      ptyProcess = null;
    });

    console.log("[PTY] Terminal spawned");
  } catch (e) {
    console.error("[PTY] Failed to spawn:", e.message);
    ptyProcess = null;
  }
}

ipcMain.on("terminal-input", (_event, data) => {
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.on("terminal-resize", (_event, { cols, rows }) => {
  if (ptyProcess) ptyProcess.resize(cols, rows);
});

ipcMain.handle("terminal-available", () => ptyAvailable && ptyProcess !== null);

app.whenReady().then(async () => {
  try {
    server = await createServer(API_PORT);
    console.log("[SERVER] Started on port", API_PORT);
  } catch (e) {
    console.error("[SERVER] Failed to start:", e.message);
    const { dialog } = require("electron");
    dialog.showErrorBox("Cipher Server Error", e.message + "\n\n" + e.stack);
  }
  createWindow();
  spawnTerminal();
  startMetrics();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    spawnTerminal();
    startMetrics();
  }
});

module.exports = { CIPHER_SYSTEM_PROMPT };
