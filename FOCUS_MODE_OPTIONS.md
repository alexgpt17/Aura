# Focus Mode Integration Options

## The Question: Do We Need Another Extension?

**Short Answer:** Technically yes for full Focus Filters support, but there are simpler alternatives.

---

## Option 1: Focus Filters Extension (Full Implementation) ⚠️ Complex

### What It Requires:
- **New Extension Target** in Xcode
- **New Bundle Identifier** (e.g., `org.reactjs.native.example.TintApp.FocusFilterExtension`)
- **New Info.plist** with `NSExtensionPointIdentifier = com.apple.focus-filters`
- **New Entitlements** file
- **New Swift/Objective-C code** for the extension
- **App Group** access (can reuse existing)
- **More build complexity** (3rd extension target)
- **More testing complexity**

### How It Works:
1. User enables Focus Filter in iOS Settings
2. iOS calls your extension when Focus mode changes
3. Extension reads App Group → applies preset
4. Extension can modify Safari/keyboard themes

### Pros:
- ✅ Real-time detection
- ✅ Works even when app is closed
- ✅ Official iOS approach

### Cons:
- ❌ Significant complexity (new target, new code, new config)
- ❌ User must manually enable in iOS Settings
- ❌ More things that can break
- ❌ Harder to debug

---

## Option 2: Polling from Main App (Simpler) ✅ Recommended

### What It Requires:
- **No new extension** - use existing main app
- **Background task** or **foreground polling**
- **React Native background task** (or foreground check)

### How It Works:
1. App checks Focus mode status periodically (every 5-10 seconds)
2. When Focus mode changes, apply preset
3. Uses existing App Group to save/read themes

### Pros:
- ✅ No new extension target needed
- ✅ Simpler implementation
- ✅ Easier to debug
- ✅ Works with existing architecture

### Cons:
- ❌ Requires app to be running (or background task)
- ❌ Slight delay (polling interval)
- ❌ May drain battery slightly (minimal)

### Implementation:
```typescript
// In FocusModeService.ts (already created)
// Poll every 5 seconds when app is active
setInterval(async () => {
  const currentMode = await getCurrentFocusMode();
  if (currentMode !== lastMode) {
    applyPreset(currentMode);
  }
}, 5000);
```

---

## Option 3: Manual Trigger (Simplest) ✅ Easiest

### What It Requires:
- **No extension, no polling**
- **User manually selects preset** when Focus mode changes
- **Quick action button** on Home screen

### How It Works:
1. User switches Focus mode
2. User opens Aura app
3. User taps "Apply Focus Preset" button
4. App detects current Focus mode and applies preset

### Pros:
- ✅ Zero complexity
- ✅ No battery impact
- ✅ No background tasks
- ✅ Works immediately

### Cons:
- ❌ Requires user action
- ❌ Not fully automatic

---

## Option 4: Hybrid Approach (Best UX) ✅ Recommended

### What It Requires:
- **Polling when app is active** (Option 2)
- **Manual trigger button** (Option 3)
- **No Focus Filters extension** (avoid complexity)

### How It Works:
1. **When app is open**: Poll every 5 seconds, auto-apply
2. **When app is closed**: User can manually trigger on next open
3. **Quick action**: "Apply Focus Preset" button on Home screen

### Pros:
- ✅ Automatic when app is open
- ✅ Manual option when app is closed
- ✅ No new extension needed
- ✅ Good user experience

---

## Recommendation

**Use Option 4 (Hybrid Approach):**

1. **Keep the UI we built** (Settings screen with Focus mode mappings)
2. **Implement polling** in `FocusModeService` when app is active
3. **Add a quick action button** on Home screen for manual trigger
4. **Skip the Focus Filters extension** (too complex for the benefit)

### Why Skip Focus Filters Extension?
- You already have 2 extensions (Safari + Keyboard)
- Adding a 3rd adds significant complexity
- Polling works well for this use case
- Users can manually trigger if needed
- Easier to maintain and debug

---

## Current Status

✅ **UI is complete** - Settings screen with Focus mode mappings
✅ **Service structure ready** - `FocusModeService.ts` can be extended
✅ **Storage ready** - `focusModeSettings` in theme data
⚠️ **Detection needs implementation** - Can use polling (no new extension needed)

---

## Next Steps

1. **Implement polling** in `FocusModeService.startMonitoring()` (already has structure)
2. **Add manual trigger button** to Home screen
3. **Test with actual Focus mode changes**
4. **Skip Focus Filters extension** unless you really need background detection
