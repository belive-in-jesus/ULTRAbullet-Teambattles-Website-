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
                self.assertEqual(
                    parser.stylesheets[-1],
                    "css/navigation-hubs.css",
                    "The shared navigation and hub layout layer must load after each page's visual system.",
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
        for filename in ("v2-visual-system.css", "profile-analytics.css", "dashboard-analytics.css"):
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
            "trend-range",
            "analytics-recent-average",
            "analytics-recent-podium-rate",
            "analytics-latest-streak",
            "analytics-donut",
            "analytics-monthly-chart",
            "analytics-heatmap",
            "analytics-season-rows",
        ):
            self.assertIn(f'id="{element_id}"', source)


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
            "global-records",
            "global-analytics-method",
        ):
            self.assertIn(f'id="{element_id}"', source)
        ids = re.findall(r'\bid="([^"]+)"', source)
        duplicates = sorted({element_id for element_id in ids if ids.count(element_id) > 1})
        self.assertEqual(duplicates, [], "Dashboard page contains duplicate HTML IDs.")


    def test_published_dashboard_analytics_snapshots_are_consistent(self):
        analytics_dir = DOCS / "data" / "analytics"
        overview = json.loads((analytics_dir / "overview.json").read_text(encoding="utf-8"))
        timeseries = json.loads((analytics_dir / "timeseries.json").read_text(encoding="utf-8"))
        self.assertEqual(overview["schema_version"], 1)
        self.assertEqual(timeseries["schema_version"], 1)
        self.assertEqual(overview["generated_at"], timeseries["generated_at"])
        self.assertEqual(overview["totals"]["numbered_battles"], 639)
        self.assertEqual(overview["totals"]["teams"], 818)
        self.assertEqual(overview["totals"]["players"], 13366)
        self.assertEqual(len(timeseries["months"]), 24)
        self.assertEqual(len(timeseries["seasons"]), 13)
        self.assertEqual(timeseries["months"][0]["key"], "2024-11")
        self.assertEqual(timeseries["months"][-1]["key"], "2026-10")
        self.assertEqual(timeseries["months"][-1]["active_players"], 1116)
        self.assertEqual(timeseries["months"][-1]["active_teams"], 229)
        self.assertEqual(overview["current_month"]["key"], "2026-10")
        self.assertEqual(overview["current_season"]["season_number"], 13)
        self.assertTrue(overview["current_season"]["in_progress"])
        self.assertEqual(overview["latest_battle"]["battle_number"], 643)

    def test_planned_special_events_remain_explicitly_disabled(self):
        source = (DOCS / "records.html").read_text(encoding="utf-8")
        self.assertIn("<h2>Special Events</h2>", source)
        self.assertIn("remains planned, not active", source)
        self.assertNotIn('href="./special-events.html"', source)


if __name__ == "__main__":
    unittest.main()
