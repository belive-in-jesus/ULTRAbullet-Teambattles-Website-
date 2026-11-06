(() => {
  "use strict";

  const tabs = Array.from(document.querySelectorAll("[data-mode]"));
  const panels = Array.from(document.querySelectorAll("[data-mode-panel]"));
  const validModes = new Set(panels.map((panel) => panel.dataset.modePanel));

  function normalizeMode(value) {
    return value === "performance-index" ? "pi" : value;
  }

  function activateMode(mode, updateHash = true, focus = false) {
    const selected = validModes.has(mode) ? mode : "teams";

    tabs.forEach((tab) => {
      const active = tab.dataset.mode === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.modePanel !== selected;
    });

    if (updateHash && window.history && window.history.replaceState) {
      const hash = selected === "pi" ? "performance-index" : selected;
      window.history.replaceState(null, "", "#" + hash);
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateMode(tab.dataset.mode));

    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        activateMode(tabs[nextIndex].dataset.mode, true, true);
      }
    });
  });

  document.querySelectorAll("[data-open-ranking]").forEach((link) => {
    link.addEventListener("click", () => {
      activateMode(link.dataset.openRanking);
    });
  });

  const piButtons = Array.from(document.querySelectorAll("[data-pi-type]"));
  const piTables = {
    teams: document.getElementById("pi-teams-table"),
    players: document.getElementById("pi-players-table")
  };
  const piTitle = document.getElementById("pi-table-title");
  const piCount = document.getElementById("pi-table-count");

  function activatePiType(type) {
    const selected = type === "players" ? "players" : "teams";
    piButtons.forEach((button) => {
      const active = button.dataset.piType === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    Object.entries(piTables).forEach(([kind, table]) => {
      if (table) table.hidden = kind !== selected;
    });
    if (piTitle) piTitle.textContent = selected === "teams" ? "Team Performance Index" : "Player Performance Index";
    if (piCount) piCount.textContent = selected === "teams" ? "637 eligible teams" : "1,485 eligible players";
  }

  piButtons.forEach((button) => {
    button.addEventListener("click", () => activatePiType(button.dataset.piType));
  });

  const requestedMode = normalizeMode(window.location.hash.slice(1));
  if (validModes.has(requestedMode)) activateMode(requestedMode, false);
  activatePiType("teams");

  window.addEventListener("hashchange", () => {
    const nextMode = normalizeMode(window.location.hash.slice(1));
    if (validModes.has(nextMode)) activateMode(nextMode, false);
  });
})();