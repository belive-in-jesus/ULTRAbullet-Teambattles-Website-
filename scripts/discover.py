#!/usr/bin/env python3
"""Discover finished UltraBullet tournaments created by a Lichess account.

Adapted for this repository from the result-processing project by DarkOnCrack.
Credit: https://lichessbotacc.github.io/Gift-For-Nathanael/
"""
import json
import os
import sys
from urllib.parse import quote

import requests

USER = os.environ.get("LICHESS_USER", "Nathanael01").strip()
TOKEN = os.environ.get("LICHESS_TOKEN", "").strip()
NB = max(1, min(int(os.environ.get("DISCOVER_NB", "6000")), 10000))
NAME_FILTERS = [
    item.strip().lower()
    for item in os.environ.get("NAME_FILTERS", "ultrabullet").split(",")
    if item.strip()
]
ONLY_FINISHED = os.environ.get("ONLY_FINISHED", "1") == "1"
FINISHED_STATUS = 30


def main() -> int:
    if not USER:
        raise ValueError("LICHESS_USER must not be empty")
    if not NAME_FILTERS:
        raise ValueError("NAME_FILTERS must contain at least one substring")

    url = f"https://lichess.org/api/user/{quote(USER, safe='')}/tournament/created"
    headers = {"Accept": "application/x-ndjson", "User-Agent": "UltraBulletTeamBattlesLeaderboard/1.0"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"

    print(f"Scanning tournaments created by {USER}; filters={NAME_FILTERS}; max={NB}", file=sys.stderr)
    response = requests.get(url, headers=headers, params={"nb": NB}, stream=True, timeout=(15, 180))
    response.raise_for_status()

    matches = []
    scanned = 0
    for raw_line in response.iter_lines(decode_unicode=True):
        if not raw_line:
            continue
        scanned += 1
        try:
            tournament = json.loads(raw_line)
        except json.JSONDecodeError:
            print(f"Skipping malformed record #{scanned}", file=sys.stderr)
            continue

        name = tournament.get("fullName") or tournament.get("name") or ""
        lowered = name.lower()
        if not any(term in lowered for term in NAME_FILTERS):
            continue
        if ONLY_FINISHED and tournament.get("status") != FINISHED_STATUS:
            continue
        tournament_id = tournament.get("id")
        if not tournament_id:
            continue

        matches.append({
            "id": tournament_id,
            "fullName": name,
            "startsAt": tournament.get("startsAt"),
            "status": tournament.get("status"),
            "nbPlayers": tournament.get("nbPlayers"),
        })

    with open("tournaments.json", "w", encoding="utf-8") as handle:
        json.dump(matches, handle, indent=2, ensure_ascii=False)

    print(f"Scanned {scanned} tournaments; selected {len(matches)} completed matches.", file=sys.stderr)
    if scanned >= NB:
        print(
            f"WARNING: the scan reached DISCOVER_NB={NB}; older tournaments may be omitted. "
            "Increase DISCOVER_NB and run the workflow again if needed.",
            file=sys.stderr,
        )
    if not matches:
        print(
            "ERROR: no completed tournaments matched the current filter. "
            "Check the Lichess username and NAME_FILTERS input. "
            "Stopping before aggregation so an existing leaderboard is not overwritten with empty data.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
