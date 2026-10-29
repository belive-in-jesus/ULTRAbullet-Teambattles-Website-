#!/usr/bin/env python3
"""Combine worker output into the JSON files consumed by GitHub Pages.

Based on the cumulative result-processing concept by DarkOnCrack:
https://lichessbotacc.github.io/Gift-For-Nathanael/
"""
import glob
import json
import os
from datetime import datetime, timezone

PARTIALS_DIR = os.environ.get("PARTIALS_DIR", "artifacts")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "docs/data")
NAME_FILTERS = os.environ.get("NAME_FILTERS", "ultrabullet")


def compute_stats(records: list) -> dict:
    if not records:
        return {}
    records = sorted(records, key=lambda row: row.get("startsAt") or "9999")
    scores = [float(row.get("score", 0) or 0) for row in records]
    ranks = [int(row["rank"]) for row in records if row.get("rank") is not None]
    best = max(records, key=lambda row: float(row.get("score", 0) or 0))
    stats = {
        "tournaments_played": len(records),
        "best_tournament": best.get("name"),
        "best_tournament_score": best.get("score"),
        "highest_points": max(scores) if scores else None,
        "avg_points": round(sum(scores) / len(scores), 1) if scores else None,
        "active_since": records[0].get("startsAt"),
        "last_played": records[-1].get("startsAt"),
    }
    if ranks:
        podiums = sum(rank <= 3 for rank in ranks)
        stats.update({
            "best_finish": min(ranks),
            "worst_finish": max(ranks),
            "avg_finish": round(sum(ranks) / len(ranks), 1),
            "podiums": podiums,
            "first_places": sum(rank == 1 for rank in ranks),
            "top3_rate": round(podiums / len(ranks), 3),
        })
    return stats


def main() -> int:
    pattern = os.path.join(PARTIALS_DIR, "**", "partial_*.json")
    files = sorted(glob.glob(pattern, recursive=True))
    if not files:
        files = sorted(glob.glob("partial_*.json"))
    if not files:
        raise FileNotFoundError("No partial_*.json files found. Check that the fetch jobs uploaded their artifacts.")
    print(f"Combining {len(files)} worker files")

    player_totals, player_records = {}, {}
    team_totals, team_names, team_records = {}, {}, {}
    tournaments_processed = 0
    all_errors = []
    battle_history = {}

    for filename in files:
        with open(filename, encoding="utf-8") as handle:
            data = json.load(handle)
        tournaments_processed += int(data.get("processed", 0))
        for battle in data.get("tournament_records", []):
            if battle.get("id"):
                battle_history[battle["id"]] = battle
        for username, points in data.get("player_points", {}).items():
            player_totals[username] = player_totals.get(username, 0) + points
        for username, records in data.get("player_records", {}).items():
            player_records.setdefault(username, []).extend(records)
        for team_id, points in data.get("team_points", {}).items():
            team_totals[team_id] = team_totals.get(team_id, 0) + points
        for team_id, name in data.get("team_names", {}).items():
            team_names.setdefault(team_id, name)
        for team_id, records in data.get("team_records", {}).items():
            team_records.setdefault(team_id, []).extend(records)
        all_errors.extend(data.get("errors", []))

    player_rank = sorted(player_totals.items(), key=lambda item: (-item[1], item[0].lower()))
    team_rank = sorted(team_totals.items(), key=lambda item: (-item[1], item[0].lower()))
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    players = [{
        "rank": index + 1,
        "username": username,
        "points": points,
        **compute_stats(player_records.get(username, [])),
        "history": sorted(player_records.get(username, []), key=lambda row: row.get("startsAt") or "", reverse=True),
    } for index, (username, points) in enumerate(player_rank)]
    teams = [{
        "rank": index + 1,
        "team_id": team_id,
        "team_name": team_names.get(team_id, team_id),
        "points": points,
        **compute_stats(team_records.get(team_id, [])),
        "history": sorted(team_records.get(team_id, []), key=lambda row: row.get("startsAt") or "", reverse=True),
    } for index, (team_id, points) in enumerate(team_rank)]

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tournaments_processed": tournaments_processed,
        "teams_count": len(teams),
        "players_count": len(players),
        "errors_count": len(all_errors),
        "name_filters": NAME_FILTERS,
    }
    for filename, payload in (
        ("leaderboard_players.json", players),
        ("leaderboard_teams.json", teams),
        ("meta.json", meta),
        ("battle_history.json", sorted(battle_history.values(), key=lambda row: row.get("startsAt") or "", reverse=True)),
    ):
        with open(os.path.join(OUTPUT_DIR, filename), "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")

    with open("errors.json", "w", encoding="utf-8") as handle:
        json.dump(all_errors, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(
        f"Finished: {tournaments_processed} tournaments, {len(teams)} teams, "
        f"{len(players)} players, {len(all_errors)} recorded API errors."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
