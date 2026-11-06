from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urlsplit
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
PAGES = (
    "index.html",
    "rankings.html",
    "analytics.html",
    "records.html",
    "contributors.html",
    "hall-of-fame.html",
    "achievements.html",
    "information.html",
    "profile.html",
    "battle.html",
    "performance-index.html",
    "compare.html",
)


class PageAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stylesheets = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and "stylesheet" in attrs.get("rel", "").split():
            href = attrs.get("href", "")
            if href:
                self.stylesheets.append(href)
        elif tag == "script":
            src = attrs.get("src", "")
            if src:
                self.scripts.append(src)


def local_asset_path(page_name, reference):
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return None
    return (DOCS / page_name).parent.joinpath(parsed.path).resolve()


def css_delimiters_are_balanced(source):
    """Check CSS block and function delimiters while ignoring comments and strings."""
    stack = []
    pairs = {")": "(", "]": "["}
    index = 0
    quote = None
    while index < len(source):
        char = source[index]
        following = source[index + 1] if index + 1 < len(source) else ""

        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
            index += 1
            continue

        if char == "/" and following == "*":
            end = source.find("*/", index + 2)
            if end == -1:
                return False
            index = end + 2
            continue

        if char in ("'", '"'):
            quote = char
        elif char in "({[":
            stack.append(char)
        elif char == "}":
            if not stack or stack.pop() != "{":
                return False
        elif char in pairs:
            if not stack or stack.pop() != pairs[char]:
                return False
        index += 1

    return quote is None and not stack


class WebsiteAssetTests(unittest.TestCase):
    def test_every_public_page_loads_navigation_layer_after_v2_visual_system(self):
        for page_name in PAGES:
            with self.subTest(page=page_name):
                parser = PageAssets()
                parser.feed((DOCS / page_name).read_text(encoding="utf-8"))
                self.assertIn("css/v2-visual-system.css", parser.stylesheets)
                self.assertIn("css/navigation-hubs.css", parser.stylesheets)
                self.assertIn("css/arena-design-system.css", parser.stylesheets)
                self.assertLess(
                    parser.stylesheets.index("css/navigation-hubs.css"),
                    parser.stylesheets.index("css/arena-design-system.css"),
                    "The Arena visual layer must load after the shared navigation and hub layer.",
                )
                self.assertEqual(
                    parser.stylesheets[-1],
                    "css/arena-design-system.css",
                    "The shared Competitive Arena layer must load last on every public page.",
                )
                if page_name == "index.html":
                    self.assertIn("css/dashboard-analytics.css", parser.stylesheets)
                    self.assertLess(
                        parser.stylesheets.index("css/dashboard-analytics.css"),
                        parser.stylesheets.index("css/navigation-hubs.css"),
                    )
                if page_name == "profile.html":
                    self.assertIn("css/profile-analytics.css", parser.stylesheets)
                    self.assertLess(
                        parser.stylesheets.index("css/profile-analytics.css"),
                        parser.stylesheets.index("css/navigation-hubs.css"),
                    )

    def test_all_public_pages_share_the_same_primary_navigation(self):
        expected_links = (
            "./index.html",
            "./index.html#leaderboard",
            "./performance-index.html",
            "./analytics.html",
            "./compare.html",
            "./records.html",
            "./information.html",
        )
        for page_name in PAGES:
            with self.subTest(page=page_name):
                source = (DOCS / page_name).read_text(encoding="utf-8")
                nav_match = re.search(r"<nav\b[\s\S]*?</nav>", source)
                self.assertIsNotNone(nav_match, "Every public page must have the shared primary navigation.")
                nav = nav_match.group(0)
                for href in expected_links:
                    self.assertIn(f'href="{href}"', nav)
                self.assertEqual(
                    len(re.findall(r'class="nav-link active"', nav)),
                    1,
                    "Exactly one primary navigation item must be active.",
                )

    def test_local_stylesheets_and_scripts_exist(self):
        for page_name in PAGES:
            with self.subTest(page=page_name):
                parser = PageAssets()
                parser.feed((DOCS / page_name).read_text(encoding="utf-8"))
                for reference in parser.stylesheets + parser.scripts:
                    path = local_asset_path(page_name, reference)
                    if path is not None:
                        self.assertTrue(path.is_file(), f"{page_name} references missing asset {reference}")

    def test_v2_stylesheets_have_balanced_delimiters(self):
        for filename in ("v2-visual-system.css", "arena-design-system.css", "profile.css", "profile-analytics.css", "dashboard-analytics.css", "battle.css", "performance-index.css", "compare.css", "achievements.css"):
            with self.subTest(stylesheet=filename):
                source = (DOCS / "css" / filename).read_text(encoding="utf-8")
                self.assertTrue(
                    css_delimiters_are_balanced(source),
                    f"{filename} contains an unbalanced delimiter.",
                )

    def test_profile_analytics_module_loads_before_profile_controller(self):
        page = DOCS / "profile.html"
        parser = PageAssets()
        source = page.read_text(encoding="utf-8")
        parser.feed(source)
        self.assertIn("js/analytics.js", parser.scripts)
        self.assertIn("js/profile.js", parser.scripts)
        self.assertLess(
            parser.scripts.index("js/analytics.js"),
            parser.scripts.index("js/profile.js"),
        )
        for element_id in (
            "profile-initial",
            "trend-range",
            "trend-range-wrap",
            "chart-mode-score",
            "chart-mode-rank",
            "chart-legend-primary",
            "chart-legend-secondary",
            "analytics-recent-average",
            "analytics-recent-podium-rate",
            "analytics-latest-streak",
            "analytics-donut",
            "analytics-monthly-chart",
            "analytics-heatmap",
            "analytics-season-rows",
        ):
            self.assertIn(f'id="{element_id}"', source)



    def test_battle_report_page_has_required_navigation_and_result_controls(self):
        page = DOCS / "battle.html"
        parser = PageAssets()
        source = page.read_text(encoding="utf-8")
        parser.feed(source)
        self.assertIn("css/battle.css", parser.stylesheets)
        self.assertIn("js/battle.js", parser.scripts)
        self.assertLess(parser.stylesheets.index("css/battle.css"), parser.stylesheets.index("css/navigation-hubs.css"))
        for element_id in (
            "battle-title",
            "battle-status",
            "battle-summary",
            "battle-results-panel",
            "view-teams",
            "view-players",
            "result-search",
            "result-rows",
            "results-more",
        ):
            self.assertIn(f'id="{element_id}"', source)
        ids = re.findall(r'\bid="([^"]+)"', source)
        duplicates = sorted({element_id for element_id in ids if ids.count(element_id) > 1})
        self.assertEqual(duplicates, [], "Battle report page contains duplicate HTML IDs.")

    def test_dashboard_analytics_assets_and_dom_hooks_are_present(self):
        page = DOCS / "index.html"
        parser = PageAssets()
        source = page.read_text(encoding="utf-8")
        parser.feed(source)
        self.assertIn("css/dashboard-analytics.css", parser.stylesheets)
        self.assertIn("js/dashboard-analytics.js", parser.scripts)
        for element_id in (
            "global-analytics-updated",
            "global-avg-participants",
            "global-peak-participants",
            "global-month-label",
            "global-latest-active-players",
            "global-latest-active-teams",
            "global-battles-chart",
            "global-players-chart",
            "global-teams-chart",
            "global-seasons-chart",
            "global-top-teams",
            "global-top-players",
            "global-pi-teams",
            "global-pi-players",
            "global-records",
            "global-analytics-method",
        ):
            self.assertIn(f'id="{element_id}"', source)
        ids = re.findall(r'\bid="([^"]+)"', source)
        duplicates = sorted({element_id for element_id in ids if ids.count(element_id) > 1})
        self.assertEqual(duplicates, [], "Dashboard page contains duplicate HTML IDs.")


    def test_performance_index_page_has_pagination_and_all_local_assets(self):
        page = DOCS / "performance-index.html"
        parser = PageAssets()
        source = page.read_text(encoding="utf-8")
        parser.feed(source)
        self.assertIn("css/performance-index.css", parser.stylesheets)
        self.assertIn("js/performance-index.js", parser.scripts)
        for element_id in ("pi-count", "pi-search", "pi-rows", "pi-page-summary", "pi-page", "pi-prev", "pi-next"):
            self.assertIn(f'id="{element_id}"', source)
        ids = re.findall(r'\bid="([^"]+)"', source)
        duplicates = sorted({element_id for element_id in ids if ids.count(element_id) > 1})
        self.assertEqual(duplicates, [], "Performance Index page contains duplicate HTML IDs.")

    def test_head_to_head_page_loads_core_before_controller(self):
        page = DOCS / "compare.html"
        parser = PageAssets()
        source = page.read_text(encoding="utf-8")
        parser.feed(source)
        self.assertIn("css/compare.css", parser.stylesheets)
        self.assertIn("js/compare-core.js", parser.scripts)
        self.assertIn("js/compare.js", parser.scripts)
        self.assertLess(parser.scripts.index("js/compare-core.js"), parser.scripts.index("js/compare.js"))
        for element_id in ("compare-form", "compare-a", "compare-b", "compare-results", "compare-pi", "compare-pi-history", "pi-history-name-a", "pi-history-name-b", "shared-battles"):
            self.assertIn(f'id="{element_id}"', source)
        ids = re.findall(r'\bid="([^"]+)"', source)
        duplicates = sorted({element_id for element_id in ids if ids.count(element_id) > 1})
        self.assertEqual(duplicates, [], "Head-to-head page contains duplicate HTML IDs.")

    def test_global_dashboard_links_both_performance_index_leaderboards(self):
        source = (DOCS / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="global-pi-teams"', source)
        self.assertIn('id="global-pi-players"', source)
        self.assertIn('href="./performance-index.html"', source)

    def test_profile_exposes_performance_index_and_history_sections(self):
        source = (DOCS / "profile.html").read_text(encoding="utf-8")
        self.assertIn('id="profile-performance-index"', source)
        self.assertIn('id="profile-pi-card"', source)
        self.assertIn('href="./performance-index.html"', source)


    def test_published_dashboard_analytics_snapshots_are_consistent(self):
        data_dir = DOCS / "data"
        analytics_dir = data_dir / "analytics"
        overview = json.loads((analytics_dir / "overview.json").read_text(encoding="utf-8"))
        timeseries = json.loads((analytics_dir / "timeseries.json").read_text(encoding="utf-8"))
        meta = json.loads((data_dir / "meta.json").read_text(encoding="utf-8"))
        periods = json.loads((data_dir / "periods_index.json").read_text(encoding="utf-8"))

        self.assertEqual(overview["schema_version"], 1)
        self.assertEqual(timeseries["schema_version"], 1)
        self.assertEqual(overview["generated_at"], timeseries["generated_at"])
        self.assertEqual(overview["generated_at"], meta["generated_at"])

        # Published analytics must agree with the metadata produced in the same run.
        self.assertEqual(overview["totals"]["numbered_battles"], meta["tournaments_processed"])
        self.assertEqual(overview["totals"]["teams"], meta["teams_count"])
        self.assertEqual(overview["totals"]["players"], meta["players_count"])
        self.assertEqual(len(timeseries["months"]), meta["month_count"])
        self.assertEqual(len(timeseries["seasons"]), meta["season_count"])
        self.assertEqual(len(timeseries["months"]), len(periods["months"]))
        self.assertEqual(len(timeseries["seasons"]), len(periods["seasons"]))

        month_keys = [row["key"] for row in timeseries["months"]]
        self.assertEqual(month_keys, sorted(set(month_keys)))
        self.assertEqual(timeseries["months"][-1]["key"], overview["current_month"]["key"])
        self.assertEqual(timeseries["months"][-1]["active_players"], overview["current_month"]["active_players"])
        self.assertEqual(timeseries["months"][-1]["active_teams"], overview["current_month"]["active_teams"])

        self.assertEqual(timeseries["seasons"][-1]["season_number"], overview["current_season"]["season_number"])
        self.assertEqual(timeseries["seasons"][-1]["battle_count"], overview["current_season"]["battle_count"])
        self.assertEqual(overview["latest_battle"]["battle_number"], meta["max_battle_number"])

    def test_player_leaderboard_is_loaded_on_demand(self):
        source = (DOCS / "index.html").read_text(encoding="utf-8")
        init_start = source.index("async function init()")
        init_end = source.index('$("compare-search-a")', init_start)
        init_source = source[init_start:init_end]

        self.assertIn("async function ensurePlayersLoaded()", source)
        self.assertIn('load("./data/leaderboard_players.json")', source)
        self.assertNotIn('load("./data/leaderboard_players.json")', init_source)
        self.assertIn('$("players-btn").addEventListener("click",()=>setView("players"))', source)

    def test_homepage_flags_stale_published_data(self):
        source = (DOCS / "index.html").read_text(encoding="utf-8")
        self.assertIn("const DATA_STALE_AFTER_MS=36*60*60*1000;", source)
        self.assertIn("DATA STALE", source)
        self.assertIn('class="pill status-pill" id="status-pill" role="status" aria-live="polite"', source)

    def test_guide_documents_competitor_initial_marks(self):
        source = (DOCS / "information.html").read_text(encoding="utf-8")
        self.assertIn("first letter of each player or team name", source)
        self.assertIn("Lichess profile or team flair", source)

    def test_planned_special_events_remain_explicitly_disabled(self):
        source = (DOCS / "records.html").read_text(encoding="utf-8")
        self.assertIn("<h2>Special Events</h2>", source)
        self.assertIn("remains planned, not active", source)
        self.assertNotIn('href="./special-events.html"', source)


    def test_redesign_wireframes_have_clear_boundaries_and_mobile_accessibility(self):
        overview_path = DOCS / "redesign" / "overview.html"
        rankings_path = DOCS / "redesign" / "rankings.html"
        stylesheet_path = DOCS / "redesign" / "wireframes.css"
        controller_path = DOCS / "js" / "redesign-wireframes.js"

        overview = overview_path.read_text(encoding="utf-8")
        rankings = rankings_path.read_text(encoding="utf-8")
        stylesheet = stylesheet_path.read_text(encoding="utf-8")
        controller = controller_path.read_text(encoding="utf-8")

        self.assertIn("Open current website", overview)
        self.assertIn("Open current website", rankings)
        self.assertIn("2 November 2026 · 03:49 UTC", overview)
        self.assertIn("2 November 2026 · 03:49 UTC", rankings)
        self.assertIn('href="https://lichess.org/tournament/2vPEnd1i"', overview)

        regions = re.findall(r'<div class="table-scroll"([^>]*)>', rankings)
        self.assertEqual(len(regions), 5, "All five ranking tables must have their own scroll region.")
        labels = []
        for attributes in regions:
            self.assertIn('role="region"', attributes)
            self.assertIn('tabindex="0"', attributes)
            label = re.search(r'aria-label="([^"]+)"', attributes)
            self.assertIsNotNone(label, "Every scroll region must have an accessible name.")
            labels.append(label.group(1))
        self.assertEqual(len(labels), len(set(labels)), "Table scroll-region labels must be unique.")

        ids = re.findall(r'\\bid="([^"]+)"', rankings)
        self.assertEqual(len(ids), len(set(ids)), "Rankings preview contains duplicate HTML IDs.")
        self.assertIn('event.key === "ArrowRight"', controller)
        self.assertIn('event.key === "Home"', controller)
        self.assertIn('event.key === "End"', controller)
        self.assertIn("@media (max-width: 700px)", stylesheet)
        self.assertIn("@media (max-width: 400px)", stylesheet)
        self.assertIn(".table-scroll-hint", stylesheet)
        self.assertIn("position: sticky", stylesheet)
        self.assertTrue(
            css_delimiters_are_balanced(stylesheet),
            "The redesign wireframe stylesheet contains an unbalanced delimiter.",
        )


if __name__ == "__main__":
    unittest.main()
