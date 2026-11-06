"""Regression tests for the incremental per-battle cache pipeline."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


updater = load_module("update_battle_cache_under_test", "update_battle_cache.py")
converter = load_module("cache_to_partials_under_test", "cache_to_partials.py")
aggregate = load_module("aggregate_incremental_cache_under_test", "aggregate.py")


class IncrementalBattleCacheTests(unittest.TestCase):
    def test_team_payload_preserves_member_scores_and_team_identity(self):
        teams, members = updater.parse_team_results({
            "teams": [{
                "id": "club-a",
                "name": "Club A",
                "score": 125,
                "players": [
                    {"user": {"id": "alice", "name": "Alice"}, "score": 40},
                    {"user": {"id": "bob", "name": "Bob"}, "score": 25},
                ],
            }]
        })

        self.assertEqual(teams, [{
            "id": "club-a", "name": "Club A", "score": 125.0, "rank": 1,
        }])
        self.assertEqual(len(members), 2)
        self.assertEqual(members[0], {
            "team_id": "club-a",
            "team_name": "Club A",
            "player_id": "alice",
            "player_name": "Alice",
            "score": 40.0,
            "team_rank": 1,
        })

    def test_cache_converter_builds_all_aggregate_record_types(self):
        cache = {
            "schema_version": 2,
            "team_members_fetched": True,
            "battle": {
                "id": "battle-1",
                "name": "1st ULTRAbullet Team Battle",
                "battle_number": 1,
                "startsAt": 1000,
                "nbPlayers": 12,
                "url": "https://lichess.org/tournament/battle-1",
            },
            "teams": [{
                "id": "club-a", "name": "Club A", "score": 90, "rank": 1,
            }],
            "players": [{
                "id": "Alice", "name": "Alice", "score": 45, "rank": 1,
            }],
            "team_members": [{
                "team_id": "club-a",
                "team_name": "Club A",
                "player_id": "alice",
                "player_name": "Alice",
                "score": 45,
                "team_rank": 1,
            }],
        }

        partial = converter.build_partial([cache])

        self.assertEqual(partial["processed"], 1)
        self.assertEqual(partial["player_points"], {"Alice": 45.0})
        self.assertEqual(partial["team_points"], {"club-a": 90.0})
        self.assertEqual(partial["player_records"]["Alice"][0]["nbPlayers"], 12)
        self.assertEqual(partial["team_records"]["club-a"][0]["nbTeams"], 1)
        self.assertEqual(partial["team_member_records"]["club-a"][0]["player_id"], "alice")
        self.assertEqual(partial["tournament_records"][0]["id"], "battle-1")

    def test_converter_fails_closed_when_member_backfill_is_incomplete(self):
        cache = {
            "schema_version": 1,
            "team_members_fetched": False,
            "battle": {
                "id": "battle-1",
                "name": "1st ULTRAbullet Team Battle",
                "battle_number": 1,
            },
            "teams": [],
            "players": [],
        }
        with self.assertRaisesRegex(RuntimeError, "team-member snapshot"):
            converter.build_partial([cache])

    def test_converter_rejects_duplicate_battle_ids(self):
        base = {
            "schema_version": 2,
            "team_members_fetched": True,
            "battle": {
                "id": "battle-1",
                "name": "1st ULTRAbullet Team Battle",
                "battle_number": 1,
            },
            "teams": [],
            "players": [],
            "team_members": [],
        }
        with self.assertRaisesRegex(ValueError, "Duplicate battle ID"):
            converter.build_partial([base, base])

    def test_aggregate_writes_member_snapshots_for_future_incremental_runs(self):
        with __import__("tempfile").TemporaryDirectory() as temporary:
            aggregate.write_battle_reports(
                temporary,
                [{
                    "id": "battle-1",
                    "name": "1st ULTRAbullet Team Battle",
                    "battle_number": 1,
                    "startsAt": 1000,
                    "nbPlayers": 12,
                }],
                {"club-a": [{
                    "id": "battle-1", "score": 90, "rank": 1, "nbTeams": 1,
                }]},
                {"club-a": "Club A"},
                {"Alice": [{
                    "id": "battle-1", "score": 45, "rank": 1, "nbPlayers": 12,
                }]},
                {"club-a": [{
                    "id": "battle-1",
                    "player_id": "Alice",
                    "player_name": "Alice",
                    "team_name": "Club A",
                    "score": 45,
                    "team_rank": 1,
                }]},
            )
            report_path = Path(temporary) / "battles" / "battle-1.json"
            report = __import__("json").loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(report["schema_version"], 2)
            self.assertTrue(report["team_members_fetched"])
            self.assertEqual(report["team_members"][0]["player_id"], "Alice")

            partial = converter.build_partial([report])
            self.assertEqual(partial["team_member_records"]["club-a"][0]["player_id"], "Alice")


    def test_non_numbered_special_events_are_ignored(self):
        cache = {
            "schema_version": 2,
            "team_members_fetched": True,
            "battle": {
                "id": "special-1",
                "name": "Special UltraBullet Championship",
            },
            "teams": [],
            "players": [],
            "team_members": [],
        }
        with self.assertRaisesRegex(RuntimeError, "No valid numbered battle"):
            converter.build_partial([cache])


if __name__ == "__main__":
    unittest.main()
