# Overview implementation — Direction C

**Status:** functional preview on the `redesign/overview-direction-c` branch. Not published to GitHub Pages and not connected to the production homepage.

## Direction C visual language

The Overview combines the clear, light editorial workspace explored in the previous design study with selected Competitive Arena cues:

- Warm neutral page canvas, white data surfaces, restrained borders and editorial serif section headings.
- Deep navy competitive hero and latest-battle feature card.
- Cyan and violet gradients for the competitive identity and data visualisation; pine green for navigation and primary actions; muted gold for archive and rank accents.
- Monospaced, tabular figures for statistics.
- Responsive composition for desktop, tablet, mobile and narrow phones.

## Live-linked data

The page reads the existing published static datasets:

- `../data/analytics/overview.json`
- `../data/analytics/timeseries.json`

It does not duplicate, re-aggregate or alter any ranking data. The page renders archive totals, current-season progress, the latest indexed battle, the latest recorded UTC month, the latest 12 monthly battle counts and the top-five all-time team/player lists.

The data-freshness state is calculated in the browser against the source `generated_at` timestamp. The existing 36-hour threshold is retained. Invalid and future timestamps are shown as unverified rather than being treated as fresh.

## Functional behaviour

- Dynamic overview data loading with explicit failure states.
- Fresh/stale snapshot state and displayed publication timestamp.
- Current-season progress derived from `battle_count / expected_battles`.
- Latest battle report and original Lichess tournament links.
- Accessible SVG chart for the latest 12 published months.
- Top-five team and player profile links using the existing profile routes.
- Responsive layout, skip link, labelled navigation, progress semantics, chart description and visible keyboard focus.
- No third-party chart dependency and no hard-coded sample ranking values.

## Validation

`scripts/tests/test_overview_redesign.js` covers the 36-hour freshness boundary, future and invalid timestamps, season progress bounds, chart window length and output escaping. The repository validation workflow checks the new browser script and runs the new Node test alongside the existing regression suite.

## Scope boundary

Only preview assets, tests and CI validation are added/updated. The production homepage, production CSS/JavaScript, ranking calculations, generated datasets and refresh workflow are not changed.
