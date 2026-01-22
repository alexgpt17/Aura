# Safari Web Extension Native Messaging Research - iOS

## 🔍 Key Findings

### ✅ What iOS Safari DOES Support:

1. **`browser.runtime.sendNativeMessage()` from background scripts**
   - Multiple sources confirm this SHOULD work on iOS Safari
   - Must be called from background script only (not content/popup)
   - Requires `"nativeMessaging"` permission in manifest ✅ (we have this)

2. **Native handler via `beginRequest(with:)`**
   - `SafariWebExtensionHandler` implementing `NSExtensionRequestHandling`
   - Messages from JS → Native are supported
   - Native → JS is NOT supported on iOS (only macOS)

3. **App Groups for shared data**
   - Both native app and extension can share `UserDefaults` via App Group
   - This is confirmed to work on iOS

### ❌ What iOS Safari DOES NOT Support:

1. **App → Extension messaging**
   - `SFSafariApplication.dispatchMessage()` only works on macOS
   - iOS cannot push messages from native app to extension JS

2. **`sendMessage()` routing to native**
   - `browser.runtime.sendMessage()` does NOT automatically route to native handler
   - This is a macOS behavior, not iOS

### 🔴 The Problem:

**We've been using the WRONG API!**

Our current code:
```javascript
browser.runtime.sendMessage(message)  // ❌ This doesn't route to native on iOS
```

What we should be using:
```javascript
browser.runtime.sendNativeMessage("bundle.id", message)  // ✅ This should work
```

But we saw `sendNativeMessage` was `undefined` earlier, which suggests:
- Either the API doesn't exist in our runtime context
- Or we're missing configuration

---

## 🎯 The Solution Path

### Option 1: Use `sendNativeMessage` (Proper Way)

According to research, `sendNativeMessage` SHOULD exist on iOS Safari. If it doesn't, possible reasons:

1. **Background script not recognized as background context**
   - Manifest v3: background scripts are service workers
   - Service workers might have different API availability

2. **Native messaging host identifier required**
   - `sendNativeMessage(hostIdentifier, message)` requires a bundle ID
   - This must match the extension's bundle ID

3. **Permission not actually applied**
   - Even though it's in manifest.json, Safari might not have loaded it

### Option 2: Alternative Architecture (App Group Only)

If native messaging truly doesn't work, we could:
- Have the background script read directly from App Group via a different mechanism
- But this seems unlikely - Noir proves native messaging works

---

## 🧪 What We Need to Test

### 1. Verify `sendNativeMessage` actually exists

Check background.js logs:
- We already log: `typeof browser.runtime.sendNativeMessage`
- If it shows `"function"` → API exists, we should use it
- If it shows `"undefined"` → API missing, need alternative

### 2. If `sendNativeMessage` exists, use it correctly:

```javascript
// In background.js:
browser.runtime.sendNativeMessage(
    "org.reactjs.native.example.TintApp.TintExtension", // Extension bundle ID
    { type: "SYNC_FROM_APP_GROUP" }
)
```

### 3. Verify bundle ID matches

The bundle ID in `sendNativeMessage` must match:
- Extension's bundle identifier in Xcode
- Should be: `org.reactjs.native.example.TintApp.TintExtension`

---

## 📋 Action Items

1. **Check background script logs** - What does `sendNativeMessage exists =` show?
2. **If it's a function** - Update background.js to use `sendNativeMessage()` with correct bundle ID
3. **If it's undefined** - Investigate why (manifest v3 service worker issue? configuration?)
4. **Rebuild with Info.plist fix** - Might enable native messaging APIs

---

## 🎓 Architecture Reference (How Noir Likely Works)

Based on research, Noir's flow:
1. Content script → Background script (`sendMessage`)
2. Background script → Native handler (`sendNativeMessage`)
3. Native handler reads App Group (`UserDefaults`)
4. Native handler responds back through `beginRequest` response
5. Background → Content script (`sendResponse`)

Our current broken flow:
1. Content script → Background script (`sendMessage`) ✅
2. Background script → Native handler (`sendMessage`) ❌ **WRONG API**
3. Native handler never called

---

## 🚨 Critical Discovery

**We've been using `sendMessage()` expecting it to route to native, but that's NOT how it works on iOS Safari!**

The correct API is `sendNativeMessage()`, but we need to:
1. Verify it exists in our runtime
2. Use it with the correct bundle identifier
3. Ensure Info.plist is properly bundled so the handler can be found
