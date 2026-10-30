# UltraBullet Team Battles — Leaderboard

A standalone website for the recurring UltraBullet team battles organised by **Nathanael01**. It combines finished Lichess tournaments into cumulative team and player leaderboards.

> **Credit:** The battle-result aggregation script is based on **DarkOnCrack's** project, [Gift For Nathanael](https://lichessbotacc.github.io/Gift-For-Nathanael/), and is used with permission. The site and presentation are a separate project from UBWC 2026.

## Features

- Combined team and individual points across matching finished UltraBullet tournaments
- Searchable team/player standings with all-time, monthly and 50-battle seasonal rankings, sort controls and CSV export
- Detailed competitor profiles with cumulative performance metrics and lazily loaded battle history
- Searchable battle archive linking back to the original Lichess tournaments
- Daily automated refresh through GitHub Actions
- Public, static frontend; no Lichess token is exposed to website visitors

## Repository layout

- `docs/` — esports-style GitHub Pages dashboard and generated JSON data (`battle_history.json`, compact team/player leaderboard indexes, metadata and profile-history shards)
- `scripts/discover.py` — finds matching finished tournaments by standard filters, additional special-event filters or explicitly supplied Lichess tournament IDs
- `scripts/fetch_worker.py` — fetches each tournament's individual and team results
- `scripts/aggregate.py` — combines scores and calculates statistics
- `.github/workflows/leaderboard.yml` — daily and manual update workflow
- `.github/workflows/validate.yml` — pull-request checks and aggregation tests
- `scripts/tests/test_aggregate.py` — regression tests for chronological 50-battle seasons and monthly groupings

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
- Optional additional name filters: `EXTRA_NAME_FILTERS` (comma-separated)
- Optional exact Lichess event IDs: `INCLUDE_TOURNAMENT_IDS` (comma-separated; supports special events with unrelated titles or other organizers)
- Scheduled refresh: daily at 03:00 UTC

You can run the workflow manually from **Actions → UltraBullet Team Battles Leaderboard → Run workflow**. Besides the standard username and name-filter inputs, the form now has `extra_name_filters` and `include_tournament_ids` for special events. For automatic runs, the corresponding repository variables are `EXTRA_NAME_FILTERS` and `INCLUDE_TOURNAMENT_IDS`.

An optional Lichess API token may be added as a repository Actions secret named `LICHESS_TOKEN`. It is not required for public tournaments. Never put a token in the website files or commit it to the repository.

## Notes

- Standard and additional name-filter matches are discovered from tournaments created by the configured account. Exact IDs in `INCLUDE_TOURNAMENT_IDS` are explicit exceptions and are checked through the public Lichess tournament API, even when their title differs or another organizer created them.
- Seasonal rankings group each consecutive 50 included finished tournaments in chronological order (UTC start time). Season labels show their inclusive battle-number range; the latest incomplete season is marked as in progress. Event titles do not determine season membership.
- Monthly rankings use UTC calendar months. Both period rankings include only results recorded for the selected events.
- Points are summed across the discovered tournaments, so the leaderboard is cumulative, not a single-day ranking.
- When changing the filter, use a distinctive tournament-name substring to avoid accidentally including unrelated events.
- Generated result files are written into `docs/data/` and committed by the workflow.
- Competitor histories are stored in `docs/data/profiles/` in shards of 200 competitors and fetched only when a profile is opened. The next successful leaderboard workflow run regenerates the compact indexes and these shards.
- Period summaries are stored separately under `docs/data/periods/`; the frontend loads only the selected month or season.
