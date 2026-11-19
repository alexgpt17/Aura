# Aura daily Safari test checklist (~15 min)
Run each row with **one dark preset** and **one light preset** (D / L). Mark ✅ / ❌, and attach a screenshot for any ❌.
Before testing, force-quit Safari once (cold start). In debug builds, add `#aura-debug` to a URL to see HUD numbers (from Session 2 on). For any layout row (A-2, or anything that "looks squashed"), tap **Layout diff** in the HUD: it must report 0 elements moved or resized.

| # | Site / action | Pass criteria | D | L |
|---|---|---|---|---|
| Load-1 | Cold-launch Safari → open reddit.com (a site visited before) | No unthemed (white) or wrong-theme frame. Text colors are right in the first themed frame: no gray/dark text turning light 1–2 s later, including posts that load while you watch. Also repeat visits to airbnb.com: no frame in the site's original colors. Debug build (added Nov 17): open the site once with `#aura-debug` in the tab; if a flash happens, read the HUD `cache` line (hit/miss + reason, `ok`/`LATE`, host) | | |
| Load-2 | Type "wikipedia" in the address bar, tap the top hit (Preload Top Hit) | Same as Load-1 | | |
| Load-4 | Theme off in the app → reload the Safari tab → theme on in the app, back to Safari (no reload) | Page and the bottom bar/status bar take the theme right away | | |
| Load-5 | Dark theme: load a few sites (airbnb.com, walmart.com, reddit.com), scroll so new content loads, tap buttons and open menus | No white flash over buttons, text or surfaces at any point (added Nov 16) | | |
| Load-3 | Switch theme in the app → back to the Safari tab, then reload | New theme applies within ~1 s, no flicker loop. The strip at the bottom of the screen (and the status bar / toolbar tint) shows the new theme, not the old one. After the reload, at most one old-theme frame (first load after a change), never on the next load | | |
| Type-1 | reddit.com post → write a 2-line comment fast | Characters appear instantly, no stutter | | |
| Type-2 | google.com → AI Mode → type a long question | No lag; composer looks like the Aura-off version | | |
| Type-3 | google.com main search box typing + suggestions | No lag; suggestions dropdown doesn't flash | | |
| G-1 | Google search with AI Overview → "Show more" | Same layout as Aura-off; text readable; no white cards | | |
| G-2 | AI Mode answer streaming + a follow-up question | Bubbles/chips/icons visible, no flicker | | |
| G-3 | Google Images → open an image | Viewer opaque, grid not showing through | | |
| G-4 | Google search results in Safari while the "Keep things dark while you browse" Google-app promo sheet shows (it appears at the bottom of google.com results, mostly logged out or on early visits; skip if it doesn't appear) | Sheet opaque; results/AI Overview don't show through; "Stay in browser" / "Continue" readable | | |
| G-6 | Google search with an AI Overview, before tapping "Show more": try several searches, e.g. "what is ashwagandha" and an entity panel such as "uc davis". **iPhone in dark mode** (Google then sends its dark CSS) and once in light mode | Collapsed text fades into the theme background above the button, like Google's own dark mode (IMG_0726): no gray or white band over the text, no dark or white bar under the button (failing Nov 18: IMG_0719 white, IMG_0725 gray) | | |
| G-7 | AI Mode: tap the composer, type a little, stop | The page behind the expanded composer is dimmed (a visible tint), as with Aura off | | |
| G-5 | AI Mode answer, scroll; then tap the composer and type | Sticky top bar (G logo + chevron) opaque, nothing scrolls under it; composer text field opaque (answer text not visible through it); band under the composer is the theme color, not dark gray | | |
| R-1 | reddit.com post page, scroll | Top header and username/post bar opaque; nothing visibly scrolls under them. HUD inspect on the bar shows its authored-opaque layer painted | | |
| R-2 | Subreddit page, scroll | Subreddit bar ("Open App") opaque. HUD inspect shows its authored-opaque layer painted | | |
| R-3 | Start a comment → Cancel → "Save Draft?" sheet | Sheet themed; Save/Discard readable; the backdrop behind the sheet is a dimmed scrim (as with Aura off), not solid theme color; both Save and Discard keep a fill that stands apart from the sheet (neither blends in) | | |
| R-4 | reddit.com post → comment thread with "N more replies" | No black (or any off-theme) squares at the thread-line connectors, at the "N more replies" corners or the "+" expand nodes (failing Nov 19 with iOS in dark mode: IMG_0728, 0730, 0731, 0741) | ❌ Nov 19 | |
| W-1 | en.m.wikipedia.org article → open ☰ menu, wait 3 s | Menu stays opaque, including after the donate banner appears. HUD inspect on `#mw-mf-page-left` shows it painted | | |
| W-2 | Wikipedia infobox + tables + search field | Readable, no white boxes | | |
| W-3 | Another MediaWiki/Fandom wiki → open menu | Menu opaque | | |
| W-5 | www.wikipedia.org (the portal, not en.m) while a fundraising banner shows (only during a campaign; skip if none), light theme too | Banner opaque; no banner text over the language list; WIKIPEDIA wordmark readable | | |
| W-4 | en.m.wikipedia.org article with the fundraising banner showing | No bordered "Banner logo" alt-text box. If it appears, check with Aura off for that site, then HUD inspect the box (tag/class/src) | | |
| A-1 | airbnb.com → Log in (cookie popup appears) | Whole card opaque; nothing shows through or sticks out at its edges; "Accept all" / "Only necessary" readable; backdrop dimmed, not solid | | |
| A-2 | airbnb.com explore page, scroll slowly then fast | Header, search bar and category chips stay opaque; no content shows through; spacing between header and search bar matches Aura-off (HUD layout diff = 0) | | |
| A-3 | airbnb.com bottom tab bar, on login and explore, while scrolling | Bar opaque; Explore/Wishlists/… labels readable | | |
| A-5 | airbnb.com explore: the pills on listing photos ("Guest favorite", "Prices include all fees") | Look like Aura-off (not see-through); text readable on the photo (added Nov 16) | | |
| A-4 | airbnb.com category chips under the search bar | No square boxes around the emoji icons; labels readable | | |
| B-1 | Light buttons: Amazon "Add to Cart", GitHub "Sign up", a cookie banner "Accept" | Button text readable | | |
| B-3 | amazon.com product page → "Similar products" grid | Product photos look like Aura-off, not darkened to near-black. On a dark theme each photo sits on its own white background (the light-gray tile behind it isn't kept); on a light theme they blend as with Aura off | | |
| B-2 | bearbottomclothing.com product page → "Find my size" | Panel opaque (no swatches showing through), backdrop dimmed, not solid | | |
| X-1 | youtube.com, x.com, amazon.com search, github.com mobile menu | No white slabs, menus opaque, header readable | | |
| X-2 | News site with ads + cookie banner (fox5sandiego.com) | No solid curtain; ads untouched; banner card opaque | | |
| X-3 | Google Maps | No full-screen theme curtain | | |
| X-4 | Turn the theme off for one site in the app | Site returns fully to its original look | | |
| X-5 | App → Safari settings → turn on "Dark Mode" (native) → open github.com and wikipedia | Site uses its own dark mode; turning it off restores the Aura theme | | |
| X-7 | github.com with Aura on (homepage + ☰ menu) | Safari status bar and bottom toolbar take the theme color, not white (failing Nov 14) | | |
| X-8 | Edge fades, dark theme: github.com homepage carousel rows, airbnb.com "Inspiration for future getaways" category row, webmd.com drug page tab row (right edge) | Fades go into the theme color, no white strip | | |
| X-9 | Light buttons/chips: Reddit "Save Draft?" Save button, airbnb.com category chips (All/Homes/Hotels) | Text readable on its fill (or the fill themed); look out for other light buttons with light text | | |
| X-10 | webmd.com drug page (e.g. Alpha-GPC) hero: title, authors, generic names | Section themed and readable; no light decorative image under light text | | |
| X-11 | walmart.com: open/close the ☰ menu (popups moved to X-12) | No flash on the top bar or menu when it opens/closes; in particular no white "English" row or "language and currency" pill while the drawer slides in (failing Nov 19, iOS dark: IMG_0743) | ❌ Nov 19 | |
| U-1 | urbanplates.com menu: scroll past "Beverages" (and the other category bars, e.g. "Plates"); also the top header | The sticky category bar and the header are opaque; no item text under them | | |
| X-12 | walmart.com homepage: "Spanish / Español" popup and the "switch to another country" popup | Popup card opaque; no page text through it; the arrow matches the card, not a dark-blue diamond (added Nov 16; failing Nov 19, iOS dark: IMG_0742) | ❌ Nov 19 | |
| X-6 | walmart.com order / tracking page | "Spanish/Español" tooltip opaque; no white full-width strips; "Give feedback" readable | | |
| F-4 | accounts.google.com sign-in: tap "Email or phone", then (if it appears) the password field; don't sign in | The field's outline breaks around the floated label, as with Aura off; no line through the label text (failing Nov 18: IMG_0720, IMG_0721) | | |
| X-13 | appointments.ucdavis.edu (or any site with light-yellow/pastel header bars and white text), gray and dark themes | Header text readable on its bar (failing before 8b: IMG_0711, IMG_0712; needs the page behind login, not reproduced) | | |
| X-14 | registrar.ucdavis.edu page with a wide table that scrolls sideways | No white strips at the table's left/right edges ("scroll shadows"; failing before 8b: IMG_0710) | | |
| X-15 | sky.shiiyu.moe profile page, scroll | Header opaque; nothing scrolls under it (IMG_0717, IMG_0718, before 8b) | | |
| Load-6 | Dark theme: airbnb.com, reddit.com, github.com, wikipedia; cold load, watch the text | No text stays dark (black/gray) on the dark theme for more than a moment, including the cookie banner at the bottom (failing Nov 18: up to 2–3 s on airbnb.com) | | |
| F-2 | A checkout/login form with floating labels on the input border (urbanplates.com guest checkout "First Name", and the restaurant search field "Search by city or zip"); dark theme especially | Label text sits on the border cleanly like Aura-off: no white box over the label (failing Nov 18: IMG_0723), label not shifted | ✅ Nov 19 | |
| F-3 | urbanplates.com: restaurant search with no results ("No suggested addresses found" dropdown); guest checkout with empty fields ("Enter First Name, Last Name, Email, Phone" bar) | Dropdown and bar opaque, no text behind them showing through; no stray white lines up the card edges (added Nov 16); the bottom "Enter First Name…" bar is frosted with Aura off: themed it should be opaque | | |
| F-1 | A Google Form with checkboxes (docs.google.com/forms) | Checked vs unchecked boxes clearly distinct; radio buttons and switches visible; "Autosave" dialog fully opaque, no overlapping text | | |
| GM-1 | mail.google.com (mobile web, logged in), black and one colored theme: open an email; open the ☰ menu | The arrow-shaped "Primary" back button and the account selector at the top of the menu are themed or keep a fill their text reads on: no white button with light text (new Nov 19: IMG_0747, 0745) | | |
| GM-2 | Gmail ☰ menu, scroll to the bottom | No light strip at the bottom of the menu; the second account selector there is readable (new Nov 19: IMG_0746) | | |
| GM-3 | Gmail: open an email → "Details" | The "To:" value is readable, like "Date:" (new Nov 19: IMG_0748) | | |
| GM-4 | Gmail inbox and ☰ menu, scroll up and down several times | The top bar ("Gmail is better on the app" banner + toolbar) stays opaque; no list or menu text visible through it (new Nov 19: IMG_0744, 0746) | | |
| G-8 | google.com AI Mode answer → tap the composer (focused, keyboard up) | The strip under the composer (the search-pill bar, e.g. "uc davis") takes the theme like the unfocused state, not dark gray; the dim tint over the page stays (new Nov 19, low priority: IMG_0739 vs 0740) | | |
