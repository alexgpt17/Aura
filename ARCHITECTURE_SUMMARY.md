# Tint Architecture Summary (iOS-Safe, Noir-Style)

## Data Flow Overview

```
React Native App → App Group (UserDefaults)
                           ↑
                           │
Content Script → Native Handler → Response → browser.storage.local → Apply CSS
```

**Key Principle:** On iOS Safari, content scripts are the ONLY reliable execution point. Everything originates from there.

## 1. App Writes to App Group

**File:** `src/storage.js`

- Uses `react-native-shared-group-preferences` library
- Calls `saveThemes(themeData)` which uses `SharedGroupPreferences.setItem()`
- Writes to iOS **UserDefaults** with suite name: `group.com.alexmartens.tint`
- Key: `tintThemeData`
- Data structure: `{ globalTheme: {...}, siteThemes: {...} }`

**Storage Location:** iOS App Group UserDefaults (shared between app and extension)

## 2. Native Handler Copies to Extension Storage

**File:** `ios/TintExtension Extension/SafariWebExtensionHandler.swift`

**What is Extension Storage?**
- **Extension Storage = `browser.storage.local`**
- This is the Web Extension API's local storage (NOT UserDefaults)
- It's the extension's own isolated JavaScript storage
- Accessible only to the extension's JavaScript code
- Persists across page loads but is separate from App Group

**How it works:**
1. **Content script** (ONLY sync path) checks cache: `browser.storage.local.get('TINT_THEME_CACHE')`
2. If cache is missing, content script sends message: `{ type: "SYNC_FROM_APP_GROUP" }`
3. Native handler (`beginRequest`) receives the message (triggered by the message)
4. Native handler reads from App Group UserDefaults: `UserDefaults(suiteName: "group.com.alexmartens.tint").dictionary(forKey: "tintThemeData")`
5. Native handler returns data as response: `{ themes: themeData }`
6. Content script receives response and writes to extension storage: `browser.storage.local.set({ TINT_THEME_CACHE: response.themes })`

**Important:** 
- **NO background script** - Background scripts are unreliable on iOS Safari
- **Single sync path** - Only content script triggers sync (eliminates race conditions)
- **beginRequest is message-driven** - Only runs when messaged, not as a lifecycle hook

## 3. Content Script Reads and Applies CSS

**File:** `ios/TintExtension Extension/Resources/content.js`

1. **Content script runs (guaranteed by Safari):**
   - Runs on every page load
   - This is the ONLY reliable execution point on iOS

2. **Checks cache:**
   - `browser.storage.local.get('TINT_THEME_CACHE')`
   - If cache is missing → triggers native sync (single path, no race conditions)

3. **Syncs from App Group (if needed):**
   - Sends message to native handler: `{ type: "SYNC_FROM_APP_GROUP" }`
   - Receives response and writes to `browser.storage.local`

4. **Determines which theme to apply:**
   - Checks for site-specific theme for current hostname
   - Falls back to global theme
   - Merges site-specific overrides over global theme

5. **Applies CSS:**
   - Creates a `<style>` element with ID `tint-theme`
   - Injects CSS rules for:
     - Background (color or image)
     - Text color
     - Link color
   - Appends style element to `document.documentElement`

## iOS Safari Constraints

- **Background scripts:** Unreliable, event-driven, may never run - NOT USED
- **Content scripts:** Guaranteed to run - ONLY sync path
- **Native handler:** Only runs when messaged - NOT a lifecycle hook
- **beginRequest:** Message-driven, not automatic

## Data Storage Locations

- **App Group UserDefaults:** `group.com.alexmartens.tint` / key `tintThemeData` (written by app)
- **Extension Storage:** `browser.storage.local` / key `TINT_THEME_CACHE` (Cache - populated by native handler, read by content script)
