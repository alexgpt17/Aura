# How to Check Build Error

Please check these:

## 1. What's the exact error message?

In Xcode:
- Click the **red error icon** (X1) in the toolbar
- Or open **Issue Navigator** (left sidebar, icon with exclamation mark)
- What does the error message say exactly?

## 2. Check Build Phases for "TintExtension Extension"

In Xcode:
1. Select **"TintExtension Extension"** target in Project Navigator
2. Go to **"Build Phases"** tab
3. Expand **"Copy Bundle Resources"**
4. **Is `Info.plist` listed there?**

If Info.plist IS in Copy Bundle Resources:
- That's the problem! It should NOT be there
- Remove it: Select it and press Delete or uncheck it

## 3. Clean Build Folder

Sometimes Xcode caches old build settings:
1. **Product → Clean Build Folder** (Shift+Cmd+K)
2. Then rebuild

---

Please share:
1. The exact error message from Issue Navigator
2. Whether Info.plist is in Copy Bundle Resources
