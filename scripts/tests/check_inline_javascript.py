#!/usr/bin/env python3
"""Syntax-check every inline JavaScript block in the public HTML pages."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
JAVASCRIPT_TYPES = {
    "",
    "text/javascript",
    "application/javascript",
    "module",
}


class InlineScriptCollector(HTMLParser):
    """Collect executable inline script bodies, excluding external and data blocks."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.scripts: list[tuple[str, str]] = []
        self._current_type: str | None = None
        self._current_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "script":
            return

        attributes = dict(attrs)
        script_type = (attributes.get("type") or "").split(";", 1)[0].strip().lower()
        has_external_source = bool(attributes.get("src"))

        if has_external_source or script_type not in JAVASCRIPT_TYPES:
            self._current_type = None
            self._current_parts = []
            return

        self._current_type = script_type or "text/javascript"
        self._current_parts = []

    def handle_data(self, data: str) -> None:
        if self._current_type is not None:
            self._current_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "script":
            return

        if self._current_type is not None:
            body = "".join(self._current_parts)
            if body.strip():
                self.scripts.append((self._current_type, body))

        self._current_type = None
        self._current_parts = []


def main() -> int:
    pages = sorted(DOCS.glob("*.html"))
    if not pages:
        print(f"No public HTML pages found in {DOCS}")
        return 1

    checked = 0
    failures: list[str] = []

    with tempfile.TemporaryDirectory(prefix="ubt-inline-js-") as temp_dir:
        temp_root = Path(temp_dir)

        for page in pages:
            collector = InlineScriptCollector()
            try:
                collector.feed(page.read_text(encoding="utf-8"))
                collector.close()
            except (OSError, ValueError) as error:
                failures.append(f"{page.relative_to(ROOT)}: HTML parsing failed: {error}")
                continue

            for index, (script_type, body) in enumerate(collector.scripts, start=1):
                extension = ".mjs" if script_type == "module" else ".js"
                check_file = temp_root / f"{page.stem}-{index}{extension}"
                check_file.write_text(body, encoding="utf-8")
                result = subprocess.run(
                    ["node", "--check", str(check_file)],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                checked += 1
                if result.returncode != 0:
                    detail = (result.stderr or result.stdout).strip()
                    failures.append(
                        f"{page.relative_to(ROOT)} inline script {index}:\n{detail}"
                    )

    if failures:
        print("Inline JavaScript syntax validation failed:")
        for failure in failures:
            print(f"\n{failure}")
        return 1

    print(f"Inline JavaScript syntax check passed ({checked} blocks across {len(pages)} pages).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
