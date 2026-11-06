# Redesign wireframes — Overview and Rankings

These are isolated layout prototypes for the first redesign phase:

- `overview.html`: a focused competition dashboard
- `rankings.html`: one ranking workspace with Teams, Players, Contributors and Performance Index views
- `wireframes.css`: shared neutral, grayscale layout rules
- `../js/redesign-wireframes.js`: preview-only tab and keyboard navigation

The prototypes do not replace any production page. The Overview and Rankings layouts are previews; Analysis, History and Guide links still lead to the existing production pages. Both previews include a direct link back to the current production homepage.

## Information architecture review

### Overview

The page is intentionally a snapshot, not a second analytics workspace. Its content order is:

1. Archive scale: numbered battles, represented teams and represented players
2. Current season progress
3. Latest indexed battle, with separate report and original Lichess entry points
4. Compact current-month activity
5. Short all-time team and player leader previews
6. Direct routes to Rankings, Contributors, Performance Index and Analysis

This keeps full tables, historical charts and detailed comparisons out of the homepage. The Overview's leader cards are previews only; their all-time scope is named explicitly.

### Rankings

The four perspectives share a workspace but retain their own meaning:

- **Teams:** cumulative team points; all-time, monthly and fixed 50-battle season periods; minimum participation; ranking-specific sorting and export
- **Players:** cumulative individual points; the same period concepts, with individual profile entry points
- **Contributors:** contribution points across team appearances; cumulative archive view with contribution-specific search and sorting
- **Performance Index:** normalized performance view for teams or players, with the existing 10-battle eligibility threshold and component measures

Cumulative team points, individual points, contribution points and Performance Index scores must never be presented as interchangeable measures. The prototype descriptions call out these differences. Contributor controls are deliberately not given team/player period filters because this view is cumulative in the current model.

## Responsive layout contract

| Viewport | Overview | Rankings |
|---|---|---|
| Desktop (981 px and wider) | Three archive KPIs in one row; season, latest battle and monthly activity in a three-column group; leader previews side by side | Four ranking categories in one row; period and filter controls arranged horizontally; tables use their available width |
| Tablet (701–980 px) | Season and latest battle share a row; monthly activity spans the next row; leader previews remain side by side | Ranking categories remain a four-column strip while filter controls wrap into a compact second row |
| Mobile (320–700 px) | Navigation wraps rather than hiding items in a horizontal menu; intro and content panels stack; leader cards and quick links become single-column | Ranking categories use a 2 × 2 grid; filters wrap and then stack; each table scrolls horizontally inside its own labelled, keyboard-focusable region |
| Narrow phones (320–400 px) | Archive KPIs use a 2 + 1 arrangement to avoid three cramped columns | Tables keep the rank and competitor columns visible while the remaining metrics scroll horizontally; a visible hint explains the interaction |

The table layout intentionally remains tabular on small screens. Reflowing a multi-metric leaderboard into improvised cards would make comparisons between rows harder and could obscure which metric a value belongs to. The pinned rank and competitor columns preserve row identity while the user inspects additional columns.

## Interaction and accessibility boundaries

- Ranking category tabs work in the preview and support click, arrow-key, Home and End navigation.
- The active tab updates the preview hash, so direct links to `#teams`, `#players`, `#contributors` and `#performance-index` remain possible.
- Performance Index team/player selection works in the preview.
- Search, period selection, minimum-battle filters, sorting, pagination, CSV export and profile navigation are still layout placeholders; they are not connected to production ranking logic.
- Table scroll regions have accessible names and can receive keyboard focus.
- The current-production link is available from both prototype pages.
- The prototype does not load production JSON or invoke the existing ranking scripts.

## Data fixture and implementation boundary

- Displayed sample figures use the published analytics snapshot generated on **2 November 2026 at 03:49 UTC**.
- Overview totals, latest battle, current-month and current-season values are taken from the published analytics overview.
- Sample leader rows illustrate the target table hierarchy; the prototype does not claim to show all 50 rows on a page.
- Contributor rows and detailed Performance Index component values are not fabricated.
- These files remain under `docs/redesign/`; production HTML, CSS, data-loading scripts, ranking formulas and aggregation pipelines are unchanged.

## Review checklist before functional migration

- Review the page hierarchy and naming of the five main areas: Overview, Rankings, Analysis, History and Guide.
- Check desktop at 1440 px and 1024 px; tablet near 768 px; mobile at 390 px and 320 px.
- Confirm the 2 × 2 tab grid, stacked filter controls, sticky identity columns and horizontal scroll hint on narrow screens.
- Confirm the live-page links are understandable during the transition period.
- Replace fixture values from the JSON snapshot only when a fresh, successful data publication is available.
- Approve the structure before developing the final visual design system or connecting production functionality.

The next implementation phase should connect the approved layouts to existing functions in small steps, starting with Overview and then Rankings. The calculation and aggregation models should remain unchanged unless a separately tested defect requires a targeted correction.
