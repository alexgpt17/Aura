// Harness site list. Mirrors TEST_SITES.md rows that a headless browser can
// check. Fields:
//   id        short name used for output folders and --sites
//   rows      TEST_SITES.md rows this covers
//   url       start URL (or resolve(page) returns one, e.g. "first post")
//   type      { selectors: [...], open?: [...] }  typing target; `open`
//             selectors are clicked first (e.g. a "Join the conversation"
//             button). First visible match wins; open shadow DOM is pierced.
//   actions   extra steps after the 5 s screenshot: [{ click }, { wait }]
//   fixture   true → served offline from fixtures/<id>.html
//   origin    fixture only: serve it from this origin instead of
//             https://fixture.aura.test (host-gated engine code runs)
module.exports = [
    {
        id: 'reddit-post',
        rows: ['Type-1', 'R-1', 'R-3'],
        resolve: async (page) => {
            await page.goto('https://www.reddit.com/r/iphone/', { waitUntil: 'domcontentloaded', timeout: 30000 });
            const href = await page.locator('a[href*="/comments/"]').first().getAttribute('href', { timeout: 15000 });
            return new URL(href, 'https://www.reddit.com').href;
        },
        type: {
            open: ['comment-composer-host', 'faceplate-tracker[noun="comment_composer"]', 'button:has-text("Join the conversation")'],
            selectors: ['shreddit-composer [contenteditable="true"]', 'div[contenteditable="true"]', 'textarea[name="comment"]', 'textarea', 'input[type="search"]', 'input[name="q"]'],
        },
    },
    { id: 'reddit-sub', rows: ['R-2', 'Load-1'], url: 'https://www.reddit.com/r/iphone/' },
    {
        id: 'google-search',
        rows: ['Type-3', 'G-1'],
        url: 'https://www.google.com/search?q=what+is+ashwagandha',
        type: { selectors: ['textarea[name="q"]', 'input[name="q"]'] },
    },
    {
        id: 'google-aimode',
        rows: ['Type-2', 'G-2'],
        url: 'https://www.google.com/search?udm=50&q=why+is+the+sky+blue',
        type: { selectors: ['textarea[aria-label*="Ask"]', 'div[contenteditable="true"]', 'textarea'] },
    },
    { id: 'google-images', rows: ['G-3'], url: 'https://www.google.com/search?q=golden+gate+bridge&udm=2' },
    {
        id: 'wikipedia',
        rows: ['W-1', 'W-2', 'Load-2'],
        url: 'https://en.m.wikipedia.org/wiki/Golden_Gate_Bridge',
        actions: [{ click: '#mw-mf-main-menu-button, label[for="main-menu-input"]' }, { wait: 3000 }, { shot: 'menu' }],
    },
    {
        id: 'fandom',
        rows: ['W-3'],
        url: 'https://starwars.fandom.com/wiki/Luke_Skywalker',
        actions: [{ click: '.mobile-global-navigation__button, [data-tracking-label="menu"]' }, { wait: 1500 }, { shot: 'menu' }],
    },
    { id: 'airbnb-login', rows: ['A-1', 'A-3'], url: 'https://www.airbnb.com/login' },
    { id: 'airbnb-explore', rows: ['A-2', 'A-3'], url: 'https://www.airbnb.com/' },
    { id: 'amazon', rows: ['B-1', 'X-1'], url: 'https://www.amazon.com/s?k=usb+c+cable' },
    { id: 'github', rows: ['B-1', 'X-1', 'X-5'], url: 'https://github.com/', actions: [{ click: 'button[aria-label="Toggle navigation"], .HeaderMenu-toggle-bar' }, { wait: 1000 }, { shot: 'menu' }] },
    { id: 'youtube', rows: ['X-1'], url: 'https://m.youtube.com/' },
    { id: 'x', rows: ['X-1'], url: 'https://x.com/' },
    { id: 'fox5', rows: ['X-2'], url: 'https://fox5sandiego.com/' },
    // Nov 14 phone findings (record with --har record, see RELEASE_PLAN Session 8).
    { id: 'webmd', rows: ['X-8', 'X-10', 'Load-4'], url: 'https://www.webmd.com/vitamins-supplements/alpha-gpc' },
    { id: 'urbanplates', rows: ['F-2', 'U-1'], url: 'https://urbanplates.com/menu/' },
    { id: 'walmart', rows: ['X-6', 'X-11'], url: 'https://www.walmart.com/', actions: [{ click: 'button[aria-label*="Menu" i], [data-automation-id="hamburger-menu"]' }, { wait: 1000 }, { shot: 'menu' }] },
    { id: 'gmaps', rows: ['X-3'], url: 'https://www.google.com/maps' },

    // Offline fixtures (always available, also inside a no-network sandbox).
    {
        id: 'fixture-hydration',
        rows: ['Type-1 (synthetic)'],
        fixture: true,
        type: { selectors: ['#composer'] },
    },
    // Session 4 layer/overlay shapes (see each file's header comment).
    { id: 'fixture-wiki-drawer', rows: ['W-1 (synthetic)'], fixture: true },
    { id: 'fixture-airbnb-explore', rows: ['A-2', 'A-3 (synthetic)'], fixture: true },
    { id: 'fixture-airbnb-login', rows: ['A-1', 'A-3 (synthetic)'], fixture: true },
    { id: 'fixture-shadow-bars', rows: ['R-1', 'R-2 (synthetic)'], fixture: true },
    // Session 5B small surfaces.
    { id: 'fixture-airbnb-chips', rows: ['A-4 (synthetic)'], fixture: true },
    { id: 'fixture-popover', rows: ['X-6 (synthetic)'], fixture: true },
    { id: 'fixture-bearbottom-fit', rows: ['B-2 (synthetic)'], fixture: true },
    // Session 6.
    { id: 'fixture-theme-color', rows: ['Load-3 (synthetic)'], fixture: true },
    {
        id: 'fixture-google-aimode',
        rows: ['Type-2', 'G-1', 'G-2', 'G-5', 'G-6', 'G-7 (from the live DOM, Session 8)'],
        fixture: true,
        origin: 'https://www.google.com',
        type: { selectors: ['textarea[aria-label="Ask anything"]'] },
        actions: [{ click: 'textarea[aria-label="Ask anything"]' }, { wait: 600 }, { shot: 'focus', contrast: true }],
    },
    { id: 'fixture-late-text', rows: ['Load-1 (synthetic, text colors)'], fixture: true },
    {
        id: 'fixture-google-aimode-deep',
        rows: ['Type-2', 'G-2 (synthetic)'],
        fixture: true,
        origin: 'https://www.google.com',
        type: { selectors: ['textarea[aria-label="Ask anything"]'] },
    },
    { id: 'fixture-buttons', rows: ['B-1', 'X-6', 'R-3 (synthetic)'], fixture: true },
    { id: 'fixture-forms', rows: ['F-1 (synthetic)'], fixture: true, origin: 'https://docs.google.com' },
    // Session 7.
    { id: 'fixture-promo-sheet', rows: ['G-4 (synthetic)'], fixture: true, origin: 'https://www.google.com' },
    { id: 'fixture-blend', rows: ['B-3 (synthetic)'], fixture: true },
    {
        id: 'fixture-github-chrome', rows: ['X-7 (synthetic)'], fixture: true, origin: 'https://github.com',
        actions: [{ click: 'button[aria-label="Toggle navigation"]' }, { wait: 800 }, { shot: 'menu' }],
    },
    { id: 'fixture-masks', rows: ['F-2', 'R-4 (synthetic)'], fixture: true, actions: [{ click: '#fn' }, { wait: 600 }, { shot: 'focus', contrast: true }] },
    { id: 'fixture-portal-banner', rows: ['W-5 (synthetic)'], fixture: true, origin: 'https://www.wikipedia.org' },
    // Session 8 (from the live DOM read in Chrome; see each file's header).
    { id: 'fixture-fades', rows: ['X-8'], fixture: true, origin: 'https://github.com' },
    { id: 'fixture-webmd', rows: ['X-8', 'X-10', 'Load-4'], fixture: true, origin: 'https://www.webmd.com' },
    {
        id: 'fixture-walmart-menu', rows: ['X-11'], fixture: true, origin: 'https://www.walmart.com',
        actions: [{ click: '#menu' }, { wait: 800 }, { shot: 'menu', contrast: true }],
    },
    // Session 8b (phone-shaped live DOM, Playwright + iPhone 15 profile).
    {
        id: 'fixture-urbanplates', rows: ['F-2', 'F-3', 'U-1'], fixture: true, origin: 'https://urbanplates.com',
        actions: [
            { click: '#zip' }, { wait: 700 }, { shot: 'focus', contrast: true },
            { type: 'qqq' }, { wait: 800 }, { shot: 'dropdown', contrast: true },
            { click: '#plates' }, { wait: 500 }, { eval: "document.getElementById('page').scrollTop = 160" }, { wait: 800 }, { shot: 'category', contrast: true },
        ],
    },
    { id: 'fixture-walmart-popup', rows: ['X-12'], fixture: true, origin: 'https://www.walmart.com' },
];
