#!/usr/bin/env python3
"""Build compact all-time indexes, period rankings and lazy-loaded profile shards."""
import calendar
import glob
import json
import os
import re
import shutil
from collections import defaultdict
from datetime import datetime, timezone

PARTIALS_DIR = os.environ.get("PARTIALS_DIR", "artifacts")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "docs/data")
PROFILE_SHARD_SIZE = 200
SEASON_SIZE = 50
BATTLE_NAME_PATTERN = re.compile(r"^\s*(?P<number>\d+)(?:st|nd|rd|th)\s+ultrabullet\s+(?:team\s+battle|teambattle\s+team\s+battle)\s*$", re.IGNORECASE)


def parse_battle_number(name: str):
    match = BATTLE_NAME_PATTERN.fullmatch(str(name or ""))
    return int(match.group("number")) if match else None


def season_number_for_battle(battle_number: int) -> int:
    if battle_number < 1:
        raise ValueError("Battle numbers must be positive")
    return (battle_number - 1) // SEASON_SIZE + 1


def compute_stats(records: list) -> dict:
    if not records:
        return {}
    records = sorted(records, key=lambda row: int(row.get("startsAt") or 0))
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


def write_json(path: str, payload) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def build_period_ranking(records_by_key, names_by_key, period_ids, display_field, profile_refs):
    ranked = []
    for key, records in records_by_key.items():
        selected = [row for row in records if str(row.get("id") or "") in period_ids]
        if not selected:
            continue
        points = sum(float(row.get("score", 0) or 0) for row in selected)
        ranked.append({
            display_field: names_by_key.get(key, key),
            "points": points,
            **compute_stats(selected),
            **profile_refs.get(key, {}),
        })
    ranked.sort(key=lambda row: (-float(row.get("points", 0) or 0), str(row.get(display_field) or "").lower()))
    for index, row in enumerate(ranked, 1):
        row["rank"] = index
    return ranked


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
                battle_history[str(battle["id"])] = battle
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

    # Keep only regular numbered team battles. This defensive filter is applied
    # even if discovery configuration or old worker artifacts contain special events.
    regular_battles = {}
    for battle_id, battle in battle_history.items():
        number = parse_battle_number(battle.get("name") or battle.get("fullName"))
        if number is None:
            continue
        record = dict(battle)
        record["battle_number"] = number
        regular_battles[battle_id] = record
    allowed_ids = set(regular_battles)
    player_records = {key: [row for row in records if str(row.get("id") or "") in allowed_ids]
                      for key, records in player_records.items()}
    player_records = {key: records for key, records in player_records.items() if records}
    team_records = {key: [row for row in records if str(row.get("id") or "") in allowed_ids]
                    for key, records in team_records.items()}
    team_records = {key: records for key, records in team_records.items() if records}
    player_totals = {key: sum(float(row.get("score", 0) or 0) for row in records)
                     for key, records in player_records.items()}
    team_totals = {key: sum(float(row.get("score", 0) or 0) for row in records)
                   for key, records in team_records.items()}
    player_rank = sorted(player_totals.items(), key=lambda item: (-item[1], item[0].lower()))
    team_rank = sorted(team_totals.items(), key=lambda item: (-item[1], item[0].lower()))

    # Rebuild profile shards so removed competitors cannot leave stale profile files behind.
    profiles_dir = os.path.join(OUTPUT_DIR, "profiles")
    if os.path.isdir(profiles_dir):
        shutil.rmtree(profiles_dir)
    os.makedirs(profiles_dir, exist_ok=True)

    players, teams = [], []
    profile_shards = {"players": {}, "teams": {}}
    player_profile_refs, team_profile_refs = {}, {}

    for index, (username, points) in enumerate(player_rank):
        history = sorted(
            player_records.get(username, []),
            key=lambda row: int(row.get("startsAt") or 0),
            reverse=True,
        )
        shard_name = f"players-{index // PROFILE_SHARD_SIZE:03d}.json"
        player_profile_refs[username] = {
            "profile_file": f"profiles/{shard_name}",
            "profile_key": username,
        }
        players.append({
            "rank": index + 1,
            "username": username,
            "points": points,
            **compute_stats(player_records.get(username, [])),
            **player_profile_refs[username],
        })
        profile_shards["players"].setdefault(shard_name, {})[username] = {"history": history}

    for index, (team_id, points) in enumerate(team_rank):
        history = sorted(
            team_records.get(team_id, []),
            key=lambda row: int(row.get("startsAt") or 0),
            reverse=True,
        )
        shard_name = f"teams-{index // PROFILE_SHARD_SIZE:03d}.json"
        team_profile_refs[team_id] = {
            "profile_file": f"profiles/{shard_name}",
            "profile_key": team_id,
        }
        teams.append({
            "rank": index + 1,
            "team_id": team_id,
            "team_name": team_names.get(team_id, team_id),
            "points": points,
            **compute_stats(team_records.get(team_id, [])),
            **team_profile_refs[team_id],
        })
        profile_shards["teams"].setdefault(shard_name, {})[team_id] = {"history": history}

    for shards in profile_shards.values():
        for filename, payload in shards.items():
            write_json(os.path.join(profiles_dir, filename), payload)

    # Monthly tables use regular numbered battles only. Seasons are fixed to
    # official battle-number ranges, not the count/order of available records.
    numbered_battles = sorted(regular_battles.values(), key=lambda row: (int(row["battle_number"]), str(row.get("id") or "")))
    max_battle_number = max((int(row["battle_number"]) for row in numbered_battles), default=0)
    dated_battles = [row for row in numbered_battles if row.get("startsAt") is not None]

    period_dir = os.path.join(OUTPUT_DIR, "periods")
    if os.path.isdir(period_dir):
        shutil.rmtree(period_dir)
    os.makedirs(period_dir, exist_ok=True)

    months_by_key = defaultdict(list)
    for battle in dated_battles:
        moment = datetime.fromtimestamp(int(battle["startsAt"]) / 1000, tz=timezone.utc)
        months_by_key[moment.strftime("%Y-%m")].append(battle)

    month_index = []
    for month_key, battles in sorted(months_by_key.items()):
        year, month = map(int, month_key.split("-"))
        data_file = f"periods/months/{month_key}.json"
        ids = {str(row["id"]) for row in battles}
        payload = {
            "period_type": "month",
            "key": month_key,
            "label": f"{calendar.month_name[month]} {year}",
            "battle_count": len(battles),
            "battle_ids": [str(row["id"]) for row in battles],
            "teams": build_period_ranking(team_records, team_names, ids, "team_name", team_profile_refs),
            "players": build_period_ranking(player_records, {key: key for key in player_records}, ids, "username", player_profile_refs),
        }
        write_json(os.path.join(OUTPUT_DIR, data_file), payload)
        month_index.append({
            "key": month_key,
            "label": payload["label"],
            "battle_count": len(battles),
            "start_at": int(battles[0]["startsAt"]),
            "end_at": int(battles[-1]["startsAt"]),
            "data_file": data_file,
        })

    seasons_by_number = defaultdict(list)
    for battle in numbered_battles:
        seasons_by_number[season_number_for_battle(int(battle["battle_number"]))].append(battle)

    season_index = []
    for season_number in sorted(seasons_by_number):
        battles = seasons_by_number[season_number]
        first_battle = (season_number - 1) * SEASON_SIZE + 1
        last_battle = season_number * SEASON_SIZE
        season_key = f"season-{season_number:02d}"
        data_file = f"periods/seasons/{season_key}.json"
        ids = {str(row["id"]) for row in battles}
        recorded_numbers = {int(row["battle_number"]) for row in battles}
        observed_through = min(last_battle, max_battle_number)
        missing_numbers = sorted(set(range(first_battle, observed_through + 1)) - recorded_numbers)
        complete = max_battle_number >= last_battle
        in_progress = max_battle_number >= first_battle and not complete
        label = f"Season {season_number} · Battles {first_battle}–{last_battle}"
        payload = {
            "period_type": "season", "key": season_key, "label": label,
            "battle_count": len(battles), "expected_battles": SEASON_SIZE,
            "missing_battle_numbers": missing_numbers, "complete": complete,
            "in_progress": in_progress,
            "battle_ids": [str(row["id"]) for row in battles],
            "teams": build_period_ranking(team_records, team_names, ids, "team_name", team_profile_refs),
            "players": build_period_ranking(player_records, {key: key for key in player_records}, ids, "username", player_profile_refs),
        }
        write_json(os.path.join(OUTPUT_DIR, data_file), payload)
        dated = [int(row["startsAt"]) for row in battles if row.get("startsAt") is not None]
        season_index.append({
            "key": season_key, "label": label, "battle_count": len(battles),
            "expected_battles": SEASON_SIZE, "missing_battle_numbers": missing_numbers,
            "first_battle": first_battle, "last_battle": last_battle,
            "complete": complete, "in_progress": in_progress,
            "start_at": min(dated) if dated else None, "end_at": max(dated) if dated else None,
            "data_file": data_file,
        })

    generated_at = datetime.now(timezone.utc).isoformat()
    period_index = {
        "generated_at": generated_at,
        "season_size": SEASON_SIZE,
        "season_method": "Fixed official battle-number ranges: Season 1 = Battles 1–50, Season 2 = 51–100, etc. Unnumbered and special events are excluded.",
        "numbered_battles_count": len(numbered_battles),
        "max_battle_number": max_battle_number,
        "months": list(reversed(month_index)),
        "seasons": list(reversed(season_index)),
    }
    write_json(os.path.join(OUTPUT_DIR, "periods_index.json"), period_index)

    meta = {
        "generated_at": generated_at,
        "tournaments_processed": len(numbered_battles),
        "teams_count": len(teams),
        "players_count": len(players),
        "errors_count": len(all_errors),
        "selection_rule": "Numbered regular ULTRAbullet Team Battles only; special and unnumbered events excluded.",
        "profile_shard_size": PROFILE_SHARD_SIZE,
        "profiles_shards": sum(len(shards) for shards in profile_shards.values()),
        "season_size": SEASON_SIZE,
        "season_count": len(season_index),
        "month_count": len(month_index),
        "max_battle_number": max_battle_number,
        "excluded_events_count": len(battle_history) - len(regular_battles),
    }
    for filename, payload in (
        ("leaderboard_players.json", players),
        ("leaderboard_teams.json", teams),
        ("meta.json", meta),
        ("battle_history.json", sorted(numbered_battles, key=lambda row: int(row["battle_number"]), reverse=True)),
    ):
        write_json(os.path.join(OUTPUT_DIR, filename), payload)

    write_json("errors.json", all_errors)
    print(
        f"Finished: {len(numbered_battles)} regular numbered battles, "
        f"{len(battle_history) - len(regular_battles)} excluded special events, "
        f"{len(teams)} teams, {len(players)} players, {len(all_errors)} errors, "
        f"{len(season_index)} fixed-number seasons and {len(month_index)} months."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
