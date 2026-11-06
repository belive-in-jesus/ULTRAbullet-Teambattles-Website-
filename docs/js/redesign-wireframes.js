(() => {
  "use strict";

  const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
  const modePanels = Array.from(document.querySelectorAll("[data-mode-panel]"));

  function activateMode(mode, updateHash = true) {
    const selected = modePanels.some((panel) => panel.dataset.modePanel === mode)
      ? mode
      : "teams";

    modeButtons.forEach((button) => {
      const active = button.dataset.mode === selected;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });

    modePanels.forEach((panel) => {
      panel.hidden = panel.dataset.modePanel !== selected;
    });

    if (updateHash && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + (selected === "pi" ? "performance-index" : selected));
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => activateMode(button.dataset.mode));
  });

  const requestedMode = window.location.hash.replace(/^#/, "");
  const initialMode = requestedMode === "performance-index" ? "pi" : requestedMode;
  activateMode(initialMode, false);

  document.querySelectorAll(".period-row").forEach((row) => {
    const choices = Array.from(row.querySelectorAll(".period-choice"));
    choices.forEach((choice) => {
      choice.addEventListener("click", () => {
        choices.forEach((item) => item.setAttribute("aria-pressed", String(item === choice)));
      });
    });
  });

  document.querySelectorAll("[data-pi-type]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.piType;
      document.querySelectorAll("[data-pi-type]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      document.querySelectorAll("[data-pi-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.piPanel !== selected;
      });
      const search = document.querySelector('[aria-label="Search Performance Index"]');
      if (search) search.placeholder = selected === "teams" ? "Find a team…" : "Find a player…";
    });
  });
})();
