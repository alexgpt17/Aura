# Aura — Release Plan (ship by Nov 10, 2026)
Status legend: [ ] todo · [x] done · [~] partial. Update at the end of every session.
Workflow (from Nov 4): you say "continue with Session N" → I read this file, measure with `tools/harness` before and after the fix, update this file, and give you a short on-phone visual check list. The on-device HUD (auraDebug.js) stays in Debug builds for spot checks, but no session depends on it.
Repo: `~/Developer/Aura` is the only copy (the iCloud Desktop copy was retired Oct 24).

## Root causes found in Session 1 (summary — full evidence in "Root-cause details" at the end of this file)
1. **Input lag** — each mutation batch re-runs ~15 passes over the page. Scope usually collapses to `<html>` (common ancestor of unrelated + Aura's own style mutations). Several passes are O(n²) (`textContent` / `querySelectorAll('a[href]')` per element). Some passes mutate every run, re-triggering themselves. The scroll handler does full unsliced walks. On Google, `body:has()` CSS and observers rewrite every element of the AI answer card per mutation.
2. **Load flash** — everything but the html/body shield waits on async `storage.local.get` (read twice). Safari injects `document_start` scripts late with Preload Top Hit / cold extension. Cold-cache fallback takes 100 ms + a native round trip. The shield is hard-coded dark (wrong for light themes). background.js may rewrite storage every 5 s (unstable key order).
3. **Google parity** — the universal transparency rule strips Google's surfaces and ~600 lines of JS rebuild them. Decision: fix the lag sources first. Token mode (Google uses ~58 `:root` color variables) is a fallback only.
4. **Reddit sticky bars** — the sticky repaint is skipped (likely the child-coverage < 0.5 rule or shadow DOM). The existing selector is an unverified guess; get the real one via the debug inspector.
5. **Light buttons** — the `color: revert` rule reverts to *UA* colors (light under forced dark scheme). The contrast safety net never runs in shadow DOM, ignores background-image, and skips gradient buttons.
6. **Wikipedia drawer** — `#mw-mf-page-left` is fixed and ≥75% vw → treated as a "covering sheet". Once `.donate-banner` renders, it qualifies as the "inner card", so the drawer gets inline `transparent !important` and is never repainted (`visitStickyElement` scrim branch; same in `visitOverlayModalWalk`).
7. **Light themes** — dark shield, `--aura-border` is white-alpha, several fills assume dark.
8. **Layers & overlays: geometry guessing instead of authored paint** (added Oct 23; covers #4, #6, and Airbnb) — the universal rule strips every layout background before any JS runs, so the sticky/overlay passes can't see whether the original was opaque. They guess from geometry (child coverage, covering-sheet size, "inner card" shape). See "8. Layers & overlays" in Root-cause details.

## Baseline results (on device, Oct 23)
- **Approximate.** Until Oct 24 the app was built from `~/Developer/Aura` while edits went to the Desktop copy, so these results came from `b74bc54` + the Oct 7 edits, not `0d47537`. The Oct 7 edits are in `git stash@{0}` and `~/Developer/Aura-oct7-uncommitted.patch`; not applied.
- Wikipedia sidebar still turns transparent (expected; now fixed by the Session 4 layer engine).
- Input lag on Reddit and Google AI Overview: noticeable but not severe. Still a priority.
- Airbnb (new, not seen before; unclear when it appeared):
  1. Login: the cookie popup renders as a centered box that looks cut off. Only the text column is opaque, and the login form shows at the card's edges.
  2. Explore: the header touches the search bar, and page content shows through the header/search bar while scrolling.
  3. The bottom tab bar is transparent.
- All three Airbnb bugs trace to root cause #8, not to Airbnb-specific code.

## Engine principles (Oct 23 — apply to every fix from here on)
- **Fixed/sticky layers** (headers, toolbars, tab bars, search bars, sidebars): if the original was opaque, the themed one is opaque, including after scroll, resize, and late-loading content. Decide from the **authored paint**, never from geometry.
- **Overlays** (modals, cookie/consent, dropdowns, drawers): backdrop and card are handled separately (dark translucent scrim kept, opaque card painted, transparent wrapper left alone). Never clipped.
- **Layout**: theming never changes spacing or size. Enforced by a jest test plus the HUD layout diff.
- Per-site overrides only for genuine exceptions confirmed with HUD inspect.

## Baseline
- [x] Uncommitted work reviewed in Session 1 and committed locally as the pre-release baseline (not pushed); extension jest tests green.
- Decisions:
  - Scheduler change approved.
  - Google: fix lag sources first; token mode only as fallback.
  - Cuts: niche passes, time-based rule, Native Dark Mode (only if no shipping UI exposes it).
  - Split themes are kept.

## Schedule (re-dated Nov 4: deadline moved to Nov 10)
| Session | Date | Scope |
|---|---|---|
| 2 | Oct 23 ✓ | Debug HUD + inspect + quick wins (committed Nov 4 as `57b516a`) |
| 3 | Nov 4 ✓ | Test harness + input lag |
| 4 | Nov 5 | **Layer & overlay engine**: absorbs the old Session 6 Wikipedia/Reddit items |
| 5 | Nov 6 | Load flash + light-theme base |
| 6 | Nov 7 | Google AI lag/looks + buttons |
| 7 | Nov 8 | Regression + App Store submission |
| — | Nov 9 | Buffer / resubmission |
| — | Nov 10 | Deadline |

- **Cut:**
  - the Google token-mode prototype (it was fallback-only)
  - the Minerva and Reddit per-site rules (replaced by the Session 4 general rule)
  - the "dark surfaces left behind on light themes" check (post-release)
- **Deferred:** the native-dark-mode stylesheet scan cache.

## Session 2 — Debug HUD + measure (unblocks every other fix) — code done Oct 23, device measurements pending
- [x] `auraDebug.js` (loaded before content.js). The Release build replaces it with a no-op stub via an Xcode Run Script phase (Release config only). content.js calls `DBG?.x()` hooks, so there's zero cost when stubbed.
- [x] Enable per tab by appending `#aura-debug` to the URL (remembered in sessionStorage).
- [x] HUD overlay (screenshot-able):
  - script-start time vs `responseEnd`/`domInteractive`
  - storage-resolved time and CSS-applied time
  - passes/sec, last pass ms, root (`html` vs scoped), element count
  - mutation records/sec (own vs site)
  - scroll passes
  - storage.onChanged count
- [x] Inspect mode: tap an element to see:
  - tag/id/classes and the shadow host chain
  - computed position/bg/color, plus the **authored** bg (what the site painted before Aura)
  - which Aura sets touched it
  - which sticky skip rule fired (`stickySkipReason`)
- [x] Layout diff: compare fixed/sticky/overlay element rects with Aura's sheets on vs off; report deltas > 1 px.
- [x] Low-risk quick wins:
  - Dedupe `storage.get`: content.js reuses injected.js's promise.
  - Stable-key compare in background.js.
  - Stop remove/set churn in the inline-highlight and loader passes.
  - Write the pseudo-bg sheet only when its text changes.
  - Run `promoteEngineStylesheet` only when our sheet isn't last, at most once per 2 s.
- Implementation notes:
  - The HUD host is `display: contents` inside a closed shadow root, so the engine never paints it.
  - Inspect's authored paint is a debug-only probe (disable Aura's sheets + lift our inline props on that one element). The production probe is Session 4.
  - `stickyInfoFor()` was extracted from `visitStickyElement`; `stickySkipReason()` is in themeHeuristics.js with one test per reason.
  - Release stub: the Xcode phase "Stub auraDebug.js (Release)" on the extension target fails the build if the file isn't found. Script sandboxing is off for that target only.
- Test: Reddit + Google AI Mode with the HUD. Report passes/sec while idle and while typing. Before/after numbers go in this file.
- Measurements: **superseded** by the harness (Nov 4). Device HUD numbers below were never collected.
  | Page | Idle passes/s (10 s avg) | Typing passes/s | Sync max ms | Site/own mut/s | onChanged in 30 s |
  |---|---|---|---|---|---|
  | Reddit post | | | | | |
  | Google AI Mode | | | | | |
- Inspect findings (fill in): Reddit top/subreddit bar, Airbnb header/pill/tab bar/cookie card, Wikipedia `#mw-mf-page-left`: authored verdict + `stickySkip` + rules line. Airbnb explore layout diff result.


## Test harness (Nov 4) — `tools/harness/`, see its README
- `npm run harness` (or `cd tools/harness && node run.js`) loads every TEST_SITES site in Playwright WebKit with an iPhone 15 Pro profile, unthemed + dark + light.
  - **Injection:** Aura's scripts in manifest order, document_start, all frames; storage/runtime stubbed.
  - **Screenshots:** load, +5 s, after scrolling, plus menus.
  - **Load metrics:** Aura task time, longest task, passes (full-doc vs scoped), frame gaps, time to CSS applied / settled, Aura-caused layout Δ.
  - **Typing:** keystroke → next frame latency in the first 4 s and on the settled page.
  - Output: `out/<stamp>/report.md`.
- **Snapshots:** `--har record` saves every load; `--har replay` reruns them offline with identical DOM. `--compare A B` prints before/after plus a per-element paint diff.
- **A/B:** `AURA_EXT_DIR=<Resources of a worktree>` runs an older engine.
- **Fixture:** `fixture-hydration` is an offline, deterministic, Reddit-shaped page (~300 shadow roots, ~4 s of hydration, a comment box). It's for engine A/B runs where the network isn't available.
- **Simulator:** `tools/harness/sim.sh build|install|theme dark|light|off|shots` runs the real extension in Simulator Safari and takes screenshots.
- **Not yet run against live sites** (see Session 3 notes): the environment I run in can't start WebKit or reach the internet.

## Session 3 — Input lag (Blocker 1) — done Nov 4
- **Cause (measured):** on a full-document pass, `handleShadowDOM` ran synchronously over every shadow root. That included `reopaqueExpandedContentPanels` per root, which is O(n²) because of `textContent` per element.
  - During hydration, mutations land everywhere, so scope = `<html>` and every pass pays for all shadow roots in one task. That produced 200–260 ms tasks on the fixture (more on a phone and on real Reddit).
  - After hydration, passes are scoped and cheap. That matches "bad for the first 3–4 s, then fine".
- [x] Cut `reopaqueExpandedContentPanels` (approved cut). It was 80% of pass time on the fixture. The A/B paint diff shows the only change is rows inside shadow roots that it had painted theme-bg on a theme-bg page (false positives, no visible difference).
- [x] Time-budget the whole pass: `runSafetyPasses` is now a step queue (`runSteps`).
  - Slices of 8 ms each, every slice its own task.
  - While typing (key/input in the last 600 ms), slices drop to 3 ms with 16 ms gaps.
  - Each shadow root expands into its own sliced steps (`shadowRootSteps`, replacing `handleShadowDOM`).
- [x] Exclude Aura's own writes: `takeRecords()` at the end of every slice, every pass and the scroll handler. Records queued at the end of our own task are exactly our writes, so they no longer widen scope or re-trigger passes.
- [x] Typing detection (`keydown`/`input`, capture, passive) feeds the slice budget. A separate typing-guard deferral turned out unnecessary: typing p95 now equals unthemed.
- [ ] Scope by added nodes. **Deferred:** full-document passes are now harmless to input, and this touches every pass's root handling. Revisit if live harness runs show long load-time CPU.
- [ ] Scroll handler tracked-only. **Deferred** to Session 4, which rewrites sticky handling anyway.
- [ ] Remaining approved cuts (in-place nav panels, inline highlights, logo inversion, loader images, time-based day/night). **Not done:** each cost < 3 ms per pass on the fixture after slicing, so they no longer cause lag. Cutting them removes visible behavior that I couldn't verify visually here.
- [ ] Gate nav-drawer classification to fixed/sticky. **Deferred** to Session 4 (same code).
- [x] ~~Cut Native Dark Mode~~ → **kept**: verified Oct 23 that SafariScreen's "Dark Mode" switch sets `nativeDarkModeEnabled`. Include it in the Session 7 regression pass.
- **Numbers** (fixture-hydration, Chromium headless on an idle Mac, median of 3 loads, dark theme; light is within ±10%). Before = `57b516a` via a git worktree (`AURA_EXT_DIR`), same machine, same run:
  | Metric | Unthemed | Before (`57b516a`) | After |
  |---|---|---|---|
  | Longest Aura task during load | – | 245 ms | 15 ms |
  | Aura time, nav → load + 5 s | – | 519 ms | 143 ms |
  | Tasks ≥ 50 ms | – | 2 | 0 |
  | Longest frame gap during load | 17–33 ms | 233 ms | 33 ms |
  | Typing, first 4 s: p50 / p95 / max | 23 / 30 / 42 | 25 / 43 / 196 | 28 / 35 / 40 |
  | Typing, settled: p50 / p95 / max | 25 / 33 / 33 | 25 / 32 / 35 | 24 / 34 / 34 |
  | Aura-caused layout Δ | – | 0 | 0 |
  - Mac numbers. A phone is ~2–3× slower, so the before case is roughly 0.5 s stalls on device, which matches "5–6 words of lag".
- **Simulator:** `sim.sh` is written, but the Debug build failed at the dSYM step with "No space left on device". The Mac had 40 MB free; my 2.4 GB scratch build was deleted, leaving 2.4 GB. A full RN Simulator build needs more than that.
- **Harness fix:** typing runs whose keydowns don't pair 1:1 with sent keys are now flagged INVALID and left out of medians. 2 of the 3 old-engine light runs showed negative latencies before this.
- **Still needed:** live Reddit/Google numbers from `npm run harness -- --sites reddit-post,google-aimode --repeat 3` with WebKit. Then the full-site regression run. Both need a machine where Playwright WebKit can start and reach the internet.

## Session 4 — Layer & overlay engine (root cause 8; absorbs old Session 6 Wikipedia/Reddit)
- [ ] Probe primitive `readAuthoredPaint(el)`:
  - The universal and white-inline rules get `:where(:not([data-aura-probe]))` (zero specificity, so the cascade is unchanged).
  - Probe a batch: set `data-aura-probe` + `data-aura-notrans` (transition off) → read computed bg-color/bg-image/backdrop-filter in one recalc → remove probe → remove notrans next frame.
  - Cache per element, keyed by `className`. Read the site's own inline bg before our inline write.
  - `data-aura-*` isn't in the observer's attributeFilter, so probing creates no mutation records.
  - Same `:where` clause in the shadow-root copies.
- [ ] Fixed/sticky rule (replaces the coverage/covering-sheet/z-index vetoes in `shouldSkipStickyElement` for the paint decision; ad/AMP skips stay):
  - Probe the layer and its descendants to depth 3 that are ≥ 40% of its width.
  - Paint the first authored-opaque node per branch `--aura-bg` (alpha ≥ 0.5, or translucent + backdrop-filter); stop descending there.
  - Never paint an authored-transparent element.
- [ ] Persistence:
  - Re-check tracked layers on scroll/resize (tracked set only).
  - Re-probe on class change.
  - Re-paint if the site rewrites `style`.
  - Probe new nodes inside a tracked layer.
- [ ] Overlay rule (replaces the `isOverlayCoveringSheet` → `paintOverlayScrimAsTransparent` → `findInnerModalCard` paint path in `reopaqueOverlays`, `visitOverlayModalWalk`, `visitStickyElement`, `revertGrownModalCards`):
  - Backdrop = authored dark translucent → restore the authored scrim.
  - Card = authored opaque → `--aura-overlay`.
  - Wrapper = authored transparent → leave it, keep descending.
- [ ] Layout invariance: jest test scanning content.js CSS + `setProperty` calls for geometry properties (padding/margin/size/inset/border-width/display/position/transform), with a justified allowlist.
- [ ] Per-site rules only where HUD inspect shows the general rule is wrong. Remove the unverified Reddit SITE_FIX if the general rule covers it.
- Test: TEST_SITES A-1..A-3, R-1, R-2, W-1, W-3, X-2 (curtain must not return), dark + light; HUD layout diff = 0 on Airbnb explore.

## Session 5 — Theme load flash (Blocker 2) + light-theme base (Blocker 7) (was Session 4)
- [ ] Use Session 2 HUD data to confirm the cause: late injection vs slow storage vs cold-cache fallback.
- [ ] Ship a static `aura-base.css` via manifest `content_scripts.css` (Safari applies it before first paint). It holds the theme-agnostic structure keyed on `html[data-aura]` plus a neutral shield. injected.js sets the vars + attribute as soon as its single storage read resolves.
- [ ] Light-theme shield: follow `prefers-color-scheme` until the theme is known (or remember the last theme's lightness). Final choice depends on Session 2 data.
- [ ] Cold cache: background writes storage on install/startup; content falls back once, with no 100 ms timer.
- [ ] Make the `--aura-border`/elevation tokens theme-aware (light themes get dark-alpha borders).
- Test: TEST_SITES "Load" rows (cold-launch Safari, Preload Top Hit), dark + light.

## Session 6 — Google AI Overview / AI Mode (Blocker 3) + buttons (Blocker 5) (was Sessions 5 + 6)
- [ ] Replace `body:has(...)` / unscoped `div:has(~ div ...)` SITE_FIX rules with JS-toggled classes or scoped selectors.
- [ ] Dedicated observers: stop rewriting every div/p/li/span of the AI answer card on each Google mutation. Paint the card root once and add a CSS rule scoped by a data-attribute we set.
- [ ] Ask-anything / AI-chat passes: run only when their containers changed, never on keystrokes inside the composer.
- [ ] Fix visual mismatches found via HUD inspect with scoped SITE_FIX selectors.
- [x] ~~Google "token mode" prototype~~ → **cut Oct 23** to make room for Session 4.
- [ ] Buttons:
  - Add a button-contrast pass in light + shadow DOM, using each button's own background (including the first gradient stop; the Session 4 probe gives the authored fill).
  - Replace the `color: revert` rule.
  - Covers the Airbnb category chips (link color on white pills), the "Guest favorite" badge, and the "Prices include all fees" pill.
- Test: TEST_SITES Google rows + Type-2/Type-3 + B-1, dark + light, side by side with Aura off.

## Session 7 — Regression + App Store submission
- [ ] Full TEST_SITES pass (dark + light + one split preset). Fix only regressions.
- [ ] Release build: verify the debug stub was swapped in (HUD unreachable), no console noise, version/build bumped.
- [ ] Privacy:
  - App Privacy = Data Not Collected.
  - Justify `<all_urls>` in the review notes ("applies on-device CSS; no page content leaves the device").
  - Privacy policy URL is live.
  - PrivacyInfo.xcprivacy is present for each target (already done).
- [ ] Review-guideline risks for content-modifying extensions:
  - 2.1 completeness: the extension must visibly work. The reviewer steps are in SUBMISSION_READINESS.md.
  - 4.2 minimum functionality: themes, custom themes, per-site settings.
  - 5.1.1 data/permissions: explain the broad host access.
  - 2.3 accurate metadata: screenshots must show real themed Safari pages.
  - 5.2 IP: don't feature third-party branding prominently in screenshots.
  - Ad iframes: confirm the SafeFrame check is in content.js (SUBMISSION_READINESS item 1).
- [ ] Xcode:
  - Uncheck the legacy TintExtension target in the Archive scheme.
  - Archive TintApp and upload.
  - Fill in the review notes and submit.

## Session log
- **Session 1 (Oct 22):**
  - Audit and root causes, this plan, and TEST_SITES.md.
  - Reviewed the ~650 uncommitted lines and committed them locally as the baseline (not pushed).
  - Net useful parts:
    - skips a native sync on cached loads
    - `change`/`toggle` listeners for CSS-only menus
    - tooltip theming
    - revert hysteresis
    - Google composer fix
  - Known risks, handled in Sessions 3 and 4 (renumbered Oct 23):
    - a new fixed covering-sheet scrim branch (a second route to the Wikipedia bug)
    - the `transitionend` listener
    - the shadow-DOM nav-panel pass
  - No other code changes.
- **Session 2 (Oct 23):**
  - Folded in the on-device baseline (Airbnb, Wikipedia, lag). Found root cause #8, revised the schedule, and added the engine principles.
  - Built the debug HUD, inspector and layout diff, plus all five quick wins.
  - Device measurements still to do (see Session 2 test list).
- **Session 3 (Nov 4):**
  - Committed the Session 2 work (`57b516a`, 243 engine tests green).
  - Built `tools/harness` (WebKit/Chromium runner, offline fixture, HAR snapshots, A/B + paint diff, Simulator script).
  - Found the early-typing lag cause with it, and made the pass engine time-sliced and shadow-root-sliced. Cut the content-panel pass. Before/after numbers are in Session 3.
  - Blocked here: Playwright WebKit can't start inside my sandbox, and the sandbox has no general internet. Live-site runs are still to do.

## Root-cause details (Session 1 audit)
Line numbers are from baseline commit `0d47537`. Paths are relative to `ios/TintExtension Extension/Resources/`. Confidence levels are stated per item. "Hypothesis" means the HUD (Session 2) must confirm it.

### How the engine runs (context for all blockers)
- manifest.json injects 5 scripts into every frame (`all_frames: true`) at `document_start`.
- `injected.js` paints a hard-coded `#121212` html/body shield, then `storage.local.get`, then paints html/body in theme colors.
- `content.js` `init()` (5187) does its own `storage.local.get`, then `applyTheme()` injects ~400 lines of CSS (`#aura-core-engine`). That CSS includes the universal rule (every layout tag gets `background-color: transparent !important`) plus SITE_FIXES (~427–740).
- `runSafetyPasses(root)` (4263) runs `handleShadowDOM` plus ~14 synchronous passes, a sliced 5-visitor walk, and a contrast walk. Most passes re-opaque what the universal rule stripped.
- Triggers:
  - MutationObserver on `<html>` (subtree; attributes include `style`/`class`), 150 ms debounce
  - `change`/`transitionend`/`toggle` listeners
  - scroll listener (200 ms throttle)
  - `visibilitychange` native sync
  - a 60 s timer
  - on Google, extra per-element MutationObservers
- `background.js` polls native messaging every 5 s and rebroadcasts UPDATE_THEME to all tabs when data changes.

### 1. Input lag on Reddit and Google AI (high confidence)
Each mutation batch, including the ones typing produces, triggers a full engine pass.
1. **Scope collapses to `<html>`.** `findCommonMutationAncestor` (themeHeuristics.js:91) takes the common ancestor of *all* records in the 150 ms window. Unrelated site mutations (timestamps, ads, lazy components, the AI stream) land in the same window. So do Aura's own inline-style writes: `pendingMutationRecords` keeps queuing while `ignoreMutations` is true (content.js:5216–5226, 4323–4335). The root becomes `<html>`, so every keystroke burst costs a full-document pass.
2. **Self-retriggering loop (hypothesis).** `finish()` re-arms dispatch if records arrived during the pass (content.js:4333). Several passes mutate even when nothing changed:
   - `visitInlineHighlightElement` (~4200) and `visitLoaderBgElement` (~3965) remove, then set, on every pass.
   - `visitPseudoBgElement` (~3927) rewrites `#aura-pseudo-overrides` textContent every pass.
   - `promoteEngineStylesheet` (~4246) re-appends our `<style>` whenever the site added a style after it. That is a childList mutation plus a full style recalc, and Reddit/Google add styles constantly.

   Result: passes may chain every ~200 ms indefinitely. Confirm with the HUD's passes/sec while idle.
3. **O(n²) heuristics.** Per-element functions scan each element's whole subtree:
   - `classifyNavDrawerState` runs for every element in `visitOverlayModalWalk` (1781). It calls `navSignalsFromElement` (themeHeuristics.js:936), which runs `querySelectorAll('a[href]')` on the subtree.
   - `classifyNavMenuPanelState` does the same (synchronous, up to 4000 elements).
   - `classifyExpandedContentPanelState` calls `modalCardInfoFromElement` (themeHeuristics.js:860), which does `el.textContent` + regex per element. For `<body>` that is the whole page's text, repeated for every ancestor.
   - `visitInlineHighlightElement` reads the parent's full textContent for every `<span>`.
   - Visitors interleave `getComputedStyle`/`getBoundingClientRect` reads with inline-style writes, which causes layout thrash.
4. **Long synchronous phase.** Only the 5-visitor walk is sliced (`forEachSliced`, FRAME_SLICE 300). Everything else runs in one task, and input events wait behind it:
   - `handleShadowDOM` (4805): a full stylesheet compare plus passes per shadow root
   - shells, pseudo, loader, logo, highlights, overlays, top chrome
   - `restoreAuthoredChromeOpacity`: scans up to 15k CSS rules (5 s TTL, or whenever the sheet count changes), then runs a 300-selector `querySelectorAll`
   - the panel passes and the Google passes
5. **Scroll handler.** On iOS, focusing or typing in a field scrolls the page. Every 200 ms, the handler runs unscoped, unsliced, full-document `reopaqueTopChrome` (2971) and `reopaqueStickyFixed` walks.
6. **Google only.**
   - SITE_FIXES use `body:has(...)` and unscoped `div:has(~ div [aria-controls="m-x-content"]):empty` (~477–499). A `:has()` whose subject is `body` makes WebKit re-check invalidation on almost any DOM change, which adds style-recalc cost to every keystroke.
   - `attachDedicatedGoogleRepaintObserver` (2472) synchronously rewrites the inline style of every div/p/li/span in the AI answer card on each mutation inside it. That happens continuously while AI Mode streams.
   - `rethemeAskAnythingComposer` / `rethemeGoogleAiChatSurface` run on composer keystrokes.
7. **Shadow roots.** Each shadow root (Reddit has hundreds) gets a full copy of the ~400-line stylesheet, which multiplies style-recalc cost.

### 2. Inconsistent 1–2 s theme-load flash (medium-high confidence; confirm with HUD timings)
- Only the html/body shield paints synchronously. Everything else waits on async `browser.storage.local.get`, which is called **twice** (injected.js and content.js). When the extension process is warm this takes milliseconds; when it is cold, much longer.
- **Late injection (likely main cause of the inconsistency).** Apple's developer forums document that `document_start` is unreliable with Preload Top Hit, prerendering, and after extension wake. In those loads the page paints unthemed before any of our scripts run.
- **Cold-cache path.** If `tintThemeData` is missing, the code waits 100 ms, messages background, then makes a native round trip with a 3 s timeout. That alone can produce a 1–2 s flash.
- **Light themes flash dark first.** The shield is hard-coded `#121212` (injected.js:~50).
- **Storage churn (hypothesis).** `background.js` detects changes by comparing `JSON.stringify` of native data. Swift dictionary key order isn't stable, so it may write storage about every 5 s. Each write fires `onChanged` in every tab, which writes html/body styles, which mutates the DOM, which runs a full pass. Cheap fix: compare a key-sorted stringify. Confirm with the HUD's onChanged counter.

### 3. Google AI Overview / AI Mode parity (high confidence)
- Live inspection: Google SERP and AI surfaces are token-driven, with ~58 `:root` color custom properties. Examples: `--xhUGwc` (page bg), `--bbQxAb`/`--YLNNHc` (text), `--JKqx2` (link), `--DEeStf`/`--TSWZIb`/`--XKMDxc` (surfaces). The names are the same in Google's light and dark modes; only the values differ.
- The universal rule deletes Google's surfaces. About 450–600 lines of geometry heuristics then repaint pieces: the Ask-anything climb, disclaimer-text anchoring, dedicated observers, and `:has()` fades. The result is visual drift from the Aura-off look, plus the lag in 1.6.
- Decision (Oct 22): fix the lag sources first while keeping the transparency rule (now Session 6). Token mode was cut on Oct 23.

### 4. Reddit sticky header transparent (medium confidence; needs the on-device selector)
- The universal rule strips the bar. `visitStickyElement` (2222) should repaint it, but likely bails for one of these reasons:
  - `shouldSkipStickyElement` (themeHeuristics.js:1869): `childCoverageFrac < 0.5` (avatar + short text + `…` button in a wide bar) or the z-index ≥ 2000 rule
  - the bar lives inside a shadow root, which only gets sticky handling during passes that include its host
- The existing `shreddit-subreddit-header` SITE_FIX (~731) is an unverified guess. Chrome can't load reddit.com from my tooling, so get the real element from the HUD inspector.
- The screenshot shows an ad scrolling under "Open App", so the subreddit bar has the same problem.

### 5. Light buttons on dark themes, e.g. Reddit "Save" (high confidence; general bug)
- Buttons are never repainted (BUTTON is in `BRIGHT_SKIP_TAGS`), but their **text** is force-recolored:
  - `[role=dialog] *` sets `color` and `-webkit-text-fill-color` to `var(--aura-text)`.
  - The follow-up "fix" sets `color: revert` on buttons (content.js:1072–1082). `revert` rolls back to the **user-agent** stylesheet, not the site's CSS. Under forced `color-scheme: dark`, UA `ButtonText` is light, so you get light text on the button's authored light background.
- The contrast safety net (`visitContrastElement`, 3646) would catch it, except:
  - (a) it never runs inside shadow roots, where Reddit's buttons live; `handleShadowDOM` runs only the sticky/overlay/panel passes
  - (b) `effectiveBackground` (themeHeuristics.js:1998) ignores background-image and CSS-variable fills
  - (c) it skips gradient buttons entirely
- Light themes have the mirror risk: dark buttons get dark text.

### 6. Wikipedia left drawer turns transparent (high confidence; reproduced in code)
- Live DOM (Minerva, phone width): `#mw-mf-page-left.menu` is `position: fixed`, 300×657, z-index 2, inside `nav.navigation-drawer`. It contains `.donate-banner`, an opaque white card with text, a link, and an animated gif that loads late.
- At phone width the drawer is ≥ 75% vw and ≥ 45% vh, so `isOverlayCoveringSheet` returns true.
- `visitStickyElement` (content.js:2252–2260) has a branch for fixed + covering-sheet + non-ARIA. When `findInnerModalCard` finds a card inside, it calls `paintOverlayScrimAsTransparent`, which writes inline `background-color: transparent !important` on the drawer and drops it from `modalCardOpaqueModified`.
- Before the banner renders there is no inner card, so the drawer looks right. Once the banner appears, it qualifies as the "inner card", the drawer gets scrim treatment, and nothing repaints it (no open transition, and it's no longer tracked). This matches "the donation banner may be involved".
- `visitOverlayModalWalk` (1781) has the same flaw on two paths: its fall-through for the 'ambiguous' nav state, and the non-ARIA fixed covering-sheet scrim branch added in the baseline commit.
- Other MediaWiki/Fandom sites with fixed drawers that contain a card take the same path.

### 8. Layers & overlays: geometry guessing instead of authored paint (high confidence from code; Airbnb specifics to confirm with HUD inspect)
- **The flaw.** The universal rule (content.js:986) sets `background-color: transparent !important` and `backdrop-filter: none` on every layout tag before any JS runs. After that, `getComputedStyle` can't tell whether the site's original layer was opaque, so every repaint decision is a geometry guess.
- **Fixed/sticky** (`visitStickyElement` 2222 → `shouldSkipStickyElement` themeHeuristics.js:1869) paints `--aura-bg` unless a geometry veto fires:
  - `childOpaqueCoverageFrac >= 0.35`: the Airbnb explore header contains a full-width white search pill → counted as "self-opaque" → skipped → see-through header. Also kills frosted (translucent + blur) headers.
  - `childCoverageFrac < 0.5`: a 3-item bottom tab bar (Explore/Wishlists/Log in) → skipped → transparent toolbar. Same rule suspected for Reddit (#4).
- **Overlays.** `isOverlayCoveringSheet` (≥ 75% vw and ≥ 45% vh) is treated as "scrim". `paintOverlayScrimAsTransparent` (1551) then makes the element transparent and paints whatever `findInnerModalCard` picks.
  - **Airbnb cookie card** (~87% vw × 57% vh) qualifies → the card goes transparent and its text block becomes the "inner card" → only the text column is opaque; the login form shows at the card edges ("cut off").
  - **Wikipedia drawer (#6):** same path; the donate banner is the "inner card".
- **Layout.** No Aura CSS rule or inline `setProperty` changes geometry: all inline writes are color/background/visibility/filter (grep, Oct 23). The only geometry declarations are the Wikipedia `border` lines. The "header touches search bar" look is most likely the missing opaque header band rather than real spacing. Session 2's layout diff confirms or refutes this.
- **How others avoid it.** Dark Reader/Noir-style engines never strip-then-guess. They transform each authored color, so opaque stays opaque, a dark translucent scrim stays a scrim, and a white card becomes a dark card, without any layout classification. Session 4 gets the same ground truth cheaply with the authored-paint probe instead of rewriting every stylesheet.

### 7. Light themes (untested; known gaps)
- The shield is always dark (see 2).
- `--aura-border` is `rgba(255,255,255,.15)`, invisible on light backgrounds.
- `visitBrightElement` returns early on light themes, which is fine, but nothing checks for **dark** surfaces left behind on light themes.
- Several Google/Reddit SITE_FIX fills assume a dark theme.
- Every fix must pass the light column in TEST_SITES.md.

### Dead or unnecessary code (approved cuts marked ✂)
| Cut | Why | ~Lines |
|---|---|---|
| ✂ `reopaqueExpandedContentPanels` + `classifyExpandedContentPanelState` | O(n²) textContent; only for the booking.com date picker | 250 |
| ✂ `reopaqueExpandedNavMenuPanels` (or restrict to nav candidates) | O(n²) link counts | 120 |
| Nav-drawer classification on every element → fixed/sticky only | O(n²) | refactor |
| ✂ `rethemeInlineHighlights` | parent textContent per span; churn | 80 |
| ✂ `rethemeLogoContrast` | canvas sampling per IMG; niche | 150 |
| ✂ `clearLoaderBackgroundImages` | churn every pass; niche | 60 |
| `promoteEngineStylesheet` every pass → rarely | full style recalc | small |
| Google JS passes → slim down (Session 6) | lag + drift | ~600 |
| `restoreAuthoredChromeOpacity` QSA per bar | duplicate 300-selector QSA | refactor |
| `tryDirectNativeSync`, 100 ms startup sync, visibilitychange sync | duplicate paths; background already syncs | 80 |
| ✂ Time-based day/night (content 60 s timer + background) | only set from Focus Mode screens | 60 |
| **Keep** `nativeDarkModeEnabled` / `gatherNativeDarkModeInfo` | Shipping UI exposes it: the "Dark Mode" switch in `src/screens/SafariScreen.tsx:234` (registered in App.tsx:53). Not cut, per your rule. Optional perf: cache the stylesheet scan per page. | — |
| `all_frames: true` for ad frames | engine runs in every iframe | config |
| Kept: split themes | user-facing presets | — |
