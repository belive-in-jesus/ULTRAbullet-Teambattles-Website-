(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UBTCompareCore = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function compareHistories(historyA, historyB) {
    const mapA = new Map((Array.isArray(historyA) ? historyA : [])
      .filter(row => row && row.id)
      .map(row => [String(row.id), row]));
    const mapB = new Map((Array.isArray(historyB) ? historyB : [])
      .filter(row => row && row.id)
      .map(row => [String(row.id), row]));

    const common = [...mapA.keys()]
      .filter(id => mapB.has(id))
      .map(id => ({ id, a: mapA.get(id), b: mapB.get(id) }))
      .sort((left, right) =>
        (Number(right.a.startsAt) || 0) - (Number(left.a.startsAt) || 0)
      );

    const totals = {
      common,
      winsA: 0,
      winsB: 0,
      draws: 0,
      pointsA: 0,
      pointsB: 0,
      rankWinsA: 0,
      rankWinsB: 0,
      comparableScoreBattles: 0,
      comparableRankBattles: 0
    };

    for (const battle of common) {
      const scoreA = battle.a.score == null ? NaN : Number(battle.a.score);
      const scoreB = battle.b.score == null ? NaN : Number(battle.b.score);
      if (Number.isFinite(scoreA)) totals.pointsA += scoreA;
      if (Number.isFinite(scoreB)) totals.pointsB += scoreB;
      if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) {
        totals.comparableScoreBattles += 1;
        if (scoreA > scoreB) totals.winsA += 1;
        else if (scoreB > scoreA) totals.winsB += 1;
        else totals.draws += 1;
      }

      // Null and missing ranks are unknown, not rank zero.
      const rankA = battle.a.rank == null ? NaN : Number(battle.a.rank);
      const rankB = battle.b.rank == null ? NaN : Number(battle.b.rank);
      if (Number.isFinite(rankA) && rankA > 0
        && Number.isFinite(rankB) && rankB > 0) {
        totals.comparableRankBattles += 1;
        if (rankA < rankB) totals.rankWinsA += 1;
        else if (rankB < rankA) totals.rankWinsB += 1;
      }
    }

    totals.pointsA = Math.round(totals.pointsA * 10) / 10;
    totals.pointsB = Math.round(totals.pointsB * 10) / 10;
    return totals;
  }

  return { compareHistories };
});
