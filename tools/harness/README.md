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
| `visual` | Load, then screenshot at the load event (`load`), at load + 5 s (`5s`), and after scrolling 3 screens (`scrolled`). Then the site's `actions`, e.g. opening a menu (`menu`). | Aura ms, longest Aura task, passes (full-document vs scoped), longest frame gap, time to CSS applied, time to settled, layout Δ, and paint dump |
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
- **The fixture is synthetic.** `fixture-hydration` is shaped like Reddit's hydration (~300 shadow roots, ~4 s of hydration). It works offline, for engine A/B runs.
