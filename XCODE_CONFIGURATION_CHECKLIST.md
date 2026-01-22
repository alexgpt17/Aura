# Xcode Configuration Checklist (Manual Verification Required)

These settings cannot be verified from code files and must be checked in Xcode UI.

## 🔴 CRITICAL: Native Messaging May Not Work on iOS Safari

**Important Discovery:** On iOS Safari Web Extensions, `browser.runtime.sendMessage()` from background scripts may NOT automatically route to native handlers like it does on macOS. This could be the fundamental issue we're facing.

### Alternative Approaches to Verify:
1. Check if there's a different API for iOS
2. Verify if background scripts can call native at all on iOS
3. Check if there's additional configuration needed

---

## 1. Signing & Capabilities (Most Critical)

### For EACH target (TintApp, TintExtension, TintExtension Extension):

**In Xcode:**
- Select target → **Signing & Capabilities** tab

#### TintApp Target:
- [ ] **Team**: Same Team ID for all targets (should be `4JV5Y33KJB`)
- [ ] **Bundle Identifier**: `org.reactjs.native.example.TintApp`
- [ ] **App Groups** capability:
  - [ ] Capability is present (not just entitlements file)
  - [ ] `group.com.alexmartens.tint` is checked/enabled
  - [ ] Capability has a green checkmark (not red error)

#### TintExtension Target:
- [ ] **Team**: Same as TintApp (`4JV5Y33KJB`)
- [ ] **Bundle Identifier**: `org.reactjs.native.example.TintApp.TintExtension`
- [ ] **App Groups** capability:
  - [ ] Capability is present
  - [ ] `group.com.alexmartens.tint` is checked/enabled
  - [ ] No errors

#### TintExtension Extension Target:
- [ ] **Team**: Same as others (`4JV5Y33KJB`)
- [ ] **Bundle Identifier**: `org.reactjs.native.example.TintApp.TintExtension` (matches parent)
- [ ] **App Groups** capability:
  - [ ] Capability is present
  - [ ] `group.com.alexmartens.tint` is checked/enabled
  - [ ] No errors

**⚠️ If ANY target shows RED ERRORS in App Groups:**
- The App Group might not exist in your Apple Developer account
- Go to developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → App Groups
- Verify `group.com.alexmartens.tint` exists and is enabled

---

## 2. Build Settings (Verify INFOPLIST_FILE)

### TintExtension Extension Target:

**Build Settings → Search for "INFOPLIST_FILE":**
- [ ] `INFOPLIST_FILE` = `TintExtension Extension/Info.plist` (not a path issue)
- [ ] `INFOPLIST_FILE` is not empty
- [ ] Path is correct relative to project root

**Build Settings → Search for "PRODUCT_MODULE_NAME":**
- [ ] `PRODUCT_MODULE_NAME` is set (this resolves `$(PRODUCT_MODULE_NAME)` in Info.plist)
- [ ] Should resolve to something like `TintExtension_Extension` or similar
- [ ] This must match what Info.plist expects for `NSExtensionPrincipalClass`

**Verify the resolved class name:**
- In Info.plist: `$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler`
- This must resolve to an actual Swift class name
- Check if Swift module name matches

---

## 3. Target Dependencies & Embedding

### TintApp Target → Build Phases:

**Target Dependencies:**
- [ ] `TintExtension Extension` is listed as a dependency
- [ ] Build order is correct

**Embed App Extensions:**
- [ ] `TintExtension Extension.appex` is embedded
- [ ] "Code Sign On Copy" is checked
- [ ] "Remove Headers On Copy" is checked

---

## 4. Build Phases - Verify Copy Bundle Resources

### TintExtension Extension Target → Build Phases → Copy Bundle Resources:

- [ ] **Info.plist is NOT listed here** (it's handled by INFOPLIST_FILE)
- [ ] Only Resources folder contents are listed (images, manifest.json, etc.)
- [ ] No duplicate entries

---

## 5. Extension Point Configuration

### Verify Safari Web Extension Point:

In Info.plist (we can see this in code, but verify it's being read):
- [ ] `NSExtensionPointIdentifier` = `com.apple.Safari.web-extension`
- [ ] `NSExtensionPrincipalClass` = `$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler`

**But also check:**
- [ ] In Xcode: Target → Info tab → Check if NSExtension settings are visible
- [ ] No duplicate or conflicting extension configurations

---

## 6. iOS Safari Extension Limitations (Research Needed)

### Critical Unknowns:

1. **Does iOS Safari support native messaging the same way macOS does?**
   - On macOS: `sendMessage()` without recipient → native handler
   - On iOS: This might not work the same way
   - Noir works, so there must be a way, but we need to find it

2. **Background script lifecycle on iOS:**
   - Are background scripts persistent enough to handle messages?
   - Do they need special configuration?

3. **Native handler invocation:**
   - What triggers `beginRequest` on iOS Safari?
   - Is it different from macOS?

---

## 7. Apple Developer Portal Verification

### Check Online:
1. Go to developer.apple.com → Certificates, Identifiers & Profiles
2. **Identifiers → App Groups:**
   - [ ] `group.com.alexmartens.tint` exists
   - [ ] Enabled for your Team ID
   - [ ] Associated with your App ID

3. **Identifiers → App IDs:**
   - [ ] Main app ID has App Groups capability enabled
   - [ ] Extension app ID has App Groups capability enabled

4. **Profiles → Provisioning Profiles:**
   - [ ] Profiles include App Groups capability
   - [ ] Profiles are valid and not expired

---

## 8. Potential iOS-Specific Issues

### Things to investigate:

1. **Manifest v3 on iOS Safari:**
   - Are we using correct manifest version?
   - Are background scripts service workers or persistent scripts on iOS?

2. **Native messaging permission:**
   - We have `"nativeMessaging"` in manifest.json
   - But is this actually supported on iOS Safari?
   - Does it need different configuration?

3. **Message routing:**
   - Content script → Background works ✅ (we see logs)
   - Background → Native doesn't work ❌ (no logs)
   - Is there a different API or configuration needed?

---

## Next Steps After Verification

1. **If App Groups show errors:** Fix in Developer Portal
2. **If INFOPLIST_FILE is wrong:** Fix in Build Settings
3. **If class name doesn't resolve:** Check PRODUCT_MODULE_NAME
4. **If everything checks out:** We may need to investigate iOS-specific native messaging APIs

**Most likely issue:** iOS Safari may require a different approach for native messaging than what we've been trying.
