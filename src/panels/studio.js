document.addEventListener("DOMContentLoaded", () => {
  // ── STATE ──────────────────────────────────────────────
  let activeTab = "image";
  let selectedImageModel = "black-forest-labs/flux-1.1-pro:free";
  let selectedVoice = "nova";
  let selectedVideoModel = "wavespeedai/wan-2.1-t2v-480p";

  const tabs = document.querySelectorAll(".studio-tab");
  const sections = document.querySelectorAll(".studio-section");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("studio-" + activeTab)?.classList.add("active");
    });
  });

  // ── IMAGE ──────────────────────────────────────────────
  const imgPrompt = document.getElementById("img-prompt");
  const imgModelSel = document.getElementById("img-model-sel");
  const imgGenBtn = document.getElementById("img-gen-btn");
  const imgResults = document.getElementById("img-results");
  const imgStatus = document.getElementById("img-status");

  async function loadImageModels() {
    try {
      const res = await window.api.fetch("/api/media/image/models");
      imgModelSel.innerHTML = "";
      for (const m of res.models) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name + " — " + m.quality;
        imgModelSel.appendChild(opt);
      }
      imgModelSel.value = selectedImageModel;
    } catch (e) {}
  }

  imgModelSel.addEventListener("change", () => { selectedImageModel = imgModelSel.value; });

  imgGenBtn.addEventListener("click", async () => {
    const prompt = imgPrompt.value.trim();
    if (!prompt) return;
    imgGenBtn.disabled = true;
    imgStatus.textContent = "Generating image...";
    try {
      const res = await window.api.fetch("/api/media/image/generate", {
        method: "POST",
        body: { prompt, model: selectedImageModel },
      });
      if (res.error) { imgStatus.textContent = "Error: " + res.error; return; }
      imgStatus.textContent = "Done.";
      const card = document.createElement("div");
      card.className = "media-result-card";
      if (res.images && res.images.length > 0) {
        for (const img of res.images) {
          const url = img.image_url?.url || img.url || ("data:image/png;base64," + img.b64_json);
          card.innerHTML += '<img src="' + url + '" class="generated-img" />';
        }
      } else {
        card.innerHTML = '<div class="media-text">' + (res.text || "No image returned.") + '</div>';
      }
      card.innerHTML += '<div class="media-caption">' + prompt + '</div>';
      imgResults.prepend(card);
    } catch (e) {
      imgStatus.textContent = "Error: " + e.message;
    } finally {
      imgGenBtn.disabled = false;
    }
  });

  imgPrompt.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); imgGenBtn.click(); } });

  // ── AUDIO / TTS ────────────────────────────────────────
  const ttsText = document.getElementById("tts-text");
  const ttsVoiceSel = document.getElementById("tts-voice-sel");
  const ttsGenBtn = document.getElementById("tts-gen-btn");
  const ttsResults = document.getElementById("tts-results");
  const ttsStatus = document.getElementById("tts-status");

  const analyzeAudioInput = document.getElementById("analyze-audio-input");
  const analyzePrompt = document.getElementById("analyze-audio-prompt");
  const analyzeBtn = document.getElementById("analyze-audio-btn");
  const analyzeResult = document.getElementById("analyze-result");

  async function loadVoices() {
    try {
      const res = await window.api.fetch("/api/media/audio/voices");
      ttsVoiceSel.innerHTML = "";
      for (const v of res.voices) {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.name + " — " + v.desc;
        ttsVoiceSel.appendChild(opt);
      }
      ttsVoiceSel.value = selectedVoice;
    } catch (e) {}
  }

  ttsVoiceSel.addEventListener("change", () => { selectedVoice = ttsVoiceSel.value; });

  ttsGenBtn.addEventListener("click", async () => {
    const text = ttsText.value.trim();
    if (!text) return;
    ttsGenBtn.disabled = true;
    ttsStatus.textContent = "Generating voice...";
    try {
      const res = await window.api.fetch("/api/media/audio/tts", {
        method: "POST",
        body: { text, voice: selectedVoice },
      });
      if (res.error) { ttsStatus.textContent = "Error: " + res.error; return; }
      ttsStatus.textContent = "Done.";
      const card = document.createElement("div");
      card.className = "media-result-card";
      const audioSrc = "data:" + res.mimeType + ";base64," + res.audio;
      card.innerHTML = '<audio controls class="gen-audio"><source src="' + audioSrc + '" type="' + res.mimeType + '"></audio>' +
        '<div class="media-caption">' + text.substring(0, 80) + (text.length > 80 ? "..." : "") + '</div>' +
        '<a class="dl-btn" download="cipher-voice.mp3" href="' + audioSrc + '">⬇ Download</a>';
      ttsResults.prepend(card);
    } catch (e) {
      ttsStatus.textContent = "Error: " + e.message;
    } finally {
      ttsGenBtn.disabled = false;
    }
  });

  analyzeBtn.addEventListener("click", async () => {
    const file = analyzeAudioInput.files[0];
    if (!file) return;
    analyzeBtn.disabled = true;
    analyzeResult.textContent = "Analyzing audio...";
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      try {
        const res = await window.api.fetch("/api/media/audio/analyze", {
          method: "POST",
          body: { audio: base64, prompt: analyzePrompt.value || "Analyze this audio.", mimeType: file.type },
        });
        analyzeResult.textContent = res.error ? "Error: " + res.error : res.analysis;
      } catch (err) {
        analyzeResult.textContent = "Error: " + err.message;
      } finally {
        analyzeBtn.disabled = false;
      }
    };
    reader.readAsDataURL(file);
  });

  // ── VIDEO ──────────────────────────────────────────────
  const vidPrompt = document.getElementById("vid-prompt");
  const vidModelSel = document.getElementById("vid-model-sel");
  const vidGenBtn = document.getElementById("vid-gen-btn");
  const vidResults = document.getElementById("vid-results");
  const vidStatus = document.getElementById("vid-status");

  async function loadVideoModels() {
    try {
      const res = await window.api.fetch("/api/media/video/models");
      vidModelSel.innerHTML = "";
      for (const m of res.models) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name + " — " + m.desc;
        vidModelSel.appendChild(opt);
      }
    } catch (e) {}
  }

  vidGenBtn.addEventListener("click", async () => {
    const prompt = vidPrompt.value.trim();
    if (!prompt) return;
    vidGenBtn.disabled = true;
    vidStatus.textContent = "Generating video... this takes ~1-2 minutes...";
    try {
      const res = await window.api.fetch("/api/media/video/generate", {
        method: "POST",
        body: { prompt, model: vidModelSel.value },
      });
      if (res.error) { vidStatus.textContent = "Error: " + res.error; return; }
      vidStatus.textContent = "Done.";
      const card = document.createElement("div");
      card.className = "media-result-card";
      card.innerHTML = '<video controls class="gen-video"><source src="' + res.url + '"></video>' +
        '<div class="media-caption">' + prompt + '</div>' +
        '<a class="dl-btn" href="' + res.url + '" target="_blank">⬇ Open video</a>';
      vidResults.prepend(card);
    } catch (e) {
      vidStatus.textContent = "Error: " + e.message;
    } finally {
      vidGenBtn.disabled = false;
    }
  });

  // ── INIT ───────────────────────────────────────────────
  loadImageModels();
  loadVoices();
  loadVideoModels();
});
