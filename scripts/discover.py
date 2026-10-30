#!/usr/bin/env python3
"""Discover finished, regular numbered ULTRAbullet Team Battles only."""
import json
import os
import re
import sys
from urllib.parse import quote

import requests

USER = os.environ.get("LICHESS_USER", "Nathanael01").strip()
TOKEN = os.environ.get("LICHESS_TOKEN", "").strip()
NB = max(1, min(int(os.environ.get("DISCOVER_NB", "6000")), 10000))
REGULAR_BATTLE_PATTERN = re.compile(
    r"^\s*\d+(?:st|nd|rd|th)\s+ultrabullet\s+(?:team\s+battle|teambattle\s+team\s+battle)\s*$",
    re.IGNORECASE,
)
NAME_FILTERS = [
    item.strip().lower()
    for item in os.environ.get("NAME_FILTERS", "ultrabullet").split(",")
    if item.strip()
]
ONLY_FINISHED = os.environ.get("ONLY_FINISHED", "1") == "1"
FINISHED_STATUS = 30

session = requests.Session()
session.headers.update({
    "Accept": "application/json",
    "User-Agent": "UltraBulletTeamBattlesLeaderboard/1.0",
})
if TOKEN:
    session.headers["Authorization"] = f"Bearer {TOKEN}"


def normalize_tournament(tournament: dict) -> dict:
    tournament_id = tournament.get("id")
    return {
        "id": str(tournament_id),
        "fullName": tournament.get("fullName") or tournament.get("name") or str(tournament_id),
        "startsAt": tournament.get("startsAt"),
        "status": tournament.get("status"),
        "nbPlayers": tournament.get("nbPlayers"),
    }


def main() -> int:
    if not USER:
        raise ValueError("LICHESS_USER must not be empty")
    if not NAME_FILTERS:
        raise ValueError("Configure at least one name filter")

    url = f"https://lichess.org/api/user/{quote(USER, safe='')}/tournament/created"
    headers = {"Accept": "application/x-ndjson", "User-Agent": "UltraBulletTeamBattlesLeaderboard/1.0"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"

    print(
        f"Scanning regular numbered battles created by {USER}; filters={NAME_FILTERS}; max={NB}",
        file=sys.stderr,
    )
    response = session.get(url, headers=headers, params={"nb": NB}, stream=True, timeout=(15, 180))
    response.raise_for_status()

    matches = {}
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
        tournament_id = tournament.get("id")
        if not tournament_id:
            continue
        if ONLY_FINISHED and tournament.get("status") != FINISHED_STATUS:
            continue
        if not any(term in lowered for term in NAME_FILTERS):
            continue
        if not REGULAR_BATTLE_PATTERN.fullmatch(name):
            continue
        record = normalize_tournament(tournament)
        matches[record["id"]] = record

    selected = sorted(
        matches.values(),
        key=lambda row: (int(row.get("startsAt") or 0), row["id"]),
    )
    with open("tournaments.json", "w", encoding="utf-8") as handle:
        json.dump(selected, handle, indent=2, ensure_ascii=False)

    print(
        f"Scanned {scanned} tournaments; selected {len(selected)} finished matches "
        f"using {len(NAME_FILTERS)} name filter(s); only numbered regular events are eligible.",
        file=sys.stderr,
    )
    if scanned >= NB:
        print(
            f"WARNING: the scan reached DISCOVER_NB={NB}; older tournaments may be omitted. "
            "Increase DISCOVER_NB or add a specific tournament ID if needed.",
            file=sys.stderr,
        )
    if not selected:
        print(
            "ERROR: no completed tournaments matched the current configuration. "
            "Check the Lichess username, name filters and regular numbered battle titles. "
            "Stopping before aggregation so an existing leaderboard is not overwritten with empty data.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
