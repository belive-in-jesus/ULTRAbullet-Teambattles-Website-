"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const analytics = require("../../docs/js/dashboard-analytics.js");

class FakeElement {
  constructor() {
    this.textContent = "";
    this.innerHTML = "";
  }
}

function fakeDocument() {
  const elements = new Map();
  return {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement());
      return elements.get(id);
    },
    elements
  };
}

const sampleOverview = {
  schema_version: 1,
  generated_at: "2026-10-31T03:39:59.000Z",
  totals: {
    numbered_battles: 639,
    teams: 818,
    players: 13366,
    avg_participants_per_battle: 118.4,
    highest_participation: 214,
    highest_participation_battle: {
      name: "500th ULTRAbullet Team Battle",
      battle_number: 500
    }
  },
  current_month: {
    key: "2026-10",
    label: "October 2026",
    active_players: 3540,
    active_teams: 486,
    battle_count: 26
  },
  leaders: {
    teams: [{ name: "Leading Team", id: "leading-team", points: 50000, tournaments_played: 639, avg_points: 78.2 }],
    players: [{ name: "Leading Player", id: "LeadingPlayer", points: 25000, tournaments_played: 450, avg_points: 55.5 }]
  },
  performance_index: {
    eligible_counts: { teams: 18, players: 42 },
    teams: [{ id: "leading-team", name: "Leading Team", rank: 1, score: 91.4, battles: 120 }],
    players: [{ id: "LeadingPlayer", name: "Leading Player", rank: 1, score: 94.2, battles: 80 }]
  },
  records: {
    teams: [{ key: "most_battles", label: "Most battles played", holder: "Leading Team", holder_id: "leading-team", value: 639, unit: "battles" }],
    players: [{ key: "highest_single_battle", label: "Highest single-battle score", holder: "Leading Player", holder_id: "LeadingPlayer", value: 900, unit: "points" }]
  }
};

const sampleSeries = {
  months: [
    { key: "2026-09", label: "Sep 2026", battle_count: 26, active_players: 3200, active_teams: 440 },
    { key: "2026-10", label: "Oct 2026", battle_count: 26, active_players: 3540, active_teams: 486 }
  ],
  seasons: Array.from({ length: 13 }, (_, index) => ({
    season_number: index + 1,
    battle_count: 50,
    expected_battles: 50
  }))
};

test("global chart renders an accessible SVG with escaped labels and data values", () => {
  const svg = analytics.buildBarChart(
    [{ key: "2026-10", label: "October <2026>", battle_count: 26 }],
    "battle_count",
    "Monthly battle count",
    "battles"
  );
  assert.match(svg, /<svg/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /Monthly battle count/);
  assert.match(svg, /October &lt;2026&gt;/);
  assert.match(svg, /26 battles/);
  assert.match(svg, />Oct<\/text>/);
  const other = analytics.buildBarChart([{ key: "2026-10", label: "October 2026", battle_count: 26 }], "battle_count", "Other chart", "battles", 12, "other-chart");
  assert.match(svg, /global-gradient-global/);
  assert.match(other, /global-gradient-other-chart/);
  assert.doesNotMatch(svg, /global-gradient-other-chart/);
});

test("season chart can display all 13 seasons instead of truncating to 12", () => {
  const svg = analytics.buildBarChart(
    sampleSeries.seasons.map(row => ({ ...row, label: "S" + row.season_number })),
    "battle_count",
    "Season progression",
    "battles",
    20
  );
  assert.equal((svg.match(/<rect /g) || []).length, 13);
});

test("dashboard renderer populates KPIs, charts, rankings and record cards", () => {
  const doc = fakeDocument();
  assert.equal(analytics.renderDashboardAnalytics(sampleOverview, sampleSeries, doc), true);
  assert.equal(doc.getElementById("global-avg-participants").textContent, "118.4");
  assert.equal(doc.getElementById("global-peak-participants").textContent, "214");
  assert.equal(doc.getElementById("global-latest-active-players").textContent, "3,540");
  assert.equal(doc.getElementById("global-latest-active-teams").textContent, "486");
  assert.equal(doc.getElementById("global-month-label").textContent, "October 2026");
  assert.match(doc.getElementById("global-battles-chart").innerHTML, /<svg/);
  assert.match(doc.getElementById("global-players-chart").innerHTML, /<svg/);
  assert.match(doc.getElementById("global-teams-chart").innerHTML, /<svg/);
  assert.equal((doc.getElementById("global-seasons-chart").innerHTML.match(/<rect /g) || []).length, 13);
  assert.match(doc.getElementById("global-top-teams").innerHTML, /Leading Team/);
  assert.match(doc.getElementById("global-top-players").innerHTML, /Leading Player/);
  assert.match(doc.getElementById("global-records").innerHTML, /Most battles played/);
  assert.match(doc.getElementById("global-pi-teams").innerHTML, /Leading Team/);
  assert.match(doc.getElementById("global-pi-players").innerHTML, /94.2/);
});

test("Performance Index leader lists use official ranks and link to profiles", () => {
  const html = analytics.performanceIndexList([
    { id: "top-player", name: "Top Player", rank: 1, score: 93.6, battles: 25 }
  ], "player");
  assert.match(html, /profile.html\?type=player&amp;id=top-player|profile.html\?type=player&id=top-player/);
  assert.match(html, /#1/);
  assert.match(html, /93.6/);
  assert.match(html, /25 ranked battles/);
  assert.match(analytics.performanceIndexList([], "team"), /No officially eligible Performance Index results/);
});

test("leader and record names are escaped before entering dashboard markup", () => {
  const leaders = analytics.leaderList([{
    name: '<img src=x onerror="alert(1)">',
    id: "safe-id",
    points: 1,
    tournaments_played: 1,
    avg_points: 1
  }], "player");
  assert.doesNotMatch(leaders, /<img/);
  assert.match(leaders, /&lt;img/);

  const records = analytics.recordCards({
    records: {
      teams: [{
        label: '<script>alert("x")</script>',
        holder: "Team",
        holder_id: "team-id",
        value: 1,
        unit: "points"
      }]
    }
  });
  assert.doesNotMatch(records, /<script>/);
  assert.match(records, /&lt;script&gt;/);
});

test("empty time series returns informative placeholders rather than throwing", () => {
  const doc = fakeDocument();
  assert.equal(analytics.renderDashboardAnalytics({ totals: {}, leaders: {}, records: {} }, { months: [], seasons: [] }, doc), true);
  assert.match(doc.getElementById("global-battles-chart").innerHTML, /Not enough published data/);
  assert.match(doc.getElementById("global-seasons-chart").innerHTML, /Not enough published data/);
});
