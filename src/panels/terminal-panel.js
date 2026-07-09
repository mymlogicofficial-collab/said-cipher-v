document.addEventListener("DOMContentLoaded", () => {
  const termContainer = document.getElementById("terminal-container");
  if (!termContainer) return;

  // Check if xterm is available
  if (typeof Terminal === "undefined") {
    termContainer.innerHTML = `<div class="terminal-unavailable">
      <div class="unavail-icon">⚡</div>
      <div class="unavail-title">Terminal Unavailable</div>
      <div class="unavail-msg">xterm.js not loaded. Check node_modules.</div>
    </div>`;
    return;
  }

  // Check if the IPC bridge exists (node-pty side)
  if (!window.terminal) {
    termContainer.innerHTML = `<div class="terminal-unavailable">
      <div class="unavail-icon">🔧</div>
      <div class="unavail-title">Terminal Not Ready</div>
      <div class="unavail-msg">Native terminal module (node-pty) needs a one-time build step.</div>
      <div class="unavail-sub">Run <code>npx electron-rebuild -f -w node-pty</code> in the app folder, then restart.</div>
    </div>`;
    return;
  }

  // All good — boot the terminal
  const term = new Terminal({
    theme: {
      background: "#0a0a0a",
      foreground: "#50fa7b",
      cursor: "#50fa7b",
      cursorAccent: "#0a0a0a"
    },
    fontFamily: "Courier New, monospace",
    fontSize: 13,
    cursorBlink: true,
    scrollback: 1000,
  });

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(termContainer);
  fitAddon.fit();

  window.terminal.onData((data) => term.write(data));
  term.onData((data) => window.terminal.send(data));

  const ro = new ResizeObserver(() => {
    fitAddon.fit();
    window.terminal.resize(term.cols, term.rows);
  });
  ro.observe(termContainer);
  window.terminal.resize(term.cols, term.rows);
});
