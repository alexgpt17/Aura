# Submission readiness — Aura

Everything found during a full re-scan (2026-09-13, `HEAD` = `5670d1c` plus this session's flat-background-token and dead-code-cleanup changes) that stands between this build and an App Store submission, ranked by priority. See [README.md](README.md) for the architecture context behind each item.

This replaces an earlier version of this document (2026-08-25, commit `cfcef1e`). Four real commits landed after that scan (`3cb8c0f`, `306f8c4`, `af12dbc`, `5670d1c` — ~5,000 lines changed across `content.js`/`themeHeuristics.js`), then a separate work session fully restored git to `5670d1c` and discarded a large amount of uncommitted experimentation. Every item below was individually re-verified against the current files rather than carried forward from the old narrative.

## Blockers — fix before submitting

### 1. Ad iframe theming leak — confirmed still live

`all_frames: true` in the manifest means Aura's scripts run inside every same- and cross-origin `<iframe>` on a page, including ad-network creative frames. `isAdSafeFrameContext()` (`themeHeuristics.js`) detects a SafeFrame-rendered ad iframe (`window.$sf`/`window.inDapIF`) independent of hostname matching. `injected.js` checks it and removes its own early dark paint shield inside a detected ad frame — but `content.js`'s `init()`/`applyTheme()` path **never checks it at all**, confirmed by grep (`isAdSafeFrameContext`/`isConfirmedAdFrame` appear only in `themeHeuristics.js` and `injected.js`, nowhere in `content.js`). Net effect: the early flicker is suppressed, but the full `#aura-core-engine` stylesheet still gets injected into the ad creative moments later — the actual "theme painted into the ad" bug is unchanged.

**Fix direction:** add the same `isAdSafeFrameContext()` check to `content.js` at the point `applyTheme()` is called from `init()`, mirroring what `injected.js` already does, so both files agree and bail together.

**Honest limitation either way:** this only covers SafeFrame-rendered ads — a large share of programmatic display ads, but not all formats — and there's an inherent small window between `document_start` and the async check where a shield could still flash first.

### 2. fox5sandiego.com curtain — code present, needs device verification

Not an open code gap. `revertStickyPaint`, `chromeOuterModified`, `modalCardOpaqueModified`, `revertGrownModalCards`, and a `SITE_FIXES` entry for `fox5sandiego.com` are all extensively present in current `content.js` (landed in one of the four commits after the last scan). The mechanism: `visitStickyElement`/`reopaqueTopChrome` and the overlay pass now track their own prior opaque paints and revert them once a later pass decides the element (or a formerly-small consent/CMP wrapper) has grown into covering-sheet/curtain territory, rather than staying stuck opaque forever.

**Still needed:** this has never been device-tested against the *current* build specifically. Verify on fox5sandiego.com (dark theme, scroll) before treating as shipping-ready — see test pass below.

## Should fix before submitting

### 3. Legacy `TintExtension` host target still archives with every build

`TintApp.xcscheme` still has `buildForArchiving = "YES"` for the `TintExtension.app` `BuildableName` (confirmed). It isn't embedded in the shipped `.ipa` — `TintApp`'s "Embed App Extensions" phase only copies `TintExtension Extension.appex` and `ContentBlockerExtension.appex` — so it's not a review risk, but archiving `TintApp` still compiles it every time. One-checkbox fix, best done by hand in Xcode rather than a scripted `.xcscheme` edit (risks Xcode silently reformatting the file on next save for a change with no functional benefit): **Product → Scheme → Edit Scheme… → Archive tab → uncheck `TintExtension`.** Leave Test/Run/Profile/Analyze untouched.

### 4. `content.js` has no debug-logging gate

`background.js` has a module-scoped `AURA_DEBUG_LOGGING = false` flag gating its ~25 tracing `console.log` calls (confirmed present, off by default). `content.js` has no equivalent — confirmed by grep, zero matches for `AURA_DEBUG_LOGGING` in the file. Any tracing `console.log` calls in `content.js` are unconditionally on. Add the same flag/pattern for consistency and a quieter Safari console for anyone (reviewer or user) who opens dev tools.

### 5. Google "Ask anything" trigger button unthemed

`<button>` tags are unconditionally excluded from every background/color-touching pass in the engine (avoids breaking arbitrary sites' branded CTAs), and the Google-scoped "Ask anything" composer logic (`rethemeAskAnythingComposer`) only matches text-input-shaped elements (`textarea`, `input`, `[contenteditable="true"]`, `[role="textbox"]`) — never the *collapsed trigger pill* itself, which renders as a white/unthemed box. Confirmed still unfixed — no `isAskAnythingTrigger`/`paintAskAnythingTriggerText` anywhere in the code. Not attempted yet.

### 6. Google search — typing lag and visual glitches (unresolved, nothing currently in code)

Four related issues on google.com, all Google-specific (not reproduced on other sites):

- **Lag while typing in the main search bar.**
- **Lag while typing in the AI Mode / "Ask anything" composer.**
- **The search-suggestions dropdown visibly flashes** between its normal opaque state and transparent while it's open or updating.
- **Text color flashing.** On a search results knowledge-panel/sports widget (e.g. a live-score card), white text — tab labels like "MEN'S SINGLES"/"WOMEN'S SINGLES", the day-of-week date tabs, a "Video highlights" caption — flashes back and forth between plain white and the active theme's color (green, in the reported case) roughly every 1-2 seconds. Same flicker cadence as the suggestions-dropdown flash above, but on `color` rather than `background-color`/opacity — likely the same underlying repeated re-theme/un-theme cycle rather than a separate bug, though unconfirmed. Newly reported, not yet investigated at all — no prior fix attempt exists for this one, unlike the other three.

History for the first three, for whoever picks this back up: the AI composer had a verified-working on-device fix (`paintAskAnythingChipOpaque` plus a stable `[data-xid="aim-mars-input-plate"]` selector, confirmed real via Safari Web Inspector's Sources search of Google's own minified JS) before it was discarded. The main-search-bar transparency issue went through one regressive attempt (a single-gate `position:fixed` + full-viewport check matched `document.body`/`document.documentElement` themselves via Google's `.qb0KL` body-lock class, blacking out the entire search screen — reverted) and one untested redesign (three independent gates: html/body exclusion, `role="search"`/`searchbox` descendant requirement, `document.elementFromPoint()` topmost-visibility confirmation) that never got on-device verification. The suggestions-dropdown flashing never got a confirmed root cause; suspicion pointed at an interaction with the universal transparency rule. Treat all four as open/unstarted, not "in progress" — nothing survives to build on.

### 7. Google search — initial theme-load lag

A few seconds of visibly wrong colors while Google's AI Overview streams in, before the engine's normal debounced pass catches up. Confirmed still unattempted in current code (no `runFastPathForMutations`). A speculative un-debounced-pass-on-every-mutation approach was tried once, suspected of being expensive enough on every site to cause unrelated regressions, and abandoned before device confirmation either way. Don't re-attempt this in the same pass as item 2 (fox5sandiego) — a prior combination of "chrome/lag fix" changes is what produced an unconfirmed, likely-wrong result last time.

### 8. iOS deployment-target documentation mismatch

README previously claimed "iOS 15.0+." Actual `IPHONEOS_DEPLOYMENT_TARGET` in `project.pbxproj`: `TintApp` (main app, tests) = **17.0**, `TintExtension Extension` (Safari extension host) = 16.6, `FocusFilterExtension` = 16.0, `ContentBlockerExtension` = 15.1. App Store Connect will show the real effective minimum for the umbrella app (17.0, since the main app target gates the whole submission), not 15.0. README has been corrected to state this. **Open decision for Alexander:** is 17.0 intentional, or should `TintApp`'s deployment target be lowered to match the extensions (and if so, is anything in the app actually iOS-17-only, or was this drift accidental)?

### 9. Stray empty iconset in the legacy `TintExtension` host target

`ios/TintExtension/Assets.xcassets/AppIcon.appiconset/Contents.json` references icon filenames that don't exist on disk anywhere in that directory (confirmed — only `Contents.json` is present, zero PNGs). This target isn't embedded in the shipped `.ipa` (see item 3), so likely benign — extensions commonly inherit the host app's icon — but worth a quick confirmation rather than assuming, since it sits right next to item 3's other legacy-target loose end.

### 10. Stray `console.log` in shipped/reachable RN code

`App.tsx:100` is in a live path that ships. `FocusModeService.ts:47,54,61` are lower priority since that service is only called from the two unregistered Focus Mode screens (see item 11) — unreachable from any live UI path today.

### 11. Dead-code hygiene: Focus Mode screens fully unreachable

`FocusModeScreen.tsx` and `FocusModePresetSelectionScreen.tsx` exist, are fully wired to storage (`focusModeSettings` in `src/storage.js`), but are not imported or registered anywhere in `App.tsx` — confirmed by a fresh navigation-structure survey. Not a submission blocker on its own (dead code isn't a rejection risk), but means Focus Mode is entirely unreachable from the shipping 3-tab UI. If it ships in a future release, this is a matter of registering a route and re-embedding the native `FocusFilterExtension` (excluded from `TintApp`'s "Embed App Extensions" phase, per README), not debugging anything broken.

## Test pass before submitting

Re-run the full manual device regression (dark theme + light theme on each):

- [ ] **fox5sandiego.com** — item 2: code present, device-verify no solid curtain and scroll does not re-swallow content
- [ ] Google (web, Images, Shopping — carousel tiles aren't painted as modal sheets)
- [ ] Google search — main search bar typing (item 6, unfixed — expect lag), AI Mode composer typing (item 6, unfixed — expect lag), suggestions dropdown (item 6, unfixed — expect flashing), a knowledge-panel/sports widget with white text on a themed background (item 6, unfixed — expect text color flashing between white and theme color), "Ask anything" trigger pill (item 5, unfixed — expect white box), initial AI Overview streaming settle (item 7, unfixed — expect brief wrong colors)
- [ ] Wikipedia (infobox/tables readable)
- [ ] Amazon search
- [ ] YouTube, Reddit, X
- [ ] **A news site with programmatic display ads** — confirm ad creatives are untouched, not painted (item 1, currently a confirmed live bug — expect this to fail until item 1's fix lands)
- [ ] One cookie/sign-in sheet (scrim stays transparent, inner card opaque)
- [ ] Maps (must not get a solid theme curtain)
- [ ] Content blocker categories reload correctly after toggling
- [ ] Fresh install → onboarding → enable extension flow, exactly as a reviewer would follow it — extension should show as "Aura" (confirmed fixed, verify on-device)
- [ ] No crash on launch, background, or theme switch

If a site fails, add a `SITE_FIXES` entry with a stable selector rather than loosening a general heuristic — the engine's existing convention (see `content.js` `SITE_FIXES` and README's "Layer 1" section).

## Optional cleanup (binary hygiene, not a rejection risk)

None of these block submission — Apple won't reject for unused code — but they're worth a pass since you're already in here. All independently re-confirmed present in this scan:

- **Unused RN components**: `ColorPickerDropdown.tsx`, `ColorPickerModal.tsx`, `SimpleColorPickerModal.tsx`, `ThemeModePicker.tsx`, `GearIcon.tsx`, `SmileyIcon.tsx` are never imported anywhere.
- **Unused npm dependencies**: `react-native-color-picker`, `reanimated-color-picker`, `react-native-wheel-color-picker` — the app uses a hand-rolled `ModernColorPickerModal` instead. Safe to remove from `package.json`.
- **Dead/uncompiled Swift scripts**: `ios/TintApp/GenerateAppIcon.swift` and `AppIconGenerator.swift` aren't in `TintApp`'s Sources build phase and import `AppKit`, which wouldn't compile for iOS anyway. Icons are already fully generated and correct (all 9 required sizes present, correct dimensions, RGB no-alpha) — these scripts served their purpose and can be deleted.
- **Empty `ios/KeyboardExtension/` directory** — not a real Xcode target, zero files, zero references. Delete or leave; either way it ships nothing.
- **Duplicate hardcoded support email**: `WebsiteSettingsScreen.tsx` hardcodes `alexmartens1111@gmail.com` in a `mailto:` link instead of importing `SUPPORT_EMAIL` from `AppConfig.ts` (same value today, but two places to update if it ever changes). Also worth a conscious decision on whether a personal Gmail address should be the user-facing support contact at all, versus a dedicated address.
- **Vestigial storage fields**: `recentlyUsedThemes` is written on every theme selection but never read back by any screen; `appThemeColor`/`appThemeMode` are persisted but their setters are no-ops (`AppThemeContext.tsx` hardcodes in-app appearance for this release). Either wire them up or stop persisting them.
- **`SunsetSunriseService.getCurrentLocation()` is a stub** that always returns `null` (real geolocation was never implemented; the dead Focus Mode screen falls back to manual lat/lon entry). Only matters if Focus Mode / location-based day-night ships.
- **No RN screen/component/integration tests exist** — `App.test.tsx` is a render-only smoke test. Not a submission requirement.

## App Store Connect — paste-ready content

Re-verified against current `Info.plist`/`project.pbxproj`/privacy-manifest/privacy-policy state this scan — no changes needed to the content itself.

### Listing

| Field | Value |
|---|---|
| Name | Aura |
| Subtitle | Themes for Safari |
| Category | Utilities (secondary: Productivity) |
| Age rating | 4+ |
| Bundle ID | `com.alexmartens.aura` |
| Copyright | 2026 Alex Martens |
| Privacy Policy URL | https://alexgpt17.github.io/Aura/privacy/ |
| Support URL | `mailto:alexmartens1111@gmail.com`, or a hosted support page |

**Promotional text**: Recolor Safari with beautiful themes, custom colours, and per-site overrides — all on your device.

**Description**:
> Aura recolors websites in Safari with selectable themes. Pick a preset, create your own colours, and set overrides for individual sites. An optional content blocker can filter ads, trackers, social widgets, and annoyances.
>
> How to get started:
> 1. Open Aura and choose a theme.
> 2. On iPhone, go to Settings → Safari → Extensions and turn on Aura. Allow access on All Websites.
> 3. Open Safari — your theme applies on the page.
>
> Themes and settings stay on your device. Aura does not require an account and does not sell or upload your browsing content.

**Keywords**: `safari,theme,dark mode,color,extension,content blocker,custom theme,website`

**What's New (1.0)**: Initial release: Safari themes, custom colours, per-site overrides, and optional content blocker.

### App Privacy nutrition labels

Every category — Contact Info, Health & Fitness, Financial, Location, Sensitive Info, Contacts, User Content, Browsing History, Identifiers, Purchases, Usage Data, Diagnostics — is **No**, re-confirmed this scan (no analytics/tracking SDK of any kind found in dependencies or source; privacy manifests present for every relevant target). **Data linked to user: None. Data used to track: No.**

### App Review notes (paste into App Review Information → Notes)

> Aura lets users recolor Safari web pages with selectable themes, create custom themes, set per-site overrides, and optionally enable a Safari Content Blocker for ads/trackers/annoyances.
>
> **Required setup (Safari theming)** — the container app configures themes; the Safari Web Extension applies them. You must enable the extension or Safari will look unchanged:
> 1. Install and open Aura, complete onboarding (or open the Themes tab).
> 2. Settings app → Safari → Extensions → enable **Aura** (Safari Web Extension) → Allow on All Websites.
> 3. Return to Aura → Themes → choose a theme.
> 4. Open Safari to any webpage — the theme should apply.
>
> **Content Blocker (optional)**: Aura → Protection tab → enable categories → Settings → Safari → Extensions → enable Aura Content Blocker → Allow on All Websites.
>
> **Privacy**: https://alexgpt17.github.io/Aura/privacy/ — Aura does not collect account data, location, or analytics. No sign-in. The Safari extension's broad website access (`<all_urls>`) is used only to apply on-device theme CSS; page contents are never uploaded.
>
> **Focus Mode**: not included in this build (extension not embedded). Aura will not appear under Settings → Focus → Focus Filters.
>
> **Test account**: none — no login.

The extension now correctly shows as "Aura" in Settings → Safari → Extensions (confirmed fixed in `_locales/en/messages.json`), so the "enable Aura" instruction above matches what a reviewer will actually see.

### Signing & capabilities checklist

- Identifiers (developer.apple.com): `com.alexmartens.aura` (App), `com.alexmartens.aura.SafariExtension` (Extension), `com.alexmartens.aura.ContentBlockerExtension` (Extension), `group.com.alexmartens.tint` (App Group) — enable the App Group on all three IDs. All entitlements files on disk declare this group identically, so once the identifiers exist server-side this is just a signing/provisioning step, not a code change.
- Xcode → `TintApp` scheme → Signing & Capabilities → paid team `4JV5Y33KJB` (confirmed set), automatic signing (confirmed).
- Export compliance: `ITSAppUsesNonExemptEncryption = false` is already set in `Info.plist` — confirmed correct (standard HTTPS only).
- Privacy manifests (`PrivacyInfo.xcprivacy`) confirmed present for `TintApp`, `TintExtension Extension`, `ContentBlockerExtension`, and `FocusFilterExtension`.
- No usage-description keys (`NS*UsageDescription`) exist anywhere in the project — confirmed consistent with current functionality (no live Camera/PhotoLibrary/Geolocation API calls; `SunsetSunriseService`'s geolocation is a stub, see cleanup list).
- Archive the **TintApp** scheme (see item 3 above for the legacy-target caveat).

### Screenshots

Still need to be captured on a physical iPhone (6.7" and/or 6.1"): Themes tab with a theme selected, Browse Themes list, custom theme editor, a themed page in Safari (after enabling the extension), Protection/content-blocker screen, Settings. Match exactly what the shipping 3-tab UI shows — no Focus/Rules tab, no purchase screen (there isn't one in this codebase — confirmed no IAP/StoreKit code anywhere).
