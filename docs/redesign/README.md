# Redesign preview — UltraBullet Team Battles

The redesign is being developed as a visual and navigation layer for the standalone UltraBullet Team Battles leaderboard. It is not connected to UBWC 2026.

## Preview pages

- `overview.html` — focused overview with competition snapshot, current-season progress, latest battle, short leader previews and an official-community section
- `rankings.html` — one ranking workspace with Teams, Players, Contributors and Performance Index perspectives
- `wireframes.css` — responsive layout and the current arena-inspired visual theme
- `../js/redesign-wireframes.js` — preview-only tab switching

## Community information

The overview includes the current public invitation from the regular ULTRAbullet battle descriptions: the series is described as friendly and recurring, and welcomes all teams and anyone who enjoys ultrafast chess. Recent regular tournament listings show UltraBullet ¼+0, Rated Arena, 90 minutes and 20 leaders per team. These are presented as details from recent listings, not as permanent rules; each tournament page remains authoritative for its own event.

The official Lichess team and tournament archive are linked directly. The existing external website destination, `https://lichessbotacc.github.io/Gift-For-Nathanael/`, is retained and labelled as the currently linked website while the replacement project is being developed.

## Implementation boundary

- The redesign preview is separate from UBWC 2026.
- Existing production ranking, profile, analytics, contributor, archive and Performance Index functions remain untouched.
- The website's data pipeline, aggregation scripts, scheduled workflows, JSON datasets, IDs, query parameters and CSV/export logic are not changed.
- The production homepage receives only a new static community-information section and corresponding styles. Existing JavaScript and all current controls remain unchanged.
- The redesign pages are layout previews; their sample figures are illustrative and are not live data.

The next step is a visual review of the overview and ranking hierarchy before any further page-by-page migration.
