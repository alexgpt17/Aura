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
```
Environment variables:
- `AURA_EXT_DIR=<Resources dir>` runs another copy of the engine. For A/B runs, point it at a `git worktree` of an older commit.
- `AURA_HARNESS_BROWSER_PATH` sets a custom browser binary.

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

## Load flash
`AURA_HARNESS_STORAGE_MS=<ms>` delays the stubbed `storage.local.get` (default 5 ms, a warm cache) to model a cold extension process. `results.json` → `themeTiming` has `firstPaint`, `storageResolved` and `cssApplied`; `cssApplied − firstPaint` is how long the page showed without Aura's stylesheet.
