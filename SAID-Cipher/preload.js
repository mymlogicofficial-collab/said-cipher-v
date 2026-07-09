const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendTerminalInput: (data) => ipcRenderer.send("terminal-input", data),
  onTerminalOutput: (callback) =>
    ipcRenderer.on("terminal-output", (_event, data) => callback(data)),
  resizeTerminal: (cols, rows) =>
    ipcRenderer.send("terminal-resize", { cols, rows }),
  onMetricsUpdate: (callback) =>
    ipcRenderer.on("metrics-update", (_event, data) => callback(data)),
});
