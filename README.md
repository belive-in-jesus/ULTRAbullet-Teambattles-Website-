# UltraBullet Team Battles — Leaderboard

A standalone website for the recurring UltraBullet team battles organised by **Nathanael01**. It combines finished Lichess tournaments into cumulative team and player leaderboards.

> **Credit:** The battle-result aggregation script is based on **DarkOnCrack's** project, [Gift For Nathanael](https://lichessbotacc.github.io/Gift-For-Nathanael/), and is used with permission. The site and presentation are a separate project from UBWC 2026.

## Features

- Combined team and individual points across matching finished UltraBullet tournaments
- Searchable team/player standings and per-entry statistics
- Daily automated refresh through GitHub Actions
- Public, static frontend; no Lichess token is exposed to website visitors

## Repository layout

- `docs/` — GitHub Pages website and generated JSON data
- `scripts/discover.py` — finds matching finished tournaments created by the configured Lichess account
- `scripts/fetch_worker.py` — fetches each tournament's individual and team results
- `scripts/aggregate.py` — combines scores and calculates statistics
- `.github/workflows/leaderboard.yml` — daily and manual update workflow

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

You can run the workflow manually from **Actions → UltraBullet Team Battles Leaderboard → Run workflow**, and override the Lichess username or name filter.

An optional Lichess API token may be added as a repository Actions secret named `LICHESS_TOKEN`. It is not required for public tournaments. Never put a token in the website files or commit it to the repository.

## Notes

- Only tournaments created by the configured account and matching the configured name filter are included.
- Points are summed across the discovered tournaments, so the leaderboard is cumulative, not a single-day ranking.
- When changing the filter, use a distinctive tournament-name substring to avoid accidentally including unrelated events.
- Generated result files are written into `docs/data/` and committed by the workflow.
