#!/usr/bin/env python3
"""Incrementally update per-battle result snapshots from the Lichess API.

Existing battle reports are used as the source of truth for player/team results.
The first incremental run backfills the team-member records required by the
contributor leaderboard. Future runs fetch only newly discovered battles.
All API requests are made sequentially to respect Lichess API guidance.
"""
from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import requests

API_ROOT = "https://lichess.org/api"
CACHE_DIR = Path(os.environ.get("BATTLE_CACHE_DIR", "cache/battles"))
SOURCE_REPORT_DIR = Path(os.environ.get("BATTLE_REPORT_DIR", "docs/data/battles"))
TOURNAMENTS_FILE = Path(os.environ.get("TOURNAMENTS_FILE", "tournaments.json"))
TOKEN = os.environ.get("LICHESS_TOKEN", "").strip()
REQUEST_DELAY = max(0.0, float(os.environ.get("REQUEST_DELAY", "1.0")))
FORCE_REFRESH_ALL = os.environ.get("FORCE_REFRESH_ALL", "false").strip().lower() in {"1", "true", "yes"}
CACHE_SCHEMA_VERSION = 2
MAX_RETRIES = 7
INITIAL_BACKOFF = 3.0
MAX_BACKOFF = 60.0
BATTLE_NAME_PATTERN = re.compile(
    r"^\s*(?P<number>\d+)(?:st|nd|rd|th)\s+ultrabullet\s+(?:team\s+battle|teambattle\s+team\s+battle)\s*$",
    re.IGNORECASE,
)

session = requests.Session()
session.headers.update({
    "User-Agent": "UltraBulletTeamBattlesLeaderboard/2.0",
    "Accept": "application/json",
})
if TOKEN:
    session.headers["Authorization"] = f"Bearer {TOKEN}"


def parse_battle_number(name: str | None) -> int | None:
    match = BATTLE_NAME_PATTERN.fullmatch(str(name or ""))
    return int(match.group("number")) if match else None


def as_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def as_rank(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def request_api(url: str, *, accept: str = "application/json", allow_not_found: bool = False):
    """Perform a single API request, retrying gently and waiting >=60s on 429."""
    backoff = INITIAL_BACKOFF
    headers = {"Accept": accept}
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(url, headers=headers, timeout=(15, 180), stream=True)
        except requests.RequestException as error:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"Network request failed after {MAX_RETRIES} attempts: {url}") from error
            wait = min(backoff, MAX_BACKOFF)
            print(f"Network issue; retrying in {wait:.0f}s ({attempt}/{MAX_RETRIES})", file=sys.stderr)
            time.sleep(wait)
            backoff = min(backoff * 2, MAX_BACKOFF)
            continue

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            try:
                server_wait = float(retry_after) if retry_after else 60.0
            except (TypeError, ValueError):
                server_wait = 60.0
            wait = max(60.0, server_wait)
            response.close()
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"Lichess rate limit persisted after {MAX_RETRIES} attempts: {url}")
            print(f"Lichess rate limit (429); waiting {wait:.0f}s before retry ({attempt}/{MAX_RETRIES})", file=sys.stderr)
            time.sleep(wait)
            continue

        if response.status_code >= 500 and attempt < MAX_RETRIES:
            response.close()
            wait = min(backoff, MAX_BACKOFF)
            print(f"Lichess HTTP {response.status_code}; retrying in {wait:.0f}s ({attempt}/{MAX_RETRIES})", file=sys.stderr)
            time.sleep(wait)
            backoff = min(backoff * 2, MAX_BACKOFF)
            continue

        if REQUEST_DELAY:
            time.sleep(REQUEST_DELAY)
        if response.status_code == 404 and allow_not_found:
            return response
        response.raise_for_status()
        return response

    raise RuntimeError(f"Request failed after {MAX_RETRIES} attempts: {url}")


def parse_player_results(response, battle: dict) -> list[dict]:
    rows = []
    try:
        for raw_line in response.iter_lines(decode_unicode=True):
            if not raw_line:
                continue
            if isinstance(raw_line, bytes):
                raw_line = raw_line.decode("utf-8")
            row = json.loads(raw_line)
            username = row.get("username") or row.get("name")
            if not username:
                continue
            rows.append({
                "id": str(username),
                "name": str(username),
                "score": round(as_float(row.get("score")), 1),
                "rank": as_rank(row.get("rank")),
            })
    finally:
        response.close()
    return rows


def parse_team_results(payload: dict) -> tuple[list[dict], list[dict]]:
    teams = []
    team_members = []
    source_teams = payload.get("teams", []) if isinstance(payload, dict) else []
    for index, team in enumerate(source_teams):
        team_id = team.get("id")
        if not team_id:
            continue
        team_name = str(team.get("name") or team_id)
        teams.append({
            "id": str(team_id),
            "name": team_name,
            "score": round(as_float(team.get("score")), 1),
            "rank": index + 1,
        })
        for member in team.get("players", []) or []:
            user = member.get("user") or {}
            player_id = user.get("id") or user.get("name")
            if not player_id:
                continue
            team_members.append({
                "team_id": str(team_id),
                "team_name": team_name,
                "player_id": str(player_id),
                "player_name": str(user.get("name") or player_id),
                "score": round(as_float(member.get("score")), 1),
                "team_rank": index + 1,
            })
    return teams, team_members


def battle_metadata(tournament: dict, existing: dict | None = None) -> dict:
    prior = (existing or {}).get("battle", {})
    name = tournament.get("fullName") or tournament.get("name") or prior.get("name") or ""
    number = parse_battle_number(name) or prior.get("battle_number")
    battle_id = str(tournament.get("id") or prior.get("id") or "")
    return {
        "id": battle_id,
        "name": str(name or "UltraBullet Team Battle"),
        "battle_number": int(number or 0),
        "startsAt": tournament.get("startsAt") if tournament.get("startsAt") is not None else prior.get("startsAt"),
        "nbPlayers": tournament.get("nbPlayers") if tournament.get("nbPlayers") is not None else prior.get("nbPlayers"),
        "url": f"https://lichess.org/tournament/{battle_id}",
    }


def load_existing_snapshot(
    battle_id: str,
    cache_dir: Path = CACHE_DIR,
    report_dir: Path = SOURCE_REPORT_DIR,
) -> dict | None:
    """Prefer the private cache, falling back to the existing public report during migration."""
    candidates = (
        cache_dir / f"{battle_id}.json",
        report_dir / f"{battle_id}.json",
    )
    for path in candidates:
        if not path.exists():
            continue
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Cannot read existing battle data {path}: {error}") from error
    return None


def write_json_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
        temporary_path = Path(handle.name)
    os.replace(temporary_path, path)


def fetch_players(tournament_id: str, battle: dict) -> list[dict]:
    response = request_api(
        f"{API_ROOT}/tournament/{tournament_id}/results?sheet=false",
        accept="application/x-ndjson",
    )
    return parse_player_results(response, battle)


def fetch_teams(tournament_id: str) -> tuple[list[dict], list[dict], bool]:
    response = request_api(
        f"{API_ROOT}/tournament/{tournament_id}/teams",
        allow_not_found=True,
    )
    if response.status_code == 404:
        response.close()
        return [], [], False
    try:
        payload = response.json()
    finally:
        response.close()
    teams, members = parse_team_results(payload)
    return teams, members, True


def update_cache(tournaments: list[dict]) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    counters = {"new": 0, "backfilled": 0, "refreshed": 0, "unchanged": 0}

    eligible_by_id = {}
    for tournament in tournaments:
        name = tournament.get("fullName") or tournament.get("name") or ""
        if not parse_battle_number(name):
            continue
        tournament_id = str(tournament.get("id") or "").strip()
        if tournament_id:
            eligible_by_id[tournament_id] = tournament

    # Ensure that legacy reports outside the current discovery window are
    # also migrated once. This prevents an old cached battle from blocking
    # the aggregate merely because it is no longer in the discovery response.
    for report_path in SOURCE_REPORT_DIR.glob("*.json"):
        if report_path.stem in eligible_by_id:
            continue
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Cannot read legacy battle report {report_path}: {error}") from error
        battle = report.get("battle") or {}
        name = str(battle.get("name") or "")
        if parse_battle_number(name):
            eligible_by_id[report_path.stem] = {
                "id": report_path.stem,
                "fullName": name,
                "startsAt": battle.get("startsAt"),
                "nbPlayers": battle.get("nbPlayers"),
            }

    eligible = list(eligible_by_id.items())
    eligible.sort(key=lambda item: (int(item[1].get("startsAt") or 0), item[0]))
    if not eligible:
        raise RuntimeError("Discovery returned no eligible numbered battles; refusing to rebuild from an empty cache.")

    for index, (battle_id, tournament) in enumerate(eligible, start=1):
        cache_path = CACHE_DIR / f"{battle_id}.json"
        existing = load_existing_snapshot(battle_id)

        is_current = (
            existing is not None
            and int(existing.get("schema_version") or 0) >= CACHE_SCHEMA_VERSION
            and existing.get("team_members_fetched") is True
        )
        if is_current and not FORCE_REFRESH_ALL:
            counters["unchanged"] += 1
            continue

        battle = battle_metadata(tournament, existing)
        if existing is None:
            players = fetch_players(battle_id, battle)
            teams, members, team_endpoint_available = fetch_teams(battle_id)
            counters["new"] += 1
        elif FORCE_REFRESH_ALL:
            players = fetch_players(battle_id, battle)
            teams, members, team_endpoint_available = fetch_teams(battle_id)
            counters["refreshed"] += 1
        else:
            # Existing player results are already stored. Only fetch the
            # previously missing team/member snapshot needed by contributors.
            players = existing.get("players", [])
            teams, members, team_endpoint_available = fetch_teams(battle_id)
            if not team_endpoint_available and not teams:
                teams = existing.get("teams", [])
            counters["backfilled"] += 1

        if not team_endpoint_available:
            raise RuntimeError(
                f"Team results endpoint returned 404 for battle {battle_id}. "
                "Refusing to publish incomplete team and contributor rankings."
            )

        payload = {
            "schema_version": CACHE_SCHEMA_VERSION,
            "team_members_fetched": True,
            "team_endpoint_available": bool(team_endpoint_available),
            "battle": battle,
            "summary": {
                "teams_count": len(teams),
                "players_count": len(players),
                "team_member_records_count": len(members),
                "team_results_available": bool(teams),
                "player_results_available": bool(players),
            },
            "teams": teams,
            "players": players,
            "team_members": members,
        }
        write_json_atomic(cache_path, payload)

        if index % 25 == 0 or index == len(eligible):
            print(
                f"Checked {index}/{len(eligible)} battles · "
                f"{counters['new']} new · {counters['backfilled']} backfilled · "
                f"{counters['refreshed']} force-refreshed · {counters['unchanged']} unchanged",
                file=sys.stderr,
            )

    print(
        "Battle cache update complete: "
        + ", ".join(f"{key}={value}" for key, value in counters.items()),
        file=sys.stderr,
    )
    return counters


def main() -> int:
    if not TOURNAMENTS_FILE.exists():
        raise FileNotFoundError(f"Discovery file not found: {TOURNAMENTS_FILE}")
    tournaments = json.loads(TOURNAMENTS_FILE.read_text(encoding="utf-8"))
    if not isinstance(tournaments, list):
        raise ValueError("tournaments.json must contain a JSON array")
    update_cache(tournaments)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
