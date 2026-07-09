document.addEventListener("DOMContentLoaded", () => {
  let aceEditor = null;
  let openTabs = [];
  let activeTabPath = null;

  const fileTree = document.getElementById("editor-file-tree");
  const editorTabs = document.getElementById("editor-tabs");
  const editorContainer = document.getElementById("editor-container");

  async function loadFileTree(dirPath) {
    const result = await window.api.fetch("/api/files/list?path=" + encodeURIComponent(dirPath || "."));
    return result.entries || [];
  }

  async function renderTree(dirPath, container, depth) {
    const entries = await loadFileTree(dirPath);
    for (const entry of entries) {
      const item = document.createElement("div");
      item.className = "tree-item" + (entry.type === "directory" ? " directory" : "") + (entry.protected ? " protected" : "");
      item.style.paddingLeft = (12 + depth * 14) + "px";

      const icon = document.createElement("span");
      icon.className = "tree-icon";
      icon.textContent = entry.type === "directory" ? "\u25B6" : "\u25CB";

      const name = document.createElement("span");
      name.className = "tree-name";
      name.textContent = entry.name;

      item.appendChild(icon);
      item.appendChild(name);
      container.appendChild(item);

      if (entry.type === "directory") {
        const children = document.createElement("div");
        children.style.display = "none";
        container.appendChild(children);
        let loaded = false;

        item.addEventListener("click", async () => {
          if (!loaded) {
            await renderTree(entry.path, children, depth + 1);
            loaded = true;
          }
          const isOpen = children.style.display !== "none";
          children.style.display = isOpen ? "none" : "block";
          icon.textContent = isOpen ? "\u25B6" : "\u25BC";
        });
      } else {
        item.addEventListener("click", () => openFile(entry.path, entry.protected));
      }
    }
  }

  function getAceMode(filePath) {
    const ext = filePath.split(".").pop().toLowerCase();
    const modes = {
      js: "ace/mode/javascript",
      jsx: "ace/mode/jsx",
      ts: "ace/mode/typescript",
      tsx: "ace/mode/tsx",
      json: "ace/mode/json",
      html: "ace/mode/html",
      htm: "ace/mode/html",
      css: "ace/mode/css",
      py: "ace/mode/python",
      rb: "ace/mode/ruby",
      go: "ace/mode/golang",
      rs: "ace/mode/rust",
      java: "ace/mode/java",
      c: "ace/mode/c_cpp",
      cpp: "ace/mode/c_cpp",
      h: "ace/mode/c_cpp",
      sh: "ace/mode/sh",
      bash: "ace/mode/sh",
      md: "ace/mode/markdown",
      yaml: "ace/mode/yaml",
      yml: "ace/mode/yaml",
      xml: "ace/mode/xml",
      sql: "ace/mode/sql",
      toml: "ace/mode/toml",
    };
    return modes[ext] || "ace/mode/text";
  }

  async function openFile(filePath, isProtected) {
    const existing = openTabs.find((t) => t.path === filePath);
    if (existing) {
      switchToTab(filePath);
      return;
    }

    const result = await window.api.fetch("/api/files/read?path=" + encodeURIComponent(filePath));
    if (result.error) return;

    openTabs.push({
      path: filePath,
      content: result.content,
      protected: isProtected || result.protected,
      modified: false,
    });
    renderTabs();
    switchToTab(filePath);
  }

  function renderTabs() {
    editorTabs.innerHTML = "";
    for (const tab of openTabs) {
      const el = document.createElement("div");
      el.className = "editor-tab" + (tab.path === activeTabPath ? " active" : "");

      const name = tab.path.split("/").pop();
      el.innerHTML =
        "<span>" + (tab.modified ? "\u2022 " : "") + name + "</span>" +
        '<span class="tab-close">\u2715</span>';

      el.querySelector("span:first-child").addEventListener("click", () => switchToTab(tab.path));
      el.querySelector(".tab-close").addEventListener("click", (e) => {
        e.stopPropagation();
        closeTab(tab.path);
      });

      editorTabs.appendChild(el);
    }
  }

  function switchToTab(filePath) {
    const tab = openTabs.find((t) => t.path === filePath);
    if (!tab) return;

    if (aceEditor && activeTabPath) {
      const prevTab = openTabs.find((t) => t.path === activeTabPath);
      if (prevTab) {
        prevTab.content = aceEditor.getValue();
      }
    }

    activeTabPath = filePath;
    renderTabs();
    createEditor(tab);
  }

  function closeTab(filePath) {
    openTabs = openTabs.filter((t) => t.path !== filePath);
    if (activeTabPath === filePath) {
      activeTabPath = openTabs.length > 0 ? openTabs[openTabs.length - 1].path : null;
    }
    renderTabs();
    if (activeTabPath) {
      switchToTab(activeTabPath);
    } else {
      if (aceEditor) {
        aceEditor.destroy();
        aceEditor = null;
      }
      editorContainer.innerHTML = '<div class="editor-placeholder">Select a file to edit</div>';
    }
  }

  function createEditor(tab) {
    editorContainer.innerHTML = "";

    if (tab.protected) {
      const banner = document.createElement("div");
      banner.style.cssText =
        "background:#2a1515;border:1px solid #3a1a1a;color:#ff5555;padding:6px 12px;font-size:0.75rem;border-radius:4px;flex-shrink:0;";
      banner.textContent = "PROTECTED \u2014 This file is in a core zone and cannot be modified.";
      editorContainer.appendChild(banner);
    }

    const editorDiv = document.createElement("div");
    editorDiv.id = "ace-editor";
    editorDiv.style.cssText = "flex:1;width:100%;";
    editorContainer.appendChild(editorDiv);
    editorContainer.style.display = "flex";
    editorContainer.style.flexDirection = "column";

    if (aceEditor) {
      aceEditor.destroy();
    }

    aceEditor = ace.edit(editorDiv, {
      value: tab.content,
      mode: getAceMode(tab.path),
      theme: "ace/theme/one_dark",
      fontSize: 13,
      fontFamily: "'Courier New', 'Fira Code', monospace",
      showPrintMargin: false,
      highlightActiveLine: true,
      showGutter: true,
      tabSize: 2,
      useSoftTabs: true,
      wrap: false,
      readOnly: tab.protected,
      scrollPastEnd: 0.5,
    });

    aceEditor.renderer.setScrollMargin(4, 4, 0, 0);

    if (!tab.protected) {
      aceEditor.on("change", () => {
        tab.content = aceEditor.getValue();
        if (!tab.modified) {
          tab.modified = true;
          renderTabs();
        }
      });

      aceEditor.commands.addCommand({
        name: "save",
        bindKey: { win: "Ctrl-S", mac: "Cmd-S" },
        exec: () => saveFile(tab),
      });
    }

    aceEditor.focus();
  }

  async function saveFile(tab) {
    if (tab.protected) return;
    const result = await window.api.fetch("/api/files/write", {
      method: "POST",
      body: { path: tab.path, content: tab.content },
    });
    if (!result.error) {
      tab.modified = false;
      renderTabs();
    }
  }

  window.addEventListener("panel-switched", (e) => {
    if (e.detail.panel === "editor" && aceEditor) {
      setTimeout(() => aceEditor.resize(), 50);
    }
  });

  renderTree(".", fileTree, 0);
});
