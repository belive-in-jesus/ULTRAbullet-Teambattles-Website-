from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
PAGES = (
    "index.html",
    "hall-of-fame.html",
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
    def test_every_public_page_loads_v2_visual_system_last(self):
        for page_name in PAGES:
            with self.subTest(page=page_name):
                page = DOCS / page_name
                parser = PageAssets()
                parser.feed(page.read_text(encoding="utf-8"))
                self.assertTrue(parser.stylesheets, "No stylesheet references were found.")
                self.assertEqual(
                    parser.stylesheets[-1],
                    "css/v2-visual-system.css",
                    "The V2 stylesheet must load after all page-specific styles.",
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

    def test_v2_stylesheet_delimiters_are_balanced(self):
        stylesheet = DOCS / "css" / "v2-visual-system.css"
        source = stylesheet.read_text(encoding="utf-8")
        self.assertTrue(css_delimiters_are_balanced(source), "V2 stylesheet contains an unbalanced delimiter.")

    def test_planned_special_events_remain_explicitly_disabled(self):
        for page_name in PAGES:
            with self.subTest(page=page_name):
                source = (DOCS / page_name).read_text(encoding="utf-8")
                self.assertRegex(source, r'class="nav-link upcoming"[^>]*aria-disabled="true"')


if __name__ == "__main__":
    unittest.main()
