#!/usr/bin/env python3
"""Build compact all-time indexes, period rankings and lazy-loaded profile shards."""
import calendar
import glob
import json
import os
import re
import shutil
import sys
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


def longest_podium_streak(records: list) -> int:
    """Count podium finishes in consecutive official numbered battles."""
    ranks_by_number = {}
    for row in records:
        number = parse_battle_number(row.get("name"))
        rank = row.get("rank")
        if number is None or rank is None:
            continue
        try:
            ranks_by_number[number] = int(rank)
        except (TypeError, ValueError):
            continue
    if not ranks_by_number:
        return 0

    current = longest = 0
    for number in range(min(ranks_by_number), max(ranks_by_number) + 1):
        rank = ranks_by_number.get(number)
        if rank is not None and 1 <= rank <= 3:
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return longest


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
        "longest_podium_streak": longest_podium_streak(records),
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



ACHIEVEMENT_DEFINITIONS = {
    "players": [
        {"id": "battles_100", "name": "Century Challenger", "description": "Recorded results in 100 official battles.", "criteria": "100 battles", "metric": "tournaments_played", "threshold": 100, "icon": "100"},
        {"id": "battles_200", "name": "Double Century", "description": "Recorded results in 200 official battles.", "criteria": "200 battles", "metric": "tournaments_played", "threshold": 200, "icon": "200"},
        {"id": "battles_400", "name": "Battle Marathon", "description": "Recorded results in 400 official battles.", "criteria": "400 battles", "metric": "tournaments_played", "threshold": 400, "icon": "400"},
        {"id": "battles_600", "name": "Ultra Veteran", "description": "Recorded results in 600 official battles.", "criteria": "600 battles", "metric": "tournaments_played", "threshold": 600, "icon": "600"},
        {"id": "podiums_25", "name": "Podium Specialist", "description": "Finished in the top three at least 25 times.", "criteria": "25 podiums", "metric": "podiums", "threshold": 25, "icon": "25×"},
        {"id": "podiums_50", "name": "Podium Elite", "description": "Finished in the top three at least 50 times.", "criteria": "50 podiums", "metric": "podiums", "threshold": 50, "icon": "50×"},
        {"id": "podiums_100", "name": "Podium Legend", "description": "Finished in the top three at least 100 times.", "criteria": "100 podiums", "metric": "podiums", "threshold": 100, "icon": "100"},
        {"id": "podiums_300", "name": "Podium Immortal", "description": "Finished in the top three at least 300 times.", "criteria": "300 podiums", "metric": "podiums", "threshold": 300, "icon": "300"},
        {"id": "wins_10", "name": "10-Time Champion", "description": "Won at least 10 official battles.", "criteria": "10 wins", "metric": "first_places", "threshold": 10, "icon": "10 W"},
        {"id": "wins_25", "name": "Grand Champion", "description": "Won at least 25 official battles.", "criteria": "25 wins", "metric": "first_places", "threshold": 25, "icon": "25 W"},
        {"id": "wins_50", "name": "Supreme Champion", "description": "Won at least 50 official battles.", "criteria": "50 wins", "metric": "first_places", "threshold": 50, "icon": "50 W"},
        {"id": "wins_75", "name": "Ultra Champion", "description": "Won at least 75 official battles.", "criteria": "75 wins", "metric": "first_places", "threshold": 75, "icon": "75 W"},
        {"id": "streak_8", "name": "Podium Momentum", "description": "Reached the podium in eight consecutive numbered battles.", "criteria": "8 consecutive podiums", "metric": "longest_podium_streak", "threshold": 8, "icon": "8×"},
        {"id": "streak_10", "name": "Unbroken Momentum", "description": "Reached the podium in 10 consecutive numbered battles.", "criteria": "10 consecutive podiums", "metric": "longest_podium_streak", "threshold": 10, "icon": "10×"},
        {"id": "streak_12", "name": "Unstoppable Run", "description": "Reached the podium in 12 consecutive numbered battles.", "criteria": "12 consecutive podiums", "metric": "longest_podium_streak", "threshold": 12, "icon": "12×"},
        {"id": "streak_15", "name": "Perfect Podium Run", "description": "Reached the podium in 15 consecutive numbered battles.", "criteria": "15 consecutive podiums", "metric": "longest_podium_streak", "threshold": 15, "icon": "15×"},
    ],
    "teams": [
        {"id": "battles_300", "name": "Established Club", "description": "Recorded results in 300 official battles.", "criteria": "300 battles", "metric": "tournaments_played", "threshold": 300, "icon": "300"},
        {"id": "battles_400", "name": "Veteran Club", "description": "Recorded results in 400 official battles.", "criteria": "400 battles", "metric": "tournaments_played", "threshold": 400, "icon": "400"},
        {"id": "battles_500", "name": "Elite Institution", "description": "Recorded results in 500 official battles.", "criteria": "500 battles", "metric": "tournaments_played", "threshold": 500, "icon": "500"},
        {"id": "battles_600", "name": "600-Battle Institution", "description": "Recorded results in 600 official battles.", "criteria": "600 battles", "metric": "tournaments_played", "threshold": 600, "icon": "600"},
        {"id": "podiums_50", "name": "Podium Contender", "description": "Finished in the top three at least 50 times.", "criteria": "50 podiums", "metric": "podiums", "threshold": 50, "icon": "50×"},
        {"id": "podiums_150", "name": "Podium Dynasty", "description": "Finished in the top three at least 150 times.", "criteria": "150 podiums", "metric": "podiums", "threshold": 150, "icon": "150"},
        {"id": "podiums_250", "name": "Podium Empire", "description": "Finished in the top three at least 250 times.", "criteria": "250 podiums", "metric": "podiums", "threshold": 250, "icon": "250"},
        {"id": "podiums_400", "name": "Four-Hundred Podiums", "description": "Finished in the top three at least 400 times.", "criteria": "400 podiums", "metric": "podiums", "threshold": 400, "icon": "400"},
        {"id": "wins_10", "name": "10-Time Team Champion", "description": "Won at least 10 official battles.", "criteria": "10 wins", "metric": "first_places", "threshold": 10, "icon": "10 W"},
        {"id": "wins_25", "name": "Dominant Team", "description": "Won at least 25 official battles.", "criteria": "25 wins", "metric": "first_places", "threshold": 25, "icon": "25 W"},
        {"id": "wins_50", "name": "Team Dynasty", "description": "Won at least 50 official battles.", "criteria": "50 wins", "metric": "first_places", "threshold": 50, "icon": "50 W"},
        {"id": "wins_100", "name": "Century of Victories", "description": "Won at least 100 official battles.", "criteria": "100 wins", "metric": "first_places", "threshold": 100, "icon": "100 W"},
        {"id": "streak_10", "name": "Unbroken Team Form", "description": "Reached the podium in 10 consecutive numbered battles.", "criteria": "10 consecutive podiums", "metric": "longest_podium_streak", "threshold": 10, "icon": "10×"},
        {"id": "streak_20", "name": "Elite Consistency", "description": "Reached the podium in 20 consecutive numbered battles.", "criteria": "20 consecutive podiums", "metric": "longest_podium_streak", "threshold": 20, "icon": "20×"},
        {"id": "streak_30", "name": "Thirty-Battle Reign", "description": "Reached the podium in 30 consecutive numbered battles.", "criteria": "30 consecutive podiums", "metric": "longest_podium_streak", "threshold": 30, "icon": "30×"},
        {"id": "streak_40", "name": "Forty-Battle Reign", "description": "Reached the podium in 40 consecutive numbered battles.", "criteria": "40 consecutive podiums", "metric": "longest_podium_streak", "threshold": 40, "icon": "40×"},
    ],
}


def achievements_for(stats: dict, kind: str) -> list:
    """Return earned career achievement IDs using transparent all-time thresholds."""
    definitions = ACHIEVEMENT_DEFINITIONS[kind]
    earned = []
    for definition in definitions:
        try:
            value = float(stats.get(definition["metric"]) or 0)
        except (TypeError, ValueError):
            value = 0
        if value >= definition["threshold"]:
            earned.append(definition["id"])
    return earned


def summarize_member_records(records: list, id_field: str, name_field: str) -> list:
    """Summarize per-battle top-contributor snapshots without claiming a full roster."""
    grouped = {}
    for row in records:
        identifier = str(row.get(id_field) or "").strip()
        battle_id = str(row.get("id") or "").strip()
        if not identifier or not battle_id:
            continue
        bucket = grouped.setdefault(identifier, {"name": row.get(name_field) or identifier, "records": {}})
        bucket["records"][battle_id] = row

    summaries = []
    for identifier, bucket in grouped.items():
        items = list(bucket["records"].values())
        scores = [float(row.get("score", 0) or 0) for row in items]
        latest = max(items, key=lambda row: int(row.get("startsAt") or 0))
        total = sum(scores)
        summaries.append({
            "id": identifier,
            "name": bucket["name"],
            "battles_listed": len(items),
            "contribution_points": round(total, 1),
            "avg_contribution": round(total / len(items), 1) if items else 0,
            "best_contribution": max(scores) if scores else 0,
            "last_seen": latest.get("startsAt"),
            "last_battle": latest.get("name"),
        })
    return sorted(
        summaries,
        key=lambda row: (-float(row["contribution_points"]), -int(row["battles_listed"]), str(row["name"]).lower()),
    )


def build_contributor_leaderboard(
    team_member_records: dict,
    player_records: dict,
    team_names: dict,
    allowed_battle_ids: set | None = None,
) -> dict:
    """Aggregate listed team-standing contributions into a global player ranking.

    A player's appearance is counted once per battle even if duplicate snapshots
    are present. Lichess normally allows one team per player in a single battle;
    the maximum score is retained defensively if an unexpected cross-team
    duplicate exists.
    """
    player_key_by_id = {str(key).strip().lower(): key for key in player_records}
    grouped = {}
    covered_teams = set()
    covered_battles = set()

    for team_id, records in team_member_records.items():
        team_key = str(team_id or "").strip()
        if not team_key:
            continue
        team_name = team_names.get(team_key, team_key)
        for row in records:
            battle_id = str(row.get("id") or "").strip()
            if not battle_id:
                continue
            if allowed_battle_ids is not None and battle_id not in allowed_battle_ids:
                continue

            raw_player_id = str(row.get("player_id") or row.get("player_name") or "").strip()
            if not raw_player_id:
                continue
            canonical_id = player_key_by_id.get(raw_player_id.lower())
            display_name = canonical_id or row.get("player_name") or raw_player_id
            contributor_key = str(canonical_id or raw_player_id).strip().lower()
            if not contributor_key:
                continue

            try:
                score = float(row.get("score", 0) or 0)
            except (TypeError, ValueError):
                score = 0.0
            battle_record = {
                "score": score,
                "startsAt": row.get("startsAt"),
                "name": row.get("name") or row.get("last_battle"),
            }

            contributor = grouped.setdefault(contributor_key, {
                "player_id": canonical_id,
                "lichess_id": raw_player_id,
                "name": str(display_name),
                "battle_records": {},
                "teams": {},
            })
            if canonical_id:
                contributor["player_id"] = canonical_id
                contributor["name"] = str(canonical_id)

            existing_battle = contributor["battle_records"].get(battle_id)
            if existing_battle is None or score > existing_battle["score"]:
                contributor["battle_records"][battle_id] = battle_record

            team_bucket = contributor["teams"].setdefault(team_key, {
                "name": team_name,
                "battle_records": {},
            })
            existing_team_battle = team_bucket["battle_records"].get(battle_id)
            if existing_team_battle is None or score > existing_team_battle["score"]:
                team_bucket["battle_records"][battle_id] = battle_record

            covered_teams.add(team_key)
            covered_battles.add(battle_id)

    ranked = []
    for contributor in grouped.values():
        battle_rows = list(contributor["battle_records"].values())
        if not battle_rows:
            continue
        points = sum(row["score"] for row in battle_rows)
        latest = max(battle_rows, key=lambda row: int(row.get("startsAt") or 0))
        team_summaries = []
        for team_id, team_bucket in contributor["teams"].items():
            team_rows = list(team_bucket["battle_records"].values())
            team_points = sum(row["score"] for row in team_rows)
            team_latest = max(team_rows, key=lambda row: int(row.get("startsAt") or 0))
            team_summaries.append({
                "id": team_id,
                "name": team_bucket["name"],
                "battles_listed": len(team_rows),
                "contribution_points": round(team_points, 1),
                "avg_contribution": round(team_points / len(team_rows), 1),
                "last_seen": team_latest.get("startsAt"),
            })
        team_summaries.sort(
            key=lambda row: (
                -float(row["contribution_points"]),
                -int(row["battles_listed"]),
                str(row["name"]).lower(),
            )
        )
        ranked.append({
            "player_id": contributor.get("player_id"),
            "lichess_id": contributor.get("lichess_id"),
            "profile_available": bool(contributor.get("player_id")),
            "name": contributor.get("name") or contributor.get("lichess_id"),
            "contribution_points": round(points, 1),
            "battles_listed": len(battle_rows),
            "teams_count": len(team_summaries),
            "avg_contribution": round(points / len(battle_rows), 1),
            "best_contribution": round(max(row["score"] for row in battle_rows), 1),
            "last_seen": latest.get("startsAt"),
            "last_battle": latest.get("name"),
            "teams": team_summaries,
        })

    ranked.sort(
        key=lambda row: (
            -float(row["contribution_points"]),
            -int(row["battles_listed"]),
            -int(row["teams_count"]),
            str(row["name"]).lower(),
        )
    )
    for index, row in enumerate(ranked, 1):
        row["rank"] = index

    return {
        "summary": {
            "contributors_count": len(ranked),
            "teams_covered_count": len(covered_teams),
            "battles_covered_count": len(covered_battles),
            "battle_appearances_count": sum(row["battles_listed"] for row in ranked),
            "total_contribution_points": round(sum(row["contribution_points"] for row in ranked), 1),
            "profile_match_count": sum(bool(row["profile_available"]) for row in ranked),
        },
        "contributors": ranked,
    }


def build_achievements_catalog(teams: list, players: list, generated_at: str) -> dict:
    """Create a public index of badge criteria, counts and leading holders."""
    categories = {}
    leaders = {}
    for kind, rows, id_field, name_field in (
        ("players", players, "username", "username"),
        ("teams", teams, "team_id", "team_name"),
    ):
        category_rows = []
        for definition in ACHIEVEMENT_DEFINITIONS[kind]:
            holders = [
                row for row in rows
                if definition["id"] in (row.get("achievements") or [])
            ]
            holders.sort(
                key=lambda row: (
                    -float(row.get(definition["metric"]) or 0),
                    -int(row.get("tournaments_played") or 0),
                    str(row.get(name_field) or "").lower(),
                )
            )
            category_rows.append({
                **definition,
                "count": len(holders),
                "holders": [{
                    "id": row.get(id_field),
                    "name": row.get(name_field),
                    "rank": row.get("rank"),
                    "points": row.get("points"),
                    "value": row.get(definition["metric"]),
                } for row in holders[:8]],
            })
        categories[kind] = category_rows

        ranked = sorted(
            rows,
            key=lambda row: (
                -len(row.get("achievements") or []),
                -float(row.get("points") or 0),
                str(row.get(name_field) or "").lower(),
            ),
        )
        leaders[kind] = [{
            "id": row.get(id_field),
            "name": row.get(name_field),
            "rank": row.get("rank"),
            "points": row.get("points"),
            "achievement_count": len(row.get("achievements") or []),
        } for row in ranked[:10] if row.get("achievements")]

    return {
        "generated_at": generated_at,
        "summary": {
            "players_with_achievements": sum(bool(row.get("achievements")) for row in players),
            "teams_with_achievements": sum(bool(row.get("achievements")) for row in teams),
            "player_badges_awarded": sum(len(row.get("achievements") or []) for row in players),
            "team_badges_awarded": sum(len(row.get("achievements") or []) for row in teams),
        },
        "categories": categories,
        "leaders": leaders,
    }


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


def compact_leader(row: dict, kind: str) -> dict:
    name_field = "team_name" if kind == "teams" else "username"
    id_field = "team_id" if kind == "teams" else "username"
    fields = (
        "rank", "points", "tournaments_played", "avg_points",
        "podiums", "first_places", "best_finish",
        "highest_points", "best_tournament",
    )
    return {
        "name": row.get(name_field),
        "id": row.get(id_field),
        **{field: row.get(field) for field in fields},
    }


def build_record_holders(rows: list, kind: str) -> list:
    name_field = "team_name" if kind == "teams" else "username"
    id_field = "team_id" if kind == "teams" else "username"
    definitions = [
        ("most_points", "Most career points", "points", "points", 1),
        ("most_battles", "Most battles played", "tournaments_played", "battles", 1),
        ("most_podiums", "Most podium finishes", "podiums", "podiums", 1),
        ("most_first_places", "Most first places", "first_places", "wins", 1),
        ("highest_single_battle", "Highest single-battle score", "highest_points", "points", 1),
        ("longest_podium_streak", "Longest consecutive podium streak", "longest_podium_streak", "consecutive battles", 1),
        ("highest_average", "Highest average points (25+ battles)", "avg_points", "points / battle", 25),
    ]
    records = []
    for key, label, field, unit, minimum_battles in definitions:
        eligible = [
            row for row in rows
            if row.get(field) is not None
            and int(row.get("tournaments_played") or 0) >= minimum_battles
        ]
        if not eligible:
            continue
        holder = max(eligible, key=lambda row: (float(row.get(field) or 0), str(row.get(name_field) or "").lower()))
        records.append({
            "key": key,
            "label": label,
            "holder": holder.get(name_field),
            "holder_id": holder.get(id_field),
            "value": holder.get(field),
            "unit": unit,
            "detail": holder.get("best_tournament") if field == "highest_points" else None,
            "battles_required": minimum_battles if minimum_battles > 1 else None,
        })
    return records


def build_hall_of_fame(teams: list, players: list, seasons: list, generated_at: str) -> dict:
    """Build a compact, refreshable history page from the ranking outputs."""
    return {
        "generated_at": generated_at,
        "totals": {
            "numbered_battles": 0,
            "teams": len(teams),
            "players": len(players),
            "completed_seasons": sum(bool(season.get("complete")) for season in seasons),
        },
        "all_time": {
            "teams": [compact_leader(row, "teams") for row in teams[:5]],
            "players": [compact_leader(row, "players") for row in players[:5]],
        },
        "records": {
            "teams": build_record_holders(teams, "teams"),
            "players": build_record_holders(players, "players"),
        },
        "seasons": seasons,
    }




def build_dashboard_analytics(
    numbered_battles: list,
    teams: list,
    players: list,
    team_records: dict,
    player_records: dict,
    season_summaries: list,
    generated_at: str,
) -> tuple[dict, dict]:
    """Build small pre-aggregated dashboard datasets from eligible battle results."""
    monthly_battles = defaultdict(list)
    monthly_teams = defaultdict(set)
    monthly_players = defaultdict(set)
    monthly_team_points = defaultdict(float)
    monthly_player_points = defaultdict(float)
    team_months = defaultdict(set)
    player_months = defaultdict(set)

    seasonal_battles = defaultdict(list)
    seasonal_teams = defaultdict(set)
    seasonal_players = defaultdict(set)
    seasonal_team_points = defaultdict(float)
    seasonal_player_points = defaultdict(float)

    for battle in numbered_battles:
        starts_at = battle.get("startsAt")
        if starts_at is None:
            continue
        try:
            moment = datetime.fromtimestamp(int(starts_at) / 1000, tz=timezone.utc)
        except (TypeError, ValueError, OverflowError, OSError):
            continue
        month_key = moment.strftime("%Y-%m")
        monthly_battles[month_key].append(battle)
        number = int(battle.get("battle_number") or parse_battle_number(battle.get("name")) or 0)
        if number > 0:
            seasonal_battles[season_number_for_battle(number)].append(battle)

    def collect_competitor_rows(records_by_key: dict, kind: str) -> None:
        for competitor_id, records in records_by_key.items():
            for row in records:
                starts_at = row.get("startsAt")
                if starts_at is None:
                    continue
                try:
                    moment = datetime.fromtimestamp(int(starts_at) / 1000, tz=timezone.utc)
                except (TypeError, ValueError, OverflowError, OSError):
                    continue
                month_key = moment.strftime("%Y-%m")
                number = parse_battle_number(row.get("name"))
                if kind == "teams":
                    monthly_teams[month_key].add(competitor_id)
                    monthly_team_points[month_key] += float(row.get("score", 0) or 0)
                    team_months[competitor_id].add(month_key)
                    if number:
                        seasonal_teams[season_number_for_battle(number)].add(competitor_id)
                        seasonal_team_points[season_number_for_battle(number)] += float(row.get("score", 0) or 0)
                else:
                    monthly_players[month_key].add(competitor_id)
                    monthly_player_points[month_key] += float(row.get("score", 0) or 0)
                    player_months[competitor_id].add(month_key)
                    if number:
                        seasonal_players[season_number_for_battle(number)].add(competitor_id)
                        seasonal_player_points[season_number_for_battle(number)] += float(row.get("score", 0) or 0)

    collect_competitor_rows(team_records, "teams")
    collect_competitor_rows(player_records, "players")

    months = []
    seen_teams, seen_players = set(), set()
    for month_key in sorted(monthly_battles):
        battles = monthly_battles[month_key]
        participant_counts = []
        for battle in battles:
            try:
                count = int(battle.get("nbPlayers"))
                if count >= 0:
                    participant_counts.append(count)
            except (TypeError, ValueError):
                continue
        active_team_ids = monthly_teams[month_key]
        active_player_ids = monthly_players[month_key]
        new_teams = active_team_ids - seen_teams
        new_players = active_player_ids - seen_players
        seen_teams.update(active_team_ids)
        seen_players.update(active_player_ids)
        months.append({
            "key": month_key,
            "label": datetime.strptime(month_key, "%Y-%m").strftime("%b %Y"),
            "battle_count": len(battles),
            "active_teams": len(active_team_ids),
            "active_players": len(active_player_ids),
            "new_teams": len(new_teams),
            "new_players": len(new_players),
            "participant_entries": sum(participant_counts),
            "avg_participants_per_battle": round(sum(participant_counts) / len(participant_counts), 1) if participant_counts else None,
            "max_participants": max(participant_counts) if participant_counts else None,
            "team_points_total": round(monthly_team_points[month_key], 1),
            "player_points_total": round(monthly_player_points[month_key], 1),
        })

    season_lookup = {int(item["season_number"]): item for item in season_summaries}
    seasons = []
    season_numbers = sorted(set(seasonal_battles) | set(season_lookup))
    for season_number in season_numbers:
        metadata = season_lookup.get(season_number, {})
        battles = seasonal_battles.get(season_number, [])
        participant_counts = []
        for battle in battles:
            try:
                count = int(battle.get("nbPlayers"))
                if count >= 0:
                    participant_counts.append(count)
            except (TypeError, ValueError):
                continue
        seasons.append({
            "season_number": season_number,
            "key": metadata.get("key", f"season-{season_number:02d}"),
            "label": metadata.get("label", f"Season {season_number}"),
            "first_battle": metadata.get("first_battle", (season_number - 1) * SEASON_SIZE + 1),
            "last_battle": metadata.get("last_battle", season_number * SEASON_SIZE),
            "battle_count": len(battles),
            "expected_battles": metadata.get("expected_battles", SEASON_SIZE),
            "complete": bool(metadata.get("complete", False)),
            "in_progress": bool(metadata.get("in_progress", False)),
            "missing_battles": len(metadata.get("missing_battle_numbers", [])),
            "active_teams": len(seasonal_teams[season_number]),
            "active_players": len(seasonal_players[season_number]),
            "avg_participants_per_battle": round(sum(participant_counts) / len(participant_counts), 1) if participant_counts else None,
            "team_points_total": round(seasonal_team_points[season_number], 1),
            "player_points_total": round(seasonal_player_points[season_number], 1),
            "team_champion": metadata.get("team_champion"),
            "player_champion": metadata.get("player_champion"),
        })

    dated_battles = [battle for rows in monthly_battles.values() for battle in rows]
    participant_battles = []
    for battle in dated_battles:
        try:
            count = int(battle.get("nbPlayers"))
            if count >= 0:
                participant_battles.append((count, battle))
        except (TypeError, ValueError):
            continue
    average_participants = (
        round(sum(count for count, _ in participant_battles) / len(participant_battles), 1)
        if participant_battles else None
    )
    peak = max(participant_battles, key=lambda item: (item[0], int(item[1].get("startsAt") or 0))) if participant_battles else None
    latest_battle = max(
        numbered_battles,
        key=lambda battle: (int(battle.get("startsAt") or 0), int(battle.get("battle_number") or 0)),
        default=None,
    )
    latest_month = months[-1] if months else None
    current_season = seasons[-1] if seasons else None

    def compact_record_bundles(rows: list, kind: str) -> list:
        wanted = {"most_battles", "most_podiums", "highest_single_battle", "longest_podium_streak"}
        return [record for record in build_record_holders(rows, kind) if record.get("key") in wanted]

    overview = {
        "schema_version": 1,
        "generated_at": generated_at,
        "totals": {
            "numbered_battles": len(numbered_battles),
            "dated_battles": len(dated_battles),
            "teams": len(teams),
            "players": len(players),
            "avg_participants_per_battle": average_participants,
            "total_participant_entries": sum(count for count, _ in participant_battles),
            "highest_participation": peak[0] if peak else None,
            "highest_participation_battle": ({
                "name": peak[1].get("name"),
                "battle_number": peak[1].get("battle_number"),
                "id": peak[1].get("id"),
                "startsAt": peak[1].get("startsAt"),
                "url": peak[1].get("url"),
            } if peak else None),
        },
        "latest_battle": ({
            "name": latest_battle.get("name"),
            "battle_number": latest_battle.get("battle_number"),
            "id": latest_battle.get("id"),
            "startsAt": latest_battle.get("startsAt"),
            "nbPlayers": latest_battle.get("nbPlayers"),
            "url": latest_battle.get("url"),
        } if latest_battle else None),
        "current_month": latest_month,
        "current_season": current_season,
        "leaders": {
            "teams": [compact_leader(row, "teams") for row in teams[:5]],
            "players": [compact_leader(row, "players") for row in players[:5]],
        },
        "records": {
            "teams": compact_record_bundles(teams, "teams"),
            "players": compact_record_bundles(players, "players"),
        },
        "methodology": {
            "eligibility": "Only finished regular numbered ULTRAbullet Team Battles are included; special and unnumbered events are excluded.",
            "monthly_activity": "Active teams and players are distinct competitors with at least one recorded result in the UTC calendar month.",
            "new_competitors": "New teams and players are counted in the first UTC month in which they appear in the recorded archive.",
            "participation": "Participants per battle use Lichess tournament nbPlayers; the monthly average excludes battles with no participant count.",
            "seasons": f"Fixed official battle-number ranges of {SEASON_SIZE} battles; missing battle numbers do not shift season boundaries.",
        },
    }
    timeseries = {
        "schema_version": 1,
        "generated_at": generated_at,
        "months": months,
        "seasons": seasons,
    }
    return overview, timeseries


def profile_index_bucket(identifier: str) -> str:
    """Return the one-character bucket shared by the profile page lookup."""
    first = str(identifier or "").strip().lower()[:1]
    return re.sub(r"[^a-z0-9]", "_", first) or "_"




def build_cumulative_rank_history(records_by_key: dict, numbered_battles: list) -> dict:
    """Return compact all-time rank checkpoints for each competitor.

    A checkpoint is the last available numbered battle in each fixed season.
    The ranking is recalculated from cumulative scores recorded up to that
    battle, so missing battle numbers do not shift the season boundaries.
    """
    battle_numbers = {}
    last_in_season = {}
    for battle in numbered_battles:
        battle_id = str(battle.get("id") or "").strip()
        number = int(battle.get("battle_number") or parse_battle_number(battle.get("name")) or 0)
        if not battle_id or number < 1:
            continue
        battle_numbers[battle_id] = number
        season = season_number_for_battle(number)
        last_in_season[season] = max(number, last_in_season.get(season, 0))

    if not battle_numbers:
        return {}

    checkpoints = set(last_in_season.values())
    event_scores = defaultdict(dict)
    for competitor_id, records in records_by_key.items():
        key = str(competitor_id)
        for row in records:
            number = battle_numbers.get(str(row.get("id") or "").strip())
            if not number:
                continue
            try:
                score = float(row.get("score", 0) or 0)
            except (TypeError, ValueError):
                score = 0.0
            # Keep one result per competitor and battle if old worker files
            # happen to contain duplicate snapshots.
            current = event_scores[number].get(key)
            if current is None or score > current:
                event_scores[number][key] = score

    cumulative = {}
    history = defaultdict(list)
    for number in sorted(event_scores):
        for competitor_id, score in event_scores[number].items():
            cumulative[competitor_id] = cumulative.get(competitor_id, 0.0) + score

        if number not in checkpoints:
            continue

        ordered = sorted(cumulative.items(), key=lambda item: (-item[1], item[0].lower()))
        for index, (competitor_id, _points) in enumerate(ordered, start=1):
            history[competitor_id].append([number, index])

    return dict(history)


def write_battle_reports(
    output_dir: str,
    numbered_battles: list,
    team_records: dict,
    team_names: dict,
    player_records: dict,
) -> int:
    """Publish one lazy-loaded, compact report per numbered battle."""
    reports_dir = os.path.join(output_dir, "battles")
    if os.path.isdir(reports_dir):
        shutil.rmtree(reports_dir)
    os.makedirs(reports_dir, exist_ok=True)

    teams_by_battle = defaultdict(list)
    for team_id, records in team_records.items():
        for record in records:
            battle_id = str(record.get("id") or "").strip()
            if not battle_id:
                continue
            try:
                score = float(record.get("score", 0) or 0)
            except (TypeError, ValueError):
                score = 0.0
            try:
                rank = int(record.get("rank")) if record.get("rank") is not None else None
            except (TypeError, ValueError):
                rank = None
            teams_by_battle[battle_id].append({
                "id": str(team_id),
                "name": team_names.get(team_id, team_id),
                "score": round(score, 1),
                "rank": rank,
            })

    players_by_battle = defaultdict(list)
    for username, records in player_records.items():
        for record in records:
            battle_id = str(record.get("id") or "").strip()
            if not battle_id:
                continue
            try:
                score = float(record.get("score", 0) or 0)
            except (TypeError, ValueError):
                score = 0.0
            try:
                rank = int(record.get("rank")) if record.get("rank") is not None else None
            except (TypeError, ValueError):
                rank = None
            players_by_battle[battle_id].append({
                "id": str(username),
                "name": str(username),
                "score": round(score, 1),
                "rank": rank,
            })

    for battle in numbered_battles:
        battle_id = str(battle.get("id") or "").strip()
        if not battle_id:
            continue

        teams = teams_by_battle.get(battle_id, [])
        players = players_by_battle.get(battle_id, [])
        teams.sort(key=lambda row: (
            row["rank"] if row["rank"] and row["rank"] > 0 else 10**9,
            -row["score"],
            row["name"].lower(),
        ))
        players.sort(key=lambda row: (
            row["rank"] if row["rank"] and row["rank"] > 0 else 10**9,
            -row["score"],
            row["name"].lower(),
        ))
        for index, row in enumerate(teams, start=1):
            if not row["rank"] or row["rank"] < 1:
                row["rank"] = index
        for index, row in enumerate(players, start=1):
            if not row["rank"] or row["rank"] < 1:
                row["rank"] = index

        payload = {
            "schema_version": 1,
            "battle": {
                "id": battle_id,
                "name": battle.get("name") or battle.get("fullName") or "UltraBullet Team Battle",
                "battle_number": int(battle.get("battle_number") or 0),
                "startsAt": battle.get("startsAt"),
                "nbPlayers": battle.get("nbPlayers"),
                "url": battle.get("url") or f"https://lichess.org/tournament/{battle_id}",
            },
            "summary": {
                "teams_count": len(teams),
                "players_count": len(players),
                "team_results_available": bool(teams),
                "player_results_available": bool(players),
            },
            "teams": teams,
            "players": players,
        }
        write_json(os.path.join(reports_dir, f"{battle_id}.json"), payload)

    return len(numbered_battles)


def write_profile_lookup_indexes(profiles_dir: str, players: list, teams: list, rank_history: dict | None = None) -> int:
    """Write small bucketed indexes so direct profile URLs avoid full leaderboard downloads."""
    index_dir = os.path.join(profiles_dir, "index")
    if os.path.isdir(index_dir):
        shutil.rmtree(index_dir)
    os.makedirs(index_dir, exist_ok=True)
    total_shards = 0
    for kind, rows, id_field in (
        ("players", players, "username"),
        ("teams", teams, "team_id"),
    ):
        buckets = defaultdict(dict)
        for row in rows:
            identifier = str(row.get(id_field) or "").strip()
            lookup_key = identifier.lower()
            if not lookup_key:
                continue
            bucket = profile_index_bucket(identifier)
            entry = dict(row)
            entry["id"] = identifier
            entry["name"] = row.get("username") if kind == "players" else row.get("team_name", identifier)
            checkpoints = (rank_history or {}).get(kind, {}).get(lookup_key)
            if checkpoints:
                entry["rank_history"] = checkpoints
            buckets[bucket][lookup_key] = entry
        for bucket, payload in buckets.items():
            write_json(os.path.join(index_dir, f"{kind}-{bucket}.json"), payload)
            total_shards += 1
    return total_shards


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
    team_member_records = {}
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
        for team_id, records in data.get("team_member_records", {}).items():
            team_member_records.setdefault(team_id, []).extend(records)
        all_errors.extend(data.get("errors", []))

    # Fail closed before touching published datasets. A worker error means at
    # least one result endpoint may be missing, so publishing the aggregate
    # would silently turn an incomplete refresh into the new public baseline.
    if all_errors:
        write_json("errors.json", all_errors)
        print(
            f"ERROR: refusing to publish incomplete data; "
            f"{len(all_errors)} worker error(s) were recorded. "
            "The previous generated datasets remain untouched. See errors.json.",
            file=sys.stderr,
        )
        return 1

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
    team_member_records = {
        key: [row for row in records if str(row.get("id") or "") in allowed_ids]
        for key, records in team_member_records.items()
    }
    team_member_records = {key: records for key, records in team_member_records.items() if records}
    player_totals = {key: sum(float(row.get("score", 0) or 0) for row in records)
                     for key, records in player_records.items()}
    team_totals = {key: sum(float(row.get("score", 0) or 0) for row in records)
                   for key, records in team_records.items()}
    player_rank = sorted(player_totals.items(), key=lambda item: (-item[1], item[0].lower()))
    team_rank = sorted(team_totals.items(), key=lambda item: (-item[1], item[0].lower()))
    numbered_battles = sorted(regular_battles.values(), key=lambda row: (int(row["battle_number"]), str(row.get("id") or "")))
    player_rank_history = build_cumulative_rank_history(player_records, numbered_battles)
    team_rank_history = build_cumulative_rank_history(team_records, numbered_battles)

    # Resolve Lichess account IDs to the canonical player profile key and build
    # both directions of the team-contributor relationship.
    player_key_by_id = {str(key).strip().lower(): key for key in player_records}
    member_records_by_team = defaultdict(list)
    team_records_by_player = defaultdict(list)
    for team_id, records in team_member_records.items():
        for record in records:
            raw_player_id = str(record.get("player_id") or record.get("player_name") or "").strip()
            if not raw_player_id:
                continue
            player_key = player_key_by_id.get(raw_player_id.lower(), raw_player_id)
            member_row = {
                **record,
                "player_id": player_key,
                "player_name": record.get("player_name") or player_key,
            }
            member_records_by_team[team_id].append(member_row)
            team_records_by_player[player_key].append({
                **member_row,
                "team_id": team_id,
                "team_name": team_names.get(team_id, record.get("team_name") or team_id),
            })

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
        player_stats = compute_stats(player_records.get(username, []))
        achievements = achievements_for(player_stats, "players")
        players.append({
            "rank": index + 1,
            "username": username,
            "points": points,
            **player_stats,
            "achievements": achievements,
            **player_profile_refs[username],
        })
        profile_shards["players"].setdefault(shard_name, {})[username] = {
            "history": history,
            "teams": summarize_member_records(team_records_by_player.get(username, []), "team_id", "team_name"),
        }

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
        team_stats = compute_stats(team_records.get(team_id, []))
        achievements = achievements_for(team_stats, "teams")
        teams.append({
            "rank": index + 1,
            "team_id": team_id,
            "team_name": team_names.get(team_id, team_id),
            "points": points,
            **team_stats,
            "achievements": achievements,
            **team_profile_refs[team_id],
        })
        profile_shards["teams"].setdefault(shard_name, {})[team_id] = {
            "history": history,
            "members": summarize_member_records(member_records_by_team.get(team_id, []), "player_id", "player_name"),
        }

    for shards in profile_shards.values():
        for filename, payload in shards.items():
            write_json(os.path.join(profiles_dir, filename), payload)

    profile_lookup_shards = write_profile_lookup_indexes(
        profiles_dir,
        players,
        teams,
        {
            "players": {str(key).lower(): value for key, value in player_rank_history.items()},
            "teams": {str(key).lower(): value for key, value in team_rank_history.items()},
        },
    )

    # Monthly tables use regular numbered battles only. Seasons are fixed to
    # official battle-number ranges, not the count/order of available records.
    max_battle_number = max((int(row["battle_number"]) for row in numbered_battles), default=0)
    battle_reports_count = write_battle_reports(OUTPUT_DIR, numbered_battles, team_records, team_names, player_records)
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
    season_hall = []
    season_count = season_number_for_battle(max_battle_number) if max_battle_number else 0
    for season_number in range(1, season_count + 1):
        battles = seasons_by_number.get(season_number, [])
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

        season_hall.append({
            "key": season_key,
            "season_number": season_number,
            "label": label,
            "battle_count": len(battles),
            "expected_battles": SEASON_SIZE,
            "missing_battle_numbers": missing_numbers,
            "first_battle": first_battle,
            "last_battle": last_battle,
            "complete": complete,
            "in_progress": in_progress,
            "status": "complete" if complete else ("in_progress" if in_progress else "upcoming"),
            "start_at": min(dated) if dated else None,
            "end_at": max(dated) if dated else None,
            "team_podium": [compact_leader(row, "teams") for row in payload["teams"][:3]],
            "player_podium": [compact_leader(row, "players") for row in payload["players"][:3]],
            "team_champion": compact_leader(payload["teams"][0], "teams") if complete and payload["teams"] else None,
            "player_champion": compact_leader(payload["players"][0], "players") if complete and payload["players"] else None,
        })

    generated_at = datetime.now(timezone.utc).isoformat()
    contributor_leaderboard = build_contributor_leaderboard(
        team_member_records,
        player_records,
        team_names,
        allowed_battle_ids=allowed_ids,
    )
    write_json(os.path.join(OUTPUT_DIR, "contributors.json"), {
        "generated_at": generated_at,
        "summary": contributor_leaderboard["summary"],
        "contributors": contributor_leaderboard["contributors"],
        "methodology": (
            "Career contribution points summed from player scores listed in official numbered "
            "Lichess team-battle standings. Each player is counted once per battle. These are "
            "listed contributors, not a complete team-membership roster."
        ),
    })
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

    hall_of_fame = build_hall_of_fame(teams, players, list(reversed(season_hall)), generated_at)
    hall_of_fame["totals"]["numbered_battles"] = len(numbered_battles)
    write_json(os.path.join(OUTPUT_DIR, "hall_of_fame.json"), hall_of_fame)

    dashboard_overview, dashboard_timeseries = build_dashboard_analytics(
        numbered_battles, teams, players, team_records, player_records, season_hall, generated_at
    )
    write_json(os.path.join(OUTPUT_DIR, "analytics", "overview.json"), dashboard_overview)
    write_json(os.path.join(OUTPUT_DIR, "analytics", "timeseries.json"), dashboard_timeseries)

    achievements_catalog = build_achievements_catalog(teams, players, generated_at)
    write_json(os.path.join(OUTPUT_DIR, "achievements.json"), achievements_catalog)

    member_record_count = sum(len(records) for records in team_member_records.values())
    teams_with_member_data = sum(bool(records) for records in team_member_records.values())

    meta = {
        "generated_at": generated_at,
        "tournaments_processed": len(numbered_battles),
        "teams_count": len(teams),
        "players_count": len(players),
        "errors_count": len(all_errors),
        "selection_rule": "Numbered regular ULTRAbullet Team Battles only; special and unnumbered events excluded.",
        "profile_shard_size": PROFILE_SHARD_SIZE,
        "profiles_shards": sum(len(shards) for shards in profile_shards.values()),
        "profile_lookup_shards": profile_lookup_shards,
        "season_size": SEASON_SIZE,
        "season_count": len(season_index),
        "hall_of_fame_seasons": len(season_hall),
        "dashboard_analytics_schema_version": 1,
        "month_count": len(month_index),
        "max_battle_number": max_battle_number,
        "excluded_events_count": len(battle_history) - len(regular_battles),
        "team_member_records_count": member_record_count,
        "contributors_count": contributor_leaderboard["summary"]["contributors_count"],
        "contributor_battle_appearances_count": contributor_leaderboard["summary"]["battle_appearances_count"],
        "contributor_leaderboard_schema_version": 1,
        "teams_with_member_data_count": teams_with_member_data,
        "achievement_catalog_schema_version": 1,
        "rank_history_schema_version": 1,
        "battle_reports_schema_version": 1,
        "battle_reports_count": battle_reports_count,
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
