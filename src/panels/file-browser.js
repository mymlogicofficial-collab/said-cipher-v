document.addEventListener("DOMContentLoaded", () => {
  let currentPath = "";
  const filesGrid = document.getElementById("files-grid");
  const filesPath = document.getElementById("files-path");
  const upBtn = document.getElementById("files-up-btn");
  const refreshBtn = document.getElementById("files-refresh-btn");

  async function loadDir(dirPath) {
    try {
      const result = await window.api.fetch("/api/files/list?path=" + encodeURIComponent(dirPath || ""));
      currentPath = result.path;
      filesPath.textContent = currentPath;
      filesGrid.innerHTML = "";
      for (const entry of result.entries) {
        const item = document.createElement("div");
        item.className = "file-item" + (entry.isDir ? " dir" : "");
        const size = entry.isFile ? (entry.size > 1048576 ? (entry.size/1048576).toFixed(1)+"MB" : entry.size > 1024 ? (entry.size/1024).toFixed(1)+"KB" : entry.size+"B") : "";
        item.innerHTML = '<div class="file-icon">' + (entry.isDir ? "📁" : "📄") + '</div><div class="file-name">' + entry.name + '</div>' + (size ? '<div class="file-size">'+size+'</div>' : '');
        item.addEventListener("dblclick", () => { if (entry.isDir) loadDir(result.path + "/" + entry.name); });
        filesGrid.appendChild(item);
      }
    } catch (e) {
      filesGrid.innerHTML = '<div style="color:#555;padding:16px">Error: ' + e.message + '</div>';
    }
  }

  upBtn.addEventListener("click", () => {
    const parts = currentPath.replace(/\\/g, "/").split("/").filter(Boolean);
    parts.pop();
    loadDir(parts.join("/") || "/");
  });
  refreshBtn.addEventListener("click", () => loadDir(currentPath));
  loadDir("");
});
