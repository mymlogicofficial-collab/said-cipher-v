document.addEventListener("DOMContentLoaded", () => {
  let currentPath = ".";

  const filesGrid = document.getElementById("files-grid");
  const filesPath = document.getElementById("files-path");
  const filesUpBtn = document.getElementById("files-up-btn");
  const filesRefreshBtn = document.getElementById("files-refresh-btn");

  filesUpBtn.addEventListener("click", () => {
    if (currentPath === "." || currentPath === "/") return;
    const parts = currentPath.split("/");
    parts.pop();
    currentPath = parts.length > 0 ? parts.join("/") : ".";
    loadDirectory();
  });

  filesRefreshBtn.addEventListener("click", loadDirectory);

  async function loadDirectory() {
    filesPath.textContent = currentPath === "." ? "/" : "/" + currentPath;

    const result = await window.api.fetch("/api/files/list?path=" + encodeURIComponent(currentPath));
    const entries = result.entries || [];

    filesGrid.innerHTML = "";

    for (const entry of entries) {
      const card = document.createElement("div");
      card.className = "file-card" + (entry.type === "directory" ? " directory" : "") + (entry.protected ? " protected" : "");

      const icon = document.createElement("div");
      icon.className = "file-icon";
      icon.textContent = entry.type === "directory" ? "\uD83D\uDCC1" : getFileIcon(entry.name);

      const name = document.createElement("div");
      name.className = "file-name";
      name.textContent = entry.name;

      const meta = document.createElement("div");
      meta.className = "file-meta";
      if (entry.type === "directory") {
        meta.textContent = "Directory" + (entry.protected ? " \u2022 Protected" : "");
      } else {
        meta.textContent = formatSize(entry.size) + (entry.protected ? " \u2022 Protected" : "");
      }

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        if (entry.type === "directory") {
          currentPath = entry.path;
          loadDirectory();
        }
      });

      filesGrid.appendChild(card);
    }
  }

  function getFileIcon(name) {
    const ext = name.split(".").pop().toLowerCase();
    const icons = {
      js: "\uD83D\uDCDC",
      ts: "\uD83D\uDCDC",
      json: "\uD83D\uDCCB",
      html: "\uD83C\uDF10",
      css: "\uD83C\uDFA8",
      py: "\uD83D\uDC0D",
      md: "\uD83D\uDCD6",
      png: "\uD83D\uDDBC\uFE0F",
      jpg: "\uD83D\uDDBC\uFE0F",
      svg: "\uD83D\uDDBC\uFE0F",
      mp3: "\uD83C\uDFB5",
      mp4: "\uD83C\uDFA5",
    };
    return icons[ext] || "\uD83D\uDCC4";
  }

  function formatSize(bytes) {
    if (bytes === null || bytes === undefined) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  window.addEventListener("panel-switched", (e) => {
    if (e.detail.panel === "files" && filesGrid.children.length === 0) {
      loadDirectory();
    }
  });

  setTimeout(loadDirectory, 1500);
});
