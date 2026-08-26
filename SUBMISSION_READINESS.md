# Submission readiness — Aura

Everything found during a full codebase scan (2026-08-25) that stands between this build and an App Store submission, ranked by priority. See [README.md](README.md) for the architecture context behind each item.

## Blockers — fix before submitting

> **2026-08-26 — `content.js` was reverted to `fac4c5a` at user request, then §1a's curtain revert paths were re-applied the same day.** Items below that still describe undone `content.js` work: half of 1b's fix, item 4's `content.js` gate, item 6. `injected.js`, `background.js`, `themeHeuristics.js`, and the test file were *not* part of that full-file revert and may still carry their own uncommitted changes — see 1b for the remaining inconsistency.

### 1a. ✅ Fixed (code) — fox5sandiego.com curtain — awaiting device verify

The first attempted fix (a CSS-level ad-token collision theory) was device-tested and confirmed wrong. A second pass diagnosed two independent bugs in the same class; both revert paths are **re-applied in `content.js`** (2026-08-26):

**Diagnosis 1 — sticky/top-chrome passes.** `visitStickyElement` and `reopaqueTopChrome`'s `paintChrome` both re-evaluate "is this safe to paint opaque?" on every pass, but neither had a way to undo a previous opaque paint once a later re-evaluation decided the element should now be skipped. A `position: sticky`/`fixed` element that's small (safe to paint) before layout settles or before more of it has scrolled into view, then grows into covering-sheet territory, stayed permanently painted with the theme's background color from its first "safe" evaluation — matching "briefly visible, then swallowed while scrolling." **Fix:** sticky skip now clears prior paints (`revertStickyPaint` + re-check of `stickyModified`); top chrome tracks outer bars in `chromeOuterModified` and reverts when no longer a safe top-chrome bar / covering sheet.

**Diagnosis 2 — the overlay/modal-card pass.** `visitOverlayModalWalk` (the heuristic detector for consent/curtain wrappers with no `role="dialog"` — the common case for plain-`<div>` CMP implementations on ad-heavy local-news sites) only acts while `isLikelyModalCard(el)` is true, painting a small `position:fixed` card opaque with `--aura-overlay`. `isLikelyModalCard` correctly excludes anything that's grown into covering-sheet/full-viewport size — but once a CMP wrapper expands past that threshold (exactly how these animate after first paint), the function stops running for it entirely and the earlier opaque fill is never reverted. Unlike ARIA-role dialogs (re-evaluated fresh every pass by `reopaqueOverlays`, self-correcting), a non-ARIA curtain `<div>` is *only* ever touched by this one heuristic path, so it gets permanently stuck opaque once it outgrows "card" size. **Fix:** `modalCardOpaqueModified` + `revertGrownModalCards` each safety pass (mirrors sticky-pass revert).

**Current state:** sticky/chrome + modal-card revert paths are in `content.js`, plus a follow-up harden (2026-08-26): sticky re-opaque is chrome-only (height ≤ top-chrome max, z-index < 1000), skips ad surfaces / modal cards, and fox5sandiego.com has a SITE_FIX forcing known overlay shells transparent. Device-check fox5sandiego.com (dark theme + scroll) before treating as shipping-ready.

### 1b. ⚠️ Ad "white box" issue — now in a split, inconsistent state (worse than fully reverted)

Widening `AD_NETWORK_HOST_SUFFIXES` and adding iframe-ancestor marking made no visible difference on device — those only affect the parent page, not Aura's own script running *inside* an ad's cross-origin iframe (`all_frames: true`). The follow-up fix added a host-agnostic signal, `isAdSafeFrameContext()` (`themeHeuristics.js`, unreverted — checks `window.$sf` / `window.inDapIF`), checked from **two** places: `injected.js` (removes the early dark shield and stops) and `content.js`'s `init()` (set `isConfirmedAdFrame`, checked at the `applyTheme` choke point so no code path re-themes the frame).

**The `content.js` revert above broke this fix's symmetry, not just undone it.** `injected.js` still checks `isAdSafeFrameContext()` and removes its early shield inside a detected ad iframe — but `content.js` no longer checks it at all, so moments later `content.js` will still build and inject the full `#aura-core-engine` stylesheet into that same iframe. Net effect: the dark shield is now suppressed (good) but the actual theme still gets painted into the ad creative anyway (the original bug) — the early-paint flicker is gone but the "white/black box" outcome is unchanged, and the two files are now inconsistent with each other for no benefit. **Pick one:** revert `injected.js`'s `isAdSafeFrameContext()` check too (for a clean, fully-reverted state), or re-apply the `content.js`-side `isConfirmedAdFrame` check (to restore the intended fix). Leaving it split is strictly worse than either.

**Honest limitation** (applies whichever way this is resolved): this only closes the gap for ads using SafeFrame rendering — the majority of programmatic display ads, not all formats — and there's an inherent small window between `document_start` and the async recheck where an ad iframe could still flash the dark shield first.

### 2. ✅ Fixed — Safari extension showed the wrong name in iOS Settings

`ios/TintExtension Extension/Resources/_locales/en/messages.json` had unedited Xcode template strings ("TintExtension Extension" / generic filler text). Updated to `"Aura"` and a real one-sentence description. `manifest.json` already referenced these correctly via `__MSG_extension_name__`/`__MSG_extension_description__` — no manifest change needed.

**Still needed:** device check — Settings → Safari → Extensions should now show "Aura."

## Should fix before submitting

### 3. Legacy `TintExtension` host target rides along with every `TintApp` archive — manual step, not yet done

`TintApp.xcscheme` includes the legacy `TintExtension` host app as a `BuildActionEntry` with `buildForArchiving = YES`. It isn't embedded in the shipped `.ipa` (confirmed — `TintApp`'s "Embed App Extensions" phase only copies `TintExtension Extension.appex` and `ContentBlockerExtension.appex`), so it's not a review risk, but archiving `TintApp` still compiles this target every time. This is a one-checkbox fix best done by hand in Xcode rather than a scripted file edit (hand-editing `.xcscheme` XML risks Xcode silently reformatting it on next save, for a change with no functional benefit beyond build time): **Product → Scheme → Edit Scheme… → Archive tab → uncheck `TintExtension`.** Leave the Test/Run/Profile/Analyze tabs untouched.

### 4. Half-fixed — `background.js`/`content.js` debug logging

`background.js`'s ~25 `console.log` calls (5-second poll tracing) are gated behind a module-scoped `AURA_DEBUG_LOGGING = false` flag, following the same pattern as `LIVE_SPLIT_ENABLED` in `splitTheme.js`. **`content.js`'s matching gate was undone by the `content.js` revert above** — its sync-tracing `console.log` calls are back to always-on. Genuine `console.error`/`console.warn` on real failure paths are intentionally left ungated in both files. Re-add the same flag to `content.js` if/when its other reverted changes are re-applied — no reason to do it in isolation first.

### 5. ✅ Fixed — dead-code routing bug in unreachable Focus Mode screens

`FocusModeScreen.tsx` called `navigation.navigate('FocusModePresetSelection', …)` — a route name that was never registered anywhere, while the actual screen component is named `FocusModeThemeSelectionScreen`. Both call sites now correctly reference `'FocusModeThemeSelection'`, matching this codebase's route-naming convention (component name minus `Screen`). This is hygiene only — Focus Mode remains deliberately unreachable from the shipping 3-tab MVP navigator (no route was registered in `App.tsx`, nothing was wired in). If Focus Mode ships in a future release, wiring in a `<Stack.Screen name="FocusModeThemeSelection" .../>` (and re-embedding the native `FocusFilterExtension`, per the README) is now a matter of registering it, not also debugging a broken navigation reference.

### 6. Not fixed — Google "Ask anything" trigger button unthemed

`<button>` tags are unconditionally excluded from every background/color-touching pass in the engine, by design (avoids breaking arbitrary sites' branded CTAs), and the Google-scoped "Ask anything" composer logic only matches text-input-shaped elements (`textarea`, `input`, `[contenteditable="true"]`, `[role="textbox"]`) — never the collapsed trigger pill itself, which renders as a white/unthemed box. A fix for this (`isAskAnythingTrigger`/`paintAskAnythingTriggerText` in `content.js`, plus a shared text-matching predicate) was written and then undone by the `content.js` revert above — it never got on-device verification either way. Still open, unfixed, starting from scratch if revisited.

### 7. Still open — Google search initial theme-load lag

A few seconds of visibly wrong colors while Google's AI Overview streams in, before the engine's normal debounced pass catches up. A speculative fix (`runFastPathForMutations`, an un-debounced pass on every mutation) was tried, suspected of causing the fox5sandiego.com regression (item 1a) by adding synchronous work on every mutation on every site, and was reverted before ever being device-confirmed either way — and is now moot regardless, since the full `content.js` revert above means it isn't in the code either way. Don't re-attempt this in the same pass as item 1a — that combination is what produced an unconfirmed, likely-wrong fix last time.

## Test pass before submitting

Re-run the full manual device regression (dark theme + light theme on each), now specifically including ad-heavy pages and the fox5sandiego.com regression check given item 1 above:

- [ ] **fox5sandiego.com** — §1a revert paths re-applied in `content.js`; device-verify no solid curtain and scroll does not re-swallow content
- [ ] Google (web, Images, Shopping — carousel tiles aren't painted as modal sheets)
- [ ] Google AI Overview — "Ask anything" button/pill (item 6, unfixed — expect it to still show as a white box) and streaming-content settle lag (item 7, unfixed)
- [ ] Wikipedia (infobox/tables readable)
- [ ] Amazon search
- [ ] YouTube, Reddit, X
- [ ] **A news site with programmatic display ads** — confirm ad creatives are untouched, not painted or whited/blacked-out (item 1b — currently in a split, worse-than-before state; see item 1b before testing this)
- [ ] One cookie/sign-in sheet (scrim stays transparent, inner card opaque)
- [ ] Maps (must not get a solid theme curtain)
- [ ] Content blocker categories reload correctly after toggling
- [ ] Fresh install → onboarding → enable extension flow, exactly as a reviewer would follow it — **verify the extension now shows as "Aura"** once item 2 is fixed
- [ ] No crash on launch, background, or theme switch

If a site fails, add a `SITE_FIXES` entry with a stable selector rather than loosening a general heuristic — the engine's existing convention (see `content.js` `SITE_FIXES` and README's "Layer 1" section).

## Optional cleanup (binary hygiene, not a rejection risk)

None of these block submission — Apple won't reject for unused code — but they're worth a pass since you're already in here:

- **Unused RN components**: `ColorPickerDropdown.tsx`, `ColorPickerModal.tsx`, `SimpleColorPickerModal.tsx`, `ThemeModePicker.tsx`, `GearIcon.tsx`, `SmileyIcon.tsx` are never imported anywhere.
- **Unused npm dependencies**: `react-native-color-picker`, `reanimated-color-picker`, `react-native-wheel-color-picker` — the app uses a hand-rolled `ModernColorPickerModal` instead. Safe to remove from `package.json`.
- **Dead/uncompiled Swift scripts**: `ios/TintApp/GenerateAppIcon.swift` and `AppIconGenerator.swift` aren't in TintApp's Sources build phase (confirmed not referenced in `project.pbxproj`) and import `AppKit`, which wouldn't compile for iOS anyway. Icons are already fully generated and correct (all 9 required sizes present, correct dimensions, RGB no-alpha) — these scripts served their purpose and can be deleted.
- **Empty `ios/KeyboardExtension/` directory** — not a real Xcode target, zero files, zero references. Delete or leave; either way it ships nothing.
- **Duplicate hardcoded support email**: `WebsiteSettingsScreen.tsx` hardcodes `alexmartens1111@gmail.com` in a `mailto:` link instead of importing `SUPPORT_EMAIL` from `AppConfig.ts` (same value today, but two places to update if it ever changes). Also worth a conscious decision on whether a personal Gmail address should be the user-facing support contact at all, versus a dedicated address.
- **Vestigial storage fields**: `recentlyUsedThemes` is written on every theme selection but never read back by any screen; `appThemeColor`/`appThemeMode` are persisted but their setters are no-ops (`AppThemeContext.tsx` hardcodes in-app appearance for this release). Either wire them up or stop persisting them.
- **`SunsetSunriseService.getCurrentLocation()` is a stub** that always returns `null` (real geolocation was never implemented; the dead Focus Mode screen falls back to manual lat/lon entry). Only matters if Focus Mode / location-based day-night ships.
- **No RN screen/component/integration tests exist** — `App.test.tsx` is a render-only smoke test. Not a submission requirement, but the `FocusModePresetSelection` routing bug (item 5) is exactly the class of bug a basic navigation test would have caught for free.

## App Store Connect — paste-ready content

Preserved from the docs that were consolidated into this file.

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

Every category — Contact Info, Health & Fitness, Financial, Location, Sensitive Info, Contacts, User Content, Browsing History, Identifiers, Purchases, Usage Data, Diagnostics — is **No**, confirmed by this scan (no analytics/tracking SDK of any kind found in dependencies or source). **Data linked to user: None. Data used to track: No.**

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

⚠️ Don't paste the "enable Aura" instruction until item 2 above is fixed — right now the toggle in Settings shows "TintExtension Extension," not "Aura," and a reviewer following these exact steps will be confused.

### Signing & capabilities checklist

- Identifiers (developer.apple.com): `com.alexmartens.aura` (App), `com.alexmartens.aura.SafariExtension` (Extension), `com.alexmartens.aura.ContentBlockerExtension` (Extension), `group.com.alexmartens.tint` (App Group) — enable the App Group on all three IDs. Confirmed all five entitlements files on disk already declare this group identically, so once the identifiers exist server-side this is just a signing/provisioning step, not a code change.
- Xcode → `TintApp` scheme → Signing & Capabilities → your paid team, automatic signing.
- Export compliance: `ITSAppUsesNonExemptEncryption = false` is already set in `Info.plist` — confirmed correct (standard HTTPS only).
- Archive the **TintApp** scheme (see item 3 above for the legacy-target caveat).

### Screenshots

Still need to be captured on a physical iPhone (6.7" and/or 6.1"): Themes tab with a theme selected, Browse Themes list, custom theme editor, a themed page in Safari (after enabling the extension), Protection/content-blocker screen, Settings. Match exactly what the shipping 3-tab UI shows — no Focus/Rules tab, no purchase screen (there isn't one in this codebase).
