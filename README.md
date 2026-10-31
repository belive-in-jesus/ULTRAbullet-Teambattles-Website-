# UltraBullet Team Battles — Leaderboard

A standalone website for the recurring UltraBullet team battles organised by **Nathanael01**. It combines finished Lichess tournaments into cumulative team and player leaderboards.

> **Credit:** The battle-result aggregation script is based on **DarkOnCrack's** project, [Gift For Nathanael](https://lichessbotacc.github.io/Gift-For-Nathanael/), and is used with permission. The site and presentation are a separate project from UBWC 2026.

## Features

- Combined team and individual points across matching finished UltraBullet tournaments
- Searchable team/player standings with all-time, monthly and 50-battle seasonal rankings, sort controls, pagination and CSV export
- Homepage dashboard with current-season progress, latest indexed battle, global monthly activity charts, active player/team trends, seasonal comparisons, all-time top-five rankings and career-record highlights
- Head-to-head team/player comparisons with six performance metrics
- Hall of Fame with season champions, podiums and automatically updated career records
- Global contributor leaderboard ranking players by listed career contribution points, battle appearances, teams represented and average contribution
- Dedicated shareable team and player profiles with score-trend charts, finish-distribution donuts, monthly point charts, 52-week activity heatmaps, season-by-season comparisons, period filters, paginated battle history, career achievement badges and historical team-contributor statistics
- Compact first-character profile lookup indexes to resolve direct profile URLs without downloading the full leaderboard
- Searchable battle archive linking back to the original Lichess tournaments
- Information page explaining eligibility, ranking periods, points and data refreshes
- V2 visual system with distinct dashboard, profile, Hall of Fame and editorial page layouts, responsive navigation and accessible interaction states
- Daily automated refresh through GitHub Actions
- Public, static frontend; no Lichess token is exposed to website visitors

## Repository layout

- `docs/` — GitHub Pages dashboard (`index.html`), Hall of Fame (`hall-of-fame.html`), achievements directory (`achievements.html`), global contributor leaderboard (`contributors.html`), methodology page (`information.html`), shareable analytics profiles (`profile.html`) and generated JSON data (including compact dashboard analytics under `data/analytics/`)
- `scripts/discover.py` — finds finished regular ULTRAbullet Team Battles with their official ordinal battle number
- `scripts/fetch_worker.py` — fetches each tournament's individual and team results
- `scripts/aggregate.py` — combines scores, calculates career and period statistics, and generates profile shards, the Hall of Fame, the global contributor leaderboard and compact dashboard analytics datasets
- `.github/workflows/leaderboard.yml` — daily and manual update workflow
- `.github/workflows/validate.yml` — pull-request checks and aggregation tests
- `scripts/tests/` — Python aggregation and dashboard-data tests plus Node.js regression tests for profile and dashboard analytics, chart rendering, DOM hooks and browser script syntax

## Publish the website

1. Open **Settings → Pages** in this repository.
2. Select **Deploy from a branch**.
3. Choose branch `main` and folder `/docs`, then save.
4. If this account uses GitHub Free, the repository must be **public** to use GitHub Pages. The published site is publicly accessible. See [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The expected project URL is:

`https://belive-in-jesus.github.io/ULTRAbullet-Teambattles-Website-/`

GitHub Pages can take a little while to publish after configuration. Check the Pages panel for the authoritative URL and deployment status.

## Configure data collection

The defaults are:
- Lichess tournament creator: `Nathanael01`
- Tournament name filter: `ultrabullet` (case-insensitive substring match)
- Finished tournaments only
- Scheduled refresh: daily at 03:00 UTC

You can run the workflow manually from **Actions → UltraBullet Team Battles Leaderboard → Run workflow** and override the Lichess username or the standard tournament-name substring.

An optional Lichess API token may be added as a repository Actions secret named `LICHESS_TOKEN`. It is not required for public tournaments. Never put a token in the website files or commit it to the repository.

## Notes

- Only finished regular battles with titles matching the numbered `1st ULTRAbullet Team Battle` pattern are included. Alliance, qualification, Christmas, Daily Arena, restarted and other unnumbered/special events are excluded from points, profiles, history and rankings.
- Seasonal rankings use fixed official battle-number ranges: Season 1 = Battles 1–50, Season 2 = Battles 51–100, and so on. Thus Battle 301 always starts Season 7, even if earlier records are missing. Missing numbers are shown as data gaps and do not shift later seasons.
- Monthly rankings use UTC calendar months and include only eligible regular numbered battles.
- Points are summed across the discovered tournaments, so the leaderboard is cumulative, not a single-day ranking.
- Generated result files are written into `docs/data/` and committed by the workflow.
- Competitor histories are stored in `docs/data/profiles/` in shards of 200 competitors and fetched only when a profile is opened. The next successful leaderboard workflow run regenerates the compact indexes and these shards.
- Period summaries are stored separately under `docs/data/periods/`; the frontend loads only the selected month or season.
- Global dashboard summaries are precomputed as `docs/data/analytics/overview.json` and `docs/data/analytics/timeseries.json`. Monthly active competitor counts are distinct teams or players with at least one recorded result during that UTC month; participant counts use the Lichess `nbPlayers` value and are not unique monthly users.
