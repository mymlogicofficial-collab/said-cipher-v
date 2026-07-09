// Admin Panel — Login & Management
(function() {
  const adminPanel = document.getElementById("panel-identity");
  let adminToken = null;

  adminPanel.innerHTML = `
    <div class="admin-container">
      <div id="admin-login-view" class="admin-view active">
        <div class="admin-box">
          <h2>Administrator Access</h2>
          <p class="admin-hint">Secure admin area for managing your app store and gallery</p>
          <form id="admin-login-form">
            <input type="text" id="admin-user" placeholder="Username" required />
            <input type="password" id="admin-pass" placeholder="Password" required />
            <button type="submit" class="admin-btn">Login</button>
          </form>
          <div id="admin-login-error" class="admin-error"></div>
        </div>
      </div>

      <div id="admin-dashboard-view" class="admin-view">
        <div class="admin-header">
          <h2>Admin Dashboard</h2>
          <button id="admin-logout-btn" class="admin-btn small">Logout</button>
        </div>

        <div class="admin-tabs">
          <button class="admin-tab active" data-tab="gallery">Gallery</button>
          <button class="admin-tab" data-tab="apps">App Store</button>
          <button class="admin-tab" data-tab="accounts">Accounts</button>
        </div>

        <!-- GALLERY TAB -->
        <div id="admin-gallery-tab" class="admin-tab-content active">
          <h3>Media Gallery</h3>
          <p>Upload and manage your art, music, and media</p>
          
          <div class="gallery-upload">
            <input type="file" id="gallery-file-input" accept="image/*,audio/*" multiple />
            <button id="gallery-upload-btn" class="admin-btn">Upload Media</button>
            <span id="gallery-upload-status" class="status-msg"></span>
          </div>

          <div id="gallery-items" class="gallery-grid"></div>
        </div>

        <!-- APP STORE TAB -->
        <div id="admin-apps-tab" class="admin-tab-content">
          <h3>App Store Listings</h3>
          <p>Add and manage apps in your store</p>
          
          <div class="app-form">
            <input type="text" id="app-name" placeholder="App Name" />
            <textarea id="app-description" placeholder="App Description" rows="3"></textarea>
            <input type="text" id="app-version" placeholder="Version" value="1.0.0" />
            <input type="number" id="app-price" placeholder="Price (USD)" min="0" step="0.99" />
            <input type="file" id="app-file" accept=".exe,.app,.apk,.zip" />
            <button id="app-add-btn" class="admin-btn">Add App</button>
            <span id="app-add-status" class="status-msg"></span>
          </div>

          <div id="app-listings" class="app-grid"></div>
        </div>

        <!-- ACCOUNTS TAB -->
        <div id="admin-accounts-tab" class="admin-tab-content">
          <h3>Administrator Accounts</h3>
          <p>Create additional admin accounts for your team</p>
          
          <div class="account-form">
            <input type="text" id="new-admin-user" placeholder="New Username" />
            <input type="password" id="new-admin-pass" placeholder="New Password" />
            <button id="new-admin-btn" class="admin-btn">Create Admin</button>
            <span id="new-admin-status" class="status-msg"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .admin-container { padding: 20px; }
    .admin-view { display: none; }
    .admin-view.active { display: block; }
    .admin-box { max-width: 400px; margin: 40px auto; padding: 30px; background: #1a1a1a; border-radius: 8px; border: 1px solid #333; }
    .admin-box h2 { margin: 0 0 10px; color: #fff; }
    .admin-hint { color: #999; font-size: 14px; margin-bottom: 20px; }
    .admin-box form { display: flex; flex-direction: column; gap: 10px; }
    .admin-box input { padding: 10px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; }
    .admin-btn { padding: 10px 20px; background: #0066cc; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .admin-btn:hover { background: #0052a3; }
    .admin-btn.small { padding: 6px 12px; font-size: 12px; }
    .admin-error { color: #ff3333; font-size: 12px; margin-top: 10px; }
    .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .admin-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #333; }
    .admin-tab { padding: 10px 20px; background: none; border: none; color: #999; cursor: pointer; border-bottom: 2px solid transparent; }
    .admin-tab.active { color: #0066cc; border-bottom-color: #0066cc; }
    .admin-tab-content { display: none; }
    .admin-tab-content.active { display: block; }
    .gallery-upload, .app-form, .account-form { background: #1a1a1a; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; }
    .gallery-upload input, .app-form input, .app-form textarea, .account-form input { padding: 10px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; }
    .gallery-grid, .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; }
    .gallery-item, .app-item { background: #1a1a1a; padding: 10px; border-radius: 8px; border: 1px solid #333; }
    .gallery-item img, .gallery-item audio { width: 100%; margin-bottom: 10px; border-radius: 4px; }
    .status-msg { font-size: 12px; color: #999; }
    .status-msg.success { color: #00cc00; }
    .status-msg.error { color: #ff3333; }
  `;
  document.head.appendChild(style);

  // Login
  document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("admin-user").value;
    const password = document.getElementById("admin-pass").value;
    
    try {
      const res = await fetch("http://127.0.0.1:9471/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        adminToken = data.token;
        showDashboard();
      } else {
        document.getElementById("admin-login-error").textContent = "Invalid credentials";
      }
    } catch (err) {
      document.getElementById("admin-login-error").textContent = "Connection error: " + err.message;
    }
  });

  // Logout
  document.getElementById("admin-logout-btn").addEventListener("click", async () => {
    await fetch("http://127.0.0.1:9471/api/admin/logout", {
      method: "POST",
      headers: { "x-admin-token": adminToken }
    });
    adminToken = null;
    showLogin();
  });

  // Tab switching
  document.querySelectorAll(".admin-tab").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const tab = e.target.dataset.tab;
      document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.remove("active"));
      e.target.classList.add("active");
      document.getElementById("admin-" + tab + "-tab").classList.add("active");
    });
  });

  function showLogin() {
    document.getElementById("admin-login-view").classList.add("active");
    document.getElementById("admin-dashboard-view").classList.remove("active");
  }

  function showDashboard() {
    document.getElementById("admin-login-view").classList.remove("active");
    document.getElementById("admin-dashboard-view").classList.add("active");
  }

  // Check if already logged in
  checkAdminStatus();

  async function checkAdminStatus() {
    try {
      const token = localStorage.getItem("adminToken");
      if (token) {
        const res = await fetch("http://127.0.0.1:9471/api/admin/status", {
          headers: { "x-admin-token": token }
        });
        if (res.ok) {
          adminToken = token;
          showDashboard();
        }
      }
    } catch (err) {}
  }

  // Save token to localStorage
  const originalShowDashboard = showDashboard;
  window.showDashboard = function() {
    localStorage.setItem("adminToken", adminToken);
    originalShowDashboard();
  };
})();
