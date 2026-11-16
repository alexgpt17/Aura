# Aura harness

Measures and screenshots the extension engine in WebKit (Safari's engine) without a phone.

```sh
cd tools/harness
npm install && npx playwright install webkit   # once
node run.js                                    # everything: all sites × unthemed/dark/light
```

The output goes to `out/<timestamp>/`: `report.md`, `results.json`, screenshots and paint dumps.

## How it works
- **Injection.** The scripts are injected from `manifest.json` in manifest order, at document start, in every frame, matching what Safari does. Each script runs in its own function scope, which approximates Safari's isolated world.
- **Debug hooks.** `auraDebug.js` isn't loaded. `probe.js` implements the same `AuraDebug` hooks and records them.
- **Extension API stubs.** `browser.storage.local` returns the theme after 5 ms, the same as a warm Safari cache. `runtime.*` calls are no-ops.
- **Timing attribution.** Aura's `setTimeout`/`setInterval`/`requestAnimationFrame`/`MutationObserver` are swapped for timed wrappers. Every Aura task is timed, including work scheduled after an `await`.
- **Sub-pass timing.** content.js's `safePass` is patched in memory to time each step. The file on disk is never changed.
- **Device.** Playwright's `iPhone 15 Pro` profile: viewport, Safari user agent, touch.

## What a run records
| Scenario | What happens | Metrics |
|---|---|---|
| `visual` | Load, then screenshot at the load event (`load`), at load + 5 s (`5s`), and after scrolling 3 screens (`scrolled`). Then the site's `actions`, e.g. opening a menu (`menu`). | Aura ms, longest Aura task, passes (full-document vs scoped), longest frame gap, time to CSS applied, time to settled, layout Δ, and paint dumps at +5 s and after scrolling |
| `typing` | Types at 85 ms/key from the moment the input appears until navigation + 5 s, waits until 9 s, then types 30 more keys | Keystroke → next frame latency (p50/p95/max) for the first 4 s and for the settled page, plus Aura work while typing |

- **Layout Δ.** With Aura's sheets on vs. off on the same page (document and shadow copies), how many visible elements moved or resized by more than 1 px. It must be 0.
- **Settled.** The end of the first pass that has no other pass within 1 s after it.

## Options
```
--sites a,b          ids from sites.js (default: all live sites; fixtures only when named)
--themes none,dark,light
--scenarios visual,typing
--repeat N           N loads each; the report shows the median
--har record|replay  record each load to har/<site>.har, or replay offline (default: replay if a HAR exists, else live)
--browser webkit|chromium
--headed             show the browser (helps when a site blocks headless)
--label name         suffix for the output folder
--no-shots
--compare out/A out/B   before/after table plus a per-element paint diff
--keep-storage       localStorage (Aura's per-site theme cache) carries over between
                     loads of the same site and theme; with --repeat, the first load
                     is the cold one and medians use the warm loads only
--scenarios switch   theme-change check (see below)
--scenarios settings the app's native Dark Mode and per-site Disabled switches (see below)
```
Environment variables:
- `AURA_EXT_DIR=<Resources dir>` runs another copy of the engine. For A/B runs, point it at a `git worktree` of an older commit.
- `AURA_HARNESS_BROWSER_PATH` sets a custom browser binary.
- `AURA_HARNESS_STORAGE_MS=<ms>` delays the stubbed storage read (see Load flash).
- `AURA_HARNESS_DUMP_INLINE=1` adds each element's inline style and `data-aura-*` marks to the paint dumps (finds which pass wrote a paint; debug only, it changes the dump format).
- `AURA_HARNESS_TIMELINE=1` records the color timeline (see below). Off by default: it captures a stack per Aura style write, which slows the engine.

## Typical session loop
```sh
node run.js --har record --label baseline   # first time: snapshot the sites
# …change content.js…
node run.js --har replay --label fix --repeat 3
node run.js --compare out/<baseline> out/<fix>
```
Replays use the same DOM every time, so paint diffs and timings compare like for like.

## Limits
- **Not the real extension.** This doesn't run Safari's extension runtime, its real injection timing (Preload Top Hit, cold extension), or background.js. Use the Simulator for those (see RELEASE_PLAN.md).
- **Not phone speed.** A Mac is roughly 2–3× faster than an iPhone. Compare runs with each other, not with what you feel on the phone.
- **Logged-out pages only.** Reddit's logged-out comment box may need a login. The typing scenario then falls back to the first editable it finds, which is recorded as `typingTarget`.
- **The fixtures are synthetic.** They work offline, for engine A/B runs. Each file's header comment says what it models:
  - `fixture-hydration`: Reddit's hydration (~300 shadow roots, ~4 s of hydration, a comment box).
  - `fixture-wiki-drawer`: Wikipedia's `#mw-mf-page-left` drawer, opened by its checkbox, with a donate banner inserted 2.5 s later (W-1).
  - `fixture-airbnb-explore`: fixed header + full-width search pill + chips, and a 3-item bottom tab bar; a class flip and a full `style` rewrite test persistence (A-2, A-3).
  - `fixture-airbnb-login`: login form, dark translucent backdrop, and a role-less 87% × 57% cookie card (A-1, A-3).
  - `fixture-shadow-bars`: Reddit-shaped sticky custom elements whose painted surface is a plain div inside their shadow root (R-1, R-2).
  - `fixture-airbnb-chips`: `a[role=tab]` > transparent 28×28 absolute span > emoji `<video>` (A-4); a chat launcher (transparent square wrapper around a round button); photo controls with a dark scrim and a white disc.
  - `fixture-popover`: a role-less, absolute, z-indexed white tooltip with an arrow over an order timeline, inserted after 1 s (X-6); a transparent caption and badge row as controls.
  - `fixture-bearbottom-fit`: `.ff-backdrop` (fixed, 55% black) > `.ff-modal` (`role=dialog`, white, 76vh), opened after 1 s (B-2 regression guard).
  - `fixture-theme-color`: two `media=`-split site theme-color metas, inline html + sheet body backgrounds, a short page (the bottom of the screen is the canvas), a shadow host and a same-origin iframe (Load-3, theme switch).
  - `fixture-late-text`: post cards whose text is in `div`/`span` with authored dark colors, hydrated into the viewport every 100 ms for ~2.5 s, plus 1500 off-screen rows (6-1, text colors catching up).
  - `fixture-buttons`: Walmart full-width white strip and "Give feedback", Airbnb chips/badge/pill, Amazon gradient "Add to Cart", a Reddit-style draft sheet in a shadow root that re-renders with `innerHTML` (B-1, X-6, R-3).
  - `fixture-forms`: served as `docs.google.com`. `div[role=checkbox|radio|switch]` whose state is their own fill, `[aria-selected]` tabs, and the "Autosave your work" dialog (F-1).
  - `fixture-google-aimode`: served as `www.google.com`. AI Overview with the "Show more" fade, an AI Mode answer card that streams, and a fixed composer bar > pill > textarea that mutates on every keystroke (Type-2, G-1, G-2). The Session 5 engine hangs on it (see RELEASE_PLAN Session 6). Session 7 (G-5): a sticky top bar and the composer inside `#rso`, and a fixed band under the composer painted with a gradient only.
  - `fixture-google-aimode-deep`: the same with the answer card 9 divs deep, like real Google. Use it for typing before/after.

  - `fixture-promo-sheet` (Session 7): served as `www.google.com`. Google's "Keep things dark while you browse" app promo: a role-less fixed bottom sheet at z-index 2000 (G-4).
  - `fixture-portal-banner` (Session 7): served as `www.wikipedia.org`. The portal's wordmark and language list, with a fixed fundraising banner at z-index 100000 inserted after 1 s (W-5).
  - `fixture-masks` (Session 7): floating labels on outlined inputs (`<label>`, `<span>`, `<div>`), and Reddit-style thread connectors in a shadow root on a site-dark section, with a square that masks the thread line (F-2, R-4).
  - `fixture-blend` (Session 7): product photos on light tiles with `mix-blend-mode: multiply`/`darken` on a wrapper div or `<picture>`, one bare multiply `<img>`, and a blended photo on a large text card (B-3).
  - `fixture-github-chrome` (Session 7): served as `github.com`. A static theme-color meta that a site script rewrites 1.5 s after load, a ☰ menu that opens a fixed full-screen panel, and Primer's own dark mode (`data-color-mode` + companions) for the native switch (X-7, X-5).

  A fixture can be served from a real site's origin with `origin` in sites.js, so host-gated engine code (SITE_FIXES, Google passes) runs.

## Theme switch (`--scenarios switch`)
Loads with the run's theme (A), switches storage to the other theme (B) live, reloads with B in storage, then turns the theme off live and reloads. At each step it dumps every surface that can carry a theme color: computed html/body background, `color-scheme`, every theme-color meta, the shield, the main sheet, each shadow-root and iframe sheet copy (by the `--aura-bg` it was built with), the theme cache key, and the mean color of the screen's bottom 60 px. `report.md` has one table per site.

## App switches (`--scenarios settings`)
From a themed load: native Dark Mode on (live), a site mutation (a late fixed banner), a reload with native on, native off (live), then this site set to "Disabled" (live) and a reload. Same per-step table as the theme switch, plus the page's `data-color-mode` and the number of light-DOM elements carrying an Aura inline paint.

## Safari tint candidates (`results.json` → `tint`)
Recorded in the visual scenario at +5 s and after each action `shot`: the theme-color metas, the html/body background, and every visible fixed/sticky box that touches the top or bottom edge (with its `::before`/`::after`). That's everything Safari can tint its status bar and toolbar from; which one it actually uses is phone-only.

## Paint dumps
One row per element: `[node, background-color, color, background-image (+ " blend:<mode>" when mix-blend-mode isn't normal)]`. `›` marks shadow-root depth.

## Color timeline (`AURA_HARNESS_TIMELINE=1`)
Samples the computed color/background of what's on screen (a 12 × 24 grid of points through `elementsFromPoint`, open shadow roots pierced) every 100 ms for 6 s, and records every Aura inline color/background write with its Aura call chain. `report.md` lists each visible change after the first full pass and the write that caused it ("site" when no Aura write precedes it).

## Load flash
`AURA_HARNESS_STORAGE_MS=<ms>` delays the stubbed `storage.local.get` (default 5 ms, a warm cache) to model a cold extension process. `results.json` → `themeTiming` has `firstPaint`, `storageResolved` and `cssApplied`; the report's "Unthemed ms" column is `cssApplied − firstPaint` (0 when the sheet landed first): how long the page showed without Aura's stylesheet. With the theme cache, measure the second load: `--keep-storage --repeat 3`.

Note: Chromium runs init scripts before `<html>` exists; Safari runs document_start scripts after it. The engine waits for `<html>` either way.
