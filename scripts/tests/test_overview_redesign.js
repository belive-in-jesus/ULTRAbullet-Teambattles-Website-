"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const overview = require("../../docs/redesign/overview-c.js");

test("freshness changes at the 36-hour threshold", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(overview.freshness("2026-11-05T00:00:00Z", now).state, "fresh");
  assert.equal(overview.freshness("2026-11-05T00:00:00Z", now + 1).state, "stale");
  assert.equal(overview.freshness("invalid-date", now).state, "unknown");
});

test("future timestamps are identified rather than reported as fresh", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(overview.freshness("2026-11-06T12:06:00Z", now).state, "future");
});

test("season progress uses fixed expected battle counts and never exceeds 100 percent", () => {
  assert.deepEqual(overview.seasonProgress({ battle_count: 44, expected_battles: 50 }), {
    recorded: 44, expected: 50, remaining: 6, percentage: 88
  });
  assert.equal(overview.seasonProgress({ battle_count: 55, expected_battles: 50 }).percentage, 100);
  assert.equal(overview.seasonProgress({ battle_count: 0, expected_battles: 0 }).percentage, 0);
});

test("activity chart uses at most the latest 12 months and escapes source labels", () => {
  const months = Array.from({ length: 14 }, (_, index) => ({
    key: "2026-" + String(index + 1).padStart(2, "0"),
    label: index === 13 ? "<script>alert(1)</script>" : "Month " + index,
    battle_count: index + 1
  }));
  const chart = overview.buildActivityChart(months);
  assert.equal((chart.match(/<rect /g) || []).length, 12);
  assert.match(chart, /&lt;script&gt;/);
  assert.doesNotMatch(chart, /<script>/);
});

test("leader rows link to the existing profile system and escape competitor names", () => {
  const html = overview.leaderList([{
    id: "safe-id", name: "<img src=x onerror=alert(1)>", points: 1234,
    tournaments_played: 20, podiums: 5
  }], "team");
  assert.match(html, /\.\.\/profile\.html\?type=team&amp;id=safe-id/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
});
