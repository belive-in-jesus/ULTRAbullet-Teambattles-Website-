(() => {
  "use strict";
  const state = { type: "players", players: [], teams: [], query: "" };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const number = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(1) : "—";
  const nameOf = (row) => state.type === "teams" ? row.team_name : row.username;
  const profileUrl = (row) => "./profile.html?type=" + (state.type === "teams" ? "team" : "player")
    + "&id=" + encodeURIComponent(state.type === "teams" ? row.team_id : row.username);

  function render() {
    const all = state[state.type];
    const query = state.query.trim().toLowerCase();
    const rows = all.filter((row) => row.performance_index_eligible
      && row.performance_index_rank != null
      && (!query || String(nameOf(row) || "").toLowerCase().includes(query)))
      .sort((a, b) => Number(a.performance_index_rank) - Number(b.performance_index_rank));
    $("pi-count").textContent = rows.length + " eligible";
    if (!rows.length) {
      $("pi-rows").innerHTML = '<tr><td colspan="8" class="pi-message">'
        + (all.length ? "No eligible competitors match this search." : "The Performance Index has not been published yet. It will appear after the next successful full data refresh.")
        + "</td></tr>";
      return;
    }
    $("pi-rows").innerHTML = rows.slice(0, 200).map((row) => {
      const c = row.performance_index_components || {};
      return "<tr><td>#" + esc(row.performance_index_rank) + "</td><td><a href=\"" + esc(profileUrl(row)) + "\">"
        + esc(nameOf(row)) + "</a></td><td class=\"pi-index\">" + number(row.performance_index)
        + "</td><td>" + number(c.average_performance) + "</td><td>" + number(c.consistency)
        + "</td><td>" + number(c.recent_performance) + "</td><td>" + number(c.participation)
        + "</td><td>" + esc(row.performance_index_battles) + "</td></tr>";
    }).join("");
  }

  async function load() {
    try {
      const [playersResponse, teamsResponse] = await Promise.all([
        fetch("./data/leaderboard_players.json", { cache: "no-store" }),
        fetch("./data/leaderboard_teams.json", { cache: "no-store" })
      ]);
      if (!playersResponse.ok || !teamsResponse.ok) throw new Error("Leaderboard data unavailable");
      [state.players, state.teams] = await Promise.all([playersResponse.json(), teamsResponse.json()]);
      render();
    } catch (error) {
      console.error("Could not load Performance Index", error);
      $("pi-count").textContent = "Unavailable";
      $("pi-rows").innerHTML = '<tr><td colspan="8" class="pi-message">The Performance Index data could not be loaded. Please try again later.</td></tr>';
    }
  }

  document.querySelectorAll("[data-type]").forEach((button) => button.addEventListener("click", () => {
    state.type = button.dataset.type;
    document.querySelectorAll("[data-type]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    render();
  }));
  $("pi-search").addEventListener("input", (event) => { state.query = event.target.value; render(); });
  load();
})();
