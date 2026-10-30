# UltraBullet Team Battles — Leaderboard

A standalone website for the recurring UltraBullet team battles organised by **Nathanael01**. It combines finished Lichess tournaments into cumulative team and player leaderboards.

> **Credit:** The battle-result aggregation script is based on **DarkOnCrack's** project, [Gift For Nathanael](https://lichessbotacc.github.io/Gift-For-Nathanael/), and is used with permission. The site and presentation are a separate project from UBWC 2026.

## Features

- Combined team and individual points across matching finished UltraBullet tournaments
- Searchable team/player standings with all-time, monthly and 50-battle seasonal rankings, sort controls, pagination and CSV export
- Homepage dashboard with current-season progress, latest indexed battle and all-time leaders
- Detailed competitor profiles with cumulative performance metrics and lazily loaded battle history
- Searchable battle archive linking back to the original Lichess tournaments
- Information page explaining eligibility, ranking periods, points and data refreshes
- Daily automated refresh through GitHub Actions
- Public, static frontend; no Lichess token is exposed to website visitors

## Repository layout

- `docs/` — esports-style GitHub Pages dashboard (`index.html`), methodology page (`information.html`) and generated JSON data (`battle_history.json`, compact team/player leaderboard indexes, metadata and profile-history shards)
- `scripts/discover.py` — finds finished regular ULTRAbullet Team Battles with their official ordinal battle number
- `scripts/fetch_worker.py` — fetches each tournament's individual and team results
- `scripts/aggregate.py` — combines scores and calculates statistics
- `.github/workflows/leaderboard.yml` — daily and manual update workflow
- `.github/workflows/validate.yml` — pull-request checks and aggregation tests
- `scripts/tests/test_aggregate.py` — regression tests for official-number 50-battle seasons, missing numbers, special-event exclusion and monthly groupings

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
