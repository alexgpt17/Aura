# App Review Notes — Aura

## What Aura does

Aura lets users recolor Safari web pages with selectable themes, create custom themes, set per-site overrides, and optionally enable a Safari Content Blocker for ads/trackers/annoyances.

## Required setup for reviewers (Safari theming)

The container app configures themes; the Safari Web Extension applies them. **You must enable the extension** or Safari will look unchanged:

1. Install and open **Aura**.
2. Complete onboarding (includes enablement steps), or open the **Themes** tab.
3. Open the iOS **Settings** app → **Safari** → **Extensions**.
4. Enable **Aura** (Safari Web Extension).
5. Allow access on **All Websites** when prompted.
6. Return to Aura → Themes → choose a theme (e.g. Dark or Ocean).
7. Open Safari to any webpage — the theme should apply.

## Content Blocker (optional)

1. In Aura, open the **Protection** tab.
2. Enable desired categories.
3. Settings → Safari → Extensions → enable **Aura Content Blocker** → Allow on All Websites.

## Privacy

- Privacy policy: https://alexgpt17.github.io/Aura/privacy/
- Aura does not collect account data, location, or analytics. No sign-in.
- The Safari extension uses broad website access (`<all_urls>`) only to apply on-device theme CSS. Page contents are not uploaded. Without All Websites access, theming cannot run on the pages the user visits.

## Focus / Rules

Focus Mode / Focus Filter is **not included in this build** (extension not embedded). Do not expect Aura under Settings → Focus → Focus Filters.

## Test account

None — no login.
