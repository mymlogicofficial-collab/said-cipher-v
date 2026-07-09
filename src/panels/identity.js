document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panel-identity");
  if (!panel) return;

  async function loadIdentity() {
    const data = await window.api.fetch("/api/system/identity");
    renderIdentity(data);
  }

  function renderIdentity(data) {
    panel.innerHTML = `
      <div class="identity-panel">
        <div class="identity-section">
          <h3>System Prompt</h3>
          <textarea id="sys-prompt-editor" rows="12">${data.systemPrompt || ""}</textarea>
          <div class="identity-actions">
            <button id="save-prompt-btn" class="btn-primary">Save Prompt</button>
            <span id="prompt-status" style="margin-left:10px;font-size:0.8em;color:#888"></span>
          </div>
        </div>

        <div class="identity-section">
          <h3>Skills <span style="font-size:0.75em;color:#888">(loaded into her on every message)</span></h3>
          <div id="skills-list">${renderSkills(data.skills || [])}</div>
          <div class="add-skill-form">
            <input id="skill-name-input" type="text" placeholder="Skill name (e.g. Karate I)" />
            <textarea id="skill-content-input" rows="4" placeholder="Skill definition..."></textarea>
            <button id="add-skill-btn" class="btn-primary">Add Skill</button>
          </div>
        </div>

        <div class="identity-section">
          <h3>Memory <span style="font-size:0.75em;color:#888">(facts she always knows)</span></h3>
          <div id="memory-list">${renderMemory(data.memory || [])}</div>
          <div class="add-memory-form">
            <input id="memory-input" type="text" placeholder="Add a memory (e.g. SE is the Foreman)" />
            <button id="add-memory-btn" class="btn-primary">Add</button>
          </div>
        </div>
      </div>
    `;

    bindEvents(data);
  }

  function renderSkills(skills) {
    if (!skills.length) return '<div style="color:#555;padding:8px">No skills loaded yet.</div>';
    return skills.map(s => `
      <div class="skill-item ${s.enabled === false ? 'disabled' : ''}" data-name="${s.name}">
        <div class="skill-header">
          <span class="skill-name">${s.name}</span>
          <div class="skill-controls">
            <button class="skill-toggle btn-sm" data-name="${s.name}">${s.enabled === false ? 'Enable' : 'Disable'}</button>
            <button class="skill-delete btn-sm btn-danger" data-name="${s.name}">✕</button>
          </div>
        </div>
        <div class="skill-preview">${(s.content || "").slice(0, 120)}${s.content && s.content.length > 120 ? '…' : ''}</div>
      </div>
    `).join("");
  }

  function renderMemory(memory) {
    if (!memory.length) return '<div style="color:#555;padding:8px">No memory entries yet.</div>';
    return memory.map((m, i) => `
      <div class="memory-item">
        <span>${m}</span>
        <button class="memory-delete btn-sm btn-danger" data-idx="${i}">✕</button>
      </div>
    `).join("");
  }

  function bindEvents(data) {
    // Save system prompt
    document.getElementById("save-prompt-btn").onclick = async () => {
      const prompt = document.getElementById("sys-prompt-editor").value;
      await window.api.fetch("/api/system/identity", { method: "POST", body: { systemPrompt: prompt } });
      document.getElementById("prompt-status").textContent = "Saved ✓";
      setTimeout(() => document.getElementById("prompt-status").textContent = "", 2000);
    };

    // Add skill
    document.getElementById("add-skill-btn").onclick = async () => {
      const name = document.getElementById("skill-name-input").value.trim();
      const content = document.getElementById("skill-content-input").value.trim();
      if (!name || !content) return;
      await window.api.fetch("/api/system/identity/skill", { method: "POST", body: { name, content } });
      loadIdentity();
    };

    // Toggle / delete skills
    panel.querySelectorAll(".skill-toggle").forEach(btn => {
      btn.onclick = async () => {
        await window.api.fetch("/api/system/identity/skill/" + btn.dataset.name + "/toggle", { method: "PATCH", body: {} });
        loadIdentity();
      };
    });
    panel.querySelectorAll(".skill-delete").forEach(btn => {
      btn.onclick = async () => {
        await window.api.fetch("/api/system/identity/skill/" + btn.dataset.name, { method: "DELETE", body: {} });
        loadIdentity();
      };
    });

    // Add memory
    document.getElementById("add-memory-btn").onclick = async () => {
      const val = document.getElementById("memory-input").value.trim();
      if (!val) return;
      const current = data.memory || [];
      current.push(val);
      await window.api.fetch("/api/system/identity", { method: "POST", body: { memory: current } });
      loadIdentity();
    };

    // Delete memory
    panel.querySelectorAll(".memory-delete").forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.dataset.idx);
        data.memory.splice(idx, 1);
        await window.api.fetch("/api/system/identity", { method: "POST", body: { memory: data.memory } });
        loadIdentity();
      };
    });
  }

  loadIdentity();
});
