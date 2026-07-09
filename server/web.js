const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const os = require("os");
const pty = require("node-pty");
const { WebSocketServer } = require("ws");

const filesRouter = require("./routes/files");
const chatRouter = require("./routes/chat");
const systemRouter = require("./routes/system");
const cradle = require("./services/ai-cradle");
const { provider: openaiProvider } = require("./services/openai-provider");

cradle.registerProvider("openai", openaiProvider);

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  next();
});
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use("/api/files", filesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/system", systemRouter);

const srcDir = path.join(__dirname, "..", "src");
const nodeModDir = path.join(__dirname, "..", "node_modules");
app.use("/src", express.static(srcDir, { etag: false, lastModified: false }));
app.use("/node_modules", express.static(nodeModDir));

let previousCpu = getCpuUsage();

function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

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

app.get("/api/metrics", (req, res) => {
  res.json(collectMetrics());
});

app.get("/", (req, res) => {
  res.sendFile(path.join(srcDir, "app.html"));
});

const wss = new WebSocketServer({ server, path: "/ws/terminal" });

wss.on("connection", (ws) => {
  const shell = process.env.SHELL || "/bin/bash";
  const ptyProc = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || os.homedir(),
    env: process.env,
  });

  ptyProc.onData((data) => {
    try { ws.send(data); } catch (e) {}
  });

  ws.on("message", (msg) => {
    const str = msg.toString();
    if (str.startsWith("RESIZE:")) {
      const parts = str.slice(7).split(",");
      const cols = parseInt(parts[0]);
      const rows = parseInt(parts[1]);
      if (cols > 0 && rows > 0) ptyProc.resize(cols, rows);
    } else {
      ptyProc.write(str);
    }
  });

  ws.on("close", () => {
    ptyProc.kill();
  });
});

const PORT = 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("[S.A.I.D.] Web interface running on http://0.0.0.0:" + PORT);
});
