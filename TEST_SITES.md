# Aura daily Safari test checklist (~15 min)
Run each row with **one dark preset** and **one light preset** (D / L). Mark ✅ / ❌, and attach a screenshot for any ❌.
Before testing, force-quit Safari once (cold start). In debug builds, add `#aura-debug` to a URL to see HUD numbers (from Session 2 on). For any layout row (A-2, or anything that "looks squashed"), tap **Layout diff** in the HUD: it must report 0 elements moved or resized.

| # | Site / action | Pass criteria | D | L |
|---|---|---|---|---|
| Load-1 | Cold-launch Safari → open reddit.com (a site visited before) | No unthemed (white) or wrong-theme frame. Text colors are right in the first themed frame: no gray/dark text turning light 1–2 s later, including posts that load while you watch | | |
| Load-2 | Type "wikipedia" in the address bar, tap the top hit (Preload Top Hit) | Same as Load-1 | | |
| Load-3 | Switch theme in the app → back to the Safari tab, then reload | New theme applies within ~1 s, no flicker loop. The strip at the bottom of the screen (and the status bar / toolbar tint) shows the new theme, not the old one. After the reload, at most one old-theme frame (first load after a change), never on the next load | | |
| Type-1 | reddit.com post → write a 2-line comment fast | Characters appear instantly, no stutter | | |
| Type-2 | google.com → AI Mode → type a long question | No lag; composer looks like the Aura-off version | | |
| Type-3 | google.com main search box typing + suggestions | No lag; suggestions dropdown doesn't flash | | |
| G-1 | Google search with AI Overview → "Show more" | Same layout as Aura-off; text readable; no white cards | | |
| G-2 | AI Mode answer streaming + a follow-up question | Bubbles/chips/icons visible, no flicker | | |
| G-3 | Google Images → open an image | Viewer opaque, grid not showing through | | |
| G-4 | Google search on Safari while the "Keep things dark while you browse" (Google app promo) sheet shows | Sheet opaque; results/AI Overview don't show through; "Stay in browser" / "Continue" readable | | |
| G-5 | AI Mode answer, scroll; then tap the composer and type | Sticky top bar (G logo + chevron) opaque, nothing scrolls under it; composer text field opaque (answer text not visible through it); band under the composer is the theme color, not dark gray | | |
| R-1 | reddit.com post page, scroll | Top header and username/post bar opaque; nothing visibly scrolls under them. HUD inspect on the bar shows its authored-opaque layer painted | | |
| R-2 | Subreddit page, scroll | Subreddit bar ("Open App") opaque. HUD inspect shows its authored-opaque layer painted | | |
| R-3 | Start a comment → Cancel → "Save Draft?" sheet | Sheet themed; Save/Discard readable; the backdrop behind the sheet is a dimmed scrim (as with Aura off), not solid theme color; both Save and Discard keep a fill that stands apart from the sheet (neither blends in) | | |
| R-4 | reddit.com post → comment thread with "N more replies" | No black (or any off-theme) squares at the thread-line connectors | | |
| W-1 | en.m.wikipedia.org article → open ☰ menu, wait 3 s | Menu stays opaque, including after the donate banner appears. HUD inspect on `#mw-mf-page-left` shows it painted | | |
| W-2 | Wikipedia infobox + tables + search field | Readable, no white boxes | | |
| W-3 | Another MediaWiki/Fandom wiki → open menu | Menu opaque | | |
| W-5 | www.wikipedia.org portal with the fundraising banner showing (light theme too) | Banner opaque; no banner text over the language list; WIKIPEDIA wordmark readable | | |
| W-4 | en.m.wikipedia.org article with the fundraising banner showing | No bordered "Banner logo" alt-text box. If it appears, check with Aura off for that site, then HUD inspect the box (tag/class/src) | | |
| A-1 | airbnb.com → Log in (cookie popup appears) | Whole card opaque; nothing shows through or sticks out at its edges; "Accept all" / "Only necessary" readable; backdrop dimmed, not solid | | |
| A-2 | airbnb.com explore page, scroll slowly then fast | Header, search bar and category chips stay opaque; no content shows through; spacing between header and search bar matches Aura-off (HUD layout diff = 0) | | |
| A-3 | airbnb.com bottom tab bar, on login and explore, while scrolling | Bar opaque; Explore/Wishlists/… labels readable | | |
| A-4 | airbnb.com category chips under the search bar | No square boxes around the emoji icons; labels readable | | |
| B-1 | Light buttons: Amazon "Add to Cart", GitHub "Sign up", a cookie banner "Accept" | Button text readable | | |
| B-3 | amazon.com product page → "Similar products" grid | Product photos look like Aura-off (not darkened to near-black) | | |
| B-2 | bearbottomclothing.com product page → "Find my size" | Panel opaque (no swatches showing through), backdrop dimmed, not solid | | |
| X-1 | youtube.com, x.com, amazon.com search, github.com mobile menu | No white slabs, menus opaque, header readable | | |
| X-2 | News site with ads + cookie banner (fox5sandiego.com) | No solid curtain; ads untouched; banner card opaque | | |
| X-3 | Google Maps | No full-screen theme curtain | | |
| X-4 | Turn the theme off for one site in the app | Site returns fully to its original look | | |
| X-5 | App → Safari settings → turn on "Dark Mode" (native) → open github.com and wikipedia | Site uses its own dark mode; turning it off restores the Aura theme | | |
| X-7 | github.com with Aura on (homepage + ☰ menu) | Safari status bar and bottom toolbar take the theme color, not white | | |
| X-6 | walmart.com order / tracking page | "Spanish/Español" tooltip opaque; no white full-width strips; "Give feedback" readable | | |
| F-2 | A checkout/login form with floating labels on the input border (urbanplates.com guest checkout) | Label text sits on the border cleanly like Aura-off: no white box over the label, label not shifted | | |
| F-1 | A Google Form with checkboxes (docs.google.com/forms) | Checked vs unchecked boxes clearly distinct; radio buttons and switches visible; "Autosave" dialog fully opaque, no overlapping text | | |
