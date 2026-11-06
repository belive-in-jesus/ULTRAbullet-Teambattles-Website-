#!/usr/bin/env python3
"""Convert persistent per-battle snapshots into the aggregate input format."""
from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

CACHE_DIR = Path(os.environ.get("BATTLE_CACHE_DIR", "cache/battles"))
OUTPUT_DIR = Path(os.environ.get("PARTIALS_DIR", "artifacts"))
BATTLE_NAME_PATTERN = re.compile(
    r"^\s*(?P<number>\d+)(?:st|nd|rd|th)\s+ultrabullet\s+(?:team\s+battle|teambattle\s+team\s+battle)\s*$",
    re.IGNORECASE,
)


def parse_battle_number(name: str | None) -> int | None:
    match = BATTLE_NAME_PATTERN.fullmatch(str(name or ""))
    return int(match.group("number")) if match else None


def as_float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def build_partial(caches: list[dict]) -> dict:
    tournament_records = []
    player_records = defaultdict(list)
    team_records = defaultdict(list)
    team_member_records = defaultdict(list)
    player_points = defaultdict(float)
    team_points = defaultdict(float)
    team_names = {}
    seen_battle_ids = set()

    for cache in caches:
        battle = cache.get("battle") or {}
        battle_id = str(battle.get("id") or "").strip()
        name = str(battle.get("name") or "")
        number = int(battle.get("battle_number") or parse_battle_number(name) or 0)
        if not battle_id or number < 1:
            continue
        if battle_id in seen_battle_ids:
            raise ValueError(f"Duplicate battle ID in cache: {battle_id}")
        seen_battle_ids.add(battle_id)

        if cache.get("team_members_fetched") is not True:
            raise RuntimeError(
                f"Battle {battle_id} has no completed team-member snapshot. "
                "Refusing to rebuild contributor data from incomplete cache."
            )

        starts_at = battle.get("startsAt")
        nb_players = battle.get("nbPlayers")
        tournament_records.append({
            "id": battle_id,
            "name": name,
            "startsAt": starts_at,
            "nbPlayers": nb_players,
            "url": battle.get("url") or f"https://lichess.org/tournament/{battle_id}",
        })

        players = cache.get("players") or []
        teams = cache.get("teams") or []
        nb_teams = len(teams)

        for player in players:
            player_id = str(player.get("id") or player.get("name") or "").strip()
            if not player_id:
                continue
            score = as_float(player.get("score"))
            player_points[player_id] += score
            player_records[player_id].append({
                "id": battle_id,
                "name": name,
                "startsAt": starts_at,
                "score": score,
                "rank": player.get("rank"),
                "nbPlayers": nb_players,
            })

        for team in teams:
            team_id = str(team.get("id") or "").strip()
            if not team_id:
                continue
            team_name = str(team.get("name") or team_id)
            score = as_float(team.get("score"))
            team_points[team_id] += score
            team_names.setdefault(team_id, team_name)
            team_records[team_id].append({
                "id": battle_id,
                "name": name,
                "startsAt": starts_at,
                "score": score,
                "rank": team.get("rank"),
                "nbTeams": nb_teams,
            })

        for member in cache.get("team_members") or []:
            team_id = str(member.get("team_id") or "").strip()
            player_id = str(member.get("player_id") or member.get("player_name") or "").strip()
            if not team_id or not player_id:
                continue
            team_member_records[team_id].append({
                "id": battle_id,
                "player_id": player_id,
                "player_name": str(member.get("player_name") or player_id),
                "score": as_float(member.get("score")),
                "startsAt": starts_at,
                "team_rank": member.get("team_rank"),
                "team_name": str(member.get("team_name") or team_names.get(team_id) or team_id),
            })

    if not tournament_records:
        raise RuntimeError("No valid numbered battle snapshots found; refusing to create an empty aggregate.")

    tournament_records.sort(key=lambda row: (int(row.get("startsAt") or 0), row["id"]))
    return {
        "worker": "cache",
        "processed": len(tournament_records),
        "tournament_records": tournament_records,
        "player_points": dict(player_points),
        "player_records": dict(player_records),
        "team_points": dict(team_points),
        "team_names": team_names,
        "team_records": dict(team_records),
        "team_member_records": dict(team_member_records),
        "errors": [],
    }


def load_caches(cache_dir: Path = CACHE_DIR) -> list[dict]:
    if not cache_dir.is_dir():
        raise FileNotFoundError(f"Battle cache directory not found: {cache_dir}")
    files = sorted(cache_dir.glob("*.json"))
    if not files:
        raise FileNotFoundError(f"No battle snapshots found in {cache_dir}")
    caches = []
    for path in files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Cannot read battle snapshot {path}: {error}") from error
        caches.append(payload)
    return caches


def main() -> int:
    caches = load_caches()
    partial = build_partial(caches)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "partial_0.json"
    output_path.write_text(json.dumps(partial, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(
        f"Built aggregate input from {partial['processed']} cached battles: "
        f"{len(partial['player_records'])} players, {len(partial['team_records'])} teams, "
        f"{sum(len(rows) for rows in partial['team_member_records'].values())} member records",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
