# Redesign wireframes — Overview and Rankings

These pages are isolated layout prototypes for the first redesign phase:

- `overview.html`: a focused homepage dashboard
- `rankings.html`: one ranking workspace with Teams, Players, Contributors and Performance Index views
- `wireframes.css`: shared neutral, grayscale layout rules
- `../js/redesign-wireframes.js`: preview-only tab switching

## What this phase decides

The Overview is limited to the competition snapshot, season progress, latest battle, monthly activity and short leader previews. Full tables and detailed analytics are moved out of the homepage.

The Rankings workspace uses four perspectives. Team and Player views retain all-time, monthly and 50-battle seasonal periods, minimum-battle filtering, sorting, pagination and CSV export in the eventual production implementation. Contributors keeps contribution-specific search and sort dimensions. Performance Index retains team/player selection, eligibility (10+ battles) and its component measures.

## Data and implementation boundaries

- Displayed sample figures are from the published analytics snapshot generated on 2 November 2026.
- Contributor table rows and detailed Performance Index component values are intentionally not fabricated in the wireframe.
- These prototypes do not load production JSON, invoke the current ranking scripts, or modify existing application pages.
- The prototype tabs are interactive for layout review; filters, sorting, pagination, profile links and CSV export are visual placeholders.
- No production logic, data pipeline, existing page, or navigation entry is changed by this phase.

The next step after layout approval is to decide responsive behaviour and component details, then migrate the existing functionality behind these approved layouts in small, testable steps.
