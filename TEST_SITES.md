# Aura daily Safari test checklist (~15 min)
Run each row with **one dark preset** and **one light preset** (D / L). Mark ✅ / ❌, and attach a screenshot for any ❌.
Before testing, force-quit Safari once (cold start). In debug builds, add `#aura-debug` to a URL to see HUD numbers (from Session 2 on). For any layout row (A-2, or anything that "looks squashed"), tap **Layout diff** in the HUD: it must report 0 elements moved or resized.

| # | Site / action | Pass criteria | D | L |
|---|---|---|---|---|
| Load-1 | Cold-launch Safari → open reddit.com | No unthemed (white) or wrong-theme frame | | |
| Load-2 | Type "wikipedia" in the address bar, tap the top hit (Preload Top Hit) | Same as Load-1 | | |
| Load-3 | Switch theme in the app → back to the Safari tab | New theme applies within ~1 s, no flicker loop | | |
| Type-1 | reddit.com post → write a 2-line comment fast | Characters appear instantly, no stutter | | |
| Type-2 | google.com → AI Mode → type a long question | No lag; composer looks like the Aura-off version | | |
| Type-3 | google.com main search box typing + suggestions | No lag; suggestions dropdown doesn't flash | | |
| G-1 | Google search with AI Overview → "Show more" | Same layout as Aura-off; text readable; no white cards | | |
| G-2 | AI Mode answer streaming + a follow-up question | Bubbles/chips/icons visible, no flicker | | |
| G-3 | Google Images → open an image | Viewer opaque, grid not showing through | | |
| R-1 | reddit.com post page, scroll | Top header and username/post bar opaque; nothing visibly scrolls under them. HUD inspect on the bar shows its authored-opaque layer painted | | |
| R-2 | Subreddit page, scroll | Subreddit bar ("Open App") opaque. HUD inspect shows its authored-opaque layer painted | | |
| R-3 | Start a comment → Cancel → "Save Draft?" sheet | Save/Discard text readable | | |
| W-1 | en.m.wikipedia.org article → open ☰ menu, wait 3 s | Menu stays opaque, including after the donate banner appears. HUD inspect on `#mw-mf-page-left` shows it painted | | |
| W-2 | Wikipedia infobox + tables + search field | Readable, no white boxes | | |
| W-3 | Another MediaWiki/Fandom wiki → open menu | Menu opaque | | |
| A-1 | airbnb.com → Log in (cookie popup appears) | Whole card opaque; nothing shows through or sticks out at its edges; "Accept all" / "Only necessary" readable; backdrop dimmed, not solid | | |
| A-2 | airbnb.com explore page, scroll slowly then fast | Header, search bar and category chips stay opaque; no content shows through; spacing between header and search bar matches Aura-off (HUD layout diff = 0) | | |
| A-3 | airbnb.com bottom tab bar, on login and explore, while scrolling | Bar opaque; Explore/Wishlists/… labels readable | | |
| A-4 | airbnb.com category chips under the search bar | No square boxes around the emoji icons; labels readable | | |
| B-1 | Light buttons: Amazon "Add to Cart", GitHub "Sign up", a cookie banner "Accept" | Button text readable | | |
| B-2 | bearbottomclothing.com product page → "Find my size" | Panel opaque (no swatches showing through), backdrop dimmed, not solid | | |
| X-1 | youtube.com, x.com, amazon.com search, github.com mobile menu | No white slabs, menus opaque, header readable | | |
| X-2 | News site with ads + cookie banner (fox5sandiego.com) | No solid curtain; ads untouched; banner card opaque | | |
| X-3 | Google Maps | No full-screen theme curtain | | |
| X-4 | Turn the theme off for one site in the app | Site returns fully to its original look | | |
| X-5 | App → Safari settings → turn on "Dark Mode" (native) → open github.com and wikipedia | Site uses its own dark mode; turning it off restores the Aura theme | | |
| X-6 | walmart.com order / tracking page | "Spanish/Español" tooltip opaque; no white full-width strips; "Give feedback" readable | | |
| F-1 | A Google Form with checkboxes (docs.google.com/forms) | Checked vs unchecked boxes clearly distinct; "Autosave" dialog fully opaque, no overlapping text | | |
