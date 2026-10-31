"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { compareHistories } = require("../../docs/js/compare-core.js");

test("comparison treats missing ranks as unknown, never as rank zero", () => {
  const a = [
    { id: "battle-1", startsAt: 300, score: 100, rank: 1 },
    { id: "battle-2", startsAt: 200, score: 50, rank: null },
    { id: "battle-3", startsAt: 100, score: 50, rank: 5 }
  ];
  const b = [
    { id: "battle-1", startsAt: 300, score: 90, rank: 2 },
    { id: "battle-2", startsAt: 200, score: 75, rank: 4 },
    { id: "battle-3", startsAt: 100, score: 60, rank: 2 }
  ];

  const result = compareHistories(a, b);
  assert.equal(result.common.length, 3);
  assert.equal(result.winsA, 1);
  assert.equal(result.winsB, 2);
  assert.equal(result.draws, 0);
  assert.equal(result.pointsA, 200);
  assert.equal(result.pointsB, 225);
  assert.equal(result.comparableRankBattles, 2);
  assert.equal(result.rankWinsA, 1);
  assert.equal(result.rankWinsB, 1);
});

test("comparison deduplicates tournament IDs and counts equal scores as draws", () => {
  const a = [
    { id: "shared", startsAt: 100, score: 10, rank: 1 },
    { id: "shared", startsAt: 100, score: 12, rank: 1 }
  ];
  const b = [
    { id: "shared", startsAt: 100, score: 12, rank: 1 }
  ];

  const result = compareHistories(a, b);
  assert.equal(result.common.length, 1);
  assert.equal(result.winsA, 0);
  assert.equal(result.winsB, 0);
  assert.equal(result.draws, 1);
  assert.equal(result.comparableRankBattles, 1);
  assert.equal(result.rankWinsA, 0);
  assert.equal(result.rankWinsB, 0);
});

test("comparison excludes missing scores from score wins and totals", () => {
  const result = compareHistories(
    [{ id: "one", score: null, rank: 1 }],
    [{ id: "one", score: 20, rank: 2 }]
  );

  assert.equal(result.common.length, 1);
  assert.equal(result.comparableScoreBattles, 0);
  assert.equal(result.winsA, 0);
  assert.equal(result.winsB, 0);
  assert.equal(result.draws, 0);
  assert.equal(result.pointsA, 0);
  assert.equal(result.pointsB, 20);
});
