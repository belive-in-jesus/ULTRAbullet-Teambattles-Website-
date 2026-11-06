# CSS architecture audit — redesign preparation

**Scope:** read-only audit of the current production stylesheet architecture on `main`, after the incremental-refresh merge (6 November 2026).

**Important:** this document proposes a future consolidation. It does not change production CSS, HTML, JavaScript, data loading or ranking logic.

## Executive finding

The current visual system is not one coherent stylesheet stack. Four global layers successively redefine the same foundations, with a fifth layer for navigation and landing pages. Page-specific modules are then inserted at different points in that sequence.

The final stylesheet often determines the visible result, but earlier layers still provide component rules, utility classes and legacy custom properties that later files do not fully replace. Removing one layer without first mapping those dependencies would break existing pages in ways that may not be obvious from a screenshot of the homepage.

The redesign should move to one canonical global system and a small set of page-family modules. The migration should be incremental and testable; it should not be implemented by adding a sixth global override layer.

## 1. Current production stylesheet loading

The 12 public pages use these global layers:

1. `css/design-system.css`
2. `css/design-refresh.css`
3. `css/v2-visual-system.css`
4. `css/navigation-hubs.css`
5. `css/arena-design-system.css`

The homepage additionally loads `css/dashboard-analytics.css`. Other page-specific modules are inserted before the navigation and Arena layers:

| Page | Additional module(s) |
|---|---|
| Overview / dashboard | `dashboard-analytics.css` |
| Contributor leaderboard | `contributors.css` |
| Achievements | `achievements.css` |
| Competitor profile | `profile.css`, `profile-analytics.css` |
| Battle report | `battle.css` |
| Performance Index | `performance-index.css` |
| Head-to-head comparison | `compare.css` |
| Rankings, Analysis, History, Guide, Hall of Fame | No dedicated external module in the stylesheet list |

The ordering has practical consequences: `arena-design-system.css` is loaded last on every public page and can override rules from all earlier files, including page-specific components. The existing regression suite explicitly checks this load order.

## 2. Global layers and overlap

### `design-system.css` — V1.5 foundation

- 634 lines; one global `:root` block and one global body foundation.
- Defines the original unprefixed tokens such as `--bg`, `--surface`, `--text`, `--muted`, `--cyan`, `--font-sans` and `--font-mono`.
- Owns a broad shared surface: body, shell, masthead, brand, navigation, hero, actions, cards, dashboard, leaderboard and modal components.
- Also contains a later information-page section and its own responsive/reduced-motion rules.

### `design-refresh.css` — V1.7 override layer

- 509 lines; redefines the same unprefixed root tokens and reworks body, shell, masthead, navigation, hero, metrics and shared surfaces.
- Adds more page-specific editorial and Hall of Fame styling.
- Repeats selectors already present in V1.5, including `.masthead`, `.mast-actions`, `.nav-link`, `.hero h1`, `.stats` and `.stat`.
- Contains another set of responsive and reduced-motion rules.

### `v2-visual-system.css` — V2 system

- 1,130 lines; adds a second, namespaced token family: `--v2-bg`, `--v2-panel`, `--v2-text`, `--v2-cyan`, `--v2-gold`, `--v2-display`, `--v2-sans`, `--v2-mono`, spacing/radius and shadow tokens.
- Rebuilds many of the same global surfaces: body, masthead, brand, navigation, typography, dashboard, compare, standings, battle history, modal, Hall of Fame, profile and guide.
- Several important selectors are repeated inside this layer for later page-specific corrections.
- Provides a different token namespace from the original V1 modules, so legacy modules still require the older variables.

### `navigation-hubs.css` — information-architecture additions

- 313 lines; defines shared navigation refinements, home pathways and the Overview/Analysis/History/Rankings landing-page components.
- Does not define a token system of its own. It relies on older shared names and also hard-codes colours.
- Its selectors are more focused than the preceding global layers, but it still contains responsive overrides for the masthead/navigation and page layout.

### `arena-design-system.css` — last-loaded global override

- 547 lines; defines a third, namespaced family: `--arena-bg`, `--arena-panel`, `--arena-text`, `--arena-cyan`, `--arena-gold`, `--arena-display`, `--arena-sans`, `--arena-mono`, plus serif typography.
- Reworks global navigation, hero, cards, metrics, analytics panels, tables, profiles, hubs, PI and comparison surfaces.
- It is not merely a small theme file: it includes broad shared components and page-specific overrides.
- It contains repeated selector groups and repeated media-query blocks for navigation/pathway layout.

**Result:** V1.5, V1.7, V2 and Arena each contain part of the global design system. The later layers progressively restyle and supersede earlier layers, but do not replace every earlier dependency.

## 3. Token dependency across page modules

The dedicated modules do not all use the same token namespace:

| Module | Token dependencies observed |
|---|---|
| `dashboard-analytics.css` | `--v2-*` |
| `contributors.css` | `--v2-*` |
| `profile-analytics.css` | Mostly local insight variables and literal colours |
| `profile.css` | Legacy unprefixed tokens such as `--muted`, `--shadow`, `--cyan`, `--line`, `--font-mono`, `--font-sans`, `--text` |
| `performance-index.css` | Legacy unprefixed tokens such as `--accent`, `--muted`, `--line`, `--text` |
| `compare.css` | Legacy unprefixed tokens such as `--accent`, `--muted`, `--line` |
| `achievements.css` | Legacy unprefixed tokens such as `--muted`, `--font-mono`, `--cyan`, `--line` |
| `battle.css` | No shared custom-property references were found in the inspected file; it still depends on shared typography, shell and navigation rules. |

This mixed dependency is the main technical reason not to delete `design-system.css`, `design-refresh.css` or `v2-visual-system.css` in one step. Some page modules would lose their token definitions even if the Arena layer still made the homepage look acceptable.

## 4. Recommended target architecture

The next design system should be authored from the approved Overview and Rankings information architecture, not from the current CSS stack. A practical target structure is:

| Target file | Responsibility | Must not contain |
|---|---|---|
| `design-tokens.css` | One canonical palette, typography, spacing, radii, elevation, borders, focus and motion tokens | Page layout or component-specific selectors |
| `base.css` | Reset, document defaults, type scale, links, form-control inheritance, focus-visible and reduced motion | Dashboard, rankings or profile layouts |
| `layout.css` | Page shell, responsive containers, global masthead/navigation, content grid and footer | Ranking-table details or chart visuals |
| `components.css` | Reusable cards, buttons, status labels, tabs, filters, table primitives, empty/error states | Page-specific positioning and bespoke charts |
| `pages/overview.css` | Overview dashboard composition and KPI/season/latest-battle modules | Global body, nav, button or token definitions |
| `pages/rankings.css` | Ranking workspace, category tabs, filter rows, table wrappers and responsive table behaviour | Contributor, PI or points calculations |
| `pages/analysis.css` | Analytics and comparison composition | Global cards/tables already owned by components |
| `pages/history.css` | Archive, Hall of Fame, records and achievements composition | Global navigation or typography |
| `pages/profile.css` | Profile-specific data visualisation and career-history layouts | Redefinitions of shared tokens or global surfaces |
| `pages/guide.css` | Methodology and editorial content layout | Global headings, links or page shell |

The filenames above are a proposed target, not a requirement to create every file immediately. Small page families can share one module where that keeps the architecture simpler.

### Token ownership

- Define one canonical token namespace and use it everywhere.
- During migration, temporary compatibility aliases may map legacy names to canonical tokens. They should be documented and removed only after all consumers are migrated.
- Page modules should not introduce competing global palettes or redefine the typography scale.
- Component tokens (for example table header surface or status-state colour) should be semantic, not tied to a page name.

### Component ownership

Each shared component should have one source of truth. In particular, the global masthead, navigation link, button, KPI, panel, status indicator and table primitives should not be redefined in both the base layer and the final theme layer.

## 5. Proposed migration sequence

1. **Freeze the current production baseline.** Keep the existing CSS stack and record representative screenshots/behaviour for all 12 public pages.
2. **Approve the visual direction.** Use the Overview and Rankings wireframes as the structural basis; do not infer the final design from the old Arena layer.
3. **Create canonical design tokens.** Map the old V1, V2 and Arena token names; document each compatibility alias and its removal condition.
4. **Build the shared foundation.** Implement base, layout and reusable components in the isolated redesign prototype first.
5. **Migrate Overview.** Keep the existing dashboard analytics data and rendering script; change only the DOM hooks deliberately and add parity tests.
6. **Migrate Rankings.** Reuse current ranking, contributor and PI logic; connect category-specific controls to their existing functions.
7. **Migrate page families.** Analysis, History and Guide next, then Profile and detail views.
8. **Retire old layers only after verification.** Remove a legacy file only when all of its remaining unique rules and token consumers have been migrated and regression tests pass.

## 6. Required regression protection

Before replacing any production CSS, the test suite should verify:

- Every public page loads the canonical base and layout files in the same intended order.
- Page-specific modules load after shared components and do not redefine global tokens.
- All local stylesheet references exist.
- CSS syntax/delimiters are valid.
- Key page hooks, IDs and navigation links remain present.
- Desktop, tablet, mobile and narrow-phone layouts are represented in review.
- Colour contrast, visible keyboard focus, reduced-motion behaviour and table overflow remain usable.
- The data stale/fresh status remains visible and retains its existing calculation semantics.

The current asset tests already cover some of these requirements; they should be extended as each migration step is undertaken rather than replaced wholesale.

## 7. Explicit non-goals for this audit

- No changes to team/player scoring, Performance Index or contributor calculations.
- No changes to Lichess discovery, collection, cache, aggregation or publication.
- No changes to production HTML or JavaScript.
- No production stylesheet is removed or reordered by this document.
- No placeholder values are introduced into the actual published datasets.

**Recommendation:** use the current production stack as a compatibility reference only. The redesigned prototype should start from a clean token and component architecture, then connect to the existing data models after the structure and visual direction have been reviewed.
