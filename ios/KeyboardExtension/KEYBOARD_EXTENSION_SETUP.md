# Keyboard Extension Setup Guide

## Files Created

All necessary files have been created in `/ios/KeyboardExtension/`:

- `KeyboardThemeManager.swift` - Reads theme from App Group
- `KeyboardViewController.swift` - Main keyboard controller
- `KeyboardView.swift` - Custom keyboard UI
- `Info.plist` - Extension configuration
- `KeyboardExtension.entitlements` - App Group access

## Next Steps: Add Target in Xcode

Since modifying the project file directly is complex, please add the target through Xcode:

### 1. Open Xcode Project

1. Open `ios/TintApp.xcworkspace` in Xcode (NOT `.xcodeproj`)
2. Wait for indexing to complete

### 2. Add Keyboard Extension Target

1. **File → New → Target...**
2. Select **"Custom Keyboard Extension"** (under iOS → Application Extension)
3. Click **Next**
4. Configure:
   - **Product Name**: `KeyboardExtension`
   - **Bundle Identifier**: `org.reactjs.native.example.TintApp.KeyboardExtension`
   - **Language**: Swift
5. Click **Finish**
6. When prompted "Activate 'KeyboardExtension' scheme?", click **Cancel** (we'll use the main app scheme)

### 3. Delete Auto-Generated Files

Xcode will create some default files. Delete them and use our custom files:

1. Delete the auto-generated `KeyboardViewController.swift` (if different from ours)
2. Delete any auto-generated storyboard files
3. Keep `Info.plist` but we'll update it

### 4. Add Our Files to Target

1. Select all files in `ios/KeyboardExtension/` folder in Finder
2. Drag them into Xcode's `KeyboardExtension` target folder
3. When prompted:
   - ✅ Check "Copy items if needed"
   - ✅ Select "KeyboardExtension" target
   - ✅ Click "Finish"

### 5. Update Info.plist

1. Select `KeyboardExtension/Info.plist` in Xcode
2. Verify it matches our custom `Info.plist`:
   - `NSExtensionPointIdentifier` = `com.apple.keyboard-service`
   - `NSExtensionPrincipalClass` = `$(PRODUCT_MODULE_NAME).KeyboardViewController`
   - `PrimaryLanguage` = `en-US`
   - `RequestsOpenAccess` = `false`

### 6. Configure Entitlements

1. Select `KeyboardExtension` target
2. Go to **Signing & Capabilities** tab
3. Click **+ Capability**
4. Add **App Groups**
5. Check `group.com.alexmartens.tint`
6. Verify `KeyboardExtension.entitlements` file is referenced

### 7. Configure Build Settings

1. Select `KeyboardExtension` target
2. Go to **Build Settings** tab
3. Search for "Product Bundle Identifier"
4. Verify it's: `org.reactjs.native.example.TintApp.KeyboardExtension`
5. Search for "Development Team"
6. Set to same team as main app: `4JV5Y33KJB`
7. Search for "Code Signing Entitlements"
8. Set to: `KeyboardExtension/KeyboardExtension.entitlements`

### 8. Embed Extension in App

1. Select `TintApp` target
2. Go to **Build Phases** tab
3. Expand **"Embed App Extensions"** (should already exist)
4. Click **+** button
5. Select `KeyboardExtension.appex`
6. Verify it's added to the list

### 9. Add Target Dependency

1. Select `TintApp` target
2. Go to **Build Phases** tab
3. Expand **"Dependencies"**
4. Click **+** button
5. Select `KeyboardExtension`
6. Verify it's added

### 10. Build and Test

1. Select **TintApp** scheme (not KeyboardExtension)
2. Build the project (⌘B)
3. Run on device (⌘R)
4. After installation, go to **Settings → General → Keyboard → Keyboards**
5. Tap **Add New Keyboard...**
6. Select **Aura Keyboard**
7. Enable **Allow Full Access** (if needed for advanced features)

## Verification Checklist

- [ ] KeyboardExtension target exists in Xcode
- [ ] All Swift files are added to target
- [ ] Info.plist is configured correctly
- [ ] Entitlements file has App Group access
- [ ] Extension is embedded in main app
- [ ] Target dependency is set
- [ ] Build succeeds without errors
- [ ] Keyboard appears in iOS Settings

## Troubleshooting

### Build Errors

- **"No such module"**: Make sure all files are added to the target
- **"Undefined symbol"**: Check that Swift files are in "Compile Sources" build phase
- **"Entitlements error"**: Verify App Group is enabled in both app and extension

### Runtime Issues

- **Keyboard doesn't appear**: Check that it's enabled in iOS Settings
- **Theme not loading**: Verify App Group ID matches in all targets
- **Crash on launch**: Check console logs for Swift errors

## Architecture Notes

- **App Group**: `group.com.alexmartens.tint` (same as Safari extension)
- **Storage Key**: `tintThemeData` (same as Safari extension)
- **Theme Path**: `keyboardTheme` (nested in theme data)
- **Direct Read**: Keyboard reads directly from App Group (no native handler needed)
