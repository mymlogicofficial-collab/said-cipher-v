const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  onMetricsUpdate: (cb) => ipcRenderer.on("metrics-update", (_e, data) => cb(data)),
  onTerminalOutput: (cb) => ipcRenderer.on("terminal-output", (_e, data) => cb(data)),
  sendTerminalInput: (data) => ipcRenderer.send("terminal-input", data),
  sendTerminalResize: (cols, rows) => ipcRenderer.send("terminal-resize", { cols, rows }),
});

contextBridge.exposeInMainWorld("api", {
  port: 9471,
  baseUrl: "http://127.0.0.1:9471",
  async fetch(endpoint, options = {}) {
    const url = "http://127.0.0.1:9471" + endpoint;
    const defaults = { headers: { "Content-Type": "application/json" } };
    const merged = { ...defaults, ...options };
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      merged.body = JSON.stringify(options.body);
    }
    if (options.body instanceof FormData) {
      delete merged.headers["Content-Type"];
    }
    const res = await fetch(url, merged);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("[API] Non-JSON response from " + endpoint + ":", text.slice(0, 300));
      throw new Error("Server returned non-JSON: " + text.slice(0, 200));
    }
  },
  async fetchRaw(endpoint, options = {}) {
    return fetch("http://127.0.0.1:9471" + endpoint, options);
  },
});

contextBridge.exposeInMainWorld("terminal", {
  send: (data) => ipcRenderer.send("terminal-input", data),
  onData: (cb) => ipcRenderer.on("terminal-output", (_e, data) => cb(data)),
  resize: (cols, rows) => ipcRenderer.send("terminal-resize", { cols, rows }),
});

contextBridge.exposeInMainWorld("metrics", {
  onUpdate: (cb) => ipcRenderer.on("metrics-update", (_e, data) => cb(data)),
});
