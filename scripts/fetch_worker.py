#!/usr/bin/env python3
"""Fetch individual and team results for one slice of tournaments.

The structure follows the public result aggregation approach by DarkOnCrack:
https://lichessbotacc.github.io/Gift-For-Nathanael/
"""
import json
import os
import sys
import time

import requests

TOKEN = os.environ.get("LICHESS_TOKEN", "").strip()
CHUNK_INDEX = int(os.environ["CHUNK_INDEX"])
NUM_WORKERS = max(1, int(os.environ["NUM_WORKERS"]))
REQUEST_DELAY = max(0.0, float(os.environ.get("REQUEST_DELAY", "0.5")))
TOURNAMENTS_FILE = os.environ.get("TOURNAMENTS_FILE", "tournaments.json")
MAX_RETRIES = 7
INITIAL_BACKOFF = 3.0
MAX_BACKOFF = 60.0

session = requests.Session()
session.headers.update({
    "Accept": "application/x-ndjson",
    "User-Agent": "UltraBulletTeamBattlesLeaderboard/1.0",
})
if TOKEN:
    session.headers["Authorization"] = f"Bearer {TOKEN}"


def get_with_retry(url: str, **kwargs):
    backoff = INITIAL_BACKOFF
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(url, timeout=(15, 60), **kwargs)
        except requests.RequestException:
            if attempt == MAX_RETRIES:
                raise
            print(f"Network issue; retrying in {backoff:.0f}s ({attempt}/{MAX_RETRIES})", file=sys.stderr)
            time.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)
            continue

        if response.status_code == 429 or (response.status_code >= 500 and attempt < MAX_RETRIES):
            response.close()
            print(f"HTTP {response.status_code}; retrying in {backoff:.0f}s ({attempt}/{MAX_RETRIES})", file=sys.stderr)
            time.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)
            continue
        return response
    raise RuntimeError(f"Request failed after {MAX_RETRIES} attempts: {url}")


def fetch_results(tournament: dict, player_points: dict, player_records: dict) -> None:
    tournament_id = tournament["id"]
    url = f"https://lichess.org/api/tournament/{tournament_id}/results"
    response = get_with_retry(url, params={"sheet": "false"}, stream=True)
    try:
        if response.status_code != 200:
            raise RuntimeError(f"results status={response.status_code}")
        for raw_line in response.iter_lines(decode_unicode=True):
            if not raw_line:
                continue
            row = json.loads(raw_line)
            username = row.get("username") or row.get("name")
            if not username:
                continue
            try:
                score = float(row.get("score", 0) or 0)
            except (TypeError, ValueError):
                score = 0
            rank = row.get("rank")
            player_points[username] = player_points.get(username, 0) + score
            player_records.setdefault(username, []).append({
                "id": tournament_id,
                "name": tournament.get("fullName"),
                "startsAt": tournament.get("startsAt"),
                "score": score,
                "rank": rank,
                "nbPlayers": tournament.get("nbPlayers"),
            })
    finally:
        response.close()


def fetch_teams(tournament: dict, team_points: dict, team_names: dict, team_records: dict) -> None:
    tournament_id = tournament["id"]
    response = get_with_retry(f"https://lichess.org/api/tournament/{tournament_id}/teams")
    try:
        if response.status_code == 404:
            return
        if response.status_code != 200:
            raise RuntimeError(f"teams status={response.status_code}")
        payload = response.json()
        teams = payload.get("teams", [])
        for index, team in enumerate(teams):
            team_id = team.get("id")
            if not team_id:
                continue
            try:
                score = float(team.get("score", 0) or 0)
            except (TypeError, ValueError):
                score = 0
            team_points[team_id] = team_points.get(team_id, 0) + score
            team_names.setdefault(team_id, team.get("name", team_id))
            team_records.setdefault(team_id, []).append({
                "id": tournament_id,
                "name": tournament.get("fullName"),
                "startsAt": tournament.get("startsAt"),
                "score": score,
                "rank": index + 1,
                "nbTeams": len(teams),
            })
    finally:
        response.close()


def main() -> int:
    if NUM_WORKERS < 1 or CHUNK_INDEX < 0 or CHUNK_INDEX >= NUM_WORKERS:
        raise ValueError("CHUNK_INDEX must be from 0 to NUM_WORKERS - 1")
    with open(TOURNAMENTS_FILE, encoding="utf-8") as handle:
        tournaments = json.load(handle)

    assigned = tournaments[CHUNK_INDEX::NUM_WORKERS]
    player_points, player_records = {}, {}
    team_points, team_names, team_records = {}, {}, {}
    errors = []

    print(f"[Worker {CHUNK_INDEX}] assigned {len(assigned)} of {len(tournaments)} tournaments", file=sys.stderr)
    for index, tournament in enumerate(assigned, 1):
        tournament_id = tournament["id"]
        try:
            fetch_results(tournament, player_points, player_records)
        except Exception as error:
            errors.append({"id": tournament_id, "name": tournament.get("fullName"), "stage": "results", "error": str(error)})
            print(f"Could not fetch individual results for {tournament_id}: {error}", file=sys.stderr)
        time.sleep(REQUEST_DELAY)

        try:
            fetch_teams(tournament, team_points, team_names, team_records)
        except Exception as error:
            errors.append({"id": tournament_id, "name": tournament.get("fullName"), "stage": "teams", "error": str(error)})
            print(f"Could not fetch team results for {tournament_id}: {error}", file=sys.stderr)
        time.sleep(REQUEST_DELAY)

        if index % 20 == 0 or index == len(assigned):
            print(f"[Worker {CHUNK_INDEX}] {index}/{len(assigned)} processed", file=sys.stderr)

    output = {
        "worker": CHUNK_INDEX,
        "tournament_records": [{
            "id": t.get("id"),
            "name": t.get("fullName") or t.get("name") or t.get("id"),
            "startsAt": t.get("startsAt"),
            "nbPlayers": t.get("nbPlayers"),
            "url": f"https://lichess.org/tournament/{t.get('id')}",
        } for t in assigned],
        "processed": len(assigned),
        "player_points": player_points,
        "player_records": player_records,
        "team_points": team_points,
        "team_names": team_names,
        "team_records": team_records,
        "errors": errors,
    }
    output_path = f"partial_{CHUNK_INDEX}.json"
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(output, handle, indent=2, ensure_ascii=False)
    print(
        f"[Worker {CHUNK_INDEX}] done: {len(assigned)} tournaments; "
        f"{len(player_points)} players; {len(team_points)} teams; {len(errors)} errors",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
