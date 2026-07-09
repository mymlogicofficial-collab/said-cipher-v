(function () {
  if (window.api && window.terminal && window.metrics) return;

  // Support both local (Electron) and remote (Railway) backends
  // Priority: RAILWAY_BACKEND_URL env var > localStorage > window.location.origin (local)
  let API_BASE = window.location.origin;
  
  // Check if running in Electron with environment variable
  if (window.__RAILWAY_BACKEND_URL__) {
    API_BASE = window.__RAILWAY_BACKEND_URL__;
  }
  
  // Check localStorage for user-configured backend
  const storedBackend = localStorage.getItem("cipher_backend_url");
  if (storedBackend) {
    API_BASE = storedBackend;
  }

  window.api = {
    port: 5000,
    baseUrl: API_BASE,
    setBackendUrl(url) {
      API_BASE = url;
      localStorage.setItem("cipher_backend_url", url);
      console.log("[API] Backend URL set to:", url);
    },
    getBackendUrl() {
      return API_BASE;
    },
    async fetch(endpoint, options = {}) {
      const url = API_BASE + endpoint;
      const defaults = { headers: { "Content-Type": "application/json" } };
      const merged = { ...defaults, ...options };
      if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
        merged.body = JSON.stringify(options.body);
      }
      if (options.body instanceof FormData) {
        delete merged.headers["Content-Type"];
      }
      const res = await window.fetch(url, merged);
      return res.json();
    },
    async fetchRaw(endpoint, options = {}) {
      const url = API_BASE + endpoint;
      return fetch(url, options);
    },
  };

  let termSocket = null;
  const termCallbacks = [];

  function connectTerminal() {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = proto + "//" + window.location.host + "/ws/terminal";
    termSocket = new WebSocket(wsUrl);

    termSocket.onopen = function () {
      console.log("[Terminal] WebSocket connected");
    };

    termSocket.onmessage = function (event) {
      termCallbacks.forEach(function (cb) {
        cb(event.data);
      });
    };

    termSocket.onclose = function () {
      console.log("[Terminal] WebSocket closed, reconnecting...");
      setTimeout(connectTerminal, 2000);
    };

    termSocket.onerror = function () {};
  }

  window.terminal = {
    send: function (data) {
      if (termSocket && termSocket.readyState === WebSocket.OPEN) {
        termSocket.send(data);
      }
    },
    onData: function (callback) {
      termCallbacks.push(callback);
    },
    resize: function (cols, rows) {
      if (termSocket && termSocket.readyState === WebSocket.OPEN) {
        termSocket.send("RESIZE:" + cols + "," + rows);
      }
    },
  };

  connectTerminal();

  const metricsCallbacks = [];

  window.metrics = {
    onUpdate: function (callback) {
      metricsCallbacks.push(callback);
    },
  };

  setInterval(async function () {
    if (metricsCallbacks.length === 0) return;
    try {
      const res = await fetch(API_BASE + "/api/metrics");
      const data = await res.json();
      metricsCallbacks.forEach(function (cb) {
        cb(data);
      });
    } catch (e) {
      console.error("[Metrics] polling error:", e.message);
    }
  }, 1000);
})();

