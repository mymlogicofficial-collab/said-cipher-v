document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.panel;

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      panels.forEach((p) => {
        p.classList.remove("active");
        if (p.id === "panel-" + target) {
          p.classList.add("active");
        }
      });

      window.dispatchEvent(new CustomEvent("panel-switched", { detail: { panel: target } }));
    });
  });
});
