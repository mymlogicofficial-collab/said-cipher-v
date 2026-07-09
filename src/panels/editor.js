document.addEventListener("DOMContentLoaded", () => {
  let editor = null;
  let openFiles = {};
  let activeFile = null;

  const fileTree = document.getElementById("editor-file-tree");
  const editorTabs = document.getElementById("editor-tabs");
  const editorContainer = document.getElementById("editor-container");

  function initEditor() {
    if (typeof ace === "undefined") return;
    editorContainer.innerHTML = "";
    const editorDiv = document.createElement("div");
    editorDiv.id = "ace-editor";
    editorDiv.style.cssText = "width:100%;height:100%;";
    editorContainer.appendChild(editorDiv);
    editor = ace.edit("ace-editor");
    editor.setTheme("ace/theme/one_dark");
    editor.setOptions({ fontSize: "13px", fontFamily: "Courier New, monospace", showPrintMargin: false });
  }

  async function loadFileTree(dirPath) {
    try {
      const result = await window.api.fetch("/api/files/list?path=" + encodeURIComponent(dirPath || ""));
      fileTree.innerHTML = "";
      for (const entry of result.entries) {
        const item = document.createElement("div");
        item.className = "file-tree-item" + (entry.isDir ? " dir" : "");
        item.textContent = (entry.isDir ? "▶ " : "  ") + entry.name;
        const fullPath = result.path + "/" + entry.name;
        item.addEventListener("click", () => {
          if (entry.isDir) loadFileTree(fullPath);
          else openFile(fullPath, entry.name);
        });
        fileTree.appendChild(item);
      }
    } catch (e) {}
  }

  async function openFile(filePath, name) {
    if (!editor) initEditor();
    try {
      const result = await window.api.fetch("/api/files/read?path=" + encodeURIComponent(filePath));
      openFiles[filePath] = { name, content: result.content };
      activeFile = filePath;
      renderTabs();
      editor.setValue(result.content, -1);
      const ext = name.split(".").pop();
      const modeMap = { js:"javascript", ts:"typescript", py:"python", html:"html", css:"css", json:"json", md:"markdown", sh:"sh" };
      if (modeMap[ext]) editor.session.setMode("ace/mode/" + modeMap[ext]);
    } catch (e) {}
  }

  function renderTabs() {
    editorTabs.innerHTML = "";
    for (const [path, file] of Object.entries(openFiles)) {
      const tab = document.createElement("div");
      tab.className = "editor-tab" + (path === activeFile ? " active" : "");
      tab.innerHTML = "<span>" + file.name + "</span><button class='tab-close'>&times;</button>";
      tab.querySelector("span").addEventListener("click", () => { activeFile = path; editor.setValue(file.content, -1); renderTabs(); });
      tab.querySelector(".tab-close").addEventListener("click", (e) => {
        e.stopPropagation();
        delete openFiles[path];
        if (activeFile === path) {
          const keys = Object.keys(openFiles);
          activeFile = keys.length ? keys[keys.length-1] : null;
          if (activeFile) editor.setValue(openFiles[activeFile].content, -1);
          else editor.setValue("", -1);
        }
        renderTabs();
      });
      editorTabs.appendChild(tab);
    }
  }

  document.addEventListener("keydown", async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && activeFile && editor) {
      e.preventDefault();
      await window.api.fetch("/api/files/write", { method: "POST", body: { path: activeFile, content: editor.getValue() } });
      if (openFiles[activeFile]) openFiles[activeFile].content = editor.getValue();
    }
  });

  loadFileTree("");
  setTimeout(initEditor, 300);
});
