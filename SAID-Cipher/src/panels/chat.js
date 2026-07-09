document.addEventListener("DOMContentLoaded", () => {
  let activeConversation = null;
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let isProcessing = false;

  const CIPHER_WELCOME_HTML =
    '<div class="chat-welcome">' +
    '<div class="cipher-avatar">C</div>' +
    '<h2>Cipher</h2>' +
    '<p class="cipher-subtitle">S.A.I.D. AI Core</p>' +
    '<div class="cipher-capabilities">' +
    '<div class="cap-item">Read &amp; write code</div>' +
    '<div class="cap-item">Run commands</div>' +
    '<div class="cap-item">Generate images</div>' +
    '<div class="cap-item">Analyze files</div>' +
    '<div class="cap-item">Search codebase</div>' +
    '<div class="cap-item">Voice input</div>' +
    '</div>' +
    '<p class="chat-hint">Type a message or click + New Chat to begin.</p>' +
    '</div>';

  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const newChatBtn = document.getElementById("new-chat-btn");
  const chatList = document.getElementById("chat-list");
  const chatMessages = document.getElementById("chat-messages");
  const voiceBtn = document.getElementById("voice-btn");
  const attachBtn = document.getElementById("attach-btn");
  const fileAttach = document.getElementById("file-attach");

  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener("click", sendMessage);
  newChatBtn.addEventListener("click", createConversation);
  attachBtn.addEventListener("click", () => fileAttach.click());
  fileAttach.addEventListener("change", handleFileSelect);
  voiceBtn.addEventListener("click", toggleVoiceRecording);

  async function createConversation() {
    const result = await window.api.fetch("/api/chat/conversations", {
      method: "POST",
      body: { title: "Chat " + new Date().toLocaleTimeString() },
    });
    activeConversation = result.id;
    await loadConversationList();
    showConversation(result);
  }

  async function loadConversationList() {
    const result = await window.api.fetch("/api/chat/conversations");
    chatList.innerHTML = "";
    for (const convo of result.conversations) {
      const item = document.createElement("div");
      item.className = "chat-list-item" + (convo.id === activeConversation ? " active" : "");
      item.innerHTML = '<span class="chat-list-title">' + escapeHtml(convo.title) + '</span>' +
        '<button class="chat-delete-btn" title="Delete">&times;</button>';
      item.querySelector(".chat-list-title").addEventListener("click", () => openConversation(convo.id));
      item.querySelector(".chat-delete-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        await window.api.fetch("/api/chat/conversations/" + convo.id, { method: "DELETE" });
        if (activeConversation === convo.id) {
          activeConversation = null;
          chatMessages.innerHTML = CIPHER_WELCOME_HTML;
        }
        await loadConversationList();
      });
      chatList.appendChild(item);
    }
  }

  async function openConversation(id) {
    const result = await window.api.fetch("/api/chat/conversations/" + id);
    activeConversation = id;
    showConversation(result);
    await loadConversationList();
  }

  const cipherStatus = document.getElementById("cipher-status");
  const cipherLabel = cipherStatus.querySelector(".cipher-label");

  function setCipherBusy(busy) {
    if (busy) {
      cipherStatus.classList.add("busy");
      cipherLabel.textContent = "Cipher Thinking...";
    } else {
      cipherStatus.classList.remove("busy");
      cipherLabel.textContent = "Cipher Online";
    }
  }

  function showConversation(convo) {
    chatMessages.innerHTML = "";
    if (!convo.messages || convo.messages.length === 0) {
      chatMessages.innerHTML = CIPHER_WELCOME_HTML;
      return;
    }
    for (const msg of convo.messages) {
      appendMessage(msg);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function renderMarkdown(text) {
    if (!text) return "";

    const codeBlocks = [];
    let processed = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = "%%CODEBLOCK_" + codeBlocks.length + "%%";
      codeBlocks.push({ lang: lang || "text", code: code.trim() });
      return placeholder;
    });

    const inlineCodes = [];
    processed = processed.replace(/`([^`]+)`/g, (match, code) => {
      const placeholder = "%%INLINE_" + inlineCodes.length + "%%";
      inlineCodes.push(code);
      return placeholder;
    });

    processed = escapeHtml(processed);

    codeBlocks.forEach((block, i) => {
      const replacement = '<pre class="code-block"><div class="code-header"><span class="code-lang">' +
        escapeHtml(block.lang) +
        '</span><button class="copy-btn" data-code-idx="' + i + '">Copy</button></div><code>' +
        escapeHtml(block.code) + '</code></pre>';
      processed = processed.replace("%%CODEBLOCK_" + i + "%%", replacement);
    });

    inlineCodes.forEach((code, i) => {
      processed = processed.replace("%%INLINE_" + i + "%%",
        '<code class="inline-code">' + escapeHtml(code) + '</code>');
    });

    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
    processed = processed.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    processed = processed.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    processed = processed.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    processed = processed.replace(/^\- (.+)$/gm, '<li>$1</li>');
    processed = processed.replace(/(<li>.*<\/li>\n?)+/g, (match) => '<ul>' + match + '</ul>');
    processed = processed.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    processed = processed.replace(/\n\n/g, '</p><p>');
    processed = processed.replace(/(?<!\n)\n(?!\n)/g, '<br>');

    return '<p>' + processed + '</p>';
  }

  function appendMessage(msg) {
    const div = document.createElement("div");
    div.className = "message " + msg.role + (msg.type === "system" ? " system" : "");

    let bodyContent = "";

    if (msg.role === "assistant") {
      bodyContent = renderMarkdown(msg.content);
    } else {
      bodyContent = '<p>' + escapeHtml(msg.content) + '</p>';
    }

    if (msg.toolExecutions && msg.toolExecutions.length > 0) {
      bodyContent += '<div class="tool-executions">';
      bodyContent += '<div class="tool-header">Tool Activity (' + msg.toolExecutions.length + ' actions)</div>';
      for (const exec of msg.toolExecutions) {
        const argsStr = Object.entries(exec.args || {})
          .map(([k, v]) => k + ': ' + (typeof v === 'string' && v.length > 60 ? v.substring(0, 60) + '...' : v))
          .join(', ');
        const hasError = exec.result && exec.result.error;
        bodyContent += '<div class="tool-item ' + (hasError ? 'tool-error' : 'tool-success') + '">';
        bodyContent += '<span class="tool-name">' + escapeHtml(exec.tool) + '</span>';
        bodyContent += '<span class="tool-args">' + escapeHtml(argsStr) + '</span>';
        bodyContent += '</div>';
      }
      bodyContent += '</div>';
    }

    if (msg.images && msg.images.length > 0) {
      for (const img of msg.images) {
        bodyContent += '<div class="chat-image-container">';
        bodyContent += '<img class="chat-image" src="data:image/png;base64,' + img.b64_json + '" alt="' + escapeHtml(img.prompt) + '" />';
        bodyContent += '<div class="chat-image-caption">' + escapeHtml(img.prompt) + '</div>';
        bodyContent += '</div>';
      }
    }

    if (msg.attachments && msg.attachments.length > 0) {
      bodyContent += '<div class="message-attachments">';
      for (const att of msg.attachments) {
        bodyContent += '<div class="attachment-badge">' + escapeHtml(att.name) + " (" + formatSize(att.size) + ")</div>";
      }
      bodyContent += "</div>";
    }

    const roleLabel = msg.role === "assistant" ? "Cipher" : msg.role;

    div.innerHTML =
      '<div class="message-role">' + roleLabel + "</div>" +
      '<div class="message-body">' + bodyContent + "</div>";
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showThinking() {
    const div = document.createElement("div");
    div.className = "message assistant thinking";
    div.id = "thinking-indicator";
    div.innerHTML =
      '<div class="message-role">Cipher</div>' +
      '<div class="message-body"><div class="thinking-dots"><span></span><span></span><span></span></div></div>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function removeThinking() {
    const el = document.getElementById("thinking-indicator");
    if (el) el.remove();
  }

  async function sendMessage() {
    const content = chatInput.value.trim();
    if (!content || isProcessing) return;

    if (!activeConversation) await createConversation();

    chatInput.value = "";
    chatInput.style.height = "auto";
    isProcessing = true;
    sendBtn.disabled = true;
    setCipherBusy(true);

    appendMessage({ role: "user", content, type: "text" });
    showThinking();

    try {
      const result = await window.api.fetch(
        "/api/chat/conversations/" + activeConversation + "/message",
        { method: "POST", body: { content, type: "text" } }
      );

      removeThinking();

      if (result.error) {
        appendMessage({ role: "assistant", content: "Error: " + result.error, type: "system" });
      } else if (result.assistantMessage) {
        appendMessage(result.assistantMessage);
      }
    } catch (e) {
      removeThinking();
      appendMessage({ role: "assistant", content: "Connection error: " + e.message, type: "system" });
    }

    setCipherBusy(false);
    isProcessing = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }

  async function toggleVoiceRecording() {
    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

        if (!activeConversation) await createConversation();

        setCipherBusy(true);
        showThinking();

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "voice_" + Date.now() + ".webm");

          const uploadResult = await fetch(window.api.baseUrl + "/api/chat/upload/audio", {
            method: "POST",
            body: formData,
          }).then((r) => r.json());

          let messageContent;
          if (uploadResult.transcription) {
            messageContent = uploadResult.transcription;
          } else {
            messageContent = "[Voice message - transcription unavailable]";
          }

          appendMessage({ role: "user", content: messageContent, type: "audio" });

          const result = await window.api.fetch(
            "/api/chat/conversations/" + activeConversation + "/message",
            { method: "POST", body: { content: messageContent, type: "audio" } }
          );

          if (result.assistantMessage) {
            appendMessage(result.assistantMessage);
          }
        } catch (e) {
          appendMessage({ role: "assistant", content: "Error: " + e.message, type: "system" });
        } finally {
          removeThinking();
          setCipherBusy(false);
        }
      };

      mediaRecorder.start();
      isRecording = true;
      voiceBtn.classList.add("recording");
      voiceBtn.title = "Stop Recording";
    } catch (e) {
      appendMessage({
        role: "assistant",
        content: "Microphone access denied or unavailable.",
        type: "system",
      });
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    isRecording = false;
    voiceBtn.classList.remove("recording");
    voiceBtn.title = "Voice Input";
  }

  async function handleFileSelect(e) {
    const files = e.target.files;
    if (!files.length) return;
    if (!activeConversation) await createConversation();

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      appendMessage({
        role: "user",
        content: "Uploading " + file.name + "...",
        type: "file",
      });

      const uploadResult = await fetch(window.api.baseUrl + "/api/chat/upload", {
        method: "POST",
        body: formData,
      }).then((r) => r.json());

      if (uploadResult.error) {
        appendMessage({ role: "assistant", content: "Upload failed: " + uploadResult.error, type: "system" });
        continue;
      }

      let messageContent = "[File: " + uploadResult.originalname + " (" + formatSize(uploadResult.size) + ", " + uploadResult.mimetype + ")]";
      if (uploadResult.preview) {
        messageContent += "\n\nFile contents:\n```\n" + uploadResult.preview + "\n```";
      }

      setCipherBusy(true);
      showThinking();

      try {
        const result = await window.api.fetch(
          "/api/chat/conversations/" + activeConversation + "/message",
          {
            method: "POST",
            body: {
              content: messageContent,
              type: "file",
              attachments: [{
                name: uploadResult.originalname,
                size: uploadResult.size,
                type: uploadResult.mimetype,
                serverPath: uploadResult.filename,
              }],
            },
          }
        );

        removeThinking();
        setCipherBusy(false);

        if (result.assistantMessage) {
          appendMessage(result.assistantMessage);
        }
      } catch (err) {
        removeThinking();
        setCipherBusy(false);
        appendMessage({ role: "assistant", content: "Error processing file: " + err.message, type: "system" });
      }
    }

    fileAttach.value = "";
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  chatMessages.addEventListener("click", (e) => {
    if (e.target.classList.contains("copy-btn")) {
      const codeEl = e.target.closest("pre").querySelector("code");
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.textContent);
        e.target.textContent = "Copied!";
        setTimeout(() => { e.target.textContent = "Copy"; }, 1500);
      }
    }
  });

  loadConversationList();
});
