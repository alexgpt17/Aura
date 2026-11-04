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
        url: 'https://www.google.com/search?q=why+is+the+sky+blue',
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
    { id: 'gmaps', rows: ['X-3'], url: 'https://www.google.com/maps' },

    // Offline fixtures (always available, also inside a no-network sandbox).
    {
        id: 'fixture-hydration',
        rows: ['Type-1 (synthetic)'],
        fixture: true,
        type: { selectors: ['#composer'] },
    },
];
