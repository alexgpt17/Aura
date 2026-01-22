# Bundle ID & App Group Verification Checklist

## ✅ 1. Bundle IDs

### Main App (TintApp target)
- **Bundle ID**: `org.reactjs.native.example.TintApp` 
  - (Derived from: `org.reactjs.native.example.$(PRODUCT_NAME:rfc1034identifier)` where PRODUCT_NAME = `TintApp`)
- **Status**: ✅ Correct format

### Extension (TintExtension target)
- **Bundle ID**: `org.reactjs.native.example.TintApp.TintExtension`
- **Status**: ✅ Explicitly set, matches expected pattern (AppID.extension)

### Verification
- ✅ Extension bundle ID follows pattern: `{AppBundleID}.{ExtensionName}`
- ✅ Both targets exist in same Xcode project

---

## ✅ 2. App Group Configuration

### App Group ID
- **ID**: `group.com.alexmartens.tint`
- **Used in**:
  - ✅ `TintApp/TintApp.entitlements` 
  - ✅ `TintExtension/TintExtension.entitlements`
  - ✅ `TintExtension Extension/TintExtension Extension.entitlements`
  - ✅ `src/storage.js` (React Native side)
  - ✅ `SafariWebExtensionHandler.swift` (Native handler)

### Verification
- ✅ All three targets have App Group entitlement enabled
- ✅ Same App Group ID used everywhere
- ✅ Entitlements files correctly reference the App Group

---

## ✅ 3. Team ID

### Development Team
- **Team ID**: `4JV5Y33KJB`
- **Found in**:
  - ✅ TintApp target (both Debug & Release)
  - ✅ TintExtension target (both Debug & Release)

### Verification
- ✅ Same Team ID on all targets (required for App Groups)

---

## ✅ 4. Native Handler Configuration

### Info.plist (Extension)
- **NSExtensionPointIdentifier**: `com.apple.Safari.web-extension` ✅
- **NSExtensionPrincipalClass**: `$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler` ✅
  - This resolves to the class: `SafariWebExtensionHandler`

### Swift Handler
- **Class**: `SafariWebExtensionHandler` ✅
- **Protocol**: `NSExtensionRequestHandling` ✅
- **App Group ID**: `group.com.alexmartens.tint` ✅

### Verification
- ✅ Extension point identifier correct
- ✅ Principal class correctly formatted
- ✅ Handler class implements required protocol

---

## ⚠️ 5. Potential Issues to Double-Check in Xcode

### Manual Verification Needed:
1. **In Xcode, verify Capabilities:**
   - TintApp target → Signing & Capabilities → App Groups ✅ enabled
   - TintExtension target → Signing & Capabilities → App Groups ✅ enabled  
   - TintExtension Extension target → Signing & Capabilities → App Groups ✅ enabled

2. **Verify Bundle IDs in Xcode:**
   - TintApp: Should show `org.reactjs.native.example.TintApp`
   - TintExtension: Should show `org.reactjs.native.example.TintApp.TintExtension`

3. **Check Provisioning Profiles:**
   - All targets should be signed with same team
   - Profiles should include App Group entitlement

---

## ✅ Summary

| Component | Status | Value |
|-----------|--------|-------|
| App Bundle ID | ✅ | `org.reactjs.native.example.TintApp` |
| Extension Bundle ID | ✅ | `org.reactjs.native.example.TintApp.TintExtension` |
| App Group ID | ✅ | `group.com.alexmartens.tint` |
| Team ID | ✅ | `4JV5Y33KJB` (same for all) |
| Entitlements | ✅ | All 3 targets configured |
| Native Handler | ✅ | Correctly configured |

**All configurations appear correct!** ✅

The only remaining verification is to check in Xcode that the Capabilities are actually enabled in the UI (not just in the .entitlements files).
