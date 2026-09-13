# Aura

Aura is an iOS app that recolors websites inside Safari. A React Native app configures themes; a Safari Web Extension applies them live to every page via injected CSS and a DOM-walking JavaScript engine. A separate native Content Blocker extension can strip ads/trackers/social widgets/annoyances. A Focus Filter (Screen Time) extension exists and is fully implemented but is not embedded in this release.

This document explains how the system actually works, target by target, file by file. For what's left before an App Store submission, see [SUBMISSION_READINESS.md](SUBMISSION_READINESS.md).

## Contents

- [System map](#system-map)
- [Storage architecture](#storage-architecture)
- [Sync pipeline: app → Safari page](#sync-pipeline-app--safari-page)
- [The theme engine (`content.js`)](#the-theme-engine-contentjs)
- [Supporting engine modules](#supporting-engine-modules)
- [Content Blocker extension](#content-blocker-extension)
- [Focus Filter extension (built, not shipped)](#focus-filter-extension-built-not-shipped)
- [React Native app](#react-native-app)
- [Testing](#testing)
- [Development setup](#development-setup)
- [Project structure](#project-structure)

## System map

```
┌─────────────────────────┐
│   TintApp (React Native)│  Theme creation, settings, content-blocker config
│   src/*, App.tsx         │
└────────────┬─────────────┘
             │ writes (react-native-shared-group-preferences)
             ▼
┌─────────────────────────────────────────┐
│  App Group UserDefaults                  │  group.com.alexmartens.tint
│  key: tintThemeData  (single JSON blob)  │  ← SOURCE OF TRUTH
└────────────┬──────────────────────────────┘
             │ read only when messaged (no lifecycle hook)
             ▼
┌─────────────────────────────────────────┐
│  SafariWebExtensionHandler.swift          │  NSExtensionRequestHandling
│  responds to {type:"syncTheme"/"getTheme"}│  writes heartbeat key each call
└────────────┬──────────────────────────────┘
             │ browser.runtime.sendNativeMessage
             ▼
┌─────────────────────────────────────────┐
│  background.js (Manifest V3, module)      │  polls native handler every 5s,
│  writes browser.storage.local             │  debounces writes, broadcasts
└────────────┬──────────────────────────────┘  UPDATE_THEME to open tabs
             │ browser.storage.local (cache)
             ▼
┌─────────────────────────────────────────┐
│  injected.js → content.js                 │  document_start, all_frames,
│  (+ themeHeuristics/splitTheme/themeResolve)│  <all_urls> — the theme engine
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  ContentBlockerExtension (native)         │  reads the same App Group blob,
│  4 static JSON rule lists, merged live    │  independent of the web extension
└─────────────────────────────────────────┘
```

Five iOS targets exist under `ios/`:

| Target | Type | Ships? | Purpose |
|---|---|---|---|
| `TintApp` | App | Yes | Container app, RN bridge, App Group source-of-truth writer |
| `TintExtension Extension` | Safari Web Extension | Yes | The theme engine — CSS + JS injected into every page |
| `ContentBlockerExtension` | Safari content-blocker | Yes | Static/merged blocking rules |
| `FocusFilterExtension` | Intents (Focus Filter) | No (built, not embedded) | Maps an iOS Focus mode to a theme |
| `TintExtension` | Legacy host app | No (not embedded; still compiled by the `TintApp` scheme's archive action) | Historical Safari-extension debug host, superseded by `TintApp` |

`KeyboardExtension` is an empty, unwired directory — not a real Xcode target, no build risk.

## Storage architecture

**Everything lives in one JSON blob** at App Group `group.com.alexmartens.tint`, UserDefaults key `tintThemeData`. There is no per-field storage and no server — this key is the entire persistence layer for the product.

Shape (`src/storage.js`, `getDefaultThemeData()`):

```js
{
  globalTheme: { enabled, background, text, link, backgroundType: 'color'|'gradient'|'split', backgroundGradient, backgroundImage },
  siteThemes: { "example.com": { ...same shape, enabled } },
  customThemes: [],            // max 5, enforced in CustomThemeScreen.tsx
  timeBasedRule: { enabled, mode: 'manual'|'sunset', dayThemeColors, nightThemeColors, dayStartTime, nightStartTime, locationLat, locationLon },
  focusModeSettings: { enabled, mappings: { work, sleep, personal, doNotDisturb } },
  contentBlockerSettings: { enabled, categories: { ads, trackers, socialWidgets, annoyances } },
  appThemeColor, appThemeMode,  // stored but inert — see React Native app section
  favoriteThemes: [], recentlyUsedThemes: [], // recentlyUsedThemes is write-only, nothing reads it back
  hasCompletedOnboarding, hasCompletedSafariSetup,
}
```

**Write path** (`saveThemes`, `src/storage.js`): validate → stamp `_lastSaved`/`_saveCount`/`_version` → compute a 32-bit checksum over the JSON (stored as `_checksum`) → write via `react-native-shared-group-preferences` with up to 3 retries → read back once to confirm → **write the exact same payload a second time** after a 200ms sleep. The double-write exists specifically to force cross-process UserDefaults flushing between the app process and the extension process — App Group `UserDefaults` sync between processes on iOS is not immediate, and this is the workaround.

**Read path** (`getThemes`): retries up to 3x, parses if the bridge returns a JSON string, and on parse failure, failed shape validation, or a thrown error (including the known iOS `UserDefaults` "Property storage limit" corruption error) falls back to `getDefaultThemeData()` and re-persists it.

**Validation** (`validateThemeData`) rejects non-objects, arrays, blobs with more than 1000 keys (corruption heuristic), and malformed `customThemes`/`globalTheme`. The checksum, however, is **diagnostic only** — a mismatch on read is logged, never rejected or repaired. There is no versioned migration system; new fields are added via `?? default` fallbacks at call sites, not a schema migration.

**Native side** (`SafariWebExtensionHandler.swift`) reads the same key with three decoding fallbacks (dictionary, JSON-string, generic object) to tolerate whatever shape `react-native-shared-group-preferences` actually persisted, and re-emits only the three fields the extension needs (`globalTheme`, `siteThemes`, `timeBasedRule`) to keep `browser.storage.local` small.

## Sync pipeline: app → Safari page

The native handler is **message-driven only** — `beginRequest` never fires on a timer or app lifecycle event, only when something calls `sendNativeMessage`. Two independent things poll it:

1. **`background.js`**, on extension load and then every 5 seconds (`MIN_SYNC_INTERVAL`), calls `browser.runtime.sendNativeMessage("com.alexmartens.aura.SafariExtension", {type:"syncTheme"})`, diffs the response against the last-known `browser.storage.local` value (including a fallback field-by-field compare for `globalTheme` in case JSON key order differs), and if changed, writes to `browser.storage.local` (itself debounced to at most once per second) and pushes an `UPDATE_THEME` message to every open tab whose resolved theme (site override, or the current half of a time-based day/night rule, computed inline) changed.
2. **`content.js`**, on every tab focus (`visibilitychange`) and once 100ms after its own `init()`, asks `background.js` to re-sync (`checkThemeUpdate` message) as a fallback path independent of the 5-second poll, plus a direct-native-messaging fallback (`tryDirectNativeSync`) if the background script itself is unreachable — iOS Safari's extension background context is not reliably alive.

On the page itself, three script-injection/read paths race to avoid a flash of unthemed content:

- `injected.js` runs first (`document_start`, before `content.js`), synchronously injects a hardcoded dark `<style id="aura-early-shield">` shield (`html{background-color:#121212 !important}`) before first paint, then asynchronously reads the current `browser.storage.local` cache and repaints the shield with the real resolved theme colors the instant it resolves — well before `content.js`'s own full pass runs.
- `content.js`'s `init()` reads `browser.storage.local` again and calls `applyTheme()`, which builds and injects the full stylesheet (`#aura-core-engine`) and removes the early shield.
- Both scripts independently bail out entirely (`return` before doing anything) if `AuraThemeHeuristics.isAdNetworkHost(location.hostname)` is true — see [ad handling](#ad-handling-in-progress) below — since `all_frames: true` in the manifest means these scripts also run inside every ad-network `<iframe>` on the page.

`browser.storage.onChanged` listeners in both `injected.js` and `content.js` mean a live theme change from the app propagates to an already-open Safari tab without a reload: app saves → App Group write → next `background.js` poll (≤5s, or immediately if the tab is refocused) → `browser.storage.local` write → `onChanged` fires → `content.js` calls `applyTheme()` directly with the new theme, no re-fetch needed.

## The theme engine (`content.js`)

This is the core of the product — roughly 1,800 lines split between one big generated stylesheet and a set of DOM-walking "safety net" passes that catch what static CSS can't. The design is deliberately layered: **CSS handles the general case, JavaScript handles what CSS specificity/timing cannot reach.**

### Layer 1 — the generated stylesheet (`getFullStyleSheet`)

Injected as `<style id="aura-core-engine">`, always moved to the end of `<head>` on every pass (`promoteEngineStylesheet`) so a page's own late-injected stylesheets can never out-cascade it on equal specificity.

- Defines CSS custom properties on `:root`: `--aura-bg`, `--aura-text`, `--aura-link`, `--aura-muted` (a `color-mix()` of text at 65% opacity), `--aura-border`. `--aura-surface`, `--aura-elevated`, and `--aura-overlay` are collapsed to `var(--aura-bg)` — flat, with no elevation/depth tint — because any white/black blend of the background produces a visibly different shade for a colored theme, which reads as inconsistent rather than intentional depth; dialogs, chrome bars, composer pills, and other authored surfaces all render the exact same color as the page now.
- **Remaps common design-system tokens onto those variables** so component libraries that already use CSS variables re-theme for free: Wikipedia's Codex tokens (`--color-base`, `--background-color-neutral`, …), Material's `--md-sys-color-surface`, and generic app-shell tokens (`--background-primary/secondary/tertiary`, `--bg-primary`).
- A universal transparency rule targets layout tags (`div, main, section, article, header, nav, aside, ul, ol, li, footer, figure, table*, form, fieldset, a`) and clears `background-color`/`backdrop-filter`, scoped away from anything matching the overlay selector (`:not([role="dialog"])…`) or an ad-surface selector (see below) via compound `:not()` chains.
- Dialogs/popovers/menus/listboxes get an explicit opaque `var(--aura-overlay)` fill instead of transparency (they're meant to sit on top of the page, not show through it), including a `dialog::backdrop` scrim and forced `mix-blend-mode: normal` on every descendant to defeat pages that use `mix-blend-mode` for their own dark-mode tricks.
- Inputs/textareas/selects get `background-color: transparent` (never `--aura-surface` — filling it would show up as an unwanted highlight inside already-transparent search boxes) plus an autofill-color override using the `transition: background-color 99999s` trick to defeat Safari's autofill yellow.
- A catch-all attribute/class selector clears literal inline `background-color:#fff`-style styles and common Tailwind-esque `bg-white`/`bg-gray-50` utility classes that the tag-based rule can't reach.
- Text, links, and `<mark>` (citation highlights) get themed color with `mix-blend-mode: normal`; images/svg/video/canvas/iframe are explicitly reset to `mix-blend-mode: normal` so a page's own blend tricks don't get double-applied against the new background.
- **Split (dual-color) themes**: `getFullStyleSheet` still contains a full live-paint branch (diagonal `linear-gradient` on `html::before`, gradient text-fill via `background-clip: text`) driven by `AuraSplitTheme`, but `splitTheme.js` hardcodes `LIVE_SPLIT_ENABLED = false`, so `isSplitTheme()` always returns `false` and this branch never actually renders for new themes. It exists so an old stored record with `backgroundType: 'split'` degrades to a plain color rather than crashing the engine. No current UI path can create a new split theme (`CustomThemeScreen.tsx` hardcodes `backgroundType: 'color'`).
- `SITE_FIXES` — an array of `{ match: [hostnames], css }` — is concatenated onto the end of the sheet when the current hostname suffix-matches an entry (`google.com` also matches `www.google.com`). This is the documented last resort for a specific leftover that a general heuristic can't cover; current entries handle Google's sign-in pill / search fade gradient / AI Overview result surfaces, Wikipedia's Codex infobox/navbox/footer chrome, and Amazon's search field.
- `UNIVERSAL_TRANSPARENCY_HOST_EXCLUDES` — a second, narrower host-scoped mechanism: a list of selectors that must never be matched by the universal transparency rule **at all** on a given host, not merely re-painted afterward by JS. Exists for exactly one confirmed case so far — github.com's mobile hamburger/close toggle (three `<span>` bars painted via `background-color: currentColor`) never composites once the universal rule's own stylesheet `!important` background-color rule matches an ancestor while a CSS `transform` transition is running on the bars — a genuine browser-level compositing bug, not a specificity/ordering issue a competing rule or a JS repaint can work around. Paired with `CHROME_REPAINT_DISABLED_HOSTS` below.

### Layer 2 — JS safety-net passes

All passes run inside `runSafetyPasses()`, triggered by a `MutationObserver` (childList/subtree/attributes on `style`/`class`/`hidden`/`open`, debounced 150ms) plus a `scroll` listener (200ms debounce, since some site chrome only becomes sticky after scrolling) plus a 60-second interval that re-resolves time-based day/night themes. DOM walks are sliced into chunks of 4,000 elements via `requestAnimationFrame` (`forEachSliced`) so a large page doesn't block the main thread in one tick, and a monotonically increasing `walkGeneration` counter lets an in-flight sliced walk be cancelled cleanly if a new theme is applied mid-walk.

- **Shell pass** (`rethemeOpaqueShells` / `visitShellElement`) — clears opaque or gradient fills on SPA shells (`#app`, `#app-mount`, `#root`, `#__next`, `#__nuxt`) and other elements matching `shouldClearShellBackground`, using inline `style.setProperty(..., 'important')`, which beats a site's own ID-selector `!important` rule (inline styles always win over stylesheet rules at equal `!important` weight).
- **Overlay pass** (`reopaqueOverlays` / `visitOverlayModalWalk`) — the trickiest heuristic in the engine. It must tell apart three shapes: a full-viewport or "covering sheet" scrim (≥75% viewport width, ≥45% height — `isCoveringSheetRect`), which must stay **transparent** so the page behind a cookie/sign-in curtain doesn't get hidden by a solid theme-colored wall; a small floating card/modal, which should be **opaque**; and site chrome that merely looks like a dialog. For a covering sheet, the scrim itself is left transparent and `findInnerModalCard` walks its descendants for the actual card to paint instead — but `findInnerModalCard` deliberately rejects a candidate that is itself full-viewport/covering-sheet sized (the same curtain guard). Some genuine ARIA dialogs (`role="dialog"`/`aria-modal`) have no background of their own and put the real panel on a plain, role-less full-viewport `<div>` one level inside (booking.com's mobile "More" menu: the dialog wrapper is transparent, its child fills the whole screen with white) — `findInnerModalCard` can never match that shape, so when it comes back empty **and** the outer element is a confirmed ARIA overlay root (`isOverlayRoot`), a second search, `findInnerDialogPanel`, looks for a full-viewport descendant with real content (text + an interactive element) instead. Gating the relaxed full-viewport allowance on genuine ARIA dialog semantics is what keeps it from ever firing on an anonymous curtain.
- **Expand-in-place panel passes** (`reopaqueExpandedNavMenuPanels`/`classifyNavMenuPanelState`, `reopaqueExpandedContentPanels`/`classifyExpandedContentPanelState`, and the nav-drawer branch inside the overlay pass, `classifyNavDrawerState`) — position-agnostic counterparts for menus/panels that expand in place (`display:none → block`, `height:0 → auto`) rather than as a `position:fixed` overlay: a Bootstrap-style `.navbar-collapse` mobile menu (UC Davis OASIS), a WordPress/Divi dropdown, or a card with no nav semantics at all, like booking.com's inline "Enter dates to see prices" date-picker. All three share one gate: an element is painted opaque only on a **confirmed collapsed → expanded transition**, tracked per-element in a `WeakMap`, never merely because it "currently looks expanded" — a level-triggered check mispainted an ambient sticky nav bar into a full-page curtain on wtatennis.com early in development. The content-panel variant (no nav semantics to key off) additionally allows painting on a first-ever sighting when the element appeared well after the page/theme settled and isn't one of several identically-classed siblings (the shape of an infinite-scroll list append) — needed because some panels, like a date-picker, don't exist in the DOM at all until opened, so there is no earlier "collapsed" sighting to transition from.
- **Bright/light-surface pass** (`visitBrightElement`) — clears near-white (`relativeLuminance >= 0.9`, WCAG-style sRGB→linear conversion) and low-chroma light-gray leftover fills (`isLightContentSurface`: alpha ≥ 0.4, max-min channel spread ≤ 40, luminance ≥ 0.55) that out-specify the tag-based universal rule, while explicitly excluding controls, icons, media, dialogs, and modal cards (`BRIGHT_SKIP_TAGS`, `shouldSkipBrightElement`). Skips entirely when the active theme is itself light (Sepia/Paper), since those surfaces are then correct as-is.
- **Sticky/fixed pass** (`reopaqueStickyFixed` / `visitStickyElement`) — the universal transparency rule strips backgrounds off `position: sticky`/`fixed` headers, which would otherwise let page content scroll through them. This pass re-opaques them with `--aura-bg` — but explicitly **must not** re-opaque a full-viewport or covering-sheet fixed element (a cookie-consent anchor, a HubSpot chat launcher shell), or it repaints the exact "solid curtain over the page" bug the overlay pass exists to avoid. (The code comments call out `usopen.com`/`wta.com`/`fox5sandiego.com` as sites that previously broke this way.) It also skips a wide/short sticky element whose direct children cover under half its own width (`childCoverageFrac`, computed from live layout geometry, which the universal rule never touches, unlike `background-color`) — a `position: sticky` flex wrapper that merely parks one small floating-action button at an edge (github.com's "back to top" `.BackToTop`) would otherwise get painted as an unwanted full-width bar behind that button.
- **Top-chrome pass** (`reopaqueTopChrome`) — for headers/search bars that are not sticky/fixed but still lose to a site's own `color-scheme: dark` fill (Google Shopping's `<header>`), walks up from `header/nav/[role=banner]/[role=search]/form` seeds to the outermost matching ancestor and paints it, then clears inner layout fills below it so scrolling can't reveal a second, differently-colored slab. **`CHROME_REPAINT_DISABLED_HOSTS`** (`wtatennis.com`, `github.com`) turns this pass, `reopaqueStickyFixed`, `restoreAuthoredChromeOpacity`, and the nav-drawer branch of the overlay pass off entirely for a matched host — the last resort once a chrome-repaint pass is confirmed to be the actual cause of a rendering bug on that specific site (github.com: the repeated re-paint itself was implicated in the compositing bug the `UNIVERSAL_TRANSPARENCY_HOST_EXCLUDES` selector exclusion above fixes) rather than something the heuristic can be made more precise about.
- **Contrast pass** (`visitContrastElement`) — computes the effective background an element sits on (`effectiveBackground`, walking ancestors for the first opaque fill) and, if the element's own text color fails a 3.0 contrast ratio against it, repaints with either the theme's link or text color (`pickReadableAgainstSurface`) — never blindly forcing `--aura-text` regardless of what's actually behind the element. Skipped entirely for an active split theme (inversion logic doesn't compose with per-element contrast picking) — moot today since split is disabled. Also skips an element whose `color` and `background-color` are the same value — a common technique for a monochrome icon shape with no fill of its own beyond `background-color: currentColor` (github.com's hamburger/close bars); rewriting `color` there for text-contrast purposes would silently repaint the shape's entire visible fill instead of just its "text."
- **Google-specific micro-passes** — `rethemeAskAnythingComposer` (clears dark pill shells around the "Ask anything" AI composer field that CSS `:has()` can't reach because the decorative fill sits on a sibling, not an ancestor) and `paintGoogleImagesViewer`/mosaic-hiding (the Images tab's full-screen viewer is a covering sheet by size but must be treated as an opaque second screen, not a transparent scrim, so it's special-cased by URL/tab detection — `isGoogleImagesPage`).

### Ad handling (known gap)

Ad-awareness is implemented but **inconsistently applied between the two entry scripts** — see [SUBMISSION_READINESS.md](SUBMISSION_READINESS.md) for this as an open blocker. Mechanically, as it stands:

- `isAdNetworkHost(hostname)` (`themeHeuristics.js`) matches ~24 known ad/analytics host suffixes (`googlesyndication.com`, `doubleclick.net`, `amazon-adsystem.com`, `criteo.com`, `taboola.com`, `outbrain.com`, …). Both `injected.js` and `content.js` check this **before doing anything else** and `return` immediately if the current frame's hostname matches — meaningful because `all_frames: true` means these scripts run inside every same- and cross-origin `<iframe>` on the page, including ad-network creative frames.
- `isLikelyAdSurfaceInfo` / `isInsideAdSurface` (`themeHeuristics.js`) classify a same-origin DOM node as an ad wrapper by id/class token (`ad-unit`, `adsbygoogle`, `google_ads_iframe`, `acm-ad-tag`, `gpt-ad`, `dfp-ad`, `ad-slot`, `adslot`, `ad-container`, `adhesion`) or `aria-label`/`aria-roledescription` containing "advertisement"/"sponsored", walking up to 8 ancestors. Every JS safety-net pass (`visitBrightElement`, `visitOverlayModalWalk`, `visitStickyElement`, `visitContrastElement`, `visitShellElement`, `reopaqueTopChrome`'s `paintChrome`) checks `isAdThemingSkipped(el)` and bails before touching a matched element.
- The generated stylesheet has a separate, narrower `adNot` compound `:not()` selector (only `.ad-unit`, `google_ads_iframe`, `acm-ad-tag`, `ins.adsbygoogle`, `[aria-label="Advertisement"]`) appended to the universal transparency/text/link/`mark` rules — narrower than the JS-side token list above, a known gap.
- **`isAdSafeFrameContext()`** (`themeHeuristics.js`) detects a SafeFrame-rendered cross-origin ad iframe (`window.$sf`/`window.inDapIF`) independent of hostname matching, since a same-origin ad creative wouldn't match `isAdNetworkHost` at all. `injected.js` checks it and removes its own early paint shield inside a detected ad frame — but **`content.js`'s `init()`/`applyTheme()` path never checks it**, so moments later the full `#aura-core-engine` stylesheet still gets injected into that same ad iframe anyway. The early-paint flicker is suppressed; the actual theme-painted-into-the-ad-creative bug is not. See [SUBMISSION_READINESS.md](SUBMISSION_READINESS.md) for the fix direction.

## Supporting engine modules

All three are pure-logic UMD modules — `module.exports` under Jest, a `window.AuraX` global when loaded as a classic script in the extension — so the exact same code backs both the runtime and the unit test suite.

- **`themeHeuristics.js`** — the predicate library described above: color math (`parseCssRgb`, `relativeLuminance`, WCAG contrast ratio), surface classification (near-white, low-chroma, modal-card shape, floating-banner, search-chrome, top-chrome-bar, ad-surface), and the `OVERLAY_SELECTOR`/`BRIGHT_SKIP_TAGS`/`SPA_SHELL_IDS` constants shared by `content.js`.
- **`themeResolve.js`** — theme **precedence**: per-site theme (if `siteThemes[host].enabled !== false`) beats a time-based day/night rule (`resolveTimeBasedTheme`, minute-of-day comparison with wraparound for overnight ranges) beats the global theme. `hostMatches` implements the suffix-match rule used both here and in `SITE_FIXES`.
- **`splitTheme.js`** — the disabled dual-color renderer: diagonal-gradient CSS builders, gradient text-fill CSS, and the `LIVE_SPLIT_ENABLED` flag. `isSplitThemeRecord` (detection) and `isSplitTheme` (detection **and** the flag) are intentionally separate functions — tests assert the flag suppresses live rendering without breaking detection of legacy stored records.

## Content Blocker extension

`ContentBlockerRequestHandler.swift` implements `com.apple.Safari.content-blocker`. Four static JSON rule lists ship in the bundle (`blocklist-ads.json` 72 rules, `blocklist-trackers.json` 59, `blocklist-social.json` 21, `blocklist-annoyances.json` 38 — 190 total, well under Apple's per-extension ceiling). At `beginRequest`, the handler reads `contentBlockerSettings.categories` from the same App Group blob and dynamically concatenates only the enabled categories' rules, falling back to a single no-op rule if every category is off (Safari requires at least one rule). This extension is completely independent of the Safari Web Extension's theme engine — different extension point, different mechanism (declarative WebKit content-blocking rules vs. injected JS/CSS), sharing only the App Group storage.

## Focus Filter extension (built, not shipped)

`FocusFilterExtension` implements `SetFocusFilterIntent` (`com.apple.intents-service`, iOS 16+ Focus Filters). `AuraFocusFilter` resolves a theme by id/name against 9 built-in presets mirrored from the RN app's `BrowseThemesScreen.PRESET_THEMES` (`AuraPresetDefinitions.swift`) plus any of the user's custom themes, and writes the resolved theme back into the shared App Group blob as `globalTheme`. Entitlements and the App Group identifier are correctly configured. It is excluded from the shipping build purely because `TintApp`'s "Embed App Extensions" build phase doesn't copy its `.appex` — a deliberate, clean exclusion, not a broken half-build. It could be re-enabled by adding it to that copy-files phase whenever Focus integration is ready to ship.

## React Native app

Three-tab MVP (`App.tsx`): **Themes** (`SafariScreen`) → **Protection** (`ContentBlockerScreen`) → **Settings** (`SettingsScreen`), plus a stack for `BrowseThemes`, `CustomThemesList`, `CustomTheme`, `WebsiteSettings`, `ThemeSelection`, `PrivacyPolicy`. `FocusModeScreen` and `FocusModePresetSelectionScreen` exist, are fully wired to storage, but are not registered in the navigator — see [SUBMISSION_READINESS.md](SUBMISSION_READINESS.md) for a routing bug in that dead code.

**State management**: no Redux/MobX/Zustand. `AppThemeContext` holds only static in-app chrome colors (the app's own UI, not Safari themes) — its `setAppThemeColor`/`setAppThemeMode` are no-ops, since in-app appearance is fixed for this release even though `storage.js` still persists those fields. The actual theme configuration has no in-memory shared store at all: every screen independently calls `getThemes()` on mount and again on `navigation.addListener('focus', …)`, mutates the relevant sub-key of the full blob, and calls `saveThemes()` — a read-modify-write-full-blob pattern repeated in essentially the same shape across eight screens/services rather than factored into a shared hook.

**Native bridges**:
- `react-native-shared-group-preferences` (third-party npm package) is the only path from JS into `UserDefaults(suiteName: "group.com.alexmartens.tint")` — used exclusively inside `src/storage.js`. It is not a bridge Aura wrote itself.
- `ContentBlockerManager` (custom Swift + Obj-C bridge in `ios/TintApp/`) exposes `reloadContentBlocker`, `getContentBlockerState`, `getBlockListStats`, and `getSafariExtensionState` (a heartbeat-based liveness check, not a true enabled/disabled query — iOS exposes no such API before 26.2).
- `FocusModeManager` (custom Swift + Obj-C bridge) exposes Focus Filter availability/presets to `FocusModeService.ts`, which is itself only called from the two dead Focus screens — currently unreachable from any live UI path.

## Testing

`package.json`'s `test:engine` script already draws the line the codebase implicitly follows: **engine tests** (`__tests__/themeHeuristics.test.js`, `splitTheme.test.js`, `themeResolve.test.js`) exercise the pure UMD modules directly under Jest with no DOM mocking beyond what the predicates need, and are the best-covered part of the codebase — including the specific `isAdNetworkHost`/`isLikelyAdSurfaceInfo` cases added alongside the in-progress ad fix. **App tests** are thin: `App.test.tsx` is a render-only smoke test, and `storageShape.test.js` covers `validateThemeData`/`getDefaultThemeData` but not `saveThemes`/`getThemes`'s retry, checksum, or corruption-recovery behavior. There are no screen, component, or navigation tests.

## Development setup

- iOS 17.0+ (`TintApp`'s actual `IPHONEOS_DEPLOYMENT_TARGET`; other targets range 15.1–17.0 — see [SUBMISSION_READINESS.md](SUBMISSION_READINESS.md) if a lower shared minimum is intended), Xcode 13+, React Native 0.81.4, Node.js ≥ 20, Ruby (CocoaPods).
- `npm install && bundle install && cd ios && bundle exec pod install && cd ..`
- Open `ios/TintApp.xcworkspace` (not the `.xcodeproj`) and build the `TintApp` scheme — this also compiles (but does not embed) the legacy `TintExtension` host target, since it's part of the same scheme's archive action.
- `npm run ios` for the RN app in the simulator; the Safari extension only runs against a device/simulator with the extension enabled under Settings → Safari → Extensions (background scripts and the native handler don't run standalone).
- `npm test` for the full Jest suite; `npm run test:engine` for just the extension-engine tests.

## Project structure

```
Aura/
├── App.tsx, index.js                          # RN entry points
├── SUBMISSION_READINESS.md                    # Punch list before App Store submission
├── docs/privacy/, docs/privacy-policy.*        # Hosted privacy policy (GitHub Pages)
├── src/
│   ├── screens/                                # SafariScreen, ContentBlockerScreen, SettingsScreen
│   │                                            # (MVP tabs) + BrowseThemes/CustomTheme*/WebsiteSettings/
│   │                                            # ThemeSelection/Onboarding/PrivacyPolicy (stack) +
│   │                                            # FocusMode*  (fully wired, not registered — dead)
│   ├── components/                              # Only ThemeSwatch, Snackbar, WheelColorPickerModal
│   │                                            # (+ ModernColorPickerModal) are actually used;
│   │                                            # ColorPickerDropdown/Modal/Simple, ThemeModePicker,
│   │                                            # GearIcon, SmileyIcon are unused
│   ├── contexts/AppThemeContext.tsx             # Static in-app chrome colors only
│   ├── services/                                # SafariExtensionService, FocusModeService (unreachable),
│   │                                            # SunsetSunriseService (location is a stub), HapticService
│   ├── constants/AppConfig.ts                   # Bundle IDs, privacy URL, support email
│   └── storage.js                               # App Group read/write layer — see Storage architecture
├── ios/
│   ├── TintApp/                                 # Main app target (ships) + native bridges
│   │   ├── ContentBlockerManager.swift/.m
│   │   └── FocusModeManager.swift/.m
│   ├── TintExtension Extension/                 # Safari Web Extension (ships) — the theme engine
│   │   ├── SafariWebExtensionHandler.swift      # Native bridge: App Group → extension storage
│   │   └── Resources/
│   │       ├── manifest.json                    # MV3, <all_urls>, all_frames, document_start
│   │       ├── themeHeuristics.js                # Pure predicates (shared with Jest)
│   │       ├── splitTheme.js                     # Dual-theme renderer (feature-flagged off)
│   │       ├── themeResolve.js                   # site > time-based > global precedence
│   │       ├── injected.js                       # Early paint shield, runs before content.js
│   │       ├── content.js                        # The theme engine (CRITICAL)
│   │       └── background.js                     # App Group ↔ browser.storage.local sync/broadcast
│   ├── ContentBlockerExtension/                  # Ships — 4 JSON blocklists, dynamic merge
│   ├── FocusFilterExtension/                     # Built, not embedded — see above
│   ├── KeyboardExtension/                        # Empty directory, not a real target
│   └── TintExtension/                            # Legacy host app — not embedded, still compiled
└── android/                                      # React Native scaffolding, not actively supported
```

## License

Private project — All rights reserved.
