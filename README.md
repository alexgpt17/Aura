# Aura

**Aura** is a Safari theming app for iOS that recolors websites with selectable themes, custom colours, per-site overrides, and an optional content blocker.

## Features

- **Safari Theming**: Custom themes applied to websites via Safari Web Extension
- **Per-Site Rules**: Site-specific theme overrides
- **Content Blocker**: Optional blocking of ads, trackers, social widgets, and annoyances
- **Custom Themes**: Create up to five personalized colour themes

## Platform Support

**iOS only** — designed for iOS Safari. The Android project exists as React Native scaffolding but is not actively supported.

## App Store submission

See [APP_REVIEW_NOTES.md](APP_REVIEW_NOTES.md) for reviewer enablement steps. Privacy policy: https://alexgpt17.github.io/Aura/privacy/ (source in `docs/privacy/`). Full Connect checklist: [APP_STORE_SUBMISSION.md](APP_STORE_SUBMISSION.md).

**Ship the `TintApp` scheme only.** Do not archive the legacy `TintExtension` host target.

## Architecture Overview

Aura uses a React Native app for theme configuration and iOS native extensions for theme application:

1. **React Native App (`TintApp`)**: Theme creation, settings, content blocker configuration
2. **Safari Web Extension**: Applies themes to websites using content scripts
3. **App Group Storage**: Shared data between app and extension (`group.com.alexmartens.tint`)
4. **Content Blocker Extension**: Blocks distracting content when enabled

Focus Filter integration is not included in the MVP build.

### Data Flow

```
React Native App
    ↓ (writes)
App Group UserDefaults (group.com.alexmartens.tint)
    ↓ (sync via native handler)
Extension Storage (browser.storage.local)
    ↓ (reads)
Content Script → Applies CSS to page
```

**Key Principle**: App Group storage is the source of truth. The extension uses a cached copy in `browser.storage.local` for fast theme application.

## Project Structure

```
Aura/
├── App.tsx                                    # Main React Native app entry point
├── index.js                                   # React Native entry point
├── APP_REVIEW_NOTES.md                        # App Store reviewer notes
├── docs/
│   ├── privacy-policy.md
│   └── privacy-policy.html
├── src/
│   ├── screens/                               # App screens
│   │   ├── SafariScreen.tsx                   # Main theme configuration hub
│   │   ├── BrowseThemesScreen.tsx             # Browse preset themes
│   │   ├── CustomThemeScreen.tsx              # Create custom themes
│   │   ├── CustomThemesListScreen.tsx         # List of custom themes
│   │   ├── ThemeSelectionScreen.tsx           # Pick a theme for a website
│   │   ├── WebsiteSettingsScreen.tsx          # Per-site theme overrides
│   │   ├── ContentBlockerScreen.tsx           # Content blocker settings
│   │   ├── SettingsScreen.tsx                 # App settings
│   │   ├── PrivacyPolicyScreen.tsx            # In-app privacy summary
│   │   ├── OnboardingScreen.tsx               # First-launch tutorial
│   │   ├── ThemeOptionsScreen.tsx             # Theme options
│   │   ├── WelcomeScreen.tsx                  # Welcome screen
│   │   ├── FocusModeScreen.tsx                # (present; hidden from MVP UI)
│   │   ├── FocusModePresetSelectionScreen.tsx # (present; hidden from MVP UI)
│   │   └── PurchaseScreen.tsx                 # (present; not used in MVP)
│   ├── components/                            # Reusable UI components
│   │   ├── ThemeSwatch.tsx                    # Mini-page theme preview chip
│   │   ├── ColorPickerDropdown.tsx
│   │   ├── ColorPickerModal.tsx
│   │   ├── SimpleColorPickerModal.tsx
│   │   ├── ThemeModePicker.tsx
│   │   ├── Snackbar.tsx
│   │   ├── GearIcon.tsx
│   │   └── SmileyIcon.tsx
│   ├── contexts/
│   │   └── AppThemeContext.tsx                # App-wide theme context
│   ├── services/
│   │   ├── HapticService.ts
│   │   ├── SafariExtensionService.ts          # Extension enablement guidance / heartbeat
│   │   └── SunsetSunriseService.ts            # (unused for MVP)
│   ├── constants/
│   │   └── AppConfig.ts                       # Privacy URL, support email, bundle IDs
│   └── storage.js                             # App Group storage functions
├── ios/
│   ├── TintApp/                               # Main iOS app target (ship this)
│   ├── TintExtension Extension/               # Safari Web Extension
│   │   ├── SafariWebExtensionHandler.swift    # Native bridge (App Group → extension storage)
│   │   ├── PrivacyInfo.xcprivacy
│   │   └── Resources/
│   │       ├── content.js                     # Theme application engine (CRITICAL)
│   │       ├── background.js                  # Message routing
│   │       └── manifest.json                  # Extension manifest
│   ├── ContentBlockerExtension/               # Content blocker extension
│   │   ├── PrivacyInfo.xcprivacy
│   │   ├── blocklist-ads.json
│   │   ├── blocklist-trackers.json
│   │   ├── blocklist-social.json
│   │   └── blocklist-annoyances.json
│   └── FocusFilterExtension/                  # Present but hidden from MVP UI
└── android/                                    # React Native scaffolding (not actively supported)
```

## Navigation Structure

The app uses React Navigation with a bottom tab navigator and stack navigator:

**Bottom Tabs (MVP):**
- **Themes** (`SafariScreen`) - Main theme configuration hub
- **Shield** (`ContentBlockerScreen`) - Content blocker configuration
- **Settings** (`SettingsScreen`) - App settings

**Stack Screens (MVP):**
- `BrowseThemes` - Browse preset themes
- `CustomThemesList` - List of user-created custom themes
- `CustomTheme` - Create/edit custom theme
- `WebsiteSettings` - Configure per-site theme overrides
- `ThemeSelection` - Choose a theme for a site
- `PrivacyPolicy` - Privacy policy summary

Focus Mode / Rules and in-app purchase screens exist in the repo but are **not wired** into the MVP navigation.

## Content Script Architecture

The Safari extension's theme application is handled by `ios/TintExtension Extension/Resources/content.js`, with shared predicates in `themeHeuristics.js`.

**Core model:** paint `html`/`body` with the theme, make layout containers transparent so the theme shows through, then run JS safety nets for cases CSS cannot reach (late-applied site styles, non-ARIA popups, light-gray cards, SPA shells).

### Theme engine (extend heuristics + JS passes for general cases)

1. **`getFullStyleSheet(theme)`** — CSS variables (`--aura-bg`, `--aura-text`, `--aura-link`, `--aura-surface`, `--aura-overlay`, …), container transparency, dialog/popover surfaces, text-input *color* (transparent fill so search fields stay seamless), common SPA root IDs (`#app`, `#root`, …).
2. **`applyTheme` / `removeTheme`** — injects `#aura-core-engine` and reverts inline safety-net changes.
3. **JS safety nets** (re-run on DOM + `class`/`style`/`hidden`/`open` mutations, full document, 150ms debounce):
   - **Shell pass** — clears gradient / opaque fills on large app shells (`#app`, `#app-mount`, …). Inline `!important` beats site ID selectors.
   - **Overlay pass** — opaques `<dialog>`, `[popover]`, ARIA dialogs, and heuristic modal cards. Full-viewport scrims stay transparent; the inner card is painted instead.
   - **Bright / light-surface pass** — clears near-white and low-chroma light-gray leftovers (not brand-colored fills).
   - **Contrast pass** — walks to the effective background and picks black or white; does not blindly force `--aura-text`.
   - **Sticky pass** — re-opaques chrome bars. Still skips full-viewport curtains.
4. **`themeHeuristics.js`** — unit-tested predicates (`isLightContentSurface`, `isLikelyModalCard`, `effectiveBackground`, gradient vs `url()` classification, …). Prefer adding a heuristic here over a site-specific selector.

The stylesheet is moved to the end of `head` on each pass so later site sheets cannot win on equal-`!important` cascade order.

### Site-specific overrides (last resort)

`SITE_FIXES` in `content.js` is an array of `{ match: [hostnames], css }` entries. Use it only when a general pass still misses a unique leftover after device testing. Host matching is suffix-based (`google.com` covers `www.google.com`).

**Current leftovers:**
- `google.com` — Sign-in pill, search text-fade gradient, `#rso` result surfaces
- `wikipedia.org` — Infobox / navbox / Codex / ReadMore
- `amazon.com` — Search field

```javascript
const SITE_FIXES = [
    {
        match: ['example.com'],
        css: `
            .leftover-widget {
                background-color: var(--aura-surface) !important;
                color: var(--aura-text) !important;
            }
        `,
    },
];
```

Use CSS variables so overrides stay theme-consistent. Do not add Zillow/Discord-style catalogs if a heuristic can cover the pattern.

## Storage Architecture

### App Group Storage (Source of Truth)

**Location**: iOS UserDefaults with suite name `group.com.alexmartens.tint`  
**Key**: `tintThemeData`  
**Written by**: React Native app via `src/storage.js`  
**Read by**: Native handler (`SafariWebExtensionHandler.swift`)

**Data Structure:**
```javascript
{
  globalTheme: {
    enabled: boolean,
    background: "#000000",
    text: "#FFFFFF",
    link: "#1E90FF",
    backgroundType: "color" | "image" | "gradient",
    backgroundImage: string | null,
    backgroundGradient: string | null
  },
  siteThemes: {
    "example.com": { /* site-specific overrides */ }
  },
  customThemes: [], // Array of custom themes (max 5)
  focusModeSettings: {
    enabled: boolean,
    mappings: {
      work: string | null,    // Preset ID or null
      sleep: string | null,
      personal: string | null,
      doNotDisturb: string | null
    }
  },
  contentBlockerSettings: {
    enabled: boolean,
    categories: {
      ads: boolean,
      trackers: boolean,
      socialWidgets: boolean,
      annoyances: boolean
    }
  },
  appThemeColor: "#228B22", // Forest green
  appThemeMode: "dark" | "light",
  favoriteThemes: [],
  recentlyUsedThemes: [],
  hasCompletedOnboarding: boolean,
  hasPurchasedCustomThemes: boolean
}
```

### Extension Storage (Cache)

**Location**: `browser.storage.local` (Web Extension API)  
**Key**: `tintThemeData`  
**Populated by**: Native handler syncs from App Group  
**Read by**: Content script (`content.js`)

The extension storage is a **cached copy** for fast theme application. The native handler (`SafariWebExtensionHandler.swift`) syncs data from App Group to extension storage when requested.

## Data Sync Flow

### Theme Application (Page Load)

```
1. User loads page in Safari
2. Content script runs (content.js)
3. Content script checks browser.storage.local for cached theme
4. If cache missing → background script requests sync from native handler
5. Native handler reads from App Group UserDefaults
6. Native handler returns theme data
7. Background script writes to browser.storage.local
8. Content script reads from cache
9. Content script determines theme (global vs site-specific)
10. Content script generates CSS (universal rules + site overrides)
11. CSS injected into page via <style> element
12. Shadow DOM elements handled via MutationObserver
```

### Theme Updates (From App)

```
1. User changes theme in React Native app
2. App saves to App Group storage (src/storage.js)
3. User switches to Safari
4. Content script detects changes (via message listener or cache check)
5. New theme applied without page reload
```

## iOS Safari Constraints

- **Background scripts**: Unreliable on iOS Safari - used minimally for message routing
- **Content scripts**: Guaranteed to run on every page load - primary sync path
- **Native handler**: Only runs when messaged - not a lifecycle hook
- **beginRequest**: Message-driven, not automatic

## Development

### Requirements

- iOS 15.0+
- Xcode 13+
- React Native 0.81.4
- Node.js >= 20
- Ruby (for CocoaPods)

### Setup

1. **Install dependencies:**
```bash
npm install
bundle install
cd ios && bundle exec pod install && cd ..
```

2. **Run the app:**
```bash
npm run ios
```

3. **Build Safari extensions:**
   - Open `ios/TintApp.xcworkspace` in Xcode (not `.xcodeproj`)
   - Build all targets: `TintApp`, `TintExtension Extension`, `ContentBlockerExtension`, `FocusFilterExtension`
   - Ensure App Group entitlements are configured for all targets

### Testing

Run tests:
```bash
npm test
```

**Manual Testing Checklist:**
- [ ] Enable Aura under Settings → Safari → Extensions (All Websites)
- [ ] Safari themes apply on page load
- [ ] Dual-colour themes render without laggy scroll
- [ ] Wikipedia / design-system sites keep readable text
- [ ] Content blocker categories reload correctly
- [ ] Shadow DOM elements get themed
- [ ] Real-time theme updates work (change theme in app, see update in Safari)
- [ ] Themes persist across Safari sessions
- [ ] Custom mono and dual themes can be created (max 5)
- [ ] Per-site overrides work correctly

## Key Files Reference

### React Native App
- `src/storage.js` - App Group storage functions (`saveThemes`, `getThemes`, etc.)
- `src/components/ThemeSwatch.tsx` - Shared mono/dual theme tile
- `src/contexts/AppThemeContext.tsx` - App-wide theme context (dark/light mode, accent color)
- `src/constants/AppConfig.ts` - Bundle IDs, privacy policy URL, support email

### Safari Extension
- `ios/TintExtension Extension/Resources/content.js` - **Theme application engine** (core + site overrides)
- `ios/TintExtension Extension/SafariWebExtensionHandler.swift` - Native bridge (App Group → extension storage)
- `ios/TintExtension Extension/Resources/background.js` - Message routing for live updates

### iOS Extensions
- `ios/ContentBlockerExtension/` - JSON blocklists for ads, trackers, social widgets, annoyances

## Troubleshooting

### Themes not applying in Safari

1. Enable the extension: Settings → Safari → Extensions → Aura → Allow All Websites
2. Check App Group is configured: `group.com.alexmartens.tint`
3. Check Safari console for content script errors
4. Verify `browser.storage.local` has theme data

### Data sync issues

1. Check App Group storage in Xcode debugger
2. Verify extension storage via Safari console: `browser.storage.local.get('tintThemeData')`

### Content script not running

1. Ensure extension is enabled in Safari Settings
2. Check `manifest.json` has correct content script configuration
3. Verify page matches content script URL patterns

## License

Private project - All rights reserved.
