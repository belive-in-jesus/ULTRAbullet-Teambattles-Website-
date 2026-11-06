from html.parser import HTMLParser
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "redesign"


class VisualDirectionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.styles = []
        self.scripts = []
        self.ids = []
        self.tabs = []
        self.panels = []
        self.scroll_regions = []
        self.table_headers = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        element_id = attrs.get("id")
        if element_id:
            self.ids.append(element_id)
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.styles.append(attrs.get("href", ""))
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])
        if attrs.get("role") == "tab":
            self.tabs.append(attrs)
        if attrs.get("role") == "tabpanel":
            self.panels.append(attrs)
        if attrs.get("role") == "region" and attrs.get("aria-label"):
            self.scroll_regions.append(attrs)
        if tag == "th":
            self.table_headers.append(attrs)


def css_delimiters_are_balanced(source):
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


class VisualDirectionTests(unittest.TestCase):
    def test_preview_is_self_contained_and_does_not_load_production_css(self):
        html = (DOCS / "visual-direction.html").read_text(encoding="utf-8")
        parser = VisualDirectionParser()
        parser.feed(html)

        local_styles = [style for style in parser.styles if not style.startswith("http")]
        self.assertEqual(local_styles, ["./visual-direction.css"])
        self.assertEqual(parser.scripts, ["./visual-direction.js"])
        self.assertIn('href="../index.html"', html)
        self.assertIn("Visual direction study", html)
        self.assertIn("not the live website", html)

    def test_data_fixture_and_placeholders_are_explicit(self):
        html = (DOCS / "visual-direction.html").read_text(encoding="utf-8")
        self.assertIn("02 Nov 2026 · 03:49 UTC", html)
        self.assertIn("Stale data · refresh overdue", html)
        self.assertIn("640", html)
        self.assertIn("821", html)
        self.assertIn("13,372", html)
        self.assertIn("latest official number #644", html)
        self.assertIn("Total contribution points", html)
        self.assertIn("Not connected", html)
        self.assertIn("not fabricated", html)
        self.assertIn("Component values are placeholders", html)

    def test_ranking_tabs_and_tables_have_accessible_structure(self):
        html = (DOCS / "visual-direction.html").read_text(encoding="utf-8")
        parser = VisualDirectionParser()
        parser.feed(html)

        self.assertEqual(len(parser.tabs), 4)
        self.assertEqual(len(parser.panels), 4)
        self.assertEqual(len(parser.scroll_regions), 5)
        pi_regions = [region for region in parser.scroll_regions if region.get("data-pi-region")]
        self.assertEqual({region["data-pi-region"] for region in pi_regions}, {"teams", "players"})
        self.assertEqual(len(parser.table_headers), 35)
        self.assertTrue(all(header.get("scope") == "col" for header in parser.table_headers))
        self.assertTrue(all(region.get("tabindex") == "0" for region in parser.scroll_regions))
        self.assertEqual(len(parser.ids), len(set(parser.ids)), "Preview contains duplicate IDs.")

    def test_keyboard_and_responsive_rules_are_present(self):
        html = (DOCS / "visual-direction.html").read_text(encoding="utf-8")
        js = (DOCS / "visual-direction.js").read_text(encoding="utf-8")
        css = (DOCS / "visual-direction.css").read_text(encoding="utf-8")

        self.assertIn('event.key === "ArrowRight"', js)
        self.assertIn('event.key === "Home"', js)
        self.assertIn('event.key === "End"', js)
        self.assertIn('data-pi-type="teams"', html)
        self.assertIn('data-pi-type="players"', html)
        self.assertIn("@media (max-width: 720px)", css)
        self.assertIn("@media (max-width: 430px)", css)
        self.assertIn("position: sticky", css)
        self.assertIn("prefers-reduced-motion: reduce", css)
        self.assertTrue(css_delimiters_are_balanced(css))


if __name__ == "__main__":
    unittest.main()
