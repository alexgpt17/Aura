# Aura Future Development Plans

This document outlines planned features and improvements for future releases, organized by implementation stages.

**Current Focus:** Perfecting the keyboard (per-app themes, visual polish, iOS spec matching)

---

## Stage 1: Keyboard Perfection (Current Priority) 🔧

### Status: 🎯 In Progress

### Goals:
- ✅ Match iOS keyboard specs exactly (key height: 44pt, font: 24pt/16pt, spacing: 6pt/7pt)
- ✅ Complete per-app keyboard theme implementation (with app picker)
- ✅ Visual polish and refinement (shadows, spacing, alignment, safe area)
- ✅ Keycap casing (always uppercase display, lowercase output)
- ✅ Dynamic return key text based on input field type
- ✅ Conditional period button (URL/email fields only)
- ✅ Proper emoji button symbol (smiley face ☺)
- 🔄 Performance optimization
- 🔄 Better error handling

### Completed Tasks:
- [x] Match iOS keyboard specs exactly (dimensions, spacing, fonts, shadows)
- [x] Per-app keyboard theme detection and application (input field type inference)
- [x] Visual refinements (shadows, spacing, Row 2 alignment, safe area support)
- [x] Keycap casing implementation (uppercase display, lowercase output)
- [x] Dynamic return key text (go/search/send/done/next based on returnKeyType)
- [x] Conditional period button (only for URL, email, web search fields)
- [x] Emoji button with proper symbol (smiley face ☺)
- [x] App picker UI for per-app theme selection

### Remaining Tasks:
- [ ] Performance testing and optimization
- [ ] Error handling for theme loading failures
- [ ] Keyboard flicker fix when switching keyboards (iOS limitation, may not be fully fixable)

### Why First:
Perfecting the core keyboard experience before adding new features ensures a solid foundation.

---

## Stage 2: Focus Mode Integration

### Status: ⏸️ Deferred - Will implement after keyboard perfection

### Priority: Medium-High (after keyboard is perfected)

### Implementation Approach: Focus Filters Extension

**Decision:** When implementing Focus Mode integration, we will use a **Focus Filters Extension** rather than polling/manual approach.

### Why Focus Filters Extension:
- ✅ Works when app is closed
- ✅ Instant theme changes (no delay)
- ✅ System-managed (iOS calls extension directly)
- ✅ Better user experience for automatic theme switching

### What It Requires:
- **New Extension Target** in Xcode: `FocusFilterExtension`
- **New Bundle Identifier**: `org.reactjs.native.example.TintApp.FocusFilterExtension`
- **New Info.plist** with `NSExtensionPointIdentifier = com.apple.focus-filters`
- **New Entitlements** file with App Group access
- **New Swift Handler** class implementing `INExtension`
- **App Group** access (reuse existing `group.com.alexmartens.tint`)

### Implementation Notes:
- Extension will read `focusModeSettings` from App Group
- When Focus mode changes, iOS calls extension
- Extension applies mapped preset to both Safari and Keyboard themes
- User must enable in iOS Settings → Focus → [Focus Name] → Focus Filters

### Files to Create:
- `ios/FocusFilterExtension/FocusFilterHandler.swift`
- `ios/FocusFilterExtension/Info.plist`
- `ios/FocusFilterExtension/FocusFilterExtension.entitlements`
- Update `project.pbxproj` with new target
- Update build scheme to include new extension

### Current Status:
- ✅ UI is complete (Settings screen with Focus mode mappings)
- ✅ Storage structure ready (`focusModeSettings` in theme data)
- ✅ Service structure exists (`FocusModeService.ts`)
- ⏸️ Extension implementation deferred

---

## Stage 3: Widgets and Quick Actions

### Status: 📋 Planned

### Priority: Medium

### Features:
- **WidgetKit Integration** (iOS 14+)
  - Small widget: Quick theme switcher (3-4 presets)
  - Medium widget: Current theme display + quick switch
  - Large widget: Full theme browser (optional)
- **Widget Target Setup**
  - New `WidgetExtension` target
  - App Group access for theme data
  - SwiftUI widget views
- **Widget Functionality**
  - Display current Safari/Keyboard themes
  - Quick apply Aura presets
  - Deep link to app for full customization

### Implementation:
- Create WidgetExtension target in Xcode
- Implement SwiftUI widget views
- Configure App Group access
- Add widget configuration UI
- Test on iOS 14+ devices

### Dependencies:
- App Group storage (already in place)
- Aura presets system (already complete)

### Why Third:
Enhances accessibility without changing core functionality. Can be done in parallel with other features.

---

## Stage 4: Time/Environment Triggers

### Status: 📋 Planned

### Priority: Medium

### Features:
- Auto-switch themes based on time of day
- Battery level detection (warm theme when Low Power Mode)
- App category detection for per-app keyboard themes

### Implementation:
- Time-based scheduler
- Battery level monitoring (native module)
- App category detection (native module)
- Settings UI for trigger configuration

### Dependencies:
- Native modules for battery/app detection
- Background task scheduling

---

## Stage 5: Wallpaper Generation

### Status: 📋 Planned

### Priority: Medium-Low

### Features:
- **Wallpaper Generation from Themes**
  - Generate wallpaper images from Aura presets
  - Create gradients, patterns, or abstract designs matching theme colors
  - Support multiple device sizes (iPhone, iPad)
- **Save to Photos**
  - Save generated wallpapers to user's Photos library
  - Guide users to set wallpaper manually in Settings
- **Shortcuts Integration** (Optional, later)
  - Create Shortcuts actions for automated wallpaper changes
  - Guide power users to set up automation

### Implementation:
- Use `CoreGraphics` to generate wallpaper images
- Implement `UIImageWriteToSavedPhotosAlbum` or `PHPhotoLibrary` for saving
- Create wallpaper preview UI in app
- Generate wallpapers for each Aura preset
- Add "Generate Wallpaper" button to Aura Presets screen

### Technical Notes:
- **iOS Limitation:** No public API to programmatically change system wallpaper
- **Workaround:** Generate images → Save to Photos → User sets manually
- **Alternative:** Shortcuts app integration (requires user setup)

### Dependencies:
- CoreGraphics framework
- Photos framework permissions
- Theme color system (already in place)

### Why Fifth:
Nice-to-have feature that enhances the "Aura" experience but isn't core functionality.

---

## Stage 6: Advanced Keyboard Features

### Status: 📋 Planned

### Priority: Low-Medium

### Features:
- Minimal keyboard (letters only)
- Distraction-free writing mode
- Markdown/code keyboard layouts
- Additional keyboard layouts beyond standard QWERTY

### Implementation:
- Create multiple keyboard layouts
- Add layout selection UI
- Detect current app context
- Apply appropriate layout/theme

### Dependencies:
- Keyboard extension refactoring
- Multiple keyboard view implementations
- App context detection (from Stage 4)

### Why Sixth:
More complex feature requiring significant refactoring. Should wait until core keyboard is perfected.

---

## UI/UX Improvements

### Status: ✅ Completed (January 2025)

- ✅ **Theme Favorites**: Star/pin themes for quick access
- ✅ **Recently Used**: Track and display recently applied themes (last 10, shown on Home)
- ✅ **Search & Filter**: Search themes by name, filter by color type (Dark/Light/Warm/Cool)
- ✅ **Quick Actions**: Long-press menu with Apply, Favorite, Preview options
- ✅ **Enhanced Theme Selection**: Browse Themes collapsible section, visual improvements

### Status: 📋 Planned

- Better icon library integration
- Custom theme preview improvements
- Theme sharing/export (deferred - not needed for now)
- Preset customization UI
- Theme collections/categories
- Theme templates for custom theme creation

---

## Stage 7: Advanced Theming and Polish

### Status: 📋 Planned

### Priority: Low

### Features:
- **Image Background Support**
  - Custom image uploads for Safari themes
  - Image processing and optimization
  - Background positioning/scaling options
- **Advanced Gradients**
  - Multi-color gradients
  - Radial gradients
  - User-defined gradient stops
- **Theme Sharing/Export** (if needed)
  - Export theme as JSON
  - Import themes from files
  - Share via AirDrop/URL
- **Theme Collections/Categories**
  - Organize themes into collections
  - Pre-made collections (e.g., "Productivity", "Gaming")
- **Theme Templates**
  - Starter templates for custom theme creation
  - Copy and modify existing themes

### Why Last:
Nice-to-have features that can wait until core functionality is solid.

---

## Technical Improvements (Ongoing)

### Status: 📋 Planned

- Performance optimizations
- Better error handling
- Analytics (optional, privacy-focused)
- Accessibility improvements
- Better onboarding/tutorial for new users
- Theme backup/restore functionality

---

## Implementation Priority Summary

1. **Stage 1: Keyboard Perfection** (Current) - Core functionality
2. **Stage 2: Focus Mode Integration** - Automation (UI ready, extension needed)
3. **Stage 3: Widgets** - Quick wins, better UX
4. **Stage 4: Time/Environment Triggers** - Automation
5. **Stage 5: Wallpaper Generation** - Enhancement
6. **Stage 6: Advanced Keyboard Features** - Complexity
7. **Stage 7: Advanced Theming** - Polish

## Notes

- **Current Focus:** Perfecting the keyboard before adding new features
- All future features should maintain the black/forest green theme
- Keep implementation simple when possible
- Prioritize user experience over complexity
- Document all major architectural decisions
- Wallpaper feature is possible but requires manual user action (iOS limitation)
