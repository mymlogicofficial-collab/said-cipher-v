document.addEventListener("DOMContentLoaded", () => {
  const MAX_POINTS = 60;

  function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return d + "d " + h + "h";
    if (h > 0) return h + "h " + m + "m";
    return m + "m";
  }

  function timeLabel() {
    return new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    scales: {
      x: {
        display: true,
        ticks: { display: false },
        grid: { color: "#1a1a1a", drawBorder: false },
      },
      y: {
        min: 0,
        ticks: {
          color: "#555",
          font: { size: 9, family: "Courier New" },
          maxTicksLimit: 4,
        },
        grid: { color: "#1a1a1a", drawBorder: false },
      },
    },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        color: "#666",
        font: { size: 10, family: "Segoe UI", weight: "600" },
        padding: { bottom: 4, top: 0 },
      },
    },
    elements: {
      point: { radius: 0 },
      line: { tension: 0.3, borderWidth: 1.5 },
    },
  };

  function makeGradient(ctx, r, g, b) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 130);
    gradient.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",0.3)");
    gradient.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0.0)");
    return gradient;
  }

  const cpuCtx = document.getElementById("cpuChart").getContext("2d");
  const cpuChart = new Chart(cpuCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "CPU %",
          data: [],
          borderColor: "#ff5555",
          backgroundColor: makeGradient(cpuCtx, 255, 85, 85),
          fill: true,
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, max: 100 } },
      plugins: {
        ...chartDefaults.plugins,
        title: { ...chartDefaults.plugins.title, text: "CPU USAGE %" },
      },
    },
  });

  const memCtx = document.getElementById("memChart").getContext("2d");
  const memChart = new Chart(memCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "MEM %",
          data: [],
          borderColor: "#8be9fd",
          backgroundColor: makeGradient(memCtx, 139, 233, 253),
          fill: true,
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, max: 100 } },
      plugins: {
        ...chartDefaults.plugins,
        title: { ...chartDefaults.plugins.title, text: "MEMORY USAGE %" },
      },
    },
  });

  const loadCtx = document.getElementById("loadChart").getContext("2d");
  const loadChart = new Chart(loadCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "1m", data: [], borderColor: "#50fa7b", backgroundColor: "transparent", fill: false },
        { label: "5m", data: [], borderColor: "#f1fa8c", backgroundColor: "transparent", fill: false },
        { label: "15m", data: [], borderColor: "#ff79c6", backgroundColor: "transparent", fill: false },
      ],
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        title: { ...chartDefaults.plugins.title, text: "LOAD AVERAGE" },
        legend: {
          display: true,
          position: "bottom",
          labels: { color: "#666", font: { size: 8, family: "Courier New" }, boxWidth: 8, boxHeight: 2, padding: 6 },
        },
      },
    },
  });

  function pushData(chart, label, values) {
    chart.data.labels.push(label);
    values.forEach((val, i) => chart.data.datasets[i].data.push(val));
    if (chart.data.labels.length > MAX_POINTS) {
      chart.data.labels.shift();
      chart.data.datasets.forEach((ds) => ds.data.shift());
    }
    chart.update();
  }

  window.metrics.onUpdate((data) => {
    const label = timeLabel();
    pushData(cpuChart, label, [data.cpu]);
    pushData(memChart, label, [data.memory.percent]);
    pushData(loadChart, label, [data.load.one, data.load.five, data.load.fifteen]);

    document.getElementById("stat-cpu").textContent = "CPU: " + data.cpu + "%";
    document.getElementById("stat-mem").textContent = "MEM: " + data.memory.usedGB + "/" + data.memory.totalGB + " GB";
    document.getElementById("stat-load").textContent = "LOAD: " + data.load.one;
    document.getElementById("stat-uptime").textContent = "UP: " + formatUptime(data.uptime);
  });

  async function loadDashboardInfo() {
    try {
      const sysInfo = await window.api.fetch("/api/system/info");
      const sysCard = document.querySelector("#system-info-card .info-content");
      sysCard.innerHTML = [
        '<div class="info-row"><span class="info-label">Platform</span><span class="info-value">' + sysInfo.platform + " " + sysInfo.arch + "</span></div>",
        '<div class="info-row"><span class="info-label">Hostname</span><span class="info-value">' + sysInfo.hostname + "</span></div>",
        '<div class="info-row"><span class="info-label">CPUs</span><span class="info-value">' + sysInfo.cpus + "</span></div>",
        '<div class="info-row"><span class="info-label">Node</span><span class="info-value">' + sysInfo.nodeVersion + "</span></div>",
      ].join("");

      const aiInfo = await window.api.fetch("/api/system/ai/providers");
      const aiCard = document.querySelector("#ai-status-card .info-content");
      if (aiInfo.providers && aiInfo.providers.length > 0) {
        aiCard.innerHTML = aiInfo.providers
          .map((p) => '<div class="info-row"><span class="info-label">' + p.name + '</span><span class="info-value">' + (p.active ? "ACTIVE" : "ready") + "</span></div>")
          .join("");
      } else {
        aiCard.innerHTML = '<div style="color:#555">No providers connected.<br>Configure API keys to enable AI.</div>';
      }

      const protInfo = await window.api.fetch("/api/system/protected");
      const protCard = document.querySelector("#protection-card .info-content");
      protCard.innerHTML = protInfo.protectedPaths
        .map((p) => '<div class="protected-item">' + p + "</div>")
        .join("");
    } catch (e) {
      setTimeout(loadDashboardInfo, 2000);
    }
  }

  setTimeout(loadDashboardInfo, 1000);
});
