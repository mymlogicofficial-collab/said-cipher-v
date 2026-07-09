document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panel-settings");
  if (!panel) return;

  function renderSettings() {
    const currentBackend = window.api.getBackendUrl();
    const isLocal = currentBackend === window.location.origin;

    panel.innerHTML = `
      <div class="settings-panel">
        <div class="settings-section">
          <h3>Backend Configuration</h3>
          <p class="settings-description">Configure where Cipher connects for AI services.</p>

          <div class="setting-item">
            <label for="backend-url-input">Backend URL</label>
            <div class="backend-input-group">
              <input 
                id="backend-url-input" 
                type="text" 
                placeholder="http://localhost:9471 or https://your-railway-domain.up.railway.app"
                value="${currentBackend}"
              />
              <button id="test-backend-btn" class="btn-secondary">Test</button>
            </div>
            <div class="setting-hint">
              ${isLocal 
                ? '🖥️ Currently using <strong>local backend</strong> (Electron)' 
                : '☁️ Currently using <strong>remote backend</strong> (Railway)'}
            </div>
          </div>

          <div class="setting-item">
            <button id="save-backend-btn" class="btn-primary">Save Backend URL</button>
            <button id="reset-backend-btn" class="btn-secondary">Reset to Local</button>
            <span id="backend-status" style="margin-left:10px;font-size:0.8em;color:#888"></span>
          </div>
        </div>

        <div class="settings-section">
          <h3>Quick Setup</h3>
          <p class="settings-description">Use one of these Railway backend URLs:</p>
          <div id="railway-backends" class="railway-backends-list">
            <div class="backend-preset">
              <code>https://cipher-backend-production.up.railway.app</code>
              <button class="btn-sm" onclick="document.getElementById('backend-url-input').value = 'https://cipher-backend-production.up.railway.app'">Use</button>
            </div>
          </div>
          <p class="settings-hint" style="margin-top:10px;font-size:0.85em;color:#666;">
            Get your actual Railway domain from the cipher-backend service dashboard.
          </p>
        </div>

        <div class="settings-section">
          <h3>Status</h3>
          <div id="backend-status-detail" class="status-box">
            <div class="status-loading">Checking backend...</div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    checkBackendStatus();
  }

  function bindEvents() {
    document.getElementById("save-backend-btn").onclick = () => {
      const url = document.getElementById("backend-url-input").value.trim();
      if (!url) {
        showStatus("Please enter a backend URL", "error");
        return;
      }
      window.api.setBackendUrl(url);
      showStatus("Backend URL saved! Restart the app or refresh to apply.", "success");
    };

    document.getElementById("reset-backend-btn").onclick = () => {
      window.api.setBackendUrl(window.location.origin);
      document.getElementById("backend-url-input").value = window.location.origin;
      showStatus("Reset to local backend", "success");
    };

    document.getElementById("test-backend-btn").onclick = async () => {
      const url = document.getElementById("backend-url-input").value.trim();
      if (!url) {
        showStatus("Please enter a backend URL", "error");
        return;
      }
      await testBackend(url);
    };
  }

  async function testBackend(url) {
    const statusEl = document.getElementById("backend-status");
    statusEl.textContent = "Testing...";
    statusEl.style.color = "#888";

    try {
      const response = await fetch(url + "/health", { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        showStatus("✓ Backend is online and responding", "success");
      } else {
        showStatus("✗ Backend returned error: " + response.status, "error");
      }
    } catch (e) {
      showStatus("✗ Cannot reach backend: " + e.message, "error");
    }
  }

  async function checkBackendStatus() {
    const statusEl = document.getElementById("backend-status-detail");
    const currentBackend = window.api.getBackendUrl();

    try {
      const response = await fetch(currentBackend + "/health", { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        statusEl.innerHTML = `
          <div class="status-ok">
            <div class="status-icon">✓</div>
            <div class="status-text">
              <strong>Backend Online</strong>
              <div style="font-size:0.85em;color:#666;margin-top:4px;">
                Service: ${data.service || "cipher-backend"}<br/>
                URL: ${currentBackend}
              </div>
            </div>
          </div>
        `;
      } else {
        statusEl.innerHTML = `
          <div class="status-error">
            <div class="status-icon">✗</div>
            <div class="status-text">
              <strong>Backend Error</strong>
              <div style="font-size:0.85em;color:#666;margin-top:4px;">
                HTTP ${response.status}
              </div>
            </div>
          </div>
        `;
      }
    } catch (e) {
      statusEl.innerHTML = `
        <div class="status-error">
          <div class="status-icon">✗</div>
          <div class="status-text">
            <strong>Cannot Reach Backend</strong>
            <div style="font-size:0.85em;color:#666;margin-top:4px;">
              ${e.message}
            </div>
          </div>
        </div>
      `;
    }
  }

  function showStatus(message, type) {
    const statusEl = document.getElementById("backend-status");
    statusEl.textContent = message;
    statusEl.style.color = type === "success" ? "#4caf50" : "#f44336";
  }

  renderSettings();
});

