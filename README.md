# Aura

**Aura** is a Safari theming app for iOS that provides customizable dark themes for web browsing with intelligent per-site rules and focus mode integration.

## Features

- **Safari Theming**: Custom dark themes applied to websites via Safari Web Extension
- **Per-Site Rules**: Site-specific theme overrides for major websites (Google, Wikipedia, etc.)
- **Focus Mode Integration**: Automatic theme switching based on iOS Focus modes
- **Content Blocker**: Block distracting content during focused browsing
- **Custom Themes**: Create personalized themes with $4.99 in-app purchase

## Platform Support

**iOS only** - This app is designed specifically for iOS Safari. The Android project exists as React Native scaffolding but is not actively supported.

## Architecture Overview

Aura uses a React Native app for theme configuration and multiple iOS native extensions for theme application:

1. **React Native App**: Theme creation, settings, focus mode configuration
2. **Safari Web Extension**: Applies themes to websites using content scripts
3. **App Group Storage**: Shared data between app and extension (`group.com.alexmartens.tint`)
4. **Content Blocker Extension**: Blocks distracting content when enabled
5. **Focus Filter Extension**: Automatic theme switching when iOS Focus modes change

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
├── src/
│   ├── screens/                               # App screens
│   │   ├── SafariScreen.tsx                   # Main theme configuration hub
│   │   ├── BrowseThemesScreen.tsx             # Browse preset themes
│   │   ├── CustomThemeScreen.tsx              # Create/edit custom themes
│   │   ├── CustomThemesListScreen.tsx         # List of custom themes
│   │   ├── WebsiteSettingsScreen.tsx          # Per-site theme overrides
│   │   ├── FocusModeScreen.tsx                # Focus mode configuration
│   │   ├── FocusModePresetSelectionScreen.tsx # Map Focus modes to themes
│   │   ├── ContentBlockerScreen.tsx           # Content blocker settings
│   │   ├── SettingsScreen.tsx                 # App settings
│   │   ├── PurchaseScreen.tsx                 # In-app purchase flow
│   │   ├── OnboardingScreen.tsx              # First-launch tutorial
│   │   ├── ThemeOptionsScreen.tsx             # Theme options
│   │   └── WelcomeScreen.tsx                  # Welcome screen
│   ├── components/                            # Reusable UI components
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
│   │   ├── FocusModeService.ts                # Focus mode detection and automation
│   │   └── PurchaseManager.ts                 # StoreKit IAP handling
│   └── storage.js                             # App Group storage functions
├── ios/
│   ├── TintApp/                               # Main iOS app target
│   ├── TintExtension Extension/               # Safari Web Extension
│   │   ├── SafariWebExtensionHandler.swift    # Native bridge (App Group → extension storage)
│   │   └── Resources/
│   │       ├── content.js                     # Theme application engine (CRITICAL)
│   │       ├── background.js                  # Message routing
│   │       └── manifest.json                  # Extension manifest
│   ├── ContentBlockerExtension/               # Content blocker extension
│   │   ├── blocklist-ads.json
│   │   ├── blocklist-trackers.json
│   │   ├── blocklist-social.json
│   │   └── blocklist-annoyances.json
│   ├── FocusFilterExtension/                  # Focus mode integration
│   │   └── AuraPresetDefinitions.swift
│   └── KeyboardExtension/                     # (Currently empty/placeholder)
└── android/                                    # React Native scaffolding (not actively supported)
```

## Navigation Structure

The app uses React Navigation with a bottom tab navigator and stack navigator:

**Bottom Tabs:**
- **Themes** (`SafariScreen`) - Main theme configuration hub
- **Rules** (`FocusModeScreen`) - Focus mode and automation settings
- **Shield** (`ContentBlockerScreen`) - Content blocker configuration
- **Settings** (`SettingsScreen`) - App settings

**Stack Screens:**
- `BrowseThemes` - Browse preset themes
- `CustomThemesList` - List of user-created custom themes
- `CustomTheme` - Create/edit custom theme
- `WebsiteSettings` - Configure per-site theme overrides
- `FocusModePresetSelection` - Map Focus modes to themes
- `Purchase` - In-app purchase flow
- `ContentBlocker` - Content blocker settings (also in tabs)
- `FocusMode` - Focus mode settings (also in tabs)

## Content Script Architecture

The Safari extension's theme application is handled by `ios/TintExtension Extension/Resources/content.js`. This file has a **critical architecture** that must be understood before making changes.

### Theme Engine (DO NOT MODIFY)

The **core theme engine** applies universal dark theme rules to all websites. It should **not be modified** unless absolutely necessary. The engine consists of:

1. **`getFullStyleSheet(theme)`** - Generates universal CSS rules using CSS variables:
   - CSS variables: `--aura-bg`, `--aura-text`, `--aura-link`, `--aura-surface`, `--aura-border`, `--aura-overlay`
   - Universal transparency rules for `div`, `main`, `section`, `article`
   - Inline style overrides for white backgrounds
   - Text color rules for headings, paragraphs, links
   - Shadow DOM support

2. **`applyTheme(theme)`** - Applies the theme by creating/updating a `<style>` element with ID `aura-core-engine`

3. **`removeTheme()`** - Removes the theme when disabled

4. **`handleShadowDOM(root)`** - Automatically injects themes into Shadow DOM elements using MutationObserver

### Site-Specific Overrides (MODIFY HERE)

The **`SITE_FIXES` object** (lines 10-27) contains site-specific CSS overrides that handle edge cases the universal engine doesn't cover. **This is where you should add fixes for new websites.**

**Current site overrides:**
- `google.com` - Search bar styling, header background fixes
- `wikipedia.org` - Infobox, navbox, sidebar, table styling

**How to add a new site override:**

1. Add an entry to the `SITE_FIXES` object:
```javascript
const SITE_FIXES = {
    'google.com': `...`,
    'wikipedia.org': `...`,
    'newsite.com': `
        /* Your site-specific CSS rules here */
        .problematic-element {
            background-color: var(--aura-bg) !important;
        }
    `
};
```

2. The override is automatically injected after the universal rules in `getFullStyleSheet()`

3. Use CSS variables (`var(--aura-bg)`, `var(--aura-text)`, etc.) to maintain theme consistency

**Important**: Only modify `SITE_FIXES` for new site support. Do not modify the core theme engine functions unless fixing a critical bug.

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
- [ ] Safari themes apply on page load
- [ ] Site-specific rules work correctly (Google, Wikipedia)
- [ ] Focus Mode triggers theme changes
- [ ] Content blocker activates with Focus Mode
- [ ] Shadow DOM elements get themed
- [ ] Real-time theme updates work (change theme in app, see update in Safari)
- [ ] Themes persist across Safari sessions
- [ ] Custom themes can be created (after purchase)
- [ ] Per-site overrides work correctly

## Key Files Reference

### React Native App
- `src/storage.js` - App Group storage functions (`saveThemes`, `getThemes`, etc.)
- `src/services/FocusModeService.ts` - Focus mode detection and automation
- `src/services/PurchaseManager.ts` - StoreKit IAP handling ($4.99 custom themes)
- `src/contexts/AppThemeContext.tsx` - App-wide theme context (dark/light mode, accent color)

### Safari Extension
- `ios/TintExtension Extension/Resources/content.js` - **Theme application engine** (core + site overrides)
- `ios/TintExtension Extension/SafariWebExtensionHandler.swift` - Native bridge (App Group → extension storage)
- `ios/TintExtension Extension/Resources/background.js` - Message routing for live updates

### iOS Extensions
- `ios/ContentBlockerExtension/` - JSON blocklists for ads, trackers, social widgets, annoyances
- `ios/FocusFilterExtension/` - Automatic theme switching when iOS Focus modes change

## Focus Mode Integration

Focus Mode integration uses iOS Focus Filters (iOS 16+):

1. **User Setup**: User maps Focus modes to themes in the app
2. **Settings Storage**: Mappings saved to App Group storage
3. **Focus Filter Extension**: Runs automatically when Focus mode changes (even when app is closed)
4. **Theme Switch**: Extension reads mappings from App Group and applies appropriate theme
5. **Content Blocker**: Can be enabled/disabled per Focus mode

**User must enable Focus Filter in iOS Settings:**
Settings → Focus → [Mode] → Focus Filters → Aura

## In-App Purchase

- **Product ID**: `com.alexmartens.aura.customthemes`
- **Price**: $4.99 (one-time purchase)
- **Feature**: Unlocks ability to create custom themes (max 5)
- **Implementation**: `src/services/PurchaseManager.ts` + native StoreKit module

## Troubleshooting

### Themes not applying in Safari

1. Check App Group is configured: `group.com.alexmartens.tint`
2. Verify extension is enabled in Safari Settings → Extensions
3. Check Xcode console for native handler logs
4. Check Safari console for content script errors
5. Verify `browser.storage.local` has theme data

### Data sync issues

1. Native handler may cache UserDefaults - it calls `synchronize()` multiple times
2. Check App Group storage directly in Xcode debugger
3. Verify extension storage via Safari console: `browser.storage.local.get('tintThemeData')`

### Content script not running

1. Ensure extension is enabled in Safari Settings
2. Check `manifest.json` has correct content script configuration
3. Verify page matches content script URL patterns

## License

Private project - All rights reserved.
