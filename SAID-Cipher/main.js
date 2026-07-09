const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const pty = require("node-pty");
const os = require("os");
const { createServer } = require("./server");

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");

let mainWindow;
let ptyProcess;
let metricsInterval;
let server;

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
  const shell = process.env.SHELL || "/bin/bash";

  ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || os.homedir(),
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
}

ipcMain.on("terminal-input", (_event, data) => {
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.on("terminal-resize", (_event, { cols, rows }) => {
  if (ptyProcess) ptyProcess.resize(cols, rows);
});

app.whenReady().then(async () => {
  try {
    server = await createServer(API_PORT);
  } catch (e) {
    console.error("[SERVER] Failed to start:", e.message);
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
