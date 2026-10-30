"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const analytics = require("../../docs/js/analytics.js");

const DAY = 24 * 60 * 60 * 1000;
const at = (iso) => Date.parse(iso);

function record(number, score, rank, date) {
  const suffix = number % 10 === 1 && number % 100 !== 11 ? "st"
    : number % 10 === 2 && number % 100 !== 12 ? "nd"
    : number % 10 === 3 && number % 100 !== 13 ? "rd" : "th";
  return {
    id: "battle-" + number,
    name: number + suffix + " ULTRAbullet Team Battle",
    startsAt: at(date),
    score,
    rank
  };
}

test("battle number and fixed 50-battle season are derived from official names", () => {
  assert.equal(analytics.battleNumber(record(642, 500, 1, "2026-10-30T18:00:00Z")), 642);
  assert.equal(analytics.seasonNumber(record(642, 500, 1, "2026-10-30T18:00:00Z")), 13);
  assert.equal(analytics.seasonNumber(record(600, 500, 1, "2026-10-30T18:00:00Z")), 12);
  assert.equal(analytics.battleNumber({ name: "ULTRAbullet Alliance League" }), null);
});

test("summary calculates career, recent form, percentiles and placement distribution", () => {
  const rows = [
    record(101, 100, 1, "2026-01-01T12:00:00Z"),
    record(102, 200, 2, "2026-01-02T12:00:00Z"),
    record(103, 300, 3, "2026-01-03T12:00:00Z"),
    record(104, 400, 8, "2026-01-04T12:00:00Z"),
    record(105, 500, 12, "2026-01-05T12:00:00Z"),
    record(106, 600, 1, "2026-01-06T12:00:00Z")
  ];
  const summary = analytics.summarize(rows);
  assert.equal(summary.battles, 6);
  assert.equal(summary.rankedBattles, 6);
  assert.equal(summary.points, 2100);
  assert.equal(summary.avgPoints, 350);
  assert.equal(summary.medianPoints, 350);
  assert.equal(summary.podiums, 4);
  assert.equal(summary.firstPlaces, 2);
  assert.equal(summary.podiumRate, 4 / 6);
  assert.equal(summary.bestFinish, 1);
  assert.equal(summary.avgFinish, 27 / 6);
  assert.equal(summary.recentBattles, 6);
  assert.equal(summary.recentAverage, 350);
  assert.equal(summary.recentPodiums, 4);
  assert.equal(summary.latestPodiumRun, 1);
  assert.equal(summary.longestPodiumStreak, 3);
  assert.deepEqual(summary.rankCounts.map(item => item.count), [2, 1, 1, 1, 1]);
});

test("monthly totals are grouped using UTC calendar months", () => {
  const rows = [
    record(301, 100, 1, "2026-01-31T23:30:00Z"),
    record(302, 300, 2, "2026-02-01T00:30:00Z"),
    record(303, 500, 4, "2026-02-03T00:30:00Z")
  ];
  const months = analytics.groupMonths(rows);
  assert.deepEqual(months.map(item => item.key), ["2026-01", "2026-02"]);
  assert.equal(months[0].points, 100);
  assert.equal(months[1].points, 800);
  assert.equal(months[1].battles, 2);
  assert.equal(months[1].podiums, 1);
});

test("seasons use fixed official battle-number ranges and do not shift across gaps", () => {
  const rows = [
    record(300, 100, 1, "2026-01-01T00:00:00Z"),
    record(301, 200, 2, "2026-01-02T00:00:00Z"),
    record(350, 300, 3, "2026-01-03T00:00:00Z"),
    record(351, 400, 4, "2026-01-04T00:00:00Z")
  ];
  const seasons = analytics.groupSeasons(rows);
  assert.deepEqual(seasons.map(item => item.season), [8, 7, 6]);
  assert.equal(seasons.find(item => item.season === 7).points, 500);
  assert.equal(seasons.find(item => item.season === 6).battles, 1);
});

test("podium streaks stop at non-podium results and missing official battle numbers", () => {
  const contiguous = [
    record(10, 10, 1, "2026-01-01T00:00:00Z"),
    record(11, 10, 2, "2026-01-02T00:00:00Z"),
    record(12, 10, 3, "2026-01-03T00:00:00Z"),
    record(13, 10, 7, "2026-01-04T00:00:00Z"),
    record(14, 10, 1, "2026-01-05T00:00:00Z")
  ];
  assert.equal(analytics.longestPodiumStreak(contiguous), 3);
  assert.equal(analytics.summarize(contiguous).latestPodiumRun, 1);
  assert.equal(analytics.longestPodiumStreak([contiguous[0], contiguous[2]]), 1);
});

test("score trend and placement donut render SVG with accessible labels", () => {
  const rows = [
    record(1, 100, 1, "2026-01-01T00:00:00Z"),
    record(2, 200, 2, "2026-01-02T00:00:00Z"),
    record(3, 300, 8, "2026-01-03T00:00:00Z")
  ];
  const summary = analytics.summarize(rows);
  assert.match(analytics.buildScoreTrendSvg(rows, 25), /<svg/);
  assert.match(analytics.buildScoreTrendSvg(rows, 25), /Score trend across 3 battles/);
  assert.match(analytics.buildFinishDonutSvg(summary), /Placement distribution/);
  assert.match(analytics.buildMonthlySvg(summary.months), /Monthly points/);
  assert.match(analytics.buildActivityHeatmapSvg(rows), /Daily battle participation/);
  assert.match(analytics.buildSeasonRows(summary.seasons), /Season 1/);
});

test("empty datasets return helpful empty states rather than invalid SVG", () => {
  const summary = analytics.summarize([]);
  assert.equal(summary.battles, 0);
  assert.equal(summary.rankedBattles, 0);
  assert.equal(summary.avgPoints, 0);
  assert.match(analytics.buildScoreTrendSvg([]), /Not enough score data/);
  assert.match(analytics.buildFinishDonutSvg(summary), /Placement data is not available/);
  assert.match(analytics.buildMonthlySvg([]), /Monthly data is not available/);
  assert.match(analytics.buildActivityHeatmapSvg([]), /No dated battle activity/);
  assert.match(analytics.buildSeasonRows([]), /No numbered seasonal results/);
});
