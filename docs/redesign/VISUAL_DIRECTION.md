# Visual direction study — Editorial Data Studio

**Status:** isolated design exploration; not approved for production.

**Preview file:** `visual-direction.html`  
**Styles:** `visual-direction.css`  
**Preview-only interaction:** `visual-direction.js`

## Design intent

The existing public site has a dark, atmospheric Competitive Arena visual identity. This study deliberately explores a different direction: a light, editorial data workspace. It is not a recolour of the Arena layer.

The concept uses the competition archive as its organising principle. Large expressive headings are restrained to section introductions; numeric values use tabular/monospaced styling; card chrome is minimal; data tables are the central working surface. Pine green signals navigation and primary actions, rust marks tournament-specific references, and muted gold is reserved for rank and warning accents.

The aim is to make a dense competitive archive feel clear, calm and navigable without making the platform look like a generic corporate dashboard.

## Visual system proposal

| Role | Concept treatment |
|---|---|
| Canvas | Warm light neutral, rather than the existing dark gradient background |
| Surfaces | White and lightly tinted panels with thin borders; minimal shadow |
| Main text | Deep charcoal-green with a clear muted-text scale |
| Primary action | Pine green |
| Secondary competitive accent | Muted rust |
| Rank / warning accent | Muted gold |
| Display typography | Editorial serif for major section titles |
| Interface typography | Manrope / system sans for navigation, descriptions and controls |
| Numeric typography | Monospaced figures with tabular alignment |
| Tables | Compact, high-contrast headers; clearly separated rows; sticky rank and identity columns on phones |

The prototype's CSS tokens are defined locally in `visual-direction.css`. They do not depend on `design-system.css`, `design-refresh.css`, `v2-visual-system.css` or `arena-design-system.css`. This is intentional: the concept should be reviewable without inheriting the cascade being audited in PR #19.

## Information architecture represented

### Overview

The overview presents the archive scale first, then season progress, the latest indexed battle, monthly activity and compact all-time team/player leaders. Full analytics and historical detail remain outside the overview.

### Rankings

The four ranking views share one workspace but retain distinct meanings:

- **Teams:** cumulative team points and battle participation.
- **Players:** individual points and participation.
- **Contributors:** listed contribution records across team appearances, with contribution-specific summary and controls.
- **Performance Index:** normalized score with its 10-battle eligibility rule and component columns.

The prototype uses the source snapshot from **2 November 2026 at 03:49 UTC**. It reports 640 archived finished numbered battles; the highest official battle number in that snapshot is #644. The preview explicitly marks that data snapshot as stale. The 36-hour stale calculation must remain dynamic in the production implementation.

## Interaction boundary

**Functional in this study**
- Ranking category tabs, with arrow-key, Home and End navigation.
- Performance Index Teams/Players switch.
- Direct section anchors and links to the existing Analysis, History, Guide, battle report and Lichess event pages.

**Visual placeholders only**
- Search fields, period selection, minimum-battle filters, sorting, CSV export and pagination.
- Team/player profile links inside the sample ranking rows.
- Contributor top-three identities and total contribution points.
- Detailed Performance Index component values.

These placeholders are deliberately labelled or left empty. No contributor identities, aggregate contribution totals or PI component values have been invented.

## Responsive rules

- Desktop: overview content in two-column compositions; four ranking categories in one row; compact horizontal filter layout.
- Tablet: sections and navigation wrap while retaining visible hierarchy.
- Mobile: stacked overview panels; 2 × 2 ranking tabs; visible horizontal-scroll guidance for data tables.
- Narrow phones: rank and competitor columns stay visible while additional metrics scroll horizontally; long names are ellipsized within the sticky column.

## Architecture and next steps

The stylesheet is self-contained for this preview. If the direction is approved, its tokens and reusable component rules can be reconciled with the target architecture proposed in [CSS_ARCHITECTURE_AUDIT.md](CSS_ARCHITECTURE_AUDIT.md). That future consolidation should happen in a separate, tested migration. This study does not add another stylesheet to production or change the existing load order.

The next review should compare the visual direction against the approved structural wireframes at 1440 px, 1024 px, 768 px, 390 px and 320 px. It should also decide whether the lighter editorial treatment is the right long-term identity before any functional migration starts.
