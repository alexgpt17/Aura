#!/usr/bin/env node
// Offline snapshots of real pages, phone-shaped (Session 8c).
//
//   node snapshot.js [--scheme dark|light] [--headed] name [name...]
//   node snapshot.js --list
//
// Loads the page in Chromium with the iPhone 15 Pro profile (and
// prefers-color-scheme, default dark: the phone runs iOS in dark mode),
// waits, scrolls a few screens so lazy content renders, then saves one
// self-contained HTML file to snapshots/<name>.html (+ <name>.json):
//   - scripts removed (a static page: Aura's passes see the rendered DOM)
//   - every stylesheet inlined in place (cross-origin sheets fetched from
//     Node), @media blocks kept, so --scheme picks the light or dark rules
//   - open shadow roots serialized as declarative shadow DOM, with their
//     adoptedStyleSheets written in as <style>
//   - images, video posters and iframes replaced by same-size gray boxes
// sites.js adds every saved snapshot as `snapshot-<name>`, served from the
// page's own origin with all other requests aborted (offline, repeatable).
// Needs the network: run outside the sandbox. View only: no sign-in, no
// form submits.

const fs = require('fs');
const path = require('path');
const pw = require('playwright');

const HERE = __dirname;
const OUT = path.join(HERE, 'snapshots');

const SITES = {
    'google-ucdavis': { url: 'https://www.google.com/search?q=uc+davis' },
    'google-ashwagandha': { url: 'https://www.google.com/search?q=what+is+ashwagandha' },
    'google-signin': { url: 'https://accounts.google.com/signin' },
    // The outlined field with its label floated (F-4): focused, nothing typed.
    'google-signin-focus': { url: 'https://accounts.google.com/signin', actions: [{ focus: '#identifierId, input[type="email"]:visible' }, { wait: 1200 }] },
    // Guest checkout (F-2 on the real page): one item in the bag, the
    // First Name field focused. Nothing typed or submitted.
    'urbanplates-checkout': {
        url: 'https://urbanplates.com/order/menu/?store_id=009&service_type_id=2&menu_id=76&category_name=Plates',
        actions: [
            { eval: "(() => { const b = [...document.querySelectorAll('button, a, [role=button]')].find(x => /Chicken Tender|Aleppo|Plate/i.test(x.textContent) && x.offsetHeight > 40); if (b) b.click(); return !!b; })()", wait: 3500 },
            { eval: "(() => { const b = [...document.querySelectorAll('button')].filter(x => /add to (bag|cart|order)/i.test(x.textContent) && x.offsetParent); if (b.length) b[b.length - 1].click(); return b.length; })()", wait: 3500 },
            { eval: "(() => { const b = [...document.querySelectorAll('button, a')].find(x => /checkout|view bag|bag/i.test(x.textContent) && x.offsetParent); if (b) b.click(); return b ? b.textContent.trim().slice(0, 40) : null; })()", wait: 4000 },
            { eval: "(() => { const b = [...document.querySelectorAll('button, a')].find(x => /checkout/i.test(x.textContent) && x.offsetParent); if (b) b.click(); return b ? b.textContent.trim().slice(0, 40) : null; })()", wait: 6000 },
            { eval: "(() => { const b = [...document.querySelectorAll('button, a')].find(x => /guest/i.test(x.textContent) && x.offsetParent); if (b) b.click(); return !!b; })()", wait: 3000 },
            { focus: 'input[name*="first" i], input[id*="first" i], input[autocomplete="given-name"]', wait: 1200 },
        ],
    },
    airbnb: { url: 'https://www.airbnb.com/' },
    'reddit-post': { url: 'https://www.reddit.com/r/interestingasfuck/top/?t=day', firstLink: 'a[href*="/comments/"]' },
    walmart: { url: 'https://www.walmart.com/' },
    // The "Save Draft?" sheet (X-9): open the comment composer, type a few
    // words, Cancel. Nothing is posted; no account.
    'reddit-savedraft': {
        url: 'https://www.reddit.com/r/interestingasfuck/top/?t=day', firstLink: 'a[href*="/comments/"]',
        actions: [
            { click: 'comment-composer-host, faceplate-tracker[noun="comment_composer"], button:has-text("Join the conversation")', wait: 2500 },
            { click: 'shreddit-composer [contenteditable="true"], div[contenteditable="true"]', wait: 800 },
            { type: 'testing draft', wait: 800 },
            { click: 'button:has-text("Cancel")', wait: 2000 },
        ],
    },
    urbanplates: { url: 'https://urbanplates.com/order/' },
    wikipedia: { url: 'https://en.m.wikipedia.org/wiki/University_of_California,_Davis' },
    nytimes: { url: 'https://www.nytimes.com/' },
    amazon: { url: 'https://www.amazon.com/' },
    youtube: { url: 'https://m.youtube.com/' },
    github: { url: 'https://github.com/microsoft/playwright' },
    x: { url: 'https://x.com/nasa' },
    'ucdavis-registrar': { url: 'https://registrar.ucdavis.edu/calendar/academic-calendar' },
    skycrypt: { url: 'https://sky.shiiyu.moe/' },
};

function parseArgs(argv) {
    const a = { scheme: 'dark', names: [] };
    for (let i = 2; i < argv.length; i++) {
        const k = argv[i];
        if (k === '--scheme') a.scheme = argv[++i];
        else if (k === '--headed') a.headed = true;
        else if (k === '--list') a.list = true;
        else a.names.push(k);
    }
    return a;
}

// Runs in the page: freezes it into one HTML string. Link stylesheets
// whose rules can't be read (cross-origin) come back as placeholders that
// Node fills in.
function freezeInPage() {
    const GRAY = (w, h) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#808080"/></svg>`)}`;
    const roots = [];
    const collect = (root) => {
        root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) { roots.push(el.shadowRoot); collect(el.shadowRoot); } });
    };
    collect(document);
    // @import rules are inlined (their cssText is only the url): a site's
    // component CSS can live entirely behind one (Urban Plates).
    const rulesText = (sheet, depth = 0) => {
        try {
            return Array.from(sheet.cssRules).map(r => {
                if (r.styleSheet && depth < 4) {
                    const inner = rulesText(r.styleSheet, depth + 1);
                    if (inner == null) return r.cssText;
                    const media = r.media && r.media.mediaText;
                    return media && media !== 'all' ? `@media ${media} {\n${inner}\n}` : inner;
                }
                return r.cssText;
            }).join('\n');
        } catch (e) { return null; }
    };
    // Adopted sheets (Lit, Reddit's shreddit-*) aren't serialized by
    // getHTML: write them in as <style>.
    const adopt = (root, target) => {
        (root.adoptedStyleSheets || []).forEach(s => {
            const st = document.createElement('style');
            st.setAttribute('data-snap', 'adopted');
            st.textContent = rulesText(s) || '';
            target.insertBefore(st, target.firstChild);
        });
    };
    adopt(document, document.head || document.documentElement);
    roots.forEach(r => adopt(r, r));
    const fetchList = [];
    const inline = (root) => {
        root.querySelectorAll('link[rel~="stylesheet"]').forEach(link => {
            const st = document.createElement('style');
            const text = link.sheet ? rulesText(link.sheet) : null;
            if (link.media && link.media !== 'all') st.media = link.media;
            if (text != null) st.textContent = text;
            else if (link.href) { st.setAttribute('data-snap-href', link.href); fetchList.push(link.href); }
            link.replaceWith(st);
        });
        // <style> whose text was changed through CSSOM (insertRule) only
        // shows its rules in cssRules.
        root.querySelectorAll('style').forEach(st => {
            if (st.hasAttribute('data-snap-href') || !st.sheet) return;
            const text = rulesText(st.sheet);
            if (text != null && text.length > (st.textContent || '').length) st.textContent = text;
        });
        root.querySelectorAll('script, link[rel~="preload"], link[rel~="modulepreload"], link[rel~="prefetch"], link[rel~="preconnect"], link[rel~="dns-prefetch"], base').forEach(n => n.remove());
        root.querySelectorAll('img').forEach(img => {
            const r = img.getBoundingClientRect();
            const w = Math.max(1, Math.round(r.width || img.width || 1)), h = Math.max(1, Math.round(r.height || img.height || 1));
            img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.removeAttribute('loading');
            img.src = GRAY(w, h);
        });
        root.querySelectorAll('picture source').forEach(s => s.remove());
        root.querySelectorAll('video').forEach(v => { v.removeAttribute('src'); v.removeAttribute('poster'); v.querySelectorAll('source').forEach(s => s.remove()); v.style.background = '#808080'; });
        root.querySelectorAll('iframe').forEach(f => { f.removeAttribute('srcdoc'); f.src = 'about:blank'; f.style.background = '#808080'; });
        // Inline event handlers would throw without their scripts.
        root.querySelectorAll('*').forEach(el => { for (const a of Array.from(el.attributes)) if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
        // Form state (a typed value isn't an attribute).
        root.querySelectorAll('input').forEach(i => { if (i.type !== 'password' && i.value) i.setAttribute('value', i.value); });
    };
    inline(document);
    roots.forEach(inline);
    // Custom elements stay :defined (sites hide `:not(:defined)` ones):
    // every hyphenated tag is defined as a plain element, nothing else runs.
    const tags = new Set();
    [document].concat(roots).forEach(r => r.querySelectorAll('*').forEach(el => { if (el.tagName.includes('-')) tags.add(el.tagName.toLowerCase()); }));
    if (tags.size) {
        const sc = document.createElement('script');
        sc.setAttribute('data-snap', 'define');
        sc.textContent = JSON.stringify([...tags]) + '.forEach(function (t) { try { if (!customElements.get(t)) customElements.define(t, class extends HTMLElement {}); } catch (e) {} });';
        (document.head || document.documentElement).insertBefore(sc, (document.head || document.documentElement).firstChild);
    }
    const html = '<!doctype html>\n' + document.documentElement.getHTML({ serializableShadowRoots: true, shadowRoots: roots });
    return { html, fetchList, shadowRoots: roots.length, elements: document.getElementsByTagName('*').length, url: location.href, title: document.title, scrollHeight: document.documentElement.scrollHeight };
}

async function snapshot(browser, name, site, scheme) {
    const ctx = await browser.newContext({ ...pw.devices['iPhone 15 Pro'], colorScheme: scheme, locale: 'en-US', timezoneId: 'America/Los_Angeles' });
    const page = await ctx.newPage();
    let url = site.url, status = null;
    try {
        let resp = await page.goto(url, { waitUntil: 'commit', timeout: 45000 });
        status = resp && resp.status();
        if (site.firstLink) {
            await page.waitForTimeout(3000);
            const href = await page.locator(site.firstLink).first().getAttribute('href', { timeout: 10000 });
            url = new URL(href, page.url()).href;
            resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            status = resp && resp.status();
        }
    } catch (e) { status = 'error: ' + String(e.message).split('\n')[0]; }
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(site.waitMs || 7000);
    // A few screens down and back so lazy sections render.
    for (let i = 0; i < 6; i++) { await page.evaluate(() => window.scrollBy(0, innerHeight)).catch(() => {}); await page.waitForTimeout(400); }
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(1200);
    // View-only steps before freezing (focus a field, open a menu).
    for (const a of site.actions || []) {
        try {
            if (a.click) await page.locator(a.click).first().click({ timeout: 8000 });
            if (a.focus) { await page.locator(a.focus).first().scrollIntoViewIfNeeded({ timeout: 8000 }); await page.locator(a.focus).first().focus({ timeout: 8000 }); }
            if (a.type) await page.keyboard.type(a.type, { delay: 50 });
            if (a.eval) console.log('  eval →', JSON.stringify(await page.evaluate(a.eval)));
            await page.waitForTimeout(a.wait || 800);
        } catch (e) { console.log('  action failed', JSON.stringify(a).slice(0, 80), String(e.message).split('\n')[0]); }
    }
    const finalUrl = page.url();
    if (/\/sorry\/|captcha|challenge/i.test(finalUrl)) {
        await ctx.close();
        return { name, status, blocked: finalUrl };
    }
    const frozen = await page.evaluate(freezeInPage);
    let html = frozen.html;
    for (const href of [...new Set(frozen.fetchList)]) {
        let css = '';
        try { const r = await ctx.request.get(href, { timeout: 15000 }); if (r.ok()) css = await r.text(); } catch (e) {}
        // Relative url()s in a fetched sheet resolve against it; they're
        // aborted offline anyway, so leave them.
        const tag = `data-snap-href="${href.replace(/&/g, '&amp;')}"`;
        html = html.split(tag + '>').join(tag + '>' + css.replace(/<\/style/gi, '<\\/style'));
    }
    await ctx.close();
    fs.mkdirSync(OUT, { recursive: true });
    const origin = new URL(frozen.url).origin;
    const pathname = new URL(frozen.url).pathname + new URL(frozen.url).search;
    fs.writeFileSync(path.join(OUT, name + '.html'), html);
    const meta = { name, url: frozen.url, origin, path: pathname, scheme, status, title: frozen.title, elements: frozen.elements, shadowRoots: frozen.shadowRoots, bytes: Buffer.byteLength(html), sheetsFetched: frozen.fetchList.length, capturedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(meta, null, 1));
    return meta;
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.list || !args.names.length) { console.log(Object.keys(SITES).join('\n')); return; }
    const browser = await pw.chromium.launch({ headless: !args.headed, executablePath: process.env.AURA_HARNESS_BROWSER_PATH || undefined });
    for (const name of args.names) {
        if (!SITES[name]) { console.log(name, 'unknown'); continue; }
        try {
            const m = await snapshot(browser, name, SITES[name], args.scheme);
            console.log(JSON.stringify(m));
        } catch (e) { console.log(name, 'failed', String(e.message).split('\n')[0]); }
    }
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
