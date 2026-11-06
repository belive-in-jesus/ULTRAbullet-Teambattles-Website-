# Incremental leaderboard refresh

The scheduled leaderboard workflow runs at **06:15 and 18:15 Europe/Berlin**. GitHub Actions applies the IANA timezone, so the schedule follows German daylight-saving changes.

## Refresh model

1. Discover finished, numbered UltraBullet Team Battles created by the configured Lichess account.
2. Reuse the persistent snapshots in `cache/battles/`.
3. Fetch player/team results only for newly discovered battles. The first migration also reads the existing public reports in `docs/data/battles/` and backfills their team-member snapshots once.
4. Convert all saved battle snapshots into the existing aggregate input format.
5. Rebuild the existing cumulative rankings, profiles, period data, records, contributor data and analytics from the local cache.
6. Publish the generated data only if discovery, fetching, cache validation and aggregation all succeed.

The local aggregation still recalculates derived outputs from the complete cache. The incremental improvement is that historical Lichess result endpoints are no longer downloaded on every scheduled run.

## API safety

- Requests to Lichess are sequential: no parallel fetch workers are used.
- The default pause between API requests is 1 second.
- HTTP 429 responses trigger a wait of at least 60 seconds (or the longer server-provided `Retry-After` value).
- Unexpected missing team-result endpoints stop the refresh instead of publishing incomplete team or contributor rankings.
- An unsuccessful run does not commit generated files to `main`, so the last complete public dataset remains available.

## One-time migration

The first successful run takes longer because the existing battle reports do not contain team-member snapshots. The updater imports those historical records into `cache/battles/`. The public per-battle report files remain compact and are not enlarged with the separate processing cache.

## Manual controls

Use the [Leaderboard GitHub Actions workflow](https://github.com/belive-in-jesus/ULTRAbullet-Teambattles-Website-/actions/workflows/leaderboard.yml) to run a refresh manually.

The optional `force_refresh_all` input re-downloads all discovered battle results. It is intended for an audit or repair, not for normal scheduled operation, because it is substantially slower and makes more API requests.
