(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) {
    root.UTBOverviewDirectionC = api;
    api.init(root);
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

  function number(value, digits = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed.toLocaleString(undefined, { maximumFractionDigits: digits })
      : "—";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function dateTime(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown timestamp";
    return parsed.toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short"
    });
  }

  function freshness(generatedAt, now = Date.now(), threshold = STALE_AFTER_MS) {
    const parsed = new Date(generatedAt).getTime();
    if (!Number.isFinite(parsed)) return { state: "unknown", ageMs: null };
    const ageMs = now - parsed;
    if (ageMs < -5 * 60 * 1000) return { state: "future", ageMs };
    return { state: ageMs <= threshold ? "fresh" : "stale", ageMs };
  }

  function seasonProgress(season) {
    const recorded = Math.max(0, Number(season && season.battle_count) || 0);
    const expected = Math.max(0, Number(season && season.expected_battles) || 0);
    const percentage = expected > 0 ? Math.min(100, Math.round(recorded / expected * 100)) : 0;
    return {
      recorded,
      expected,
      remaining: Math.max(0, expected - recorded),
      percentage
    };
  }

  function compact(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "—";
    if (Math.abs(parsed) >= 1000) return (parsed / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(Math.round(parsed));
  }

  function chartLabel(row) {
    const value = String(row.label || row.key || "");
    const parts = value.split(/\s+/);
    return parts.length > 1 ? parts[0] : value;
  }

  function buildActivityChart(months) {
    const rows = Array.isArray(months)
      ? months.filter(row => Number.isFinite(Number(row.battle_count))).slice(-12)
      : [];
    if (!rows.length) {
      return '<p class="list-empty">No monthly activity is available in the published dataset.</p>';
    }

    const width = 880, height = 205, left = 42, right = 15, top = 18, bottom = 39;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const values = rows.map(row => Math.max(0, Number(row.battle_count) || 0));
    const maximum = Math.max(1, ...values);
    const scaleMaximum = Math.max(10, Math.ceil(maximum / 10) * 10);
    const step = plotWidth / rows.length;
    const barWidth = Math.min(42, step * .58);
    const chartId = "utb-overview-bars";
    const guides = [0, .5, 1].map(fraction => {
      const y = top + plotHeight * (1 - fraction);
      return '<g><line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' +
        (width - right) + '" y2="' + y.toFixed(1) +
        '" stroke="#dfe4df" stroke-dasharray="3 6"/><text x="' + (left - 9) +
        '" y="' + (y + 3).toFixed(1) +
        '" text-anchor="end" class="chart-axis">' + escapeHtml(compact(scaleMaximum * fraction)) +
        '</text></g>';
    }).join("");

    const bars = rows.map((row, index) => {
      const value = values[index];
      const barHeight = value / scaleMaximum * plotHeight;
      const x = left + index * step + (step - barWidth) / 2;
      const y = top + plotHeight - barHeight;
      const label = chartLabel(row);
      const fullLabel = String(row.label || row.key || "Month");
      return '<g><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
        '" width="' + barWidth.toFixed(1) + '" height="' + Math.max(2, barHeight).toFixed(1) +
        '" rx="4" fill="url(#' + chartId + ')"><title>' + escapeHtml(fullLabel + " · " + number(value) + " battles") +
        '</title></rect><text x="' + (x + barWidth / 2).toFixed(1) + '" y="' +
        (height - 13) + '" text-anchor="middle" class="chart-axis">' + escapeHtml(label) +
        '</text></g>';
    }).join("");

    const aria = "Monthly battle activity for " + rows.length + " months, from " +
      String(rows[0].label || rows[0].key || "the first month") + " to " +
      String(rows[rows.length - 1].label || rows[rows.length - 1].key || "the latest month");

    return '<svg class="activity-svg" viewBox="0 0 ' + width + " " + height +
      '" role="img" aria-label="' + escapeHtml(aria) +
      '"><defs><linearGradient id="' + chartId +
      '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4aaab0"/>' +
      '<stop offset="100%" stop-color="#8b7cff" stop-opacity=".68"/></linearGradient></defs>' +
      guides + bars + '</svg>';
  }

  function leaderList(rows, kind) {
    if (!Array.isArray(rows) || !rows.length) {
      return '<p class="list-empty">No published ranking entries are available.</p>';
    }
    return rows.slice(0, 5).map((row, index) => {
      const id = String(row.id || row.name || "");
      const name = escapeHtml(row.name || id || "Unknown competitor");
      const href = "../profile.html?type=" + kind + "&id=" + encodeURIComponent(id);
      const battles = number(row.tournaments_played);
      const podiums = number(row.podiums);
      const points = number(row.points);
      return '<a class="leader-row" href="' + escapeHtml(href) + '">' +
        '<span class="leader-rank">' + String(index + 1).padStart(2, "0") + '</span>' +
        '<span class="leader-name">' + name + '<small>' + battles +
        ' battles · ' + podiums + ' podiums</small></span>' +
        '<strong class="leader-points">' + points + '</strong></a>';
    }).join("");
  }

  function setText(documentObject, id, value) {
    const element = documentObject.getElementById(id);
    if (element) element.textContent = value == null || value === "" ? "—" : String(value);
  }

  function renderOverview(overview, timeseries, documentObject, now = Date.now()) {
    if (!overview || !timeseries || !documentObject) return false;
    const totals = overview.totals || {};
    const latest = overview.latest_battle || {};
    const season = overview.current_season || {};
    const month = overview.current_month || {};
    const freshnessResult = freshness(overview.generated_at, now);
    const progress = seasonProgress(season);

    setText(documentObject, "archive-battles", number(totals.numbered_battles));
    setText(documentObject, "archive-teams", number(totals.teams));
    setText(documentObject, "archive-players", number(totals.players));
    setText(documentObject, "archive-latest-number", latest.battle_number == null ? "—" : "#" + latest.battle_number);
    setText(documentObject, "hero-latest-number", latest.battle_number == null ? "—" : "#" + latest.battle_number);
    setText(documentObject, "data-updated-time", dateTime(overview.generated_at));
    setText(documentObject, "data-updated-label", "PUBLISHED DATA · " + dateTime(overview.generated_at));

    const freshnessState = documentObject.getElementById("freshness-state");
    const freshnessLabel = documentObject.getElementById("freshness-label");
    const freshnessLabels = {
      fresh: "Data current · refreshed within 36 hours",
      stale: "Data is stale · refresh overdue",
      future: "Snapshot timestamp is in the future",
      unknown: "Data age could not be verified"
    };
    if (freshnessState) {
      freshnessState.classList.remove("is-fresh", "is-stale", "is-unknown");
      freshnessState.classList.add(freshnessResult.state === "fresh" ? "is-fresh" :
        freshnessResult.state === "stale" ? "is-stale" : "is-unknown");
    }
    if (freshnessLabel) freshnessLabel.textContent = freshnessLabels[freshnessResult.state];
    
    setText(documentObject, "season-name", season.label || "Current season");
    setText(documentObject, "season-range", "Official battles " +
      number(season.first_battle) + "–" + number(season.last_battle));
    setText(documentObject, "season-percent", String(progress.percentage));
    setText(documentObject, "season-recorded", number(progress.recorded) + " recorded battles");
    setText(documentObject, "season-remaining", number(progress.remaining) + " remaining");
    setText(documentObject, "season-teams", number(season.active_teams));
    setText(documentObject, "season-players", number(season.active_players));
    setText(documentObject, "season-status", season.complete ? "Complete" : (season.in_progress ? "In progress" : "Season status"));
    const progressBar = documentObject.getElementById("season-progress");
    const progressFill = documentObject.getElementById("season-progress-fill");
    if (progressBar) progressBar.setAttribute("aria-valuenow", String(progress.percentage));
    if (progressFill) progressFill.style.width = progress.percentage + "%";

    setText(documentObject, "latest-battle-tag", latest.battle_number == null ? "#—" : "#" + latest.battle_number);
    setText(documentObject, "latest-battle-ordinal", latest.battle_number == null ? "—" : "#" + latest.battle_number);
    setText(documentObject, "latest-battle-name", latest.name || "Latest indexed battle");
    setText(documentObject, "latest-battle-participants", number(latest.nbPlayers));
    const reportLink = documentObject.getElementById("latest-report-link");
    const lichessLink = documentObject.getElementById("latest-lichess-link");
    if (reportLink && latest.id) reportLink.href = "../battle.html?id=" + encodeURIComponent(String(latest.id));
    if (lichessLink && latest.url) {
      lichessLink.href = String(latest.url);
      lichessLink.target = "_blank";
      lichessLink.rel = "noopener noreferrer";
    }

    setText(documentObject, "month-name", month.label || month.key || "Latest recorded month");
    setText(documentObject, "month-battles", number(month.battle_count));
    setText(documentObject, "month-teams", number(month.active_teams));
    setText(documentObject, "month-players", number(month.active_players));

    const chart = documentObject.getElementById("activity-chart");
    const months = Array.isArray(timeseries.months) ? timeseries.months : [];
    if (chart) chart.innerHTML = buildActivityChart(months);
    const recentMonths = months.slice(-12);
    const activityTotal = recentMonths.reduce((sum, item) => sum + (Number(item.battle_count) || 0), 0);
    setText(documentObject, "activity-total", number(activityTotal) + " battles across this period");

    const teams = documentObject.getElementById("top-teams");
    const players = documentObject.getElementById("top-players");
    if (teams) teams.innerHTML = leaderList(overview.leaders && overview.leaders.teams, "team");
    if (players) players.innerHTML = leaderList(overview.leaders && overview.leaders.players, "player");
    return true;
  }

  async function loadData(root) {
    if (!root || !root.fetch || !root.document) return false;
    const [overviewResponse, seriesResponse] = await Promise.all([
      root.fetch("../data/analytics/overview.json", { cache: "no-cache" }),
      root.fetch("../data/analytics/timeseries.json", { cache: "no-cache" })
    ]);
    if (!overviewResponse.ok || !seriesResponse.ok) {
      throw new Error("Published overview data could not be loaded (overview: " +
        overviewResponse.status + ", time series: " + seriesResponse.status + ").");
    }
    const [overview, timeseries] = await Promise.all([
      overviewResponse.json(), seriesResponse.json()
    ]);
    return renderOverview(overview, timeseries, root.document);
  }

  function init(root) {
    if (!root || !root.document) return;
    const status = root.document.getElementById("freshness-label");
    loadData(root).catch(error => {
      if (root.console && typeof root.console.error === "function") {
        root.console.error("Could not load Overview preview data", error);
      }
      const state = root.document.getElementById("freshness-state");
      if (state) {
        state.classList.remove("is-fresh", "is-stale");
        state.classList.add("is-unknown");
      }
      if (status) status.textContent = "Published data unavailable";
      setText(root.document, "data-updated-label", "PUBLISHED DATA COULD NOT BE LOADED");
      const chart = root.document.getElementById("activity-chart");
      if (chart) chart.innerHTML = '<p class="list-empty">Monthly activity could not be loaded. Try refreshing the page.</p>';
      ["top-teams", "top-players"].forEach(id => {
        const element = root.document.getElementById(id);
        if (element) element.innerHTML = '<p class="list-empty">Published rankings are unavailable.</p>';
      });
    });
  }

  return {
    STALE_AFTER_MS,
    number,
    escapeHtml,
    dateTime,
    freshness,
    seasonProgress,
    buildActivityChart,
    leaderList,
    renderOverview,
    loadData,
    init
  };
});
