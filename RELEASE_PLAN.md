# Aura — Release Plan (ship by Nov 23, 2026)
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

## Nov 5 phone findings (after Session 4)
DOM read live in Chrome where noted. "Pre-S4" means the screenshot was taken before the Session 4 build.
- **Bearbottom "Find my size"** (pre-S4): the page's color swatches show through the panel.
  - DOM: `.ff-backdrop` (role-less, fixed, z-index 100000, `rgba(0,0,0,.55)`) contains `.ff-modal` (`[role=dialog][aria-modal]`, white, full width × 76% of the height).
  - The old covering-sheet "scrim" path cleared both. **Fixed by Session 4**; B-2 passed on the phone Nov 5.
- **Airbnb category chips** (on the S4 build): a square theme-colored box around each emoji.
  - DOM: the emoji `<video>` sits in a transparent 28×28 `position:absolute` span inside a clickable `a[role=tab]`. `isLikelyFloatingIconControl` matches it, so `visitFloatingIconControlElement` paints `--aura-overlay`.
  - A remaining paint-by-shape pass. **Fixed in 5B**; A-4 passed on the phone Nov 5.
- **Bearbottom chat launcher** (pre-S4): a square box around a round button. Same category. **Fixed in 5B**; passed on the phone Nov 5.
- **Wikipedia "Banner logo"**: a bordered alt-text box where the banner image should be. Not reproduced in 5B; W-4 passed on the phone Nov 5.
- **Walmart "Spanish/Español now available" tooltip** (pre-S4): transparent body over the order timeline.
  - A non-ARIA, absolutely positioned popover; no pass handled that shape. **Fixed in 5B**; X-6 passed on the phone Nov 5.
- **Walmart "See more shipping activity" and "Give feedback"** (pre-S4): a full-width white `<button>` strip and a white button with light text. Buttons. **Fixed in Session 6** (harness); phone check pending (X-6).
- **Google Forms checkboxes** (pre-S4): `div[role=checkbox|radio]` show their state through the box's background, which the universal rule strips. Unchecked boxes show white; a checked box blends into the background. **Fixed in Session 6** (harness, `fixture-forms`); phone check pending (F-1).
- **Google Forms "Autosave your work" dialog** (pre-S4): only the top of the card is painted, and the text overlaps the form.
  - Same "inner card" path Session 4 replaced. **Expected fixed**; re-check (F-1).
  - `docs.google.com` matched `isGoogleHost()` and the google.com SITE_FIXES. **Scoped away in Session 6.**

## Nov 13 phone findings (Session 6 build)
Your build of the uncommitted Session 6 tree, dark + light. Screenshots: `~/Downloads/IMG_0666…0675.PNG` (this build) and `IMG_0648…0658.PNG` (older builds, casual, last week).
- **Passed:**
  - Load-1/2: no unthemed frame, text colors right in the first frame.
  - Load-3: the bottom strip and toolbar switch to the new theme right away, so (a) is fixed.
  - F-1 Google Forms; B-1 / X-6 buttons.
  - AI Mode typing: input lag very low; the send and attach buttons are visible.
  - Regression rows all fine: Type-1, R-1/R-2, W-1..W-3, A-1..A-4, B-2, X-1..X-3.
  - urbanplates.com: works well overall.
- **Not passed / new** (fix by category; TEST_SITES row in brackets):
  1. **AI Mode composer text field transparent** [G-5, Type-2] (IMG_0675, 0674): answer text shows through the field; typed text and buttons are fine. The AI Mode sticky top bar (G logo + chevron) is also transparent, with text scrolling under it, and the fixed band under the composer is dark gray instead of the theme color.
  2. **Google "Keep things dark while you browse" bottom sheet transparent** over the results and AI Overview [G-4] (IMG_0666).
  3. **wikipedia.org portal fundraising banner transparent** (light theme): banner text over the language list; the WIKIPEDIA wordmark looks white on the light background [W-5] (IMG_0669).
  4. **R-3 "Save Draft?" sheet:** themed and readable, but the backdrop is solid theme color instead of a dimmed scrim. Discard is dark and Save blends into the theme; both should keep a fill that stands apart from the sheet, as with Aura off. [R-3, criteria updated]
  5. **Amazon product photos nearly black** on a dark theme [B-3] (IMG_0672 vs Aura off 0673). Likely cause: `mix-blend-mode: multiply` images over a tile that is now dark.
  6. **Reddit black squares at the "N more replies" thread connectors**, light and brown themes [R-4] (IMG_0668, 0667). Not known when they first appeared.
  7. **github.com (Aura on): Safari's status bar and toolbar stay white** while the page and menu are dark [X-7] (IMG_0670, 0671).
  8. **Floating-label inputs** [F-2] (urbanplates checkout; also seen on other sites). Before this build the label text sat on the input's top border line; now a small white box sits over the label and reaches into the border. Likely shape: a label whose authored background masks the border line, now kept as authored white. Item 6 may be the same category (an element that paints its container's color to hide a line). The "text shifted down" you saw on other sites before this build is most likely this shape.
  9. **X-4 and X-5: decided Nov 13, fix both** (see "Found, not fixed" in Session 6).
- **Older-build screenshots, not confirmed on this build** ("look a little different" now): go on the next phone check, not fixed blind.
  - Walmart menu: white "Language" / "Country" rows with light text (IMG_0650).
  - Airbnb: white search pill and chips with low-contrast text, white edge fade on the category row (IMG_0648).
  - Urban Plates: sticky "Beverages" bar, checkout panel and cookie banner transparent (IMG_0656, 0657, 0655).

## Nov 14 phone findings (Session 7 build)
Your build of the uncommitted Session 7 tree, dark + light. Screenshots: `~/Downloads/IMG_0677…0694.PNG`.
- **Passed, no regressions seen:** R-4 Reddit squares, B-3 Amazon photos, X-5 native Dark Mode ("working quite well"), X-4, Airbnb search pill, all regression rows.
- **Not seen:** G-4 and W-5 (you weren't sure where to look; TEST_SITES now says when they appear).
- **Still failing / new** (fix by category; TEST_SITES row in brackets):
  1. **AI Mode composer field still transparent** [G-5] (IMG_0683, 0682, 0684). The Session 7 fixture guessed the shape wrong (composer inside `#rso`); needs the real DOM.
  2. **No tint behind the expanded composer** [G-7] (Aura off: IMG_0686, 0685). With Aura off the page behind an expanded composer is dimmed, which tells you to tap out of it; themed, there's no dimming. Hypothesis: a black full-screen layer dimmed with CSS `opacity`: its fill reads as opaque black, the overlay rule paints it `--aura-overlay` (= theme bg), and at reduced opacity over a theme page it's invisible. `readAuthoredPaint` doesn't read `opacity`.
  3. **AI Overview "Show more"** [G-6] (themed IMG_0687 vs Aura off IMG_0688): the collapsed text should fade into the background behind an opaque button; themed, the text runs under a see-through button. Likely the expander/fade marks (`markGoogleAiOverview`, `GOOGLE_AI_EXPANDER_SELECTOR`) no longer match. **The most important item.**
  4. **White edge fades** [X-8], dark themes: GitHub carousel rows (IMG_0677; Aura off 0678), Airbnb "Inspiration" category row (IMG_0681), WebMD tab row's right edge (IMG_0690, 0691). Gradient overlays (an element or `::before`/`::after`) outside fixed/sticky roots, so 7-1's gradient repaint never runs on them.
  5. **Light buttons/chips with light text** [X-9]: Reddit "Save Draft?" Save is white with light theme text (IMG_0689); Airbnb category chips are white pills with link-colored text (IMG_0681). You suspect more sites. Causes to check: `H.effectiveBackground` ignores background-image (gradient pills); button text in nested shadow roots/slots that `settleButtons` doesn't reach.
  6. **F-2 still failing on dark:** Urban Plates' focused First Name label is a white box (IMG_0680; light theme fine, IMG_0679). Likely `:focus-within` CSS gives it the white fill and moves it with no DOM mutation, so no pass re-evaluates it (no focus listener exists).
  7. **WebMD hero unreadable** [X-10] (IMG_0691, 0693, 0694; Aura off IMG_0692): a light decorative background image is kept and the text is themed light. **Decided Nov 14: drop decorative background images on large text sections and theme the section; keep photos and give their text a dark scrim.**
  8. **Safari tint:** X-7 GitHub status bar/toolbar still keep site colors. New [Load-4]: theme off → reload → theme on live, the bottom bar stays white until a reload (WebMD, IMG_0693).
  9. **Urban Plates "Beverages" sticky bar still see-through** [U-1]; **Walmart "switch to another country" popup transparent** [X-11].
  10. **Walmart ☰ menu flash** [X-11]: opening/closing the menu briefly flashes the top bar and the menu before it settles. Likely the debounced pass painting after the class toggle.
- **Decided Nov 14, changed Nov 15:** no HAR recording or HUD inspects (the Debug/WebKit steps aren't practical). Session 8 reads the live DOM through Claude in Chrome instead, and builds fixtures from that and the screenshots.

## Nov 16 phone findings (Session 8 build)
Your build of the uncommitted Session 8 tree, dark (incl. a green and a gray preset) + light. Screenshots: `~/Downloads/IMG_0702…0709.PNG`.
- **Passed:** Google AI Mode (G-5 composer, G-7 tint, Type-2: "fully ready"), the AI Overview in general, X-8 fades, X-10 WebMD, X-11 ☰ menu flash, X-9 Airbnb chips, and every other row not listed below. Typing on Google and Reddit: at most very slight lag ("might be placebo").
- **Still failing / new** (TEST_SITES row in brackets):
  1. **Google "Show more" still see-through** [G-6] (IMG_0709, the "uc davis" entity panel): text runs under a see-through button with no fade, and text below the button shows through too. Now on every search tested, though the correct fade was seen a couple of times. Session 8's fix came from desktop Chrome's DOM; the phone's markup (or timing) differs.
  2. **Reddit "Save Draft?" Save** [X-9/R-3] (IMG_0708): near-white fill, white text (invisible); Discard fine. Likely: the button sits in a nested shadow root, which since 8-2 gets only the sheet copy, so `settleButtons` never reaches it.
  3. **Urban Plates focused label still a white box** [F-2] (IMG_0706 "First Name", IMG_0703 "Search by city or zip"): white text on white, dark theme. Session 8's focusin path doesn't take on the real page.
  4. **Urban Plates sticky bars see-through** [U-1] (IMG_0704: the "Plates" category bar over "Chicken Tender Plate"; the top header area in IMG_0703/0706).
  5. **Urban Plates popups transparent** [F-3, new]: "No suggested addresses found" dropdown with the restaurant list showing through (IMG_0703); the "Enter First Name, Last Name, Email, Phone" validation bar over "Guest Checkout" (IMG_0705). Also thin white vertical lines up the card's edges (IMG_0705/0706).
  6. **Walmart "Spanish / Español" popup see-through** [X-12, new] (IMG_0707), over "How do you want your items?". Same family as the country popup (8-7).
  7. **Airbnb photo pills see-through** [A-5, new] (IMG_0702): "Guest favorite" and "Prices include all fees" on listing photos. Known since Session 6 (divs, stripped).
  8. **Original-color flash on load** [Load-1]: sometimes, repeat visits too, Airbnb especially. The per-site theme cache (Session 6) should theme the first frame, so: a cache miss, Safari injecting after first paint, or site CSS beating the cached sheet briefly.
  9. **White flashes over buttons/text on dark themes** [Load-5, new]: during load, when new content appears, and on tap / opening menus. Likely the site's own CSS transitions animating from the authored white to Aura's paint (sheet apply, the site's class toggles, JS writes not snapped) and surfaces only Aura's JS paints, which wait for the debounced pass. Needs a per-frame background metric before fixing.
- **Decided Nov 16:** (1) contrast pass inside shadow roots: yes, if Reddit/hydration typing holds; (2) keep the blended-button change; (3) U-1 and the popups in Session 8b.

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

## Schedule (re-dated Nov 13: deadline moved to Nov 23)
| Session | Date | Scope |
|---|---|---|
| 2 | Oct 23 ✓ | Debug HUD + inspect + quick wins (committed Nov 4 as `57b516a`) |
| 3 | Nov 4 ✓ | Test harness + input lag |
| 4 | Nov 4–5 ✓ | **Layer & overlay engine**: absorbs the old Session 6 Wikipedia/Reddit items (code + harness done; on-device check pending) |
| 5 | Nov 5 ✓ | Small surfaces (5B) + load flash / light base (5A); phone check passed Nov 5; committed as `96f28c1` |
| 6 | Nov 5 ✓ (pulled forward from Nov 7) | Theme cache + old-theme back layer + late text colors + buttons/controls + Google AI lag; phone check Nov 13 mostly passed; committed as `05121ac` at the start of Session 7 |
| 7 | Nov 13 ✓ | Session 6 committed (`05121ac`); Nov 13 phone findings 1–9 incl. X-4 and X-5; phone check Nov 14 passed |
| 8 | Nov 15 ✓ | Nov 14 phone findings (Google AI first), live DOM read through Claude in Chrome; phone check Nov 16 (AI Mode passed); commit at the start of 8b |
| — | Nov 16 ✓ | Phone check of Session 8: Google AI Mode passed; G-6, X-9 Reddit, F-2 still failing; new popups/flash rows (see "Nov 16 phone findings") |
| 8b | Nov 17–18 | Commit Session 8; G-6 from phone-shaped DOM, Reddit Save (nested shadow), shadow-root contrast, Urban Plates (F-2, U-1, F-3), Walmart popups, Airbnb photo pills, white flashes, load flash |
| 9 | Nov 19–20 | Regression + App Store submission |
| — | Nov 21–22 | Buffer / resubmission |
| — | Nov 23 | Deadline |

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
- [x] Scroll handler tracked-only. Done in Session 4.
- [ ] Remaining approved cuts (in-place nav panels, inline highlights, logo inversion, loader images, time-based day/night). **Not done:** each cost < 3 ms per pass on the fixture after slicing, so they no longer cause lag. Cutting them removes visible behavior that I couldn't verify visually here.
- [x] Gate nav-drawer classification to fixed/sticky. Done in Session 4.
- [x] ~~Cut Native Dark Mode~~ → **kept**: verified Oct 23 that SafariScreen's "Dark Mode" switch sets `nativeDarkModeEnabled`. Include it in the Session 9 regression pass.
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
- **On-device check (Nov 4, your build of `6b0b644`):**
  - Reddit early typing: **much better**.
  - Google AI Mode typing: **better, but still slightly slow** → follow-up in Session 6 (Google-only lag sources below are untouched: `body:has()` SITE_FIX rules, the dedicated Google repaint observer, and the composer passes on keystrokes).
  - booking.com (the removed content-panel pass's target): **looks good**.
  - Wikipedia drawer still goes transparent after ~3 s: expected; that's Session 4.
- **Signing (Nov 4):** the Apple Development certificate expired Nov 4, 11:08 AM PT, and Xcode replaced it. The new team profiles are valid for only 7 days, which usually means a free (Personal Team) account. **Before Session 9 (submission), confirm the paid Developer Program membership for team `4JV5Y33KJB` is active and that a valid Apple Distribution certificate exists.**
- **Simulator:** `sim.sh` is written, but the Debug build failed at the dSYM step with "No space left on device". The Mac had 40 MB free; my 2.4 GB scratch build was deleted, leaving 2.4 GB. A full RN Simulator build needs more than that.
- **Harness fix:** typing runs whose keydowns don't pair 1:1 with sent keys are now flagged INVALID and left out of medians. 2 of the 3 old-engine light runs showed negative latencies before this.
- **Still needed:** live Reddit/Google numbers from `npm run harness -- --sites reddit-post,google-aimode --repeat 3` with WebKit. Then the full-site regression run. Both need a machine where Playwright WebKit can start and reach the internet.

## Session 4 — Layer & overlay engine (root cause 8; absorbs old Session 6 Wikipedia/Reddit) — done Nov 4, on-device check pending
- [x] Probe primitive `readAuthoredPaint(els)` (content.js section 3c-bis):
  - The universal rule, the white-inline rule, the SPA-root rule and the static ARIA-overlay rule get `:where(:not([data-aura-probe]))` (zero specificity). Shadow-root and iframe copies get it too (same sheet).
  - A batch is flagged with `data-aura-probe` + `data-aura-notrans` (`transition: none`), read in one recalc, and unflagged in the same task. `data-aura-notrans` comes off on the next frame.
  - Aura's own inline background writes (any pass) are lifted for the read and put back. The site's own inline paint is saved before the engine's first write.
  - Cached per element by `className`; a class/style mutation inside a tracked root forces a re-read for that root.
  - No mutation records: `data-aura-*` isn't in the attributeFilter, and lifted inline writes happen inside a slice (discarded).
- [x] Pure verdict `classifyAuthoredPaint(paint, mode)` in themeHeuristics.js (14 jest cases): `opaque` (alpha ≥ 0.5, or any tint behind a backdrop blur), `scrim` (overlay mode: dark, 0.05 < alpha < 0.95, no blur), `clear`.
- [x] Fixed/sticky rule. `visitStickyElement` hands every visible fixed/sticky element to `evaluateAuthoredLayer`:
  - It probes the root plus descendants to depth 3 (overlay: 6) that are ≥ 40% of its width (overlay: 30%), skipping controls/media and nested fixed/sticky elements (those are their own roots). It also looks inside a host's open shadow root (Reddit's bars).
  - It paints the first authored-opaque node per branch (`--aura-bg`; overlay `--aura-overlay`) and stops there. It never paints an authored-transparent node.
  - `stickySkipReason` keeps only identity/visibility vetoes (skip-tag, masked, hidden, overlay-chrome, AMP, zero-size). The full-viewport, covering-sheet, too-tall, z-index ≥ 2000, child-coverage and child-opaque-coverage vetoes are gone. A fixed covering sheet goes through the overlay rule instead.
  - `reopaqueTopChrome` no longer paints or clears fixed/sticky bars or anything inside them (the layer engine owns them); its fixed-inner branch and `findFixedChromeDescendant` are removed.
- [x] Persistence:
  - Scroll + resize (window and visualViewport), 200 ms throttle: re-check tracked roots only, using cached probes. `reopaqueStickyFixed` and the full-document `reopaqueTopChrome` scroll walk are removed.
  - Class change: the root is marked dirty and re-probed on the next pass, even when that pass is scoped below the root.
  - Style rewrite: the observer callback puts the paint back in the same microtask, saves the site's new inline paint, and marks the root dirty.
  - New nodes inside a tracked root (the donate banner) re-evaluate the root.
- [x] Overlay rule, replacing `isOverlayCoveringSheet → paintOverlayScrimAsTransparent → findInnerModalCard`:
  - `reopaqueOverlays`: a covering ARIA overlay goes through the rule; the wrapper gets explicit `transparent` because the static CSS paints it. Kept from the old path: if nothing in an ARIA overlay is authored-opaque, it keeps the flat sheet. **Smaller ARIA menus/listboxes/popovers keep the old flat `--aura-overlay` sheet** (decided: their real surface is often an unstyled ancestor popup outside the root; Google suggestions are the risk).
  - `visitOverlayModalWalk`: the non-ARIA fixed covering sheet, the modal card, and the expanded nav drawer all go through the rule.
  - The z-index ≥ 1000 modal-card veto stays (fox5-class shells). Nav drawers stay exempt from it.
  - `paintOverlayScrimAsTransparent`, `paintModalCardSheet` and `revertGrownModalCards` are removed. Google Images' viewer keeps its own opaque sheet.
- [x] Nav-drawer classification is gated to fixed/sticky. **The collapsed → expanded transition gate is removed** (with `navDrawerStateHistory`): its job was to stop link-rich ambient chrome being painted on shape alone (store.hypixel.net). The authored rule already leaves a transparent link row unpainted, and the gate was what left Airbnb's header unpainted (it classifies as an "expanded drawer"). wtatennis.com stays excluded by host.
- [x] Layout invariance: `__tests__/layoutInvariance.test.js` (in `test:engine`).
  - It scans content.js/injected.js/splitTheme.js generated CSS and every `setProperty`, plus direct `.style.x =` and `cssText` writes, for padding/margin/size/inset/border(-width/-style)/display/position/transform/flex/grid/gap/font metrics/box-sizing/zoom.
  - Allowlist: the Wikipedia `.infobox/.navbox/...` 1px border (Minerva already draws 1px; only the color changes), and the split-theme `html::before` layer.
  - Found and fixed one real case: `border: none` on Wikipedia's footer Codex buttons shrank them by the border width. It is now `border-color: transparent`.
- [ ] Per-site rules: none added. The unverified Reddit `shreddit-subreddit-header` SITE_FIX is **kept** until R-2 is checked on device. The general rule now covers that shape (fixture-shadow-bars), so remove it if R-2 passes without it. Then the wtatennis/github host exclusions are the only layer exceptions.
- Unused now (kept, still unit-tested; delete in a cleanup): `findInnerModalCard`, `findInnerDialogPanel`, `isLikelyNonAriaFullscreenPanel`, `isNavDrawerOpenTransition` (the menu-panel pass still uses it), `childCoverage`-era docs in themeHeuristics.js.
- **Harness:** four new offline fixtures (see tools/harness/README.md): `fixture-wiki-drawer`, `fixture-airbnb-explore`, `fixture-airbnb-login`, `fixture-shadow-bars`. Also a second paint dump after scrolling (`paint-scrolled`), and `--compare` lists up to 60 differing elements.
- **Numbers** (Chromium headless, idle Mac, median of 3, dark; light within noise). Before = `c23baa1` via git worktree + `AURA_EXT_DIR`, same run:
  | Fixture | Layer state, before → after (dark and light) | Longest Aura task (median) | Aura ms load+5 s | Aura ms during scroll | Layout Δ |
  |---|---|---|---|---|---|
  | wiki-drawer | drawer cleared at open (~1.0 s) and stays cleared; a menu section painted as "inner card" → drawer opaque from open through banner + scroll | 10 → 11 | 43 → 47 | 8.0 → 2.1 | 0 → 0 |
  | airbnb-explore | header + tab bar transparent (listing text visible through the header) → both opaque, including after the class flip and the full `style` rewrite | 11 → 10 | 38 → 44 | 15.4 → 3.3 | 0 → 0 |
  | airbnb-login | card cleared, only `.copy` painted, backdrop cleared, tab bar transparent → whole card opaque, backdrop kept at 45%, tab bar opaque | 13 → 12 | 34 → 32 | 1.1 → 1.2 | 0 → 0 |
  | shadow-bars | host painted (by geometry) → surface inside the shadow root painted; same look | 9 → 10 | 25 → 22 | 6.7 → 2.8 | 0 → 0 |
  | hydration | unchanged look (see paint diff) | 15 → 15 | 141 → 133 | 28.2 → 20.4 | 0 → 0 |
  - Typing on hydration, first 4 s p50/p95/max: 25/32/35 → 26/35/47 (dark), 28/35/51 → 26/34/36 (light). Settled is unchanged. 0 keys over 100 ms either way.
  - Tasks ≥ 50 ms: 0 in every median run. One of 18 new-engine hydration loads (the first themed load of the batch) had a single 55 ms task outside every timed sub-pass. 6 + 6 extra loads per engine didn't reproduce it (top tasks 12–16 ms for both engines).
- **Paint diff, every element that paints differently** (before → after, dark and light, at +5 s and after scroll):
  - explore `div.hdr`, `nav.tabbar`: transparent → theme bg. The fix.
  - login `nav.tabbar`, `div.cookie-card`: transparent → theme bg; `div.cookie-scrim`: transparent → authored `rgba(0,0,0,.45)`; `div.copy`: theme bg → transparent (now inside the opaque card). The fix.
  - wiki `ul.menu-section`: theme bg → transparent. It was the old "inner card"; it now sits inside the painted drawer. The drawer itself flips in the old engine (see the per-frame timeline), so at the +5 s sample both happened to read opaque.
  - hydration `reddit-header.bar` (sticky host, no paint of its own): theme bg → transparent. Its sticky white `nav` inside the shadow root is painted in both, so it looks the same.
  - shadow-bars `top-header`, `subreddit-bar` (hosts): theme bg → transparent; `›div.wrap`, `›div.row` (their real white surfaces): transparent → theme bg. Same look; the paint now sits on the surface the site painted.
  - Everything else: 0 differences (7417 hydration elements, all unthemed runs).
- Known gaps:
  - A layer painted via one of the CSS variables Aura hijacks to `transparent` (`--background-color-neutral-subtle`) probes as transparent.
  - A cookie card inserted after load is transparent for one debounce (~150 ms) before the pass paints it. This is pre-existing and goes with Session 5.
- Test: TEST_SITES A-1..A-3, R-1, R-2, W-1, W-3, X-2 (curtain must not return), dark + light; HUD layout diff = 0 on Airbnb explore. HUD inspect now shows `authoredLayer` (opaque/scrim/clear), `layerRoot` (mode/source) and `layerPaint`.
- **On-device check Nov 5: all Session 4 rows pass.**

## Session 5 — Small surfaces + load flash + light-theme base (Blocker 2, 7) — done Nov 5, on-device check passed
Session 4 committed first as `9c5f68f` (the A/B baseline). Session 5 committed Nov 5 as `96f28c1` at the start of Session 6.
- **On-device check Nov 5: all Session 5 rows pass** — A-4, B-2, X-6, W-4, Load-1/2/3, dark + light, plus the light-theme borders and photo close/share scrims. No HUD load timings were recorded, because no load flashed during the check.
### 5B — Small surfaces
- [x] Floating icon controls decide by authored paint (content.js 3d-bis):
  - `isLikelyFloatingIconControl` only nominates. The element goes through `evaluateAuthoredLayer(el, 'overlay', 'icon')`:
    - a dark translucent scrim keeps its authored color
    - an opaque fill becomes `--aura-overlay`
    - a transparent element is never painted; an authored-opaque child (a round button) is painted instead
  - A fixed/sticky element the layer rule already owns is left to it. That was the chat launcher's square: the sticky rule left the transparent wrapper alone, then the icon pass painted it.
  - Fixes the Airbnb emoji boxes. The old inline-write path and `floatingIconControlModified` are gone.
- [x] Non-ARIA positioned popovers (`visitPopoverElement` → `smallSurfaceSteps`):
  - Nominated: `position:absolute`, z-index not `auto`, at least 40×24, not a covering sheet, not ARIA/search chrome/ad.
  - Decided: a root the site painted opaque or with a dark scrim goes through the overlay rule. A transparent one is never painted (caption and badge wrappers stay as they are).
  - Cost: the walk's existing style read; one batched probe per pass for all nominees (icons + popovers), cached by class. Light DOM and shadow roots both.
  - Tooltip arrows: in overlay mode, a small (≤ 24 px) absolute, empty child painted the **same authored color** as the card it sits on is painted with the card (`addOverlayNubs`). A pseudo-element (`::before` border triangle) arrow is not reachable and stays the site's color.
- [x] Engine: `evaluateAuthoredLayer` probes the root first and skips the descendant walk when the root is authored-opaque (same result, fewer probes). Icon/popover roots that paint nothing aren't kept in `layerRoots`, so scroll re-checks stay small.
- [x] Audit of the other shape-based opaque paints:
  - `reopaqueTopChrome` outer paint: a non-fixed top bar is painted only when the site painted it opaque. A header the site left transparent (laid over a hero) stays transparent, and its insides are left to the universal rule. The inner `!important`-surface paint also needs the probe to agree.
  - `restoreAuthoredChromeOpacity`: the `!important` stylesheet scan only nominates; one batched probe per pass confirms. It catches `background: url(…) !important` (a transparent color that passed the text filter) and later or more-specific site rules that win.
  - `visitNavMenuPanelElement` (in-place menus): the collapsed → expanded gate still decides when the panel counts as open. What gets painted is the overlay rule's call (source `navpanel`), like a drawer. A panel that is already a fixed/sticky root is left to that rule.
  - `paintOverlaySheet` for small ARIA menus/listboxes/popovers: **kept**. Their real surface is often an unstyled popup ancestor outside the ARIA root. Moving them would leave a stripped popup with only a highlighted row painted (the Google suggestions risk; same reason as Session 4). The covering-ARIA path already uses the rule.
- [~] Wikipedia "Banner logo" box: **not reproduced.** In Chrome (where Aura doesn't run), I forced both mobile fundraising banners live in the US on Nov 5 (`B2627_110303_en6C_m_p1_lg`, `B2627_110502_en6C_m_p2_sm`, campaign `WMF_FR_FY2627_en6C_m_0701`). Neither has an element labeled "Banner logo"; their Wikimedia logo is an inline `<svg class="frb-wmf-identity-logo skin-invert">`, and the donate-drawer gif has `alt=""`. Needs from the phone: HUD inspect of the box (tag, class, src), and whether it also shows with Aura off for that site. New TEST_SITES row W-4. **W-4 passed on the phone Nov 5** (no box). Keep W-4 in the Session 9 regression pass in case the banner campaign rotates back.
- [x] Fixtures: `fixture-airbnb-chips`, `fixture-popover`, `fixture-bearbottom-fit` (see tools/harness/README.md).
- **Paint diff vs `9c5f68f`** (all 8 fixtures, dark + light, +5 s and after scroll). Every element that paints differently:
  - chips `span.ico` ×4: theme bg → transparent (the A-4 fix).
  - chips `div.chat` (transparent square wrapper): theme bg → transparent. Its round `div.bubble` is painted in both.
  - chips `span.close` (authored `rgba(0,0,0,.5)` scrim): theme bg → authored scrim, white text.
  - chips `span.share` (light only): text `#222` → theme text. The background is the same in both: before, the shape pass painted the background without the text.
  - popover `div.tip`: transparent → theme overlay; `span.arrow`: white → theme overlay (the X-6 fix).
  - wiki `nav.navigation-drawer` (+5 s only): theme bg → transparent. It's an in-flow wrapper the site leaves transparent, which the top-chrome pass painted by shape; it sits on the themed page either way. The drawer itself is unchanged.
  - Everything else: 0 differences (hydration 7417 elements, explore, login, shadow-bars, bearbottom). Bearbottom B-2 was already correct on `9c5f68f`.
- **Timing:** the Mac was busy during every run (Safari + WindowServer; load average 7–13), so these are noisy.
  - Order-alternated hydration, median of 4: longest Aura task dark 22.5 → 18.7 ms, light 21.1 → 15.6 ms; Aura ms dark 201 → 232, light 194 → 162. Both engines had single 42–63 ms outliers. Tasks ≥ 50 ms: 1 in 24 new-engine loads, 0 in 24 old-engine loads; same pattern as the Session 4 note.
  - Small fixtures: longest task 9–14 ms on both engines; scroll re-check 0.5–4.5 ms on both.
  - Layout Δ 0 on every load.
  - **Rerun the A/B on an idle Mac before Session 9 (submission).**
### 5A — Theme load flash + light-theme base
- [x] Cause, as far as the harness can measure. Harness addition: `AURA_HARNESS_STORAGE_MS` delays storage; `firstPaint` is recorded.
  | Storage latency | 5 ms | 50 ms | 200 ms | 500 ms |
  |---|---|---|---|---|
  | Storage resolved → CSS applied (Aura's own work) | 0.7–1.2 ms | 1.5–2.3 ms | 2.1–4.3 ms | 2.0–4.1 ms |
  | Page on screen without Aura CSS (hydration, explore) | 0 ms | 0–9 ms | 151–159 ms | 444–461 ms |
  - Aura's own work after storage is ≤ 4 ms. The flash is the time before storage resolves (or before injection), and that's only visible on the phone.
  - **Phone check (Debug build, `#aura-debug`)**: on a flashing load, read the HUD's script-start vs `responseEnd`, storage-resolved and CSS-applied.
    - Late script start → late injection (Preload Top Hit / extension wake); nothing in-page can fix it.
    - Long script-start → storage gap → slow storage; only a synchronous theme source fixes it (decision below).
- [ ] ~~Static `aura-base.css`~~ → **not done.** It still waits for the theme from storage, so per the table it saves at most ~4 ms. Worth doing only together with a synchronous theme source (decision below).
- [x] Light-theme shield → **decided Nov 5: option (c), a per-site theme cache in the page's `localStorage`.** Built in Session 6 (item 6-0).
  - Rejected: (a) keep the shield dark (light-theme users flash dark); (b) follow `prefers-color-scheme` (worse for dark-theme users on a light OS).
  - Accepted costs:
    - a site's first visit behaves like today
    - after a theme change, each site shows the old theme once, on its first load
    - stale keys stay in sites' storage
  - The "site can read the key" concern doesn't matter in practice: Aura's injected styles and `data-aura-*` attributes already show sites that Aura is running.
- [x] Cold cache: background already syncs on its own load (`background.js:253`). content.js's fixed 100 ms `requestThemeUpdate()` timer is gone. content now asks once, right after its storage read, only when storage is empty. A slow read, or a site with the theme turned off, no longer costs a native round trip.
- [x] `--aura-border` is black-alpha (`rgba(0,0,0,.15)`) on light themes. Elevation tokens were already flat `var(--aura-bg)`, so they're theme-aware.
- Test: TEST_SITES "Load" rows (cold-launch Safari, Preload Top Hit), dark + light, with the HUD numbers above. A-4, B-2, X-6, W-4.

## Session 6 — Theme cache (Blocker 2) + Google AI Overview / AI Mode (Blocker 3) + buttons (Blocker 5) — done Nov 5, phone check Nov 13: mostly passed (see "Nov 13 phone findings")
Session 5 committed first as `96f28c1` (the A/B baseline, worktree `../Aura-s5`). Session 6 is **not committed** until the phone check.
- **What the user sees on load (Nov 5):** (a) after a theme change, the old theme stays in the back layer, usually the strip at the bottom of the screen; (b) some text colors catch up 1–2 s after the rest.

### 6-0 (a) Old theme in the back layer
- [x] Harness: `--scenarios switch` (theme A → storage switched to B live → reload with B → theme off live → reload) dumps every surface that carries a theme color, plus the mean color of the screen's bottom 60 px. New fixture `fixture-theme-color` (two `media=` theme-color metas, inline html + sheet body backgrounds, a short page, a shadow host, a same-origin iframe).
- **Surfaces and what held the old theme** (before the fix):
  | Surface | Live A → B | Theme off |
  |---|---|---|
  | html/body inline + sheet, `color-scheme`, shield | B at +0 ms | removed |
  | `<meta name="theme-color">` | **only the first meta** got B. The site's `media="(prefers-color-scheme: dark)"` meta kept the site's own color, and Safari tints the toolbar / status bar / the area around the page from the meta matching the OS appearance | **kept Aura's color**; nothing restored the site's value |
  | Shadow-root sheet copies | **A until the next pass reached each root** (`removeTheme` used `document.querySelectorAll`, which can't see into shadow roots) | **re-added with A** |
  | Same-origin iframe copies | A until the next pass | **re-added with A** |
  | Split `html::before` / `#aura-split-bg` | not used (split themes are off) | – |
  - Root cause of the "re-added" rows: `removeTheme` never cleared `currentTheme`, so mutation-triggered passes kept painting with the old theme after the theme was turned off.
  - **Most likely the phone's bottom strip: the theme-color meta.** With iOS in dark mode, Safari tints from the site's dark-media meta, which never got Aura's color. On a light theme it stays the site's dark color, which reads as "the old dark theme at the bottom".
- [x] Fix: one apply/remove path in content.js.
  - `applyTheme` / `removeTheme` own every surface: the sheet, html/body inline paint, the shield, **every** theme-color meta (each site meta saved and restored on remove; an Aura meta when the site has none), and shadow + iframe copies (tracked in a set, rewritten in the same task on a theme change, removed on theme off).
  - Every pass re-syncs metas the site adds after document_start.
  - `removeTheme` clears `currentTheme`.
  - injected.js no longer paints anything on `onChanged`; it owns only the shield and the shared storage read.
  - After: every surface is B at +0 ms on a live change and on reload; theme off restores the site's metas and leaves no copies.
- **Only the phone can confirm** whether Safari re-samples its toolbar / bottom-strip tint after a live meta change (WebKit tracks theme-color changes; Safari's own sampling is out of reach of the harness).
- [x] Shadow roots that re-render with `innerHTML` deleted Aura's sheet copy, and nothing re-added it, because the document observer can't see into shadow roots. Found on the Reddit-style draft sheet in `fixture-buttons`: the whole sheet stayed white with invisible text (R-3). Now a direct-children observer per shadow root puts the copy back in the same microtask and queues a pass scoped to the host.

### 6-0 Per-site theme cache (option c)
- [x] `themeResolve.js`: `serializeThemeCache` / `parseThemeCache`.
  - Stores exactly the fields `applyTheme` keys on, so a cached apply and the storage apply build the same sheet.
  - Validation: version 1, ≤ 2 KB, colors must be hex/rgb, the gradient ≤ 512 chars of a safe charset, the id ≤ 64 chars.
  - Never cached: theme off, native dark mode.
  - 4 jest cases (round-trip, gradient, never-cache, junk/oversize/injection).
- [x] **injected.js** reads `localStorage.__aura` synchronously (top frame only, try/catch).
  - The shield uses the cached background and `color-scheme`; with no cache (first visit) it follows `prefers-color-scheme`.
  - Ad / SafeFrame / AMP frames bail first, as before.
  - **Top frame only** because a frame's SafeFrame status is known only after its own scripts run, and an iframe shares the key with its origin.
- [x] **content.js** applies the cached theme through the same `applyTheme` at document_start (manifest order runs it right after injected.js). That makes it the shared CSS builder: no builder move needed.
  - Observers and listeners now attach before the storage await.
  - Storage reconciles through the same call: same key → no-op; changed → reapply + rewrite the key; off / nothing for this page → `removeTheme` + delete the key.
  - The key is written after each apply, only when it changed; never for theme off, native dark, AMP consent, or iframes.
- [x] Engine waits for `<html>` before applying. Safari runs document_start scripts after it exists; Chromium (the harness) doesn't.
- [x] Harness: `--keep-storage` (localStorage carries over; with `--repeat`, medians use the warm loads) and an "Unthemed ms" column (`cssApplied − firstPaint`).
- **Numbers** (second load, cache warm; median of the warm loads; dark and light alike):
  | Storage latency | Unthemed window, Session 5 → Session 6 |
  |---|---|
  | 200 ms | hydration 160–164 → **0**, explore 142–144 → **0** |
  | 500 ms | hydration 462–464 → **0**, explore 449–453 → **0** |
- Paint diff, cache-applied vs storage-applied load (same engine, every fixture, dark + light, +5 s and after scroll): **0 differences** (52 of 52 dumps).
- Costs as planned: a site's first visit behaves as before (shield in the OS appearance's colors); after a theme change each site shows the old theme once, on its first load; stale keys stay in sites' storage.

### 6-1 Time to fully themed (b)
- [x] Harness: `AURA_HARNESS_TIMELINE=1`.
  - Records every Aura inline color/background write with its Aura call chain.
  - Samples what's on screen every 100 ms for 6 s (12 × 24 point grid via `elementsFromPoint`, shadow roots pierced).
  - Reports each visible change after the first full pass and the write that caused it.
  - The first version scanned the whole document each sample and delayed Aura's own passes by seconds, so the grid replaced it.
- [x] New fixture `fixture-late-text`: post cards whose text is in `div`/`span` with authored dark colors (the sheet recolors `p`/`li`/`h1–6`/…, not `div`/`span`), hydrated into the viewport every 100 ms for ~2.5 s, plus 1500 off-screen rows. hydration / wiki-drawer / explore didn't show the shape (0 late Aura changes on Session 5).
- **Which passes wrote late colors** (Session 5, late-text, dark): `visitContrastElement` ×20, all visible text in the hydrated cards, at **4.98 s** (CSS applied at 0.09 s). Two causes:
  1. **`isStackedDuplicateLabel` was O(n²)**: every element re-read every sibling's `textContent`. A 1500-row list cost the contrast walk ~2.4 s of the 2.9 s Aura total, so the first full pass ended at ~4.7 s.
  2. **The 150 ms trailing debounce starves passes during hydration**: with mutations less than 150 ms apart, no pass runs until the page goes quiet, so hydrated text keeps the site's colors until then.
- [x] Fixes, by category:
  - The duplicate-label check counts each parent's child texts once per pass (a per-pass cache; jest: same answers with and without it). On late-text, Aura CPU drops 2.7–3.2 s → 0.62–0.68 s, and the first full pass ends at ~1.0 s instead of ~4.7 s.
  - **Fast contrast for added nodes**:
    - Where: the observer callback, i.e. before the next frame, so new text never shows a wrong color.
    - Scope: added subtrees of ≤ 300 elements, read all then write.
    - Writes only text that sits straight on the theme background (under an authored surface, the pass's bright/shell steps may still change the background, so that text waits: one change, not two).
    - Skipped while typing and until the first full pass has collected its elements (everything parsed before then is in that pass; running earlier forced style recalcs of the half-built page: a 25–30 ms task on cache-applied loads).
  - The per-element pre-passes (shells, pseudo-backgrounds, loader images, logo contrast, inline highlights, nav-menu panels) now run as sliced item steps. `rethemeOpaqueShells` alone was a single 40–100 ms task on late-text, the longest Aura task, in both engines.
  - A full-document pass drops the mutation records queued before it collects (attaching the observer before storage resolves had added a second, body-wide pass on every load). `applyTheme` discards its own writes' records.
  - Tried and dropped (no measured benefit or too costly):
    - batching contrast reads before writes (no change)
    - a 300 ms max-wait on the debounce: same 0 late changes as the fast path, but 2.5× Aura CPU on hydration (156 → 462 ms)
    - viewport-first ordering and moving rules into the sheet: not needed once the above landed
- **Time to fully themed after** (new engine, dark + light): **0 visible color changes after the first full pass** on late-text, hydration, explore, buttons, forms. The one remaining change in both engines is the wiki drawer, painted the moment it opens at 1 s: a user action, ≤ 1 sample.
- **Known gap:** hydrated *surfaces* (not text) still wait for the debounce, as before.

### Buttons (Blocker 5) + stateful controls
- [x] `H.buttonPaintDecision` (themeHeuristics.js, 8 jest cases):
  - a button's visible fill is its gradient's first stop if it has one (it paints over the background color, which on a `<button>` is often the UA's ButtonFace), else its authored background color
  - no opaque fill → left to the contrast pass
  - a full-width (≥ 80% of the parent), neutral fill against the theme → painted as a theme surface (`--aura-elevated`), theme text
  - otherwise → the fill is kept and the text set readable against it (`color` and `-webkit-text-fill-color` on the button, and on the descendants whose own color fails against the fill, so a muted subtitle keeps its gray)
- [x] `settleButtons`, light DOM and shadow roots:
  - nominated in the walk (`button`, `[role=button]`, `input[type=button|submit|reset]`)
  - one authored-paint probe batch; writes after all reads; earlier writes lifted before each re-decision
  - reverted on remove
- [x] The `color: revert` rule is gone. It reverted dialog buttons to the UA ButtonText, which is light under a forced dark scheme.
- [x] Stateful controls:
  - CSS: the universal strip now skips `[role=checkbox|radio|switch]`, `[aria-checked]` and `[aria-selected="true"]` (`:where(:not(...))`, zero specificity). A descendant clause would make every element's match walk its ancestors on every recalc, so the parts inside a control are read from the authored-paint probe instead.
  - `H.stateControlDecision`: a brand (colored) fill is kept, with the parts inside it as authored. A neutral fill against the theme becomes a theme highlight when the control is on and transparent when off, so on and off stay distinct. "Neutral" means chroma ≤ 40, which covers pale tonal tints like Material's `#e8def8`.
  - The bright-surface pass leaves state controls alone (it was clearing the selected tab).
  - `aria-checked` / `aria-selected` were added to the observer's attributeFilter, so a toggle re-decides.
- [x] The google.com SITE_FIXES and `isGoogleHost()` are scoped to Search / Images / AI Mode: `Resolve.GOOGLE_APP_HOSTS` (docs, mail, drive, …) is excluded, and `getSiteFix` takes an `exclude` list (2 jest cases).
- Fixtures: `fixture-buttons`, `fixture-forms` (served as `docs.google.com`). Before → after, dark:
  - Walmart "See more" strip: white slab → theme surface
  - "Give feedback": white text on white → black text on white
  - "Add to Cart": white text on yellow → black
  - Reddit-style draft sheet in a shadow root: white sheet, invisible text → themed sheet, "Save" with dark text
  - Forms: checked box purple and distinct; switch track invisible → visible; selected tab looked the same as unselected → highlighted
  - Light theme keeps the authored look.
- **Not covered:**
  - The Airbnb "Guest favorite" badge and "Prices include all fees" pill are divs (not buttons); they stay stripped with theme text, as before.
  - Text inside shadow roots still gets no contrast pass, except buttons (same as before).

### Google AI Overview / AI Mode (Blocker 3)
- [x] Offline fixtures served as `www.google.com`: `fixture-google-aimode` (AI Overview with the "Show more" fade; a streaming answer card; a fixed composer bar > pill > textarea that mutates on every keystroke) and `fixture-google-aimode-deep` (the card 9 divs deep, as on real Google).
- **Found: the Session 5 engine hangs on both fixtures** (renderer at 157% CPU and half the Mac's memory within a minute).
  - Cause: the composer's outer fixed bar and inner pill each got a dedicated repaint MutationObserver. Each observer's writes land in the other's subtree, and each drains only its own records, so they re-trigger each other forever.
  - Verified: with the outer-shell paint disabled, the Session 5 engine runs normally.
  - Chromium records a style mutation even for an identical value; whether WebKit loops forever or "only" churns is phone-only. **This is the most likely source of the remaining AI Mode lag on the phone.**
- [x] Fixes:
  - `body:has(...) #islrg/#islmp` → `html[data-aura-gimg-viewer]`, set by `paintGoogleImagesViewer`.
  - The unscoped `div:has(~ div …):empty` / `div:has(> …)` → `[data-aura-ai-fade]` / `[data-aura-ai-more]`, marked by `markGoogleAiOverview`.
  - The scoped `#m-x-content div:has(> span[role="heading"])` stays.
  - Answer card: marked once (`data-aura-ai-card`), cleared by one scoped sheet rule that also covers streamed-in content. Before, a dedicated observer rewrote every div/p/li/span inline per mutation.
  - The answer-root climb stops before an ancestor that holds the composer (it used to reach `<html>` on shallow pages and clear every icon button on the page).
  - Composer: marked (`data-aura-composer`) and painted by a scoped sheet rule; its dedicated observer is gone. The composer pass is skipped while typing once the composer is marked.
  - `attachDedicatedGoogleRepaintObserver` and its helpers are deleted.
- **Typing** (deep fixture; before = the Session 5 engine with the outer-shell observer disabled, the closest runnable "before"; unthemed 12/20/21 on the shallow fixture): see the A/B table below.
- [ ] Visual parity on real Google (G-1..G-3 side by side with Aura off): phone only.

### A/B vs Session 5 (`96f28c1`)
Chromium headless, Mac moderately busy (load 2.4–4.2), 4 rounds alternating which engine runs first, medians. Old = `96f28c1` (worktree `../Aura-s5`); for the AI Mode fixture, old = the same engine with the composer's outer-shell observer disabled (the real one hangs).
| Fixture | Longest Aura task, ms (dark / light) | Aura ms, load + 5 s (dark / light) | Tasks ≥ 50 ms | Layout Δ |
|---|---|---|---|---|
| late-text | 42.7 → **29.5** / 45.9 → **28.6** | 2779 → **592** / 3094 → **581** | 1 of 8 old runs → 0 | 0 → 0 |
| hydration | 15.0 → 15.2 / 15.0 → 15.2 | 152 → 171 / 149 → 163 | 0 → 0 | 0 → 0 |
| google-aimode-deep | 10.9 → 10.5 / 10.5 → 11.4 | 203 → 207 / 212 → 225 | 0 → 0 | 0 → 0 |
| explore, login, chips, popover, bearbottom, shadow-bars, wiki-drawer, theme-color | 9–15 → 9–13 (no fixture up by more than 1.7 ms) | within −8…+12 ms | 0 → 0 | 0 → 0 |
| buttons, forms | 9.5–11 → 10–12.5 | 13–24 → 25–28 (the new button/state passes) | 0 → 0 | 0 → 0 |
- Typing, keystroke → next frame, p50 / p95 / max:
  - hydration first 4 s: dark 22/30/33 → 22/30/35, light 23/32/44 → 23/33/42; settled unchanged (25/32/32 both).
  - AI Mode (deep) first 4 s: dark 14/22/23 → 15/23/24, light 14/23/37 → 16/24/44; settled 15/22/23 → 15–16/22–23/23–24. Unthemed on the shallow fixture: 12/20/21. The real "before" is a hung page.
  - 0 keys over 100 ms in any run.
- The +10–20 ms Aura time on hydration and the small fixtures is the theme-color meta sync, the button/state passes and the shadow-copy watchers; all of it is sliced or microtask-sized.
- **Paint diff vs Session 5, every element that paints differently** (dark and light, +5 s and after scroll):
  - buttons: `button.w-strip` white slab → theme surface + theme text; `button.fb` white text → black; `button.atc` white text on yellow → black; `›div.sheet` white → theme (the shadow copy survives the re-render); `›button.save` authored `#0f1a1c` → black (now inside a themed sheet). Light: the sheet → theme light bg, Save text → black.
  - forms: checked `div.box` / `div.radio` transparent → authored purple; `div.sw` transparent → authored lavender; selected `div.tab` transparent → theme highlight (light: authored `#e8def8`). Light: unchecked boxes/radios transparent → authored white.
  - login (dark): `button.social` ×3 white text on white → theme surface + white text (Airbnb's social login buttons were unreadable).
  - explore (dark): `div.pill` (the full-width white search pill, `role=button`) transparent → theme surface; same look, it sits on the painted header. Its subtitle keeps its gray.
  - shadow-bars (dark): `›button` white text on white → black text (buttons in shadow roots now get the button pass).
  - Everything else: 0 differences (hydration 7412 elements, late-text 4696, wiki, popover, chips, bearbottom, theme-color). Head elements (`meta`, `title`) are left out of the comparison: Aura's own theme-color meta sits at a different position.
- Cache-applied vs storage-applied (same engine): 0 differences in all 52 dumps; the Session 6 numbers in 6-0 are from the final engine.

### Found, not fixed (decided Nov 13: fix both; fixed in Session 7, see 7-6)
- **Per-site "Disabled" toggle doesn't disable (X-4).** The app writes `siteThemes[host].enabled = false`; `resolveTheme` (and background.js) then fall through to the time-based or global theme, and a jest test encodes that ("disabled site theme falls through"). Fix: one line in `resolveTheme` + flip that test; the cache already deletes its key for an off theme.
- **The native "Dark Mode" switch (X-5) never takes effect.** The app and the Swift handler store `nativeDarkModeEnabled` at the top level of the theme data; content.js reads it from the resolved theme. Fix: read `themeData.nativeDarkModeEnabled`. That turns on a path that hasn't run in the field.
- Test: TEST_SITES Load-1/2/3 (updated pass criteria), B-1, X-6, F-1 (updated), R-3, Type-2/Type-3, G-1..G-3, dark + light, Google rows side by side with Aura off.

## Session 7 — Nov 13 phone findings + X-4/X-5 — done Nov 13; phone check Nov 14 passed (no regressions, see "Nov 14 phone findings"); commit at the start of Session 8
- [x] Session 6 committed as `05121ac` (the A/B baseline); worktree `../Aura-s6` replaces `../Aura-s5`. Old harness runs cleared (210 MB).
- The Nov 13 screenshots (IMG_0648…0675) aren't on this Mac (Downloads ends at IMG_0627), and Claude in Chrome wasn't connected, so no live DOM was read. Every cause below is from the engine code plus a fixture that reproduces the phone symptom on the Session 6 engine; which shape the real page has is in "Only the phone can confirm".

### 7-1 Opaque surfaces still transparent (G-4, G-5, W-5)
- [x] Fixtures: `fixture-google-aimode` extended (sticky top bar and composer inside `#rso`, a gradient-only fixed band under the composer), new `fixture-promo-sheet` and `fixture-portal-banner`. All five surfaces reproduce on Session 6: top bar, composer bar/pill/field transparent; the band keeps the site's gradient (white here, Google's dark gray under its dark CSS on the phone); promo sheet and banner transparent.
- **Why the authored-paint rule didn't paint each one** (three general causes):
  1. **Google's strip rules hid the paint from the probe.** `#rso div { transparent }` and the AI-card rule in SITE_FIXES had no probe exemption, so `readAuthoredPaint` read everything under `#rso` as transparent and the layer rule never painted it (the sticky top bar, the composer's fixed bar). The `#rso` rule also out-specified the `[data-aura-composer]` paint. Fix: the probe exemption on those rules (`:where()`, no specificity change), and the `#rso` rule skips the composer.
  2. **Gradient-only paint wasn't read.** The probe read `background-color` only; a band painted with `background-image: linear-gradient(...)` read as clear, and the strip leaves gradients alone, so the site's own color stayed. Fix: `classifyAuthoredPaint` reads the gradient's stops: all opaque → `opaque`; opaque and transparent stops → `fade`. Either way the gradient is repainted in the theme color with each stop's alpha kept (`H.themeGradient`), so a fade stays a fade. 7 jest cases.
  3. **Overlay-tier cards were skipped.** A fixed modal-card shape at z-index ≥ 1000 was released unpainted (the fox5sandiego curtain guard from before Session 4), and the sticky rule leaves modal cards to that walk: Google's app-promo sheet and Wikipedia's fundraising banner. Fix: they go through the authored-paint rule like any card (a curtain is a transparent wrapper, which the rule leaves alone). fox5's own shells stay skipped by host (`CHROME_PAINT_HOST_SKIPS`, same selectors as its SITE_FIXES entry).
- Also found: `restoreAuthoredChromeOpacity` collected `!important` background selectors from Aura's own sheets too, so Aura's paint rules nominated elements as "authored opaque". Aura's sheets are now skipped (fewer rules scanned, too).
- AI Mode typing: no Aura pass runs while typing in either engine (0 passes, ~10 ms Aura time in the first 4 s in both); numbers in the A/B below.

### 7-2 Mask elements (F-2, R-4)
- [x] `fixture-masks`: floating labels across an outlined input's top border (`<label>`, `<span>`, `<div>`), and Reddit-style thread connectors in a shadow root on a site in its own dark mode (a `border-left` thread line, curved elbows, and a 16 × 16 square painted the page's `#0e1113` that cuts the line off).
- Session 6: dark themes cleared the labels (bright pass), so the border line ran through the label text; light themes kept them white (the white box, F-2); the mask square stayed `#0e1113` on every theme (black squares, R-4).
- [x] Fix, one rule (`settleMasks`): a small absolutely positioned element (≤ 320 × 40) that a neighbor's line crosses (a visible border edge of its parent or a sibling, or a hairline element), whose authored fill matches what it sits on (the nearest authored-opaque ancestor; the page when there's none), takes the themed color of what's behind it now. Nominated in the walk (one style read), decided in one step after it (probe of the mask and its ancestors in one batch), light DOM and shadow roots. 4 jest cases.

### 7-3 Buttons and scrims in sheets (R-3)
- [x] `fixture-buttons`: the draft sheet now sits in a full-screen `role=dialog` scrim (`rgba(0,0,0,.4)` + a 2 px backdrop blur) in the shadow root, with Save/Discard stacked full width. On Session 6 this reproduces the phone: solid theme-color backdrop, Save blends into the sheet.
- Causes and fixes:
  - **Scrim:** any tint behind a backdrop blur was classified as a frosted card, so the covering backdrop was painted solid. Now a layer that covers the screen and is dark translucent stays a `scrim` even when blurred (the sheet inside is the card). A plain dark scrim already worked; whether Reddit's has a blur is phone-only.
  - **Save:** a full-width neutral button was always painted as a theme surface (the Walmart strip rule). Now a button whose authored fill stood apart from its container (contrast ≥ 1.18 or a clear hue difference) is a control, never a surface. If its kept fill would blend into the themed container, it gets a distinct fill: theme text mixed into the container until it stands apart as much as it did as authored (contrast 1.15–1.6). Discard keeps its blue.
  - Cost: the container check probes a button's ancestors only when the fill could blend (or could be a strip), in the same batch as the buttons; a distinct paint stays on across passes while unchanged.

### 7-4 Images blended onto light tiles (B-3)
- [x] `fixture-blend`. The sheet has always set `img { mix-blend-mode: normal }`, so bare blended images were fine; the near-black photos come from a blend on a **wrapper** (a div or `<picture>`) around the photo. Reproduced on Session 6.
- Picked by paint diff: neutralizing the wrapper's blend changes one property on each blended wrapper and nothing else, and matches what bare `<img>`s already get; keeping the tile's light fill would change every tile, still need the neutralize fallback for a blended photo on a large text card, and put light slabs on a dark theme. Fix (`visitBlendElement`): `multiply`/`darken`/`color-burn` on an element that contains media → `normal`, dark themes only (on a light theme the blend still drops into a light page, as with Aura off).
- The harness paint dump now records a non-normal blend mode.

### 7-5 Safari tint on github.com (X-7)
- [x] Harness: `results.json → tint` lists everything Safari can tint from (theme-color metas, html/body, fixed/sticky boxes at either edge with their pseudo-elements) at +5 s and after each action. `fixture-github-chrome` follows GitHub's logged-out mobile markup (served as github.com).
- **Found:** the observer doesn't watch `content`, so a site script that rewrites its theme-color meta after Aura synced it (GitHub's color-mode script resolving "auto" is the likely candidate) leaves the site's color as the first meta until an unrelated mutation starts a pass. In the fixture the first meta stayed `#ffffff` at +5 s on a dark page. Fix: a `content`-only observer re-syncs at once; the site's newest value is what theme-off restores. After: the theme color holds through the rewrite, a live switch and a reload; theme off restores the site's value.
- Nothing else in the fixture can tint white: html/body are the theme color, and no fixed/sticky box touches an edge until the ☰ menu opens (then it's the themed menu).

### 7-6 X-4 per-site "Disabled" / 7-7 X-5 native Dark Mode
- [x] X-4: `resolveTheme` returns a site entry even when `enabled: false`, so `applyTheme` removes the theme and deletes the cache key; returning nothing would have been ignored by the storage listener (`if (!newTheme) return`). background.js sends the disabled entry. The jest test is flipped ("turns Aura off on that site", plus never cached, plus other sites unaffected).
- [x] X-5: content.js carries `themeData.nativeDarkModeEnabled` onto the resolved theme (key, cache, apply all see it).
- **The path that had never run had a bug:** after the site's own dark mode was switched on, `currentTheme` stayed set, so the first site mutation started a full Aura pass on the natively dark page (inline theme paints with no Aura sheet); a site that was already dark also kept the meta sync running. Now native mode leaves the engine idle (`currentTheme = null`, `nativeModeActive`).
- Harness `--scenarios settings` on `fixture-github-chrome` (Primer dark palette added). Session 6: native on and site Disabled changed nothing. After:
  | Step | Page | Aura sheet | theme-color metas | Cache key | Aura inline paints |
  |---|---|---|---|---|---|
  | native on, live | site's own dark (`data-color-mode=dark`) | – | site's | deleted | 0 |
  | + a site mutation | same | – | site's | – | 0 |
  | reload, native on | same | – | site's | – | 0 |
  | native off, live | Aura theme, `data-color-mode` back to `auto` | yes | theme | written | 0 |
  | site Disabled, live | site's original | – | site's | deleted | 0 |
  | reload, Disabled | site's original, no shield | – | site's | – | 0 |

### A/B vs Session 6 (`05121ac`)
Chromium headless, offline fixtures, Mac moderately busy (load 1.4–3.7), 4 rounds alternating which engine runs first, medians. Old = `05121ac` (worktree `../Aura-s6`). The A/B was run three times (the first two found the button costs below and a self-nomination); these are the final engine's numbers.
| Fixture | Longest Aura task, ms (dark / light) | Aura ms, load + 5 s (dark / light) | Tasks ≥ 50 ms | Layout Δ |
|---|---|---|---|---|
| late-text (the longest task overall) | 30.9 → 30.4 / 31.3 → 31.3 | 648 → 654 / 595 → 595 | 0 → 0 | 0 → 0 |
| hydration | 16.9 → 15.5 / 14.0 → 15.7 | 181 → 206 / 178 → 202 | 0 → 0 | 0 → 0 |
| google-aimode / -deep | 16.3 → 11.9, 12.4 → 11.8 / 11.7 → 13.0, 11.6 → 11.1 | 221 → 208, 216 → 232 / 207 → 207, 207 → 210 | 0 → 0 | 0 → 0 |
| the other 15 fixtures | 8.8–16.8 → 9.9–13.7 (per fixture −4.4…+4.1, both directions) | −8…+9 ms | 0 → 0 | 0 → 0 |
- Where the time goes: hydration's +25 ms is `settleButtons` (≈ 14 → 20 ms dark, 14 → 33 ms light: a filled button whose fill could blend into a light theme has its ancestors probed, once per element, in the same batch as the buttons). All of it is in sliced steps; the longest task didn't move. The first A/B had hydration light at +52 ms and a +17 ms forced style recalc in `reopaqueOverlays`; fixed by the 1.18 threshold (UA-default `#efefef` buttons, contrast 1.15 on white, no longer count as standing apart), one probe batch per shadow root, reading fills before lifting our own writes, and leaving an unchanged distinct paint on.
- Typing, keystroke → next frame. The AI Mode fixtures run 0 Aura passes while typing in both engines (≈ 10–12 ms Aura time in the first 4 s, ≈ 3 ms settled, the same in both), so the three A/B runs are pooled for them (12 rounds per engine; one round with a machine stall dropped). p95 first 4 s / settled:
  - AI Mode dark 22.6 → 22.6 / 22.4 → 22.8; light 22.1 → 23.2 / 21.9 → 22.1
  - AI Mode deep dark 22.7 → 22.0 / 22.1 → 22.7; light 22.4 → 23.4 / 22.4 → 23.4
  - hydration dark 30.3 → 31.2 / 31.2 → 32.3; light 30.8 → 31.8 / 31.5 → 32.4 (2 passes while typing early in both; light has the button cost above)
  - 0 keys over 100 ms. Run-to-run swing of a single A/B was ±2.5 ms (run 2 had the new engine lower almost everywhere, run 3 higher everywhere, including settled hydration, where neither engine does any work).
  - **Not strictly ≤ Session 6:** the pooled AI Mode p95 is within −0.7…+1.1 ms, with no Aura work behind the difference. Type-2 side by side with Aura off on the phone is the real check.
- **Paint diff vs Session 6, every element that paints differently** (dark and light, +5 s and after scroll):
  - google-aimode: `div.tbar` transparent → theme (7-1, cause 1); `div.cbar` transparent → theme (cause 1); `div.cband` white gradient → theme gradient (cause 2).
  - google-aimode-deep: `div.sliver` theme → transparent. Session 6 painted it in 1 of 4 rounds (nondeterministic), the final engine in 0 of 4; it sits on the painted composer bar either way, so nothing visible changes.
  - promo-sheet: `div.promo` transparent → theme (cause 3). portal-banner: `div.frb` transparent → theme (cause 3).
  - masks: `label.fl`, `span.fl`, `div.fl` (dark: transparent → theme; light: white / transparent → theme) and `›span.mask` `#0e1113` → theme (7-2).
  - buttons: `›div.scrim` solid theme → `rgba(0,0,0,.4)`; `›div.sheet` transparent → theme; `›button.save` dark: theme (blended) → its authored `#e5ebee` with black text; light: `#e5ebee` (blended into `#f2f2f7`) → distinct `#dadade` (7-3).
  - airbnb-login (dark): `button.accept` `#222` → distinct `#404042`. The cookie card's dark "Accept all" stood apart from the white card; on the themed dark card it had blended in (7-3, same rule).
  - blend (dark): `div.mx`, `picture.mx`, `div.dk`, `div.ph` blend multiply/darken → normal (7-4).
  - Everything else: 0 differences (hydration 7412 elements, late-text, wiki, popover, chips, bearbottom, theme-color, forms, explore, shadow-bars, github-chrome).
- Engine tests: 287 (`npm run test:engine`), green. `__tests__/App.test.tsx` (the RN app) fails to parse under the default jest config, as before; it isn't part of `test:engine`.

### Only the phone can confirm
- G-5: whether real AI Mode has the top bar and composer inside `#rso` (cause 1) and the band painted with a gradient (cause 2). If any of the three still shows: HUD inspect it, then ↑ parent up to the fixed/sticky element, and send the `pos`, `authored bg … img …`, `aura sets` and `rules` lines of each step.
- G-4 / W-5: whether the promo sheet and the banner are fixed cards at z-index ≥ 1000 (cause 3). Same HUD inspect if not fixed.
- W-5 wordmark: "WIKIPEDIA looks white on the light background" isn't explained by anything here. Most likely the phone was in dark mode: the portal's own `prefers-color-scheme: dark` CSS (which follows iOS, not Aura) whitens the wordmark under a light Aura theme; Aura can't switch that media query. Check with iOS in light mode; if it's still white, HUD inspect the wordmark (tag, `src`/class, `aura sets`).
- R-4: whether Reddit's squares are this shape. If they remain, HUD inspect one square on a light theme and send: the tag/class/`shadow` lines, `pos` (it should be `absolute` and about 16×16), `now bg`/`authored bg`, `aura sets`; then ↑ parent once and send the same for the parent. If tapping the square selects the whole comment row instead of a small element, say so: the square is then a `::before`/`::after` or an SVG, which this rule doesn't cover.
- R-3: whether Reddit's backdrop has a backdrop blur (the fixed case) or is a different shape; and whether Save/Discard now read as buttons.
- B-3: whether Amazon's blend is on a wrapper (fixed) or on the `<img>` itself (already neutral before, so then the cause is something else: HUD inspect the photo's parent tile).
- X-7: which surface Safari samples. Recent Safari versions may tint from page content at the edges (fixed/sticky bars, the page background) and not only from the theme-color meta; I couldn't confirm which applies to your iOS version. If github.com still shows white, HUD inspect what sits at the very top of the page (and inside the ☰ menu) and send `pos` + `now bg`.
- X-4 / X-5: the real app → extension path (App Group → background.js → storage), which the harness stubs.

## Session 8 — Nov 14 phone findings — done Nov 15; phone check Nov 16: G-5/G-7/Type-2/X-8/X-10/X-11 menu passed; G-6, X-9 Reddit, F-2 still failing (see "Nov 16 phone findings"); commit at the start of 8b
- [x] Session 7 committed as `661dcd7` (the A/B baseline); worktree `../Aura-s7` replaces `../Aura-s6`. Old harness runs cleared.
- **Sources.** The Nov 14 screenshots (IMG_0677…0694) aren't on this Mac (Downloads ends at IMG_0627 again), so they weren't viewed; causes come from the findings text plus the live DOM read in your Chrome through Claude in Chrome (a 500 px window, Chrome's minimum width; Google served its mobile layout). **Every DOM below is desktop Chrome's**; where the phone could differ it says so.
  - Read live: Google AI Overview + AI Mode (composer, composer focused), github.com, airbnb.com (chips, Inspiration row), WebMD (`/vitamins/ai/ingredientmono-1564/alpha-gpc` 404s on desktop now; `/vitamins-supplements/alpha-gpc` is the same page), Urban Plates (order-page CSS; the checkout needs a cart, so its label rule is assumed to be the same component), Walmart (☰ open/close with a mutation recorder, the country popup).
  - Not read: **reddit.com is blocked by Claude in Chrome** ("not allowed due to safety restrictions"); R-3/X-9 Save stays on `fixture-buttons` (a guess from the Nov 13 screenshots).
- **Harness bug found and fixed:** after a site's `actions`, run.js always called `page.goBack()`; on a fixture that navigates to `about:blank`, so load metrics, pass list and the after-scroll dump came from a blank page. Session 7's `fixture-github-chrome` load numbers were from that blank page (its paint diff at +5 s was real).

### 8-1 Google AI (G-5, G-6, G-7, Type-2)
`fixture-google-aimode` rebuilt from the live DOM (Google's class names; light colors). All three reproduced on Session 7.
- **G-5 composer field see-through — two causes.**
  1. The pill's fill isn't on an element: it's `.d4HWzd::before` (absolute, inset 0, `rgb(54,56,64)` on dark, 1 px border, radius 24) under a transparent textarea. `visitPseudoBgElement` clears any covering pseudo fill (built for stale card layers in page flow). **Fix:** a covering pseudo fill inside a fixed/sticky layer is that layer's authored-opaque surface: painted `--aura-overlay`, like the layer rule paints any authored-opaque surface.
  2. The `[data-aura-composer]` SITE_FIXES rule (0,1,0) loses to the universal strip (a dozen `:not([role…])` clauses): **it hasn't painted anything since Session 6**. Session 7's fixture looked right only because its fixed bar was authored opaque; Google's wrapper `.y4VEUd` is transparent. Left dead on purpose (reviving it paints a full-width slab Google never painted); 8-1's paint follows the authored pill.
  - The band behind the pill (`.Zze5V`, a gradient from transparent to the page color) was cleared by the composer's sibling sweep; it's now themed by the fade rule (8-3), so the answer fades out above the pill as with Aura off.
- **G-6 "Show more" — two causes, both clearing the collapse fade** (`.RDmXvc`: absolute, 148 px, transparent → page color at 80 px). The button is a transparent bordered pill on `.zNsLfb` (relative, z-index 2, page color), which the strip clears.
  1. `shouldClearLayoutGradient` cleared it as a large layout gradient; its exemption keyed on `[aria-controls="m-x-content"]`/"Show more AI", which Google's expander no longer has (`div.Jzkafd[role=button][aria-expanded]`).
  2. The answer-card rule `[data-aura-ai-card] :is(div,…) { background-image: none }` also hid it: the card search anchors on "AI responses may include mistakes", which the AI Overview carries too, so `#rso` got marked.
  - **Fix (general):** a fade is never cleared as a layout gradient (`isFadeGradientInfo`, heuristics); the fade rule (8-3) themes it, reading the authored gradient through the probe even when one of our rules hides it.
- **G-7 tint** (hypothesis confirmed in Google's CSS, not in the desktop DOM): `.lgo9kc { position:fixed; inset:0; background:#000; opacity:0; visibility:hidden; z-index:1000 }`, `.lgo9kc.vKW4md { opacity:.6 }`. Read as an opaque black card and painted the theme color. **Fix:** the probe reads `opacity`; a covering dark layer's alpha × its opacity decides scrim vs card (covering only, so a card mid fade-in stays a card). Which element the phone dims with is a guess.
- **Type-2:** focusing the composer now runs one scoped pass on its parent (8-4); typing numbers in the A/B below.

### 8-2 Text on light fills (X-9)
- [x] Harness metric `lowContrast` (README): visible text under 3:1 against the fill it sits on, composited through ancestors, gradients, url() images (sampled), covering pseudo-elements and absolute fill-layer siblings, weighted by opacity. Run with `--themes none` too (the site's own design) and the new `gray` theme (the app's Gray preset: dark with a light `#64D2FF` link, the X-9 shape).
- Causes and fixes, by category:
  - **A fill layer under the text** (Airbnb chips, live: `a[role=tab]` > two `pointer-events:none` absolute spans painting the pill with a near-white gradient + a relative label; the label takes the theme link color). `H.effectiveBackground` only read `background-color` up the ancestors. Now it also reads an opaque gradient (stops averaged) and an earlier absolute sibling that paints under a positioned node. Gray: "Homes"/"Hotels" `#64d2ff` on the white pill 1.65:1 → readable.
  - **Nested shadow roots never themed** (found by the metric on `fixture-hydration`): a shadow root inside a shadow root never got Aura's sheet, so nested comment cards kept `#fff` under inherited white text (white on white). Pre-existing (Session 7 the same). Fix: nested roots get the sheet copy and their own nested roots (not the per-element steps: those tripled Aura's time on the hydration fixture); the shadow watcher now sees a nested component that attaches its shadow root later and queues a pass for it.
  - **Two passes on one surface:** the inline-highlight pass pinned a white share disc's text black, then the small-surface rule painted the disc the theme color (black on dark). The layer rule now owns what it paints.
  - **Blended buttons:** a neutral button whose fill matched its authored container blends into the themed container at any width (was full-width strips only).
- Remaining, explained: see the A/B table.

### 8-3 Edge fades (X-8)
- [x] `fixture-fades` (GitHub's row `::before`/`::after`, 64–128 px, `#fff` → transparent, z-index 1; Airbnb's row arrow, a white 20×40 button whose `::before` is the 48 px fade; an element fade over clipped text; a dark photo scrim that must stay) and WebMD's tab row in `fixture-webmd` (`.fade-w::before/::after`, `#edf0ff`, z-index 5).
- **Fix (`settleFades`):** a fade (transparent and opaque stops) whose opaque color matches the authored paint behind it is repainted in the themed color of what's behind it now (`H.themeGradient`, alpha per stop kept). Elements inline; pseudo-elements as rules in the pseudo override sheet (document only). Nominated in the walk (pseudo-elements read only on positioned hosts), decided in one batched step. A dark photo scrim doesn't match what it sits on: kept.
- A button's own pseudo fade fades into what's behind the button. Airbnb's white arrow button itself stays white in the fixture (its container is the page, unknown once themed).

### 8-4 Floating label on focus (F-2)
- [x] Urban Plates' CSS: `.listboxLabelInput:focus + .listboxLabelVisualLabel { background:#fff }` — the white fill exists only while focused, with no mutation. `fixture-masks` extended (label inside the field at rest; focus moves it onto the border with the white fill).
- **Fix:** `focusin`/`focusout` → the mask rule right away on the field's parent's children, plus one scoped pass on that parent (after the label's own transition). Never per keystroke.

### 8-5 Decorative background images (X-10, decided Nov 14)
- [x] WebMD's hero: `HEADER.drug-header` with `url(drug-monograph-cms-bg-mobile.jpg)`, cover: a **JPG**, nearly white (mean luminance 252, sd 5). "Decorative" can't come from the file type, so it comes from the pixels.
- **Fix:** a ≥ half-width, ≥ 80 px section with a url() background and ≥ 20 characters of text: its image is sampled once per URL (24×24, CORS anonymous, async). Flat (luminance sd ≤ 14) → dropped, the section themes. A photo, or an image that can't be read (no CORS) → kept, with a 62 % theme-color scrim layered over it. Fixture `fixture-webmd` (hero + a photo section).
- Phone-only: whether WebMD's image CDN answers CORS for Safari (it did for Chrome); if not, the hero gets the scrim instead of the drop.

### 8-6 Safari tint (X-7, Load-4)
- [x] Switch scenario extended with Load-4's sequence (theme off → reload → theme on live → reload) and the fixed/sticky edge boxes per step. On `fixture-github-chrome` and `fixture-webmd`, **the live apply after an unthemed reload leaves exactly the surfaces of a themed reload** (html/body, theme-color meta, edge boxes). Aura's output doesn't differ, so Load-4 rests on when Safari samples. GitHub (live): a static theme-color meta `#1e2327` while the phone shows white with Aura off, so Safari isn't tinting from the meta there; the fixed boxes at the top are hidden (`opacity:0; visibility:hidden`).
- WebMD: the fixed bottom ad slot (`#f7f7f7`, 80 px) is stripped transparent when themed (ads aren't repainted), so the bottom edge shows page content under it.

### 8-7 Transparent bars/popups (U-1, X-11 popup) — not done (out of this session's list)
- Read live: Urban Plates' bar is `DIV.menuSidebar` (sticky, `#f7f8f4`); Walmart's country popup is an absolute layer > `.BaseHighlight` (shadow) > a relative `#002d58` card with white text.

### 8-8 Walmart ☰ menu flash (X-11)
- [x] `fixture-walmart-menu` from the recorded open/close (the page wrapper slides with an inline transform + transition; a `role=dialog` nav is appended; rows ~190 ms later; 41 elements with `color`/`all` transitions). The color timeline shows **no Aura change at open or close** on either engine: the flash isn't reproduced from the desktop DOM.
- What it does show: Aura's fixes animating through the site's transitions (contrast writes on `color .15s` text, the bright pass on `all .1s` tiles, a layer paint), 6 late visible changes on Session 7. **Fix:** those writes snap (`data-aura-notrans` for one frame, as the probe does): 0 late changes.

### A/B vs Session 7 (`661dcd7`)
Chromium headless, all 22 fixtures, dark + light, visual + typing, 4 rounds alternating which engine runs first, each round started only once the 1-minute load was under 6 (it was 2.5–4.5 during the runs), medians. A first A/B was discarded: the laptop slept mid-run (load 35–115), and its round 1 paint diff found the photo-scrim bug fixed below.
- **Longest Aura task:** no regression beyond noise. late-text stays the longest: 29.6 → 30.1 (dark), 29.6 → 30.6 (light). Every other fixture 9–16 ms on both, differences in both directions (−5.0…+4.4 ms). 0 tasks ≥ 50 ms on the new engine; Session 7 had one (portal-banner dark), plus single 44 ms and 88 ms tasks in two of its runs (machine noise, not in the medians).
- **Layout Δ:** 0 on every fixture, both engines.
- **Aura ms (load + 5 s):** hydration 187 → 253 (dark), 168 → 287 (light): nested shadow roots now get the sheet (8-2). late-text 634 → 706 / 583 → 630 (+8–11 %): the fade and background-image visitors run on every element; all of it in sliced steps. fades 18 → 30, webmd 21 → 30 (the new rules doing their work). Everything else within ±8 ms.
- **Typing, p95 keystroke → next frame (first 4 s / settled):**
  | Fixture | Dark | Light |
  |---|---|---|
  | google-aimode | 27.3 → 27.0 / 26.9 → 27.6 | 27.8 → 26.1 / 27.1 → 25.4 |
  | google-aimode-deep | 27.7 → 28.1 / 27.4 → 28.4 | 28.2 → 28.4 / 28.0 → 27.6 |
  | hydration | 31.5 → 31.6 / 31.6 → 31.9 | 31.4 → 31.0 / 31.4 → 33.3 |
  - 0 keys over 100 ms. The Google fixtures run 0 Aura passes while typing in both engines (≈ 11 ms Aura time early in both, the focus pass included), so their ±1 ms is the run-to-run swing. Hydration runs 2 passes early in both; its Aura time while typing rose 160 → 246 / 174 → 266 ms (the nested-shadow sheet work), with p95 unchanged. One typing load per Google fixture per engine was invalid (typing didn't start) and is left out (3 of 4 rounds).
- **Low-contrast text (< 3:1):** hydration dark 6 → 0, webmd dark 6 → 0, airbnb-chips with the Gray preset 3 → 0 (separate run). Remaining, explained: Google's disabled send button (opacity .4, low with Aura off too: the site's own); "2 more replies" at 2.8:1 on light inside a shadow root (the contrast pass doesn't run in shadow roots: decision below); the Airbnb share glyph on dark (fixed after the metric run by 8-2's third bullet; the metric doesn't read `-webkit-text-fill-color`, so it still counts it).
- **Paint diff vs Session 7, every element that paints differently** (dark and light; +5 s, after scroll, after actions). The other 18 fixtures: 0 differences, `fixture-buttons` included (the blended-button change touched none of its buttons).
  - google-aimode: `div.RDmXvc` cleared → theme fade (G-6); `div.Zze5V` cleared → theme fade (the band, G-5); `div.d4HWzd::before` cleared → theme (the pill, G-5); after focus `div.lgo9kc.vKW4md` theme color → its authored `#000` at opacity .6 (G-7). The +5 s dump isn't comparable in one round (the streamed answer had 130 vs 133 nodes at that instant); after-focus and after-scroll are.
  - fades: GitHub rows' `::before/::after` white → theme; Airbnb arrow's `::before` white → theme (the button stays white); `div.efade` cleared → theme fade; `div.photo` photo → photo under the theme scrim (X-10: it has a caption); `div.scrim` (dark scrim on the photo) cleared → kept as authored. **Bug found by this diff and fixed:** before the fix the scrim was repainted in the theme color (a whitish wash on the light theme): a fade sitting on a url() image is now kept.
  - webmd: `header.drug-header` decorative image → none (themes); tab row `::before/::after` `#edf0ff` → theme; `div.photo-hero` photo → photo under the theme scrim.
  - masks: after focus (and after scroll, the field still focused) the label white → theme (F-2).
  - hydration: 240 nested-shadow `div.card` (two and three levels deep) white → transparent (8-2).
- Engine tests: 292 (`npm run test:engine`), green; 5 new cases (scrim × opacity, fades not cleared, fade color, fill layers / gradients in `effectiveBackground`, blended narrow buttons).

### Decisions needed (answered Nov 16: 1 yes if typing holds, 2 keep, 3 yes)
1. Contrast pass inside shadow roots (the "2 more replies" case; Session 1 root cause #5): a contrast visit per shadow element (~7,000 on the hydration fixture). Add it?
2. Keep the blended-button change (a narrow neutral button that matched its container blends into the themed one)? It changed nothing in the fixtures; real sites decide.
3. U-1 and the Walmart country popup (8-7): Session 8b (Nov 17–18)?

### Only the phone can confirm
- G-5/G-6/G-7 shapes come from desktop Chrome at 500 px: whether the phone's composer pill is also a `::before`, whether its "Show more" uses the same fade element, and which element dims the page.
- X-10: whether WebMD's image CDN answers CORS for Safari (else the hero gets the scrim, not the drop).
- X-11 flash: not reproduced; if it remains, say which bar flashes and whether it's on open, close or both.
- Load-4/X-7: Aura's surfaces are identical live vs reload; check whether scrolling after the live apply updates the bars.
- Type-1 on Reddit (nested shadow roots now get the sheet: watch for typing lag and for nested comments looking different).
- X-9 Airbnb: the arrow button at the row's right edge may still be a white square.

## Session 8b — Nov 16 phone findings — Nov 17–18
Prompt below. DOM sources in order: phone-shaped markup (Playwright Chromium with an iPhone profile against the live site, network outside the sandbox, asked first), then Claude in Chrome at ~390 px, then screenshots (marked a guess).
- [ ] Commit Session 8 (the A/B baseline); worktree `../Aura-s8` replaces `../Aura-s7`; clear `tools/harness/out`.
- [ ] 8b-1 G-6 "Show more": phone-shaped DOM for an AI Overview and an entity panel; why the fade and the button's container aren't painted, and why it varied. Rebuild `fixture-google-aimode`; G-5/G-7/Type-2 unchanged.
- [ ] 8b-2 X-9 Reddit Save: buttons in nested shadow roots (not the full per-element steps).
- [ ] 8b-3 Contrast pass in shadow roots (Decision 1), sliced; dropped if typing p95 regresses.
- [ ] 8b-4 Urban Plates: F-2 on the real page, U-1 sticky bars and header, F-3 dropdown + validation bar, white edge lines.
- [ ] 8b-5 Walmart popups (X-12): "Spanish / Español" and the country popup.
- [ ] 8b-6 Airbnb photo pills (A-5).
- [ ] 8b-7 White flashes (Load-5): harness metric first (bright background/text for ≥1 frame on a dark theme: load, added content, actions), then sources, then fixes by category.
- [ ] 8b-8 Load flash (Load-1, repeat visits): cache miss vs late injection vs site CSS; a minimal debug-build readout for the phone part.

### Prompt
```
Session 8b of the Aura release work (repo ~/Developer/Aura). Read RELEASE_PLAN.md ("Nov 16 phone findings", Session 8, Session 8b), TEST_SITES.md and tools/harness/README.md. Screenshots: ~/Downloads/IMG_0702…0709.PNG — look at each before working on its item.

Setup: commit the working tree as "Session 8: Google AI composer/fades/scrim, edge fades, fill layers + nested shadow roots, focus labels, decorative bg images, snapped late writes" (the A/B baseline), remove ../Aura-s7, create ../Aura-s8 at that commit, clear tools/harness/out.

DOM sources, in this order:
1. Phone-shaped markup first: Session 8's G-6 fix was built from desktop Chrome's DOM and doesn't take on the phone. Try Playwright Chromium with an iPhone device profile (devices['iPhone 15']: UA, 390 px, touch) against the live site. That needs network outside the sandbox — ask me before the first run. Record the element's DOM, computed styles and matched rules. If a site blocks it, say so.
2. Claude in Chrome at ~390 px as a second source; say when a cause rests on desktop markup. reddit.com is blocked there. Don't sign in, submit forms or accept dialogs beyond what it takes to see the element. Urban Plates: the restaurant search field ("Search by city or zip") shows F-2 without a cart.
3. Screenshots as a last resort: build the fixture from them and mark it as a guess.

Measurement rules (unchanged): Chromium headless, offline fixtures, one fixture per shape fixed. A/B every change against Session 8 with --compare and explain every paint difference. Check uptime/load first; alternate the A/B order over ≥4 rounds and compare medians. Typing p95 swings ±2.5 ms between runs: check typingEngine before calling a difference real. Layout Δ stays 0 and npm run test:engine stays green. The longest Aura task and typing p95 don't regress; new per-element work goes through runSteps. No engine edits during a run, no harness timing while xcodebuild runs. Fix by category; no per-site rules unless the live DOM proves the general rule wrong.

Scope, in priority order:
1. G-6 Google "Show more" (IMG_0709): see-through on every search on the phone now; the correct fade was seen only a couple of times. Get the phone-shaped DOM for an AI Overview ("what is ashwagandha") and an entity panel ("uc davis"). Find why the fade and the button's container aren't painted, and why it varied (late insertion or class change missing the fade visitor, a different shape, or a fade color that doesn't match what's behind it). Rebuild fixture-google-aimode with the phone shape; keep G-5/G-7/Type-2 as they are (they passed).
2. X-9 Reddit "Save Draft?" Save (IMG_0708): white text on a near-white fill. Likely cause: nested shadow roots get only the sheet copy (shadowRootSteps(host, nested)), so settleButtons never reaches it. Confirm on a phone-shaped DOM if Playwright can load reddit; otherwise extend fixture-buttons with the sheet in a nested root (a guess). Fix: buttons in nested roots, without bringing back the full per-element steps (they tripled hydration's Aura time).
3. Contrast pass in shadow roots (decided: yes, if typing holds): the "2 more replies" case. Sliced; drop it if Reddit/hydration typing p95 regresses.
4. Urban Plates (IMG_0703–0706): F-2 focused label still a white box (why the Session 8 focusin path misses it on the real page); U-1 sticky bars (DIV.menuSidebar #f7f8f4, and the header); the address dropdown and the checkout validation bar transparent (F-3); thin white lines up the card edges.
5. Walmart popups (X-12): "Spanish / Español" (IMG_0707) and "switch to another country". Shape from Session 8: absolute layer > .BaseHighlight > relative #002d58 card.
6. Airbnb photo pills (A-5, IMG_0702): "Guest favorite" and "Prices include all fees" see-through on photos. Find what Aura off paints; fix by category (small surfaces on media).
7. White flashes on dark themes (Load-5): over buttons/text during load, when content loads in, and on tap / opening menus. First add a harness metric: per frame, in the viewport, elements whose background or text is bright for ≥1 frame on a dark theme before settling (load, added content, actions that open menus). Then find the sources — candidates: the site's CSS transitions animating from the authored paint to Aura's (the sheet apply, the site's own class toggles, JS writes not yet snapped) and surfaces that only get Aura's paint at the next debounced pass. Fix by category; report before/after counts.
8. Original-color flash on load (Load-1): sometimes, repeat visits too, Airbnb especially, although the per-site theme cache should theme the first frame. Find which: a cache miss (key, origin/redirect, storage cleared, size), Safari injecting after first paint, or site CSS beating the cached sheet until the full apply. Use the harness for what it can show; for the phone part add the smallest debug-build readout I can check without Web Inspector (e.g. cache hit + first-apply delay on the #aura-debug banner) and tell me exactly what to read off.

Report at the end: what changed with before/after numbers and every paint difference explained; per item the cause, which DOM source it rests on (phone-shaped, desktop or a guess) and what only the phone can confirm; decisions needed from me; a phone check list (site, what to look at, theme). Update RELEASE_PLAN.md (Session 8b section, session log, schedule). Don't commit 8b until I've checked it on the phone.
```

## Session 9 — Regression + App Store submission (was Session 7)
- [ ] Full TEST_SITES pass (dark + light + one split preset). Fix only regressions. Includes the Nov 5 rows: B-2 Bearbottom Find my size, F-1 Google Form, X-6 Walmart order page, A-4 Airbnb chips.
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
- **Session 4 (Nov 4):**
  - Built the authored-paint probe and the layer & overlay engine, with persistence on scroll, resize, class change, style rewrite and new nodes. Added the layout-invariance test.
  - Folded in both deferred Session 3 items.
  - Measured on four new offline fixtures (no HAR snapshots exist yet), A/B against `c23baa1`. Committed Nov 5 as `9c5f68f` after the on-device check passed.
- **Session 5 (Nov 5):**
  - 5B: floating icon controls and non-ARIA popovers moved onto the authored-paint rule, plus tooltip arrows. Audited the remaining shape-based paints: three moved, and the small-ARIA flat sheet is kept with a reason. Three new fixtures. A/B against `9c5f68f`; every paint difference is explained in Session 5.
  - 5A: measured that Aura's own work from storage to CSS applied is ≤ 4 ms. The flash is storage/injection latency, which needs the phone HUD. Removed the 100 ms fallback timer; light themes get a dark-alpha border. Shield/cache decision made: option (c), scheduled as Session 6 item 6-0.
  - Wikipedia "Banner logo": not reproducible from Chrome; W-4 then passed on the phone.
  - Phone check passed Nov 5 (all Session 5 rows, dark + light). Committed as `96f28c1` at the start of Session 6.
- **Session 6 (Nov 5, pulled forward from Nov 7):**
  - Committed Session 5 (`96f28c1`, A/B baseline in worktree `../Aura-s5`).
  - (a) Old theme in the back layer: harness theme-switch scenario. The site's dark-media theme-color meta never got Aura's color, and shadow/iframe sheet copies kept or re-added the old theme. One apply/remove path now owns every surface.
  - Per-site theme cache: the first frame is themed on a site's second load (unthemed 160/460 ms → 0 at 200/500 ms storage latency), paint-identical to the storage apply.
  - (b) Text colors late: color-timeline harness metric. Causes: an O(n²) duplicate-label check and debounce starvation during hydration. Fixed with a per-pass cache and fast contrast for added nodes; 0 late changes. The pre-pass loops are sliced.
  - Buttons + stateful controls by authored fill; `color: revert` removed; shadow sheet copies survive `innerHTML` re-renders; Google SITE_FIXES scoped away from Google's apps.
  - Google AI Mode: found and removed a mutual-observer loop that hangs the Session 5 engine on the fixture; `:has()` rules → JS-set attributes; answer card and composer painted by scoped CSS rules.
  - Fixtures: theme-color, late-text, buttons, forms, google-aimode (+ deep). Harness: `--keep-storage`, `--scenarios switch`, `AURA_HARNESS_TIMELINE`, per-fixture origin, top tasks and pass list in results.
  - Not committed; phone check list in the Session 6 report.
- **Nov 13 phone check of Session 6:** mostly passed, including Load-1/2/3 (the bottom strip switches right away), F-1, B-1/X-6, AI Mode typing and all regression rows. Nine findings recorded in "Nov 13 phone findings"; X-4 and X-5 decided: fix both. Deadline moved to Nov 23; old Session 7 renumbered to Session 9. New TEST_SITES rows G-4, G-5, W-5, R-4, B-3, X-7, F-2; R-3 criteria updated.
- **Session 7 (Nov 13):**
  - Committed Session 6 (`05121ac`, A/B baseline in worktree `../Aura-s6`).
  - Opaque surfaces: three general causes (Google's strip rules hid authored paint from the probe; gradient-only paint wasn't read; z-index ≥ 1000 cards were skipped). Also: Aura's own sheets no longer nominate "authored" elements.
  - Mask elements: one rule for floating labels and thread-line masks. R-3: a blurred covering backdrop stays a scrim; buttons keep standing apart from their themed container. B-3: darkening blends on photo wrappers neutralized on dark themes. X-7: a site rewriting its theme-color meta after Aura is re-synced at once; harness tint probe. X-4 and X-5 fixed, plus the native path's engine-restart bug.
  - Fixtures: promo-sheet, portal-banner, masks, blend, github-chrome; google-aimode and buttons extended. Harness: `--scenarios settings`, `tint`, blend mode in paint dumps, `AURA_HARNESS_DUMP_INLINE`.
  - Three A/B runs vs Session 6 (the first two found the button cost and the self-nomination). Not committed; phone check Nov 16.
- **Nov 14 phone check of Session 7:** passed, no regressions (R-4, B-3, X-4, X-5 confirmed). New/remaining findings in "Nov 14 phone findings"; Google AI first. Decided: drop decorative light background images on text sections; Session 8 reads live DOM through Claude in Chrome (no HARs/HUD). Harness: live site entries for webmd, urbanplates, walmart; google-search query → "what is ashwagandha".
- **Session 8 (Nov 15):** committed Session 7 (`661dcd7`, worktree `../Aura-s7`). Live DOM read in Chrome (Reddit blocked). Google AI G-5/G-6/G-7 causes found and fixed; fades (X-8), fill layers and nested shadow roots (X-9), focus re-evaluation (F-2), decorative background images (X-10), snapped late writes (X-11 flash). Harness: `lowContrast` metric, `gray` theme, pseudo/opacity in paint dumps, dumps after actions, Load-4 switch steps, the goBack fix. New fixtures: fades, webmd, walmart-menu; google-aimode rebuilt. A/B vs Session 7 done (4 rounds; one discarded A/B after the laptop slept); its paint diff caught a photo-scrim bug, fixed. Not committed; phone check next.
- **Nov 16 phone check of Session 8:** Google AI Mode passed (G-5, G-7, Type-2), plus X-8, X-10, X-11 menu, Airbnb chips and the regression rows; typing lag at most very slight. Still failing: G-6 (every search), Reddit Save, F-2 on the real page; new: Urban Plates bars/popups, Walmart "Spanish / Español" popup, Airbnb photo pills, white flashes and original-color flash on load. Decisions: shadow-root contrast yes if typing holds, keep blended buttons, U-1/popups in 8b. New TEST_SITES rows A-5, X-12, F-3, Load-5. Session 8b prompt written.

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
