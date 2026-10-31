/* UltraBullet Team Battles — lightweight global dashboard analytics. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.UBTDashboardAnalytics = api;
    if (root.document) api.autoLoad(root);
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const COLORS = {
    cyan: "#70e2e8",
    blue: "#7f9fff",
    violet: "#b19cff",
    gold: "#efc47c",
    green: "#78d6b1",
    muted: "#91a7bc",
    grid: "rgba(151, 178, 203, .16)"
  };

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const number = value => Number.isFinite(Number(value))
    ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })
    : "—";

  const compact = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(Math.round(n));
  };

  const date = value => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? "—"
      : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  function setText(documentObject, id, value) {
    const element = documentObject.getElementById(id);
    if (element) element.textContent = value == null || value === "" ? "—" : String(value);
  }

  function buildBarChart(items, field, ariaLabel, unitLabel, maxItems = 12) {
    const rows = Array.isArray(items) ? (maxItems ? items.slice(-maxItems) : items) : [];
    if (!rows.length || !rows.some(row => Number.isFinite(Number(row[field])))) {
      return '<div class="global-analytics-empty">Not enough published data to draw this chart yet.</div>';
    }

    const width = 760, height = 232, left = 48, right = 14, top = 22, bottom = 48;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const values = rows.map(row => Math.max(0, Number(row[field]) || 0));
    const maximum = Math.max(1, ...values);
    const scaleMaximum = maximum * 1.14;
    const step = plotWidth / rows.length;
    const barWidth = Math.min(36, step * .62);
    const ticks = [0, .5, 1].map(fraction => {
      const y = top + plotHeight * (1 - fraction);
      return '<g><line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (width - right) +
        '" y2="' + y.toFixed(1) + '" stroke="' + COLORS.grid + '" stroke-dasharray="3 7"/>' +
        '<text x="' + (left - 10) + '" y="' + (y + 4).toFixed(1) +
        '" text-anchor="end" class="global-chart-axis">' + escapeHtml(compact(scaleMaximum * fraction)) + '</text></g>';
    }).join("");

    const bars = rows.map((row, index) => {
      const value = values[index];
      const barHeight = value / scaleMaximum * plotHeight;
      const x = left + index * step + (step - barWidth) / 2;
      const y = top + plotHeight - barHeight;
      const label = String(row.label || row.key || "");
      const tooltip = label + " · " + number(value) + (unitLabel ? " " + unitLabel : "");
      return '<g><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' +
        barWidth.toFixed(1) + '" height="' + Math.max(2, barHeight).toFixed(1) +
        '" rx="5" fill="url(#global-chart-gradient)"><title>' + escapeHtml(tooltip) +
        '</title></rect><text x="' + (x + barWidth / 2).toFixed(1) + '" y="' +
        (height - 16) + '" text-anchor="middle" class="global-chart-axis">' +
        escapeHtml(label.replace(/(\w{3})\s+\d{4}/, "$1")) + '</text></g>';
    }).join("");

    return '<svg class="global-analytics-svg" viewBox="0 0 ' + width + " " + height +
      '" role="img" aria-label="' + escapeHtml(ariaLabel) + '">' +
      '<defs><linearGradient id="global-chart-gradient" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + COLORS.cyan + '"/><stop offset="100%" stop-color="' +
      COLORS.violet + '" stop-opacity=".52"/></linearGradient></defs>' + ticks + bars + '</svg>';
  }

  function leaderList(rows, kind) {
    if (!Array.isArray(rows) || !rows.length) {
      return '<p class="global-analytics-empty">No ranking data is available.</p>';
    }
    return rows.slice(0, 5).map((row, index) => {
      const id = String(row.id || "");
      const profileUrl = "./profile.html?type=" + kind + "&id=" + encodeURIComponent(id);
      const title = escapeHtml(row.name || id || "Unknown");
      const points = number(row.points);
      const battles = number(row.tournaments_played);
      const average = number(row.avg_points);
      return '<a class="global-leader-row" href="' + escapeHtml(profileUrl) + '">' +
        '<span class="global-leader-rank">' + (index + 1) + '</span>' +
        '<span class="global-leader-copy"><strong>' + title + '</strong><small>' +
        battles + ' battles · ' + average + ' avg / battle</small></span>' +
        '<strong class="global-leader-points">' + points + '<small>pts</small></strong></a>';
    }).join("");
  }

  function recordCards(overview) {
    const records = [
      ...(overview?.records?.teams || []).map(item => ({ ...item, kind: "team" })),
      ...(overview?.records?.players || []).map(item => ({ ...item, kind: "player" }))
    ];
    if (!records.length) return '<p class="global-analytics-empty">No career records are available.</p>';
    return records.slice(0, 8).map(item => {
      const label = escapeHtml(item.label || item.key || "Career record");
      const holder = escapeHtml(item.holder || "Unknown");
      const value = number(item.value) + (item.unit ? " " + escapeHtml(item.unit) : "");
      const href = item.holder_id
        ? "./profile.html?type=" + item.kind + "&id=" + encodeURIComponent(String(item.holder_id))
        : "#leaderboard";
      return '<a class="global-record-row" href="' + escapeHtml(href) + '">' +
        '<span class="global-record-kind">' + (item.kind === "team" ? "TEAM" : "PLAYER") + '</span>' +
        '<span class="global-record-copy"><strong>' + label + '</strong><small>' + holder + '</small></span>' +
        '<span class="global-record-value">' + escapeHtml(value) + '</span></a>';
    }).join("");
  }

  function renderDashboardAnalytics(overview, timeseries, documentObject) {
    if (!overview || !timeseries || !documentObject) return false;
    const totals = overview.totals || {};
    const currentMonth = overview.current_month || {};
    setText(documentObject, "global-analytics-updated", "DATA REFRESHED " + date(overview.generated_at));
    setText(documentObject, "global-avg-participants", totals.avg_participants_per_battle == null ? "—" : number(totals.avg_participants_per_battle));
    setText(documentObject, "global-peak-participants", totals.highest_participation == null ? "—" : number(totals.highest_participation));
    setText(documentObject, "global-latest-active-players", number(currentMonth.active_players));
    setText(documentObject, "global-latest-active-teams", number(currentMonth.active_teams));
    setText(documentObject, "global-month-label", currentMonth.label || currentMonth.key || "Latest recorded month");
    const peakBattle = overview.totals?.highest_participation_battle;
    setText(documentObject, "global-peak-detail", peakBattle
      ? (peakBattle.name || ("Battle " + (peakBattle.battle_number || "—")))
      : "No participant counts available");

    const months = Array.isArray(timeseries.months) ? timeseries.months : [];
    const seasons = Array.isArray(timeseries.seasons) ? timeseries.seasons : [];
    const chartData = [
      ["global-battles-chart", months, "battle_count", "Number of eligible battles per UTC month", "battles"],
      ["global-players-chart", months, "active_players", "Distinct active players per UTC month", "players"],
      ["global-teams-chart", months, "active_teams", "Distinct active teams per UTC month", "teams"],
      ["global-seasons-chart", seasons.map(row => ({
        ...row,
        label: "S" + row.season_number
      })), "battle_count", "Recorded battles per fixed 50-battle season", "battles", 20]
    ];
    for (const [id, rows, field, label, unit] of chartData) {
      const element = documentObject.getElementById(id);
      if (element) element.innerHTML = buildBarChart(rows, field, label, unit);
    }

    const teamList = documentObject.getElementById("global-top-teams");
    if (teamList) teamList.innerHTML = leaderList(overview.leaders?.teams, "team");
    const playerList = documentObject.getElementById("global-top-players");
    if (playerList) playerList.innerHTML = leaderList(overview.leaders?.players, "player");
    const recordsList = documentObject.getElementById("global-records");
    if (recordsList) recordsList.innerHTML = recordCards(overview);

    const note = documentObject.getElementById("global-analytics-method");
    if (note) note.textContent = "Active competitors are counted once per UTC month when they have a recorded result. Participants per battle come from Lichess tournament entrant counts. Seasons use fixed blocks of 50 official battle numbers.";
    return true;
  }

  async function loadDashboardAnalytics(root) {
    if (!root || !root.fetch || !root.document) return false;
    const [overviewResponse, seriesResponse] = await Promise.all([
      root.fetch("./data/analytics/overview.json", { cache: "no-cache" }),
      root.fetch("./data/analytics/timeseries.json", { cache: "no-cache" })
    ]);
    if (!overviewResponse.ok || !seriesResponse.ok) {
      throw new Error("Global analytics data is not available (overview: " +
        overviewResponse.status + ", time series: " + seriesResponse.status + ").");
    }
    const [overview, timeseries] = await Promise.all([
      overviewResponse.json(),
      seriesResponse.json()
    ]);
    return renderDashboardAnalytics(overview, timeseries, root.document);
  }

  function autoLoad(root) {
    const start = () => loadDashboardAnalytics(root).catch(error => {
      if (root.console && typeof root.console.error === "function") {
        root.console.error("Could not load dashboard analytics", error);
      }
      const status = root.document.getElementById("global-analytics-updated");
      if (status) status.textContent = "GLOBAL ANALYTICS UNAVAILABLE";
      const method = root.document.getElementById("global-analytics-method");
      if (method) method.textContent = "The dashboard analytics summary could not be loaded. Core leaderboard data remains available.";
    });
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  return { buildBarChart, leaderList, recordCards, renderDashboardAnalytics, loadDashboardAnalytics, autoLoad };
});
