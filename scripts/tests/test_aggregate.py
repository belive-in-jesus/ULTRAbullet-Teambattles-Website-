"""Regression tests for numbered-battle filtering and ranking periods."""
import importlib.util
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "aggregate.py"
SPEC = importlib.util.spec_from_file_location("aggregate_under_test", SCRIPT)
aggregate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(aggregate)


class AggregatePeriodTests(unittest.TestCase):
    def test_only_regular_numbered_battles_are_counted_and_seasons_use_official_numbers(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            artifacts = root / "artifacts"
            artifacts.mkdir()

            regular_numbers = [249, 250] + list(range(251, 276)) + list(range(277, 302))
            battles, alice_records, bob_records, club_records = [], [], [], []
            start = datetime(2026, 1, 1, tzinfo=timezone.utc)

            for index, number in enumerate(regular_numbers):
                battle_id = f"regular-{number}"
                timestamp = int(start.timestamp() * 1000) + index * 24 * 60 * 60 * 1000
                suffix = "st" if number % 10 == 1 and number % 100 != 11 else (
                    "nd" if number % 10 == 2 and number % 100 != 12 else (
                        "rd" if number % 10 == 3 and number % 100 != 13 else "th"
                    )
                )
                title = f"{number}{suffix} ULTRAbullet Team Battle"
                battles.append({
                    "id": battle_id, "name": title, "startsAt": timestamp,
                    "nbPlayers": 12, "url": f"https://lichess.org/tournament/{battle_id}",
                })
                alice_records.append({
                    "id": battle_id, "name": title, "startsAt": timestamp,
                    "score": 10, "rank": 1, "nbPlayers": 12,
                })
                club_records.append({
                    "id": battle_id, "name": title, "startsAt": timestamp,
                    "score": 25, "rank": 1, "nbTeams": 3,
                })
                if number == 301:
                    bob_records.append({
                        "id": battle_id, "name": title, "startsAt": timestamp,
                        "score": 7, "rank": 2, "nbPlayers": 12,
                    })

            # Insert a special event chronologically between regular battles.
            # Its large score must never affect totals, monthly rankings or seasons.
            special_timestamp = int(start.timestamp() * 1000) + 7 * 24 * 60 * 60 * 1000 + 1
            special = {
                "id": "special-alliance",
                "name": "8. ULTRAbullet Alliance League Team Battle",
                "startsAt": special_timestamp,
                "nbPlayers": 100,
                "url": "https://lichess.org/tournament/special-alliance",
            }
            battles.append(special)
            alice_records.append({
                "id": "special-alliance", "name": special["name"],
                "startsAt": special_timestamp, "score": 10000, "rank": 1,
            })
            club_records.append({
                "id": "special-alliance", "name": special["name"],
                "startsAt": special_timestamp, "score": 25000, "rank": 1,
            })

            worker = {
                "processed": len(battles),
                "tournament_records": battles,
                "player_points": {"alice": 10520, "bob": 7},
                "player_records": {"alice": alice_records, "bob": bob_records},
                "team_points": {"club-id": 26300},
                "team_names": {"club-id": "Test Club"},
                "team_records": {"club-id": club_records},
                "errors": [],
            }
            (artifacts / "partial_0.json").write_text(json.dumps(worker), encoding="utf-8")

            old_cwd = os.getcwd()
            try:
                os.chdir(root)
                with (
                    patch.object(aggregate, "PARTIALS_DIR", "artifacts"),
                    patch.object(aggregate, "OUTPUT_DIR", "docs/data"),
                    patch.object(aggregate, "SEASON_SIZE", 50),
                ):
                    self.assertEqual(aggregate.main(), 0)
            finally:
                os.chdir(old_cwd)

            data_dir = root / "docs" / "data"
            index = json.loads((data_dir / "periods_index.json").read_text(encoding="utf-8"))
            self.assertEqual(index["season_size"], 50)
            self.assertEqual(index["numbered_battles_count"], 52)
            self.assertEqual(index["max_battle_number"], 301)

            seasons = {item["key"]: item for item in index["seasons"]}
            self.assertEqual(len(seasons), 7)
            self.assertEqual(seasons["season-01"]["battle_count"], 0)
            self.assertEqual(len(seasons["season-01"]["missing_battle_numbers"]), 50)
            self.assertEqual(
                (seasons["season-06"]["first_battle"], seasons["season-06"]["last_battle"]),
                (251, 300),
            )
            self.assertEqual(seasons["season-06"]["battle_count"], 49)
            self.assertTrue(seasons["season-06"]["complete"])
            self.assertEqual(seasons["season-06"]["missing_battle_numbers"], [276])
            self.assertEqual(
                (seasons["season-07"]["first_battle"], seasons["season-07"]["last_battle"]),
                (301, 350),
            )
            self.assertEqual(seasons["season-07"]["battle_count"], 1)
            self.assertFalse(seasons["season-07"]["complete"])
            self.assertTrue(seasons["season-07"]["in_progress"])

            season_6 = json.loads((data_dir / seasons["season-06"]["data_file"]).read_text(encoding="utf-8"))
            self.assertEqual(len(season_6["battle_ids"]), 49)
            self.assertNotIn("special-alliance", season_6["battle_ids"])
            self.assertNotIn("regular-276", season_6["battle_ids"])

            self.assertEqual(len(json.loads((data_dir / "battle_history.json").read_text(encoding="utf-8"))), 52)
            self.assertNotIn(
                "special-alliance",
                {row["id"] for row in json.loads((data_dir / "battle_history.json").read_text(encoding="utf-8"))},
            )

            players = json.loads((data_dir / "leaderboard_players.json").read_text(encoding="utf-8"))
            self.assertEqual(players[0]["username"], "alice")
            self.assertEqual(players[0]["points"], 520)
            self.assertEqual(players[0]["tournaments_played"], 52)
            self.assertEqual(players[0]["avg_points"], 10)

            months = {item["key"]: item for item in index["months"]}
            self.assertEqual(set(months), {"2026-01", "2026-02"})
            self.assertEqual(months["2026-01"]["battle_count"], 31)
            self.assertEqual(months["2026-02"]["battle_count"], 21)

            hall = json.loads((data_dir / "hall_of_fame.json").read_text(encoding="utf-8"))
            self.assertEqual(hall["totals"]["numbered_battles"], 52)
            self.assertEqual(hall["totals"]["teams"], 1)
            self.assertEqual(hall["totals"]["players"], 2)
            self.assertEqual(hall["totals"]["completed_seasons"], 6)
            hall_seasons = {item["key"]: item for item in hall["seasons"]}
            self.assertEqual(hall_seasons["season-06"]["team_champion"]["name"], "Test Club")
            self.assertEqual(hall_seasons["season-06"]["battle_count"], 49)
            self.assertEqual(hall_seasons["season-06"]["missing_battle_numbers"], [276])
            self.assertIsNone(hall_seasons["season-07"]["team_champion"])
            self.assertEqual(hall_seasons["season-07"]["status"], "in_progress")
            self.assertEqual(hall_seasons["season-07"]["team_podium"][0]["name"], "Test Club")
            team_records = {item["key"]: item for item in hall["records"]["teams"]}
            self.assertEqual(team_records["most_points"]["holder"], "Test Club")
            self.assertEqual(team_records["highest_average"]["battles_required"], 25)

            meta = json.loads((data_dir / "meta.json").read_text(encoding="utf-8"))
            self.assertEqual(meta["hall_of_fame_seasons"], 7)
            self.assertEqual(meta["tournaments_processed"], 52)
            self.assertEqual(meta["excluded_events_count"], 1)
            self.assertEqual(meta["selection_rule"], "Numbered regular ULTRAbullet Team Battles only; special and unnumbered events excluded.")

    def test_number_parser_excludes_non_regular_titles(self):
        self.assertEqual(aggregate.parse_battle_number("300th ULTRAbullet Team Battle"), 300)
        self.assertEqual(aggregate.parse_battle_number("108th ULTRAbullet teambattle Team Battle"), 108)
        for title in (
            "8. ULTRAbullet Alliance League Team Battle",
            "1st ULTRAbullet Qualification Team Battle",
            "restarted 97th ULTRAbullet Team Battle",
            "Which is the best ULTRAbullet Team Battle",
            "Christmas ULTRAbullet Team Battle",
            "Daily UltraBullet Arena",
        ):
            self.assertIsNone(aggregate.parse_battle_number(title), title)

    def test_season_number_does_not_shift_when_battle_numbers_are_missing(self):
        self.assertEqual(aggregate.season_number_for_battle(1), 1)
        self.assertEqual(aggregate.season_number_for_battle(50), 1)
        self.assertEqual(aggregate.season_number_for_battle(51), 2)
        self.assertEqual(aggregate.season_number_for_battle(300), 6)
        self.assertEqual(aggregate.season_number_for_battle(301), 7)
        self.assertEqual(aggregate.season_number_for_battle(642), 13)

    def test_compute_stats_uses_only_the_supplied_period_records(self):
        stats = aggregate.compute_stats([
            {"startsAt": 2000, "score": 10, "rank": 2},
            {"startsAt": 1000, "score": 20, "rank": 1},
        ])
        self.assertEqual(stats["tournaments_played"], 2)
        self.assertEqual(stats["avg_points"], 15)
        self.assertEqual(stats["podiums"], 2)
        self.assertEqual(stats["active_since"], 1000)
        self.assertEqual(stats["last_played"], 2000)


if __name__ == "__main__":
    unittest.main()
