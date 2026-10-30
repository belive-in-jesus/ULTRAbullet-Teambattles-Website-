"""Unit tests for the leaderboard period aggregation."""
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
    def test_seasons_are_chronological_blocks_of_50_and_keep_special_events(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            artifacts = root / "artifacts"
            artifacts.mkdir()

            battles = []
            alice_records = []
            bob_records = []
            club_records = []
            start = datetime(2026, 1, 1, tzinfo=timezone.utc)

            for index in range(52):
                battle_id = f"event-{index:03d}"
                timestamp = int(start.timestamp() * 1000) + index * 24 * 60 * 60 * 1000
                title = (
                    "Winter Special Cup" if index == 5
                    else f"{index + 1}th ULTRAbullet Team Battle"
                )
                battles.append({
                    "id": battle_id,
                    "name": title,
                    "startsAt": timestamp,
                    "nbPlayers": 12,
                    "url": f"https://lichess.org/tournament/{battle_id}",
                })
                alice_records.append({
                    "id": battle_id,
                    "name": title,
                    "startsAt": timestamp,
                    "score": 10,
                    "rank": 1,
                    "nbPlayers": 12,
                })
                club_records.append({
                    "id": battle_id,
                    "name": title,
                    "startsAt": timestamp,
                    "score": 25,
                    "rank": 1,
                    "nbTeams": 3,
                })
                if index >= 50:
                    bob_records.append({
                        "id": battle_id,
                        "name": title,
                        "startsAt": timestamp,
                        "score": 7,
                        "rank": 2,
                        "nbPlayers": 12,
                    })

            worker = {
                "processed": 52,
                "tournament_records": battles,
                "player_points": {"alice": 520, "bob": 14},
                "player_records": {"alice": alice_records, "bob": bob_records},
                "team_points": {"club-id": 1300},
                "team_names": {"club-id": "Test Club"},
                "team_records": {"club-id": club_records},
                "errors": [],
            }
            (artifacts / "partial_0.json").write_text(
                json.dumps(worker), encoding="utf-8"
            )

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
            self.assertEqual(len(index["seasons"]), 2)

            season_1_index = next(item for item in index["seasons"] if item["key"] == "season-01")
            season_2_index = next(item for item in index["seasons"] if item["key"] == "season-02")
            self.assertEqual(season_1_index["battle_count"], 50)
            self.assertTrue(season_1_index["complete"])
            self.assertEqual((season_1_index["first_battle"], season_1_index["last_battle"]), (1, 50))
            self.assertEqual(season_2_index["battle_count"], 2)
            self.assertFalse(season_2_index["complete"])

            season_1 = json.loads(
                (data_dir / season_1_index["data_file"]).read_text(encoding="utf-8")
            )
            self.assertEqual(len(season_1["battle_ids"]), 50)
            self.assertIn("event-005", season_1["battle_ids"])
            self.assertEqual(season_1["label"], "Season 1 · Battles 1–50")
            self.assertEqual(season_1["players"][0]["username"], "alice")
            self.assertEqual(season_1["players"][0]["points"], 500)
            self.assertEqual(season_1["players"][0]["avg_points"], 10)
            self.assertTrue((data_dir / season_1["players"][0]["profile_file"]).exists())

            months = {item["key"]: item for item in index["months"]}
            self.assertEqual(set(months), {"2026-01", "2026-02"})
            self.assertEqual(months["2026-01"]["battle_count"], 31)
            self.assertEqual(months["2026-02"]["battle_count"], 21)

            meta = json.loads((data_dir / "meta.json").read_text(encoding="utf-8"))
            self.assertEqual(meta["season_count"], 2)
            self.assertEqual(meta["month_count"], 2)
            self.assertEqual(meta["tournaments_processed"], 52)

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
