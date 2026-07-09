document.addEventListener("DOMContentLoaded", () => {
  const term = new window.Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "'Courier New', 'Lucida Console', monospace",
    theme: {
      background: "#0d0d0d",
      foreground: "#e0e0e0",
      cursor: "#ffffff",
      selectionBackground: "#3a3a3a",
      black: "#0d0d0d",
      red: "#ff5555",
      green: "#50fa7b",
      yellow: "#f1fa8c",
      blue: "#6272a4",
      magenta: "#ff79c6",
      cyan: "#8be9fd",
      white: "#e0e0e0",
      brightBlack: "#555555",
      brightRed: "#ff6e6e",
      brightGreen: "#69ff94",
      brightYellow: "#ffffa5",
      brightBlue: "#d6acff",
      brightMagenta: "#ff92df",
      brightCyan: "#a4ffff",
      brightWhite: "#ffffff",
    },
    allowProposedApi: true,
  });

  const fitAddon = new window.FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  let initialized = false;

  function initTerminal() {
    if (initialized) return;
    const container = document.getElementById("terminal-container");
    if (!container || container.offsetWidth === 0) return;

    term.open(container);
    fitAddon.fit();
    initialized = true;

    window.terminal.send("\n");
  }

  window.terminal.onData((data) => {
    term.write(data);
  });

  term.onData((data) => {
    window.terminal.send(data);
  });

  term.onResize(({ cols, rows }) => {
    window.terminal.resize(cols, rows);
  });

  window.addEventListener("resize", () => {
    if (initialized) fitAddon.fit();
  });

  window.addEventListener("panel-switched", (e) => {
    if (e.detail.panel === "terminal") {
      if (!initialized) {
        setTimeout(initTerminal, 50);
      } else {
        setTimeout(() => fitAddon.fit(), 50);
      }
    }
  });

  const termPanel = document.getElementById("panel-terminal");
  if (termPanel) {
    new ResizeObserver(() => {
      if (initialized) fitAddon.fit();
    }).observe(termPanel);
  }

  setTimeout(initTerminal, 500);
});
