# Tint App Architecture

## Overview

Tint is a Safari Web Extension that applies custom CSS themes to websites. The architecture follows the **Noir-style pattern**: the iOS app is the configuration editor, and the Safari extension reads and applies themes on page load.

**Core Principle**: App Group storage is the source of truth. The extension uses a native-populated cache. Content scripts are read-only.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER DEVICE (iPhone)                      │
│                                                               │
│  ┌──────────────────────┐         ┌──────────────────────┐  │
│  │   iOS App (TintApp)  │         │  Safari Extension    │  │
│  │                      │         │                      │  │
│  │  - Theme Editor UI   │         │  - Native Handler    │  │
│  │  - Color Pickers     │         │  - Content Script    │  │
│  │  - Presets           │         │  - Background Script │  │
│  │  - Per-Site Config   │         │                      │  │
│  │                      │         │                      │  │
│  │  WRITES TO:          │         │  READS FROM:         │  │
│  │  App Group Storage   │         │  Extension Storage   │  │
│  └──────────┬───────────┘         └──────────┬───────────┘  │
│             │                                │               │
│             │  App Group                     │               │
│             │  (UserDefaults Suite)          │               │
│             ▼                                │               │
│  ┌──────────────────────────────────────────┐│               │
│  │  App Group: group.com.alexmartens.tint   ││               │
│  │                                          ││               │
│  │  Key: "tintThemeData"                    ││               │
│  │  Value: {                                ││               │
│  │    globalTheme: { ... },                 ││               │
│  │    siteThemes: { ... }                   ││               │
│  │  }                                       ││               │
│  └──────────────────┬───────────────────────┘│               │
│                     │                        │               │
│                     │  SYNC (at lifecycle)   │               │
│                     │                        │               │
│                     ▼                        │               │
│  ┌──────────────────────────────────────────┐│               │
│  │  Extension Storage                       ││               │
│  │  (UserDefaults.standard →                ││               │
│  │   browser.storage.local)                 ││               │
│  │                                          ││               │
│  │  Key: "TINT_THEME_CACHE"                 ││               │
│  │  Value: { globalTheme, siteThemes }      ││               │
│  └──────────────────┬───────────────────────┘               │
│                     │                                        │
│                     │  READ (on page load)                   │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────┐               │
│  │  Content Script                          │               │
│  │  - Reads theme from storage              │               │
│  │  - Applies CSS to page                   │               │
│  └──────────────────────────────────────────┘               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. iOS App (TintApp)

**Location**: `/App.tsx`, `/src/storage.js`

**Role**: Settings editor (the only editor)

**Technology**:
- React Native 0.81.4
- `react-native-shared-group-preferences` library
- TypeScript

**Features**:
- Global theme customization (colors, images)
- Per-site theme overrides
- Theme presets (AMOLED, Grayscale, Sepia)
- Enable/disable toggle

**Storage**:
- Writes to App Group: `group.com.alexmartens.tint`
- Key: `tintThemeData`
- Structure:
  ```javascript
  {
    globalTheme: {
      enabled: boolean,
      backgroundType: "color" | "image",
      background: "#000000",
      backgroundImage: "data:image/..." | null,
      text: "#FFFFFF",
      link: "#1E90FF"
    },
    siteThemes: {
      "wikipedia.org": { ...theme object... },
      "nytimes.com": { ...theme object... }
    }
  }
  ```

**Functions** (`src/storage.js`):
- `saveThemes(themeData)` - Writes to App Group
- `getThemes()` - Reads from App Group

**Behavior**:
- User edits settings in app
- App saves to App Group
- App does NOT communicate with extension
- App does NOT know if Safari is open
- User switches to Safari and reloads page to see changes

---

### 2. Safari Extension - Native Handler

**Location**: `/ios/TintExtension Extension/SafariWebExtensionHandler.swift`

**Role**: Bridge between App Group and extension storage

**Technology**: Swift, SafariServices framework

**Key Function**: `beginRequest(with context: NSExtensionContext)`

**What It Does**:
1. Reads theme data from App Group storage
2. Writes theme data to extension storage (`UserDefaults.standard`)
3. Maps to `browser.storage.local` in JavaScript context

**When It Runs**:
- Safari launches
- Extension is enabled
- Extension lifecycle events
- NOT on every page load (but data persists in extension storage)

**Code Flow**:
```swift
func beginRequest(with context: NSExtensionContext) {
    // 1. Read from App Group (source of truth)
    let appGroupDefaults = UserDefaults(suiteName: "group.com.alexmartens.tint")
    let themeData = appGroupDefaults?.dictionary(forKey: "tintThemeData")
    
    // 2. Write to extension storage (cache)
    UserDefaults.standard.set(themeData, forKey: "TINT_THEME_CACHE")
    
    // 3. Complete request
    context.completeRequest(returningItems: nil, completionHandler: nil)
}
```

**Important Points**:
- Does NOT inject JavaScript into pages
- Does NOT use runtime messaging
- Simply syncs App Group → Extension Storage
- Extension storage persists, so sync doesn't need to happen every page load

---

### 3. Safari Extension - Content Script

**Location**: `/ios/TintExtension Extension/Resources/content.js`

**Role**: Theme applicator (read-only)

**Technology**: JavaScript (Web Extension API)

**What It Does**:
1. Runs on every page load (matches: `"<all_urls>"`, runs at: `document_end`)
2. Reads theme data from `browser.storage.local`
3. Determines which theme to apply (global or site-specific)
4. Injects CSS into the page

**Code Flow**:
```javascript
async function loadAndApplyTheme() {
    // 1. Read from extension storage (populated by native handler)
    const result = await browser.storage.local.get('TINT_THEME_CACHE');
    const themeData = result.TINT_THEME_CACHE;
    
    // 2. Determine which theme to apply
    const hostname = window.location.hostname;
    let themeToApply = themeData.globalTheme;
    if (themeData.siteThemes[hostname]) {
        themeToApply = { ...globalTheme, ...themeData.siteThemes[hostname] };
    }
    
    // 3. Apply CSS
    applyTheme(themeToApply);
}
```

**CSS Injection**:
- Creates `<style id="tint-theme">` element
- Applies background (color or image)
- Applies text and link colors
- Uses `!important` to override page styles

**Behavior**:
- Runs on page load/reload only
- Does NOT persist data
- Does NOT communicate with app
- Does NOT use runtime messaging
- Pure read-and-apply logic

---

### 4. Safari Extension - Background Script

**Location**: `/ios/TintExtension Extension/Resources/background.js`

**Role**: Minimal (required by manifest, but not used for themes)

**Why It Exists**: Safari Web Extensions require a background script in the manifest

**Current Implementation**: Empty/minimal (not used for theme storage)

---

### 5. Safari Extension - Manifest

**Location**: `/ios/TintExtension Extension/Resources/manifest.json`

**Key Settings**:
```json
{
  "manifest_version": 3,
  "content_scripts": [{
    "js": ["content.js"],
    "matches": ["<all_urls>"],
    "run_at": "document_end"
  }],
  "permissions": ["storage"]
}
```

**Notes**:
- `"storage"` permission required for `browser.storage.local`
- Content script runs on all URLs
- Runs at `document_end` (DOM ready)

---

## Data Flow

### Saving a Theme (User Action)

```
User opens iOS app
  ↓
User changes theme settings
  ↓
App calls saveThemes(themeData)
  ↓
react-native-shared-group-preferences.setItem()
  ↓
Data written to App Group storage (UserDefaults suite)
  ↓
[User switches to Safari]
  ↓
User reloads page
  ↓
Native handler runs (beginRequest)
  ↓
Native handler syncs App Group → Extension Storage
  ↓
Content script runs
  ↓
Content script reads from extension storage
  ↓
CSS applied to page
```

### Reading a Theme (Page Load)

```
User loads/reloads page in Safari
  ↓
Content script runs (content.js)
  ↓
Content script calls browser.storage.local.get('TINT_THEME_CACHE')
  ↓
Extension storage returns cached theme data
  ↓
Content script determines theme (global vs site-specific)
  ↓
Content script creates <style> element
  ↓
CSS injected into page
  ↓
Page displays with theme applied
```

---

## Storage Architecture

### App Group Storage (Source of Truth)

**Location**: `UserDefaults(suiteName: "group.com.alexmartens.tint")`

**Key**: `tintThemeData`

**Access**:
- ✅ iOS app (reads/writes)
- ✅ Native handler (reads only)
- ❌ JavaScript (cannot access)

**Persistence**: Persists across app launches, device restarts

**Structure**:
```javascript
{
  globalTheme: {
    enabled: true,
    backgroundType: "color",
    background: "#000000",
    backgroundImage: null,
    text: "#FFFFFF",
    link: "#1E90FF"
  },
  siteThemes: {
    "wikipedia.org": {
      enabled: true,
      backgroundType: "image",
      background: "#000000",
      backgroundImage: "data:image/jpeg;base64,...",
      text: "#FFFFFF",
      link: "#1E90FF"
    }
  }
}
```

### Extension Storage (Cache)

**Location**: `UserDefaults.standard` (maps to `browser.storage.local`)

**Key**: `TINT_THEME_CACHE`

**Access**:
- ✅ Native handler (writes)
- ✅ Content script (reads)
- ❌ iOS app (cannot access)

**Persistence**: Persists across Safari sessions

**Sync**: Populated by native handler from App Group storage

**Purpose**: Cache so content script can read quickly without App Group access

---

## Key Design Decisions

### Why App Group → Extension Storage Sync?

**Problem**: JavaScript in Safari Web Extensions cannot access App Group storage directly.

**Solution**: Native handler bridges the gap by copying data from App Group to extension storage.

**Benefits**:
- ✅ JavaScript can read from extension storage
- ✅ Data persists across Safari sessions
- ✅ No runtime messaging needed
- ✅ Works reliably on iOS

### Why No Runtime Messaging?

**Problem**: `browser.runtime.sendMessage()` from content scripts routes to background scripts on iOS, not native handlers. Native handlers are rarely (or never) invoked for runtime messages.

**Solution**: Don't use runtime messaging. Instead:
- Native handler syncs at lifecycle events
- Extension storage persists between syncs
- Content script reads from persistent storage

**Benefits**:
- ✅ More reliable
- ✅ No timing issues
- ✅ Works consistently on iOS
- ✅ Matches Noir's architecture

### Why No Safari Popup UI?

**Problem**: The user wants all configuration in the iOS app.

**Solution**: No popup UI. All settings edited in iOS app.

**Benefits**:
- ✅ Consistent UX (all settings in one place)
- ✅ Better for complex configuration
- ✅ Matches Noir's approach
- ✅ Simpler extension code

### Why Per-Site Themes?

**Problem**: Users may want different themes for different websites.

**Solution**: Store both `globalTheme` and `siteThemes` object.

**Logic**:
```javascript
const hostname = window.location.hostname;
let themeToApply = globalTheme;
if (siteThemes[hostname]) {
    themeToApply = { ...globalTheme, ...siteThemes[hostname] };
}
```

**Benefits**:
- ✅ Flexible customization
- ✅ Site-specific overrides
- ✅ Global defaults
- ✅ Matches Noir's feature set

---

## File Structure

```
TintApp/
├── App.tsx                          # React Native app UI
├── src/
│   └── storage.js                   # App Group storage functions
│
├── ios/
│   ├── TintApp/                     # iOS app target
│   │   ├── AppDelegate.swift
│   │   └── TintApp.entitlements     # App Group entitlement
│   │
│   └── TintExtension Extension/     # Safari Web Extension
│       ├── SafariWebExtensionHandler.swift  # Native handler (sync)
│       ├── Info.plist
│       ├── Resources/
│       │   ├── manifest.json        # Extension manifest
│       │   ├── content.js           # Content script (applies themes)
│       │   └── background.js        # Background script (minimal)
│       └── TintExtension Extension.entitlements  # App Group entitlement
│
└── package.json
```

---

## Configuration

### App Group ID

**Value**: `group.com.alexmartens.tint`

**Used In**:
- iOS app entitlements
- Extension entitlements
- `src/storage.js` (`APP_GROUP` constant)
- `SafariWebExtensionHandler.swift` (`appGroupID`)

**Purpose**: Shared container for app and extension

### Storage Keys

**App Group Key**: `tintThemeData`
- Used by iOS app (reads/writes)
- Used by native handler (reads)

**Extension Storage Key**: `TINT_THEME_CACHE`
- Used by native handler (writes)
- Used by content script (reads)

---

## User Experience Flow

### Setting Up a Theme

1. User opens Tint app
2. User selects colors/presets/images
3. User taps "Save" (or settings auto-save)
4. App saves to App Group storage
5. User switches to Safari
6. User reloads page (or navigates to new page)
7. Extension applies theme

### Creating a Per-Site Theme

1. User opens Tint app
2. User enters website domain (e.g., "wikipedia.org")
3. User configures theme for that site
4. User saves
5. App saves to App Group storage (under `siteThemes["wikipedia.org"]`)
6. User visits wikipedia.org in Safari
7. Extension detects site-specific theme
8. Extension applies site-specific theme (merged over global theme)

### Changing a Theme

1. User opens Tint app
2. User changes settings
3. App saves to App Group storage
4. User switches to Safari
5. User reloads page
6. Extension applies new theme

**Note**: Changes don't apply to already-open tabs. User must reload page to see changes. This is intentional and matches Noir's behavior.

---

## Testing Checklist

- [ ] App saves themes to App Group storage
- [ ] Native handler reads from App Group storage
- [ ] Native handler writes to extension storage
- [ ] Content script reads from extension storage
- [ ] Themes apply on page load
- [ ] Global themes work
- [ ] Per-site themes work
- [ ] Theme changes require page reload (expected behavior)
- [ ] Themes persist across Safari sessions
- [ ] Image backgrounds work
- [ ] Color backgrounds work
- [ ] Enable/disable toggle works

---

## Known Limitations

1. **No Live Updates**: Changes in app don't apply to open Safari tabs until page reload. This is intentional.

2. **Sync Timing**: Native handler syncs at extension lifecycle events, not on every page load. Extension storage persists, so this is fine.

3. **No Safari Popup**: All configuration happens in iOS app. This is intentional.

4. **App Group Required**: Both app and extension must have App Group entitlement. This is configured in Xcode.

---

## Future Enhancements (Not Implemented)

- Image backgrounds (structure exists, needs UI)
- Gradient backgrounds
- More preset themes
- Theme import/export
- iCloud sync (currently local only)

---

*Architecture follows the Noir-style pattern: App Group is source of truth, extension storage is cache, content scripts are read-only.*
