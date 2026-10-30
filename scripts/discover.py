#!/usr/bin/env python3
"""Discover finished UltraBullet team battles by name filter or explicit tournament ID."""
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
EXTRA_NAME_FILTERS = [
    item.strip().lower()
    for item in os.environ.get("EXTRA_NAME_FILTERS", "").split(",")
    if item.strip()
]
INCLUDE_TOURNAMENT_IDS = [
    item.strip()
    for item in os.environ.get("INCLUDE_TOURNAMENT_IDS", "").split(",")
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


def fetch_explicit_tournament(tournament_id: str) -> dict:
    """Resolve an explicitly configured ID even when its title does not match a filter."""
    response = session.get(
        f"https://lichess.org/api/tournament/{quote(tournament_id, safe='')}",
        timeout=(15, 45),
    )
    response.raise_for_status()
    tournament = response.json()
    if not tournament.get("id"):
        raise ValueError(f"Tournament ID {tournament_id!r} returned no tournament record")
    if ONLY_FINISHED and tournament.get("status") != FINISHED_STATUS:
        raise ValueError(
            f"Explicit tournament {tournament_id!r} is not finished "
            f"(status={tournament.get('status')!r}); refusing to include it."
        )
    return normalize_tournament(tournament)


def main() -> int:
    if not USER:
        raise ValueError("LICHESS_USER must not be empty")
    if not NAME_FILTERS and not EXTRA_NAME_FILTERS and not INCLUDE_TOURNAMENT_IDS:
        raise ValueError("Configure at least one name filter or explicit tournament ID")

    url = f"https://lichess.org/api/user/{quote(USER, safe='')}/tournament/created"
    headers = {"Accept": "application/x-ndjson", "User-Agent": "UltraBulletTeamBattlesLeaderboard/1.0"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"

    all_filters = NAME_FILTERS + EXTRA_NAME_FILTERS
    print(
        f"Scanning tournaments created by {USER}; filters={all_filters}; "
        f"explicit_ids={len(INCLUDE_TOURNAMENT_IDS)}; max={NB}",
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
        if any(term in lowered for term in all_filters):
            record = normalize_tournament(tournament)
            matches[record["id"]] = record

    # Explicit IDs are deliberate inclusions and bypass title and creator-list filters.
    # The public tournament endpoint still verifies that each requested event exists
    # and is finished before it is allowed into the cumulative statistics.
    for tournament_id in INCLUDE_TOURNAMENT_IDS:
        if tournament_id not in matches:
            record = fetch_explicit_tournament(tournament_id)
            matches[record["id"]] = record

    selected = sorted(
        matches.values(),
        key=lambda row: (int(row.get("startsAt") or 0), row["id"]),
    )
    with open("tournaments.json", "w", encoding="utf-8") as handle:
        json.dump(selected, handle, indent=2, ensure_ascii=False)

    print(
        f"Scanned {scanned} tournaments; selected {len(selected)} finished matches "
        f"({len(NAME_FILTERS)} standard filters, {len(EXTRA_NAME_FILTERS)} extra filters, "
        f"{len(INCLUDE_TOURNAMENT_IDS)} explicit IDs).",
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
            "Check the Lichess username, filters and explicit tournament IDs. "
            "Stopping before aggregation so an existing leaderboard is not overwritten with empty data.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
