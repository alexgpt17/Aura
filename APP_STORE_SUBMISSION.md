# App Store submission kit — Aura

Use this file when filling App Store Connect and preparing the archive. Archive the **TintApp** scheme only (not TintExtension).

## 1. Privacy policy (live URL)

**URL:** https://alexgpt17.github.io/Aura/privacy/

Source: [`docs/privacy/index.html`](docs/privacy/index.html) (also mirrored at `docs/privacy-policy.html`).

### Enable GitHub Pages (one-time)

If the URL still 404s after pushing `docs/` to `main`:

1. Open https://github.com/alexgpt17/Aura/settings/pages  
2. **Source:** Deploy from a branch  
3. **Branch:** `main` → folder **`/docs`** → Save  
4. Wait 1–2 minutes, then open the privacy URL above  

Paste the same URL into App Store Connect → App Privacy → Privacy Policy URL, and into App Information → Privacy Policy URL.

---

## 2. App Store Connect listing (paste-ready)

| Field | Suggested value |
|---|---|
| **Name** | Aura |
| **Subtitle** | Themes for Safari |
| **Category** | Utilities (secondary: Productivity) |
| **Age rating** | 4+ |
| **Support URL** | `mailto:alexmartens1111@gmail.com` or a simple support page you host |
| **Marketing URL** | Optional |
| **Privacy Policy URL** | https://alexgpt17.github.io/Aura/privacy/ |
| **Copyright** | 2026 Alex Martens |
| **Bundle ID** | `com.alexmartens.aura` |

### Promotional text (optional, updatable anytime)

Recolor Safari with beautiful themes, custom colours, and per-site overrides — all on your device.

### Description

Aura recolors websites in Safari with selectable themes. Pick a preset, create your own colours, and set overrides for individual sites. An optional content blocker can filter ads, trackers, social widgets, and annoyances.

How to get started:
1. Open Aura and choose a theme.
2. On iPhone, go to Settings → Safari → Extensions and turn on Aura. Allow access on All Websites.
3. Open Safari — your theme applies on the page.

Themes and settings stay on your device. Aura does not require an account and does not sell or upload your browsing content.

### Keywords (100 char max, comma-separated)

safari,theme,dark mode,color,extension,content blocker,custom theme,website

### What’s New (1.0)

Initial release: Safari themes, custom colours, per-site overrides, and optional content blocker.

### Review Notes

Paste the full contents of [`APP_REVIEW_NOTES.md`](APP_REVIEW_NOTES.md) into App Review Information → Notes.

---

## 3. App Privacy nutrition labels

Declare in App Store Connect (App Privacy):

| Data type | Collected? | Notes |
|---|---|---|
| Contact Info | No | |
| Health & Fitness | No | |
| Financial | No | |
| Location | No | |
| Sensitive Info | No | |
| Contacts | No | |
| User Content | No | Themes stay on-device; not uploaded |
| Browsing History | No | Extension does not upload pages |
| Identifiers | No | No advertising ID / analytics |
| Purchases | No | No IAP in MVP |
| Usage Data | No | No analytics SDK |
| Diagnostics | No | |

**Data linked to user:** None  
**Data used to track:** No  
**Privacy Policy URL:** https://alexgpt17.github.io/Aura/privacy/

---

## 4. Screenshots (you take these on device)

Capture on an **iPhone** (iPhone-only app). Suggested set (6.7" and/or 6.1"):

1. Themes tab with a theme selected + mini-page preview  
2. Browse Themes list  
3. Custom theme editor  
4. Safari with a themed page (after enabling the extension)  
5. Protection / content blocker screen  
6. Settings with Safari setup / privacy rows  

Match what the app actually shows (no Focus / Rules tab, no IAP).

---

## 5. Signing & capabilities (Apple Developer)

In [developer.apple.com](https://developer.apple.com) → Identifiers, create/verify:

| Identifier | Type | Capabilities |
|---|---|---|
| `com.alexmartens.aura` | App | App Groups |
| `com.alexmartens.aura.SafariExtension` | App Extension | App Groups |
| `com.alexmartens.aura.ContentBlockerExtension` | App Extension | App Groups |
| `group.com.alexmartens.tint` | App Group | — |

Enable the same App Group on all three IDs. In Xcode (TintApp scheme → Signing & Capabilities):

- Team: your paid Apple Developer team  
- Automatically manage signing (recommended)  
- Confirm entitlements match: App Group `group.com.alexmartens.tint` on TintApp, Safari extension, and Content Blocker  

**Do not** archive the legacy `TintExtension` / `TintExtensionHost` target. Ship **TintApp** only. Focus Filter is no longer embedded.

Export compliance: Info.plist already sets `ITSAppUsesNonExemptEncryption` = false (standard HTTPS only).

---

## 6. Device test checklist (before Submit)

Run on a physical iPhone with a Development or Ad Hoc / TestFlight build. Dual-colour / split themes are not in this release.

### App

- [ ] Fresh install → onboarding mentions Safari extension enablement (classic colours only)  
- [ ] Settings → Safari → Extensions → enable **Aura** → Allow All Websites  
- [ ] Pick a dark theme (e.g. Aurora) → Safari page recolors  
- [ ] Pick a light theme (e.g. Sepia) → Safari page recolors; text readable  
- [ ] Create a custom theme → save → apply → visible in Safari  
- [ ] Per-site override for one hostname  
- [ ] Protection tab → enable a category → enable Content Blocker in Safari Settings  
- [ ] Privacy Policy screen opens; link loads https://alexgpt17.github.io/Aura/privacy/  
- [ ] No Focus / Rules tab; Aura does not appear under Focus Filters  
- [ ] App does not crash on launch, background, or theme switch  

### Engine regression (dark theme + light theme on each)

Pass: themed page background, readable text/links, intact images/icons, usable overlays, no see-through second screens, close/back restores the page.

- [ ] Google All results  
- [ ] Google Images: tap a result, scroll, close  
- [ ] Google Shopping: carousel tiles are not painted as modal sheets  
- [ ] Wikipedia (infobox / tables readable)  
- [ ] Amazon search  
- [ ] YouTube  
- [ ] Reddit  
- [ ] X  
- [ ] One news site and apple.com  
- [ ] A cookie or sign-in sheet (scrim stays transparent; inner card opaque)  
- [ ] Maps (must not get a solid theme curtain)  

If a site fails, add a host SITE_FIX with a stable selector. Do not change `.gb_A`, `.u4frDf`, or `#rso`. Do not loosen overlay/modal heuristics.  

---

## 7. What this kit cannot do for you

Apple Developer enrollment, App Store Connect app record creation, certificate/profile issuance, screenshot capture, and the final **Submit for Review** click require your Apple ID and device. Everything pasteable and code-side for MVP submission is covered above.
