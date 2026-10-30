/* UltraBullet Team Battles — reusable profile analytics.
   Pure calculations + lightweight SVG rendering; no third-party chart dependency. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UBTAnalytics = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const COLORS = {
    cyan: "#70e2e8",
    blue: "#7f9fff",
    violet: "#b19cff",
    gold: "#efc47c",
    green: "#78d6b1",
    muted: "#91a7bc",
    grid: "rgba(151, 178, 203, .16)",
    track: "rgba(151, 178, 203, .12)"
  };

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function battleNumber(record) {
    const match = String(record?.name || "").match(/^\s*(\d+)(?:st|nd|rd|th)\s+ultrabullet\s+/i);
    return match ? Number(match[1]) : null;
  }

  function seasonNumber(record) {
    const number = battleNumber(record);
    return number ? Math.floor((number - 1) / 50) + 1 : null;
  }

  function timestamp(record) {
    const value = Number(record?.startsAt);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function chronological(records) {
    return [...(Array.isArray(records) ? records : [])].sort((a, b) =>
      timestamp(a) - timestamp(b) || (battleNumber(a) || 0) - (battleNumber(b) || 0)
    );
  }

  function percentile(values, fraction) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * Math.max(0, Math.min(1, fraction));
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  function longestPodiumStreak(records) {
    const byBattle = new Map();
    for (const row of records) {
      const number = battleNumber(row);
      const rank = Number(row.rank);
      if (number && Number.isFinite(rank) && rank > 0) byBattle.set(number, rank);
    }
    if (!byBattle.size) return 0;
    let current = 0;
    let longest = 0;
    const numbers = [...byBattle.keys()].sort((a, b) => a - b);
    let previous = null;
    for (const number of numbers) {
      const rank = byBattle.get(number);
      current = rank <= 3 && (previous === null || number === previous + 1) ? current + 1 : (rank <= 3 ? 1 : 0);
      longest = Math.max(longest, current);
      previous = number;
    }
    return longest;
  }

  function latestPodiumRun(records) {
    const ranked = records
      .map(row => ({ number: battleNumber(row), rank: Number(row.rank) }))
      .filter(row => row.number && Number.isFinite(row.rank) && row.rank > 0)
      .sort((a, b) => b.number - a.number);
    if (!ranked.length || ranked[0].rank > 3) return 0;
    let count = 0;
    let expected = ranked[0].number;
    for (const row of ranked) {
      if (row.number !== expected || row.rank > 3) break;
      count += 1;
      expected -= 1;
    }
    return count;
  }

  function summarize(records) {
    const ordered = chronological(records);
    const descending = [...ordered].reverse();
    const ranks = ordered.map(row => Number(row.rank)).filter(rank => Number.isFinite(rank) && rank > 0);
    const scores = ordered.map(row => Number(row.score)).filter(score => Number.isFinite(score) && score >= 0);
    const podiums = ranks.filter(rank => rank <= 3).length;
    const firstPlaces = ranks.filter(rank => rank === 1).length;
    const lastTen = descending.slice(0, 10);
    const recentScores = lastTen.map(row => Number(row.score)).filter(score => Number.isFinite(score) && score >= 0);
    const recentRanks = lastTen.map(row => Number(row.rank)).filter(rank => Number.isFinite(rank) && rank > 0);
    const recentPodiums = recentRanks.filter(rank => rank <= 3).length;
    const points = scores.reduce((sum, score) => sum + score, 0);
    const recentPoints = recentScores.reduce((sum, score) => sum + score, 0);
    const rankCounts = [
      { key: "first", label: "1st place", count: ranks.filter(rank => rank === 1).length, color: COLORS.gold },
      { key: "second", label: "2nd place", count: ranks.filter(rank => rank === 2).length, color: COLORS.blue },
      { key: "third", label: "3rd place", count: ranks.filter(rank => rank === 3).length, color: COLORS.violet },
      { key: "top10", label: "4th–10th", count: ranks.filter(rank => rank >= 4 && rank <= 10).length, color: COLORS.cyan },
      { key: "outside", label: "11th+", count: ranks.filter(rank => rank >= 11).length, color: "#53677f" }
    ];
    const months = groupMonths(ordered);
    const seasons = groupSeasons(ordered);
    const bestMonth = [...months].sort((a, b) => b.points - a.points || b.battles - a.battles)[0] || null;
    const avgPoints = scores.length ? points / scores.length : 0;
    const recentAverage = recentScores.length ? recentPoints / recentScores.length : 0;
    return {
      battles: ordered.length,
      rankedBattles: ranks.length,
      points,
      avgPoints,
      medianPoints: percentile(scores, 0.5),
      lowerQuartile: percentile(scores, 0.25),
      upperQuartile: percentile(scores, 0.75),
      bestScore: scores.length ? Math.max(...scores) : 0,
      worstScore: scores.length ? Math.min(...scores) : 0,
      podiums,
      firstPlaces,
      podiumRate: ranks.length ? podiums / ranks.length : 0,
      winRate: ranks.length ? firstPlaces / ranks.length : 0,
      avgFinish: ranks.length ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : null,
      bestFinish: ranks.length ? Math.min(...ranks) : null,
      longestPodiumStreak: longestPodiumStreak(ordered),
      latestPodiumRun: latestPodiumRun(ordered),
      recentBattles: lastTen.length,
      recentAverage,
      recentPodiumRate: recentRanks.length ? recentPodiums / recentRanks.length : 0,
      recentRankedBattles: recentRanks.length,
      recentAverageDelta: avgPoints ? (recentAverage - avgPoints) / avgPoints : 0,
      recentPodiums,
      rankCounts,
      months,
      seasons,
      bestMonth
    };
  }

  function groupMonths(records) {
    const groups = new Map();
    for (const row of records) {
      const at = timestamp(row);
      if (!at) continue;
      const date = new Date(at);
      const key = date.toISOString().slice(0, 7);
      if (!groups.has(key)) groups.set(key, { key, battles: 0, points: 0, podiums: 0, firstPlaces: 0, finishes: 0 });
      const group = groups.get(key);
      const score = Number(row.score);
      const rank = Number(row.rank);
      group.battles += 1;
      if (Number.isFinite(score)) group.points += score;
      if (Number.isFinite(rank) && rank > 0) {
        group.finishes += 1;
        if (rank <= 3) group.podiums += 1;
        if (rank === 1) group.firstPlaces += 1;
      }
    }
    return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(group => ({
      ...group,
      avgPoints: group.battles ? group.points / group.battles : 0,
      podiumRate: group.finishes ? group.podiums / group.finishes : 0,
      label: new Date(group.key + "-01T00:00:00Z").toLocaleDateString("en", { month: "short", year: "2-digit", timeZone: "UTC" })
    }));
  }

  function groupSeasons(records) {
    const groups = new Map();
    for (const row of records) {
      const number = battleNumber(row);
      const season = seasonNumber(row);
      if (!number || !season) continue;
      const key = "season-" + String(season).padStart(2, "0");
      if (!groups.has(key)) groups.set(key, { key, season, firstBattle: (season - 1) * 50 + 1, lastBattle: season * 50, battles: 0, points: 0, podiums: 0, firstPlaces: 0, finishes: 0 });
      const group = groups.get(key);
      const score = Number(row.score);
      const rank = Number(row.rank);
      group.battles += 1;
      if (Number.isFinite(score)) group.points += score;
      if (Number.isFinite(rank) && rank > 0) {
        group.finishes += 1;
        if (rank <= 3) group.podiums += 1;
        if (rank === 1) group.firstPlaces += 1;
      }
    }
    return [...groups.values()].sort((a, b) => b.season - a.season).map(group => ({
      ...group,
      avgPoints: group.battles ? group.points / group.battles : 0,
      podiumRate: group.finishes ? group.podiums / group.finishes : 0
    }));
  }

  function buildScoreTrendSvg(records, limit) {
    const rows = chronological(records);
    const count = Number(limit);
    const visible = Number.isFinite(count) && count > 0 ? rows.slice(-count) : rows;
    const points = visible.map(row => Number(row.score)).filter(score => Number.isFinite(score) && score >= 0);
    if (!visible.length || !points.length) return '<div class="profile-empty">Not enough score data to draw a performance trend.</div>';

    const width = 960, height = 278;
    const left = 62, right = 22, top = 24, bottom = 54;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const maxScore = Math.max(1, ...points) * 1.12;
    const average = points.reduce((sum, value) => sum + value, 0) / points.length;
    const series = visible.map((row, index) => ({
      row,
      score: Math.max(0, Number(row.score) || 0),
      x: left + (visible.length <= 1 ? plotWidth / 2 : index / (visible.length - 1) * plotWidth)
    })).map(point => ({ ...point, y: top + plotHeight - point.score / maxScore * plotHeight }));
    const averageY = top + plotHeight - average / maxScore * plotHeight;
    const path = series.map((point, index) => (index ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1)).join(" ");
    const area = path + " L " + series[series.length - 1].x.toFixed(1) + " " + (top + plotHeight) + " L " + series[0].x.toFixed(1) + " " + (top + plotHeight) + " Z";
    const grid = [0, 0.5, 1].map(fraction => {
      const y = top + plotHeight * fraction;
      const value = Math.round(maxScore * (1 - fraction));
      return '<g><line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (width - right) + '" y2="' + y.toFixed(1) + '" stroke="' + COLORS.grid + '" stroke-dasharray="3 7"/><text x="' + (left - 12) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" class="analytics-axis-label">' + escapeHtml(value.toLocaleString()) + '</text></g>';
    }).join("");
    const circles = series.length <= 48 ? series.map(point => {
      const label = "#" + (battleNumber(point.row) || "?") + " · " + Math.round(point.score).toLocaleString() + " points";
      return '<circle cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="3.6" fill="' + COLORS.cyan + '" stroke="#0b1523" stroke-width="2"><title>' + escapeHtml(label) + '</title></circle>';
    }).join("") : "";
    const labels = [0, Math.floor((visible.length - 1) / 2), visible.length - 1]
      .filter((index, position, array) => array.indexOf(index) === position)
      .map(index => {
        const row = visible[index];
        const label = battleNumber(row) ? "#" + battleNumber(row) : new Date(timestamp(row)).toLocaleDateString("en", { month: "short", year: "2-digit", timeZone: "UTC" });
        return '<text x="' + series[index].x.toFixed(1) + '" y="' + (height - 18) + '" text-anchor="middle" class="analytics-axis-label">' + escapeHtml(label) + '</text>';
      }).join("");
    return '<svg class="analytics-svg analytics-line-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Score trend across ' + visible.length + ' battles">' +
      '<defs><linearGradient id="score-area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + COLORS.cyan + '" stop-opacity=".34"/><stop offset="100%" stop-color="' + COLORS.blue + '" stop-opacity=".015"/></linearGradient><linearGradient id="score-line-gradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="' + COLORS.cyan + '"/><stop offset="100%" stop-color="' + COLORS.violet + '"/></linearGradient></defs>' +
      grid +
      '<line x1="' + left + '" y1="' + averageY.toFixed(1) + '" x2="' + (width - right) + '" y2="' + averageY.toFixed(1) + '" stroke="' + COLORS.gold + '" stroke-width="1.5" stroke-dasharray="5 6" opacity=".9"><title>Average: ' + Math.round(average).toLocaleString() + ' points</title></line>' +
      '<path d="' + area + '" fill="url(#score-area-gradient)"/><path d="' + path + '" fill="none" stroke="url(#score-line-gradient)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      circles + labels +
      '</svg>';
  }

  function buildFinishDonutSvg(summary) {
    const categories = summary.rankCounts || [];
    const total = categories.reduce((sum, item) => sum + item.count, 0);
    if (!total) return '<div class="profile-empty">Placement data is not available for this period.</div>';
    const radius = 48, circumference = 2 * Math.PI * radius;
    let offset = 0;
    const rings = categories.filter(item => item.count > 0).map(item => {
      const length = item.count / total * circumference;
      const circle = '<circle cx="72" cy="72" r="' + radius + '" fill="none" stroke="' + item.color + '" stroke-width="15" stroke-dasharray="' + length.toFixed(2) + ' ' + (circumference - length).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '"/>';
      offset += length;
      return circle;
    }).join("");
    return '<svg class="analytics-donut-svg" viewBox="0 0 144 144" role="img" aria-label="Placement distribution: ' + total + ' ranked battles">' +
      '<g transform="rotate(-90 72 72)">' + rings + '</g>' +
      '<text x="72" y="68" class="analytics-donut-value" text-anchor="middle">' + Math.round((summary.podiumRate || 0) * 100) + '%</text>' +
      '<text x="72" y="86" class="analytics-donut-label" text-anchor="middle">PODIUMS</text></svg>';
  }

  function buildMonthlySvg(months) {
    const visible = (Array.isArray(months) ? months : []).slice(-12);
    if (!visible.length) return '<div class="profile-empty">Monthly data is not available yet.</div>';
    const width = 760, height = 238, left = 44, right = 12, top = 22, bottom = 50;
    const plotHeight = height - top - bottom;
    const max = Math.max(1, ...visible.map(item => item.points)) * 1.12;
    const step = (width - left - right) / visible.length;
    const barWidth = Math.min(34, step * .58);
    const grid = [0, 0.5, 1].map(fraction => {
      const y = top + plotHeight * fraction;
      return '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (width - right) + '" y2="' + y.toFixed(1) + '" stroke="' + COLORS.grid + '" stroke-dasharray="3 7"/>';
    }).join("");
    const bars = visible.map((item, index) => {
      const x = left + index * step + (step - barWidth) / 2;
      const barHeight = item.points / max * plotHeight;
      const y = top + plotHeight - barHeight;
      const label = item.key + " · " + Math.round(item.points).toLocaleString() + " points · " + item.battles + " battles";
      return '<g><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + Math.max(2, barHeight).toFixed(1) + '" rx="4" fill="url(#monthly-gradient)"><title>' + escapeHtml(label) + '</title></rect><text x="' + (x + barWidth / 2).toFixed(1) + '" y="' + (height - 17) + '" text-anchor="middle" class="analytics-axis-label">' + escapeHtml(item.label) + '</text></g>';
    }).join("");
    return '<svg class="analytics-svg analytics-monthly-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Monthly points across the latest ' + visible.length + ' months">' +
      '<defs><linearGradient id="monthly-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + COLORS.violet + '"/><stop offset="100%" stop-color="' + COLORS.blue + '" stop-opacity=".45"/></linearGradient></defs>' +
      grid + bars + '</svg>';
  }

  function buildActivityHeatmapSvg(records) {
    const rows = Array.isArray(records) ? records : [];
    const dated = rows.map(timestamp).filter(Boolean);
    if (!dated.length) return '<div class="profile-empty">No dated battle activity is available.</div>';
    const latest = new Date(Math.max(...dated));
    const end = Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), latest.getUTCDate());
    const start = end - 363 * 86400000;
    const startDate = new Date(start);
    const mondayOffset = (startDate.getUTCDay() + 6) % 7;
    const gridStart = start - mondayOffset * 86400000;
    const counts = new Map();
    for (const row of rows) {
      const at = timestamp(row);
      if (!at) continue;
      const date = new Date(at);
      const key = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const weeks = Math.ceil((end - gridStart) / 86400000 / 7) + 1;
    const width = 38 + weeks * 14;
    const height = 135;
    const cells = [];
    const monthLabels = [];
    for (let day = 0; day < 364 + mondayOffset; day++) {
      const at = gridStart + day * 86400000;
      if (at > end) break;
      const date = new Date(at);
      const week = Math.floor(day / 7);
      const weekday = day % 7;
      const count = counts.get(at) || 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
      const fills = ["rgba(145,171,199,.09)", "rgba(80,190,196,.35)", "rgba(80,190,196,.58)", "rgba(107,154,242,.78)", "#b09cff"];
      const dateLabel = date.toISOString().slice(0, 10);
      cells.push('<rect x="' + (31 + week * 14) + '" y="' + (25 + weekday * 14) + '" width="10" height="10" rx="2" fill="' + fills[level] + '" stroke="rgba(145,171,199,.08)"><title>' + dateLabel + " · " + count + (count === 1 ? " battle" : " battles") + '</title></rect>');
      if (date.getUTCDate() === 1) monthLabels.push('<text x="' + (31 + week * 14) + '" y="13" class="analytics-axis-label">' + date.toLocaleDateString("en", { month: "short", timeZone: "UTC" }) + '</text>');
    }
    const dayLabels = ["M", "W", "F"].map((label, index) => '<text x="14" y="' + (33 + index * 28) + '" class="analytics-axis-label">' + label + '</text>').join("");
    return '<svg class="analytics-svg analytics-heatmap-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Daily battle participation over the last 52 weeks">' +
      monthLabels.join("") + dayLabels + cells.join("") + '</svg>';
  }

  function buildSeasonRows(seasons) {
    const rows = (Array.isArray(seasons) ? seasons : []).slice(0, 8);
    if (!rows.length) return '<tr><td colspan="6" class="profile-empty">No numbered seasonal results are available.</td></tr>';
    return rows.map(item => {
      const podiumRate = item.finishes ? (item.podiums / item.finishes * 100).toFixed(1) + "%" : "—";
      return '<tr><td><strong>Season ' + item.season + '</strong><small>Battles ' + item.firstBattle + '–' + item.lastBattle + '</small></td>' +
        '<td class="number-cell">' + item.battles + '</td><td class="number-cell">' + Math.round(item.points).toLocaleString() + '</td>' +
        '<td class="number-cell">' + item.avgPoints.toLocaleString(undefined, { maximumFractionDigits: 1 }) + '</td>' +
        '<td class="number-cell">' + item.podiums + '</td><td class="number-cell">' + podiumRate + '</td></tr>';
    }).join("");
  }

  return {
    battleNumber,
    seasonNumber,
    chronological,
    percentile,
    longestPodiumStreak,
    latestPodiumRun,
    summarize,
    groupMonths,
    groupSeasons,
    buildScoreTrendSvg,
    buildFinishDonutSvg,
    buildMonthlySvg,
    buildActivityHeatmapSvg,
    buildSeasonRows
  };
});
