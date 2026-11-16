#!/usr/bin/env node
// Aura WebKit harness. Loads sites with Aura's content scripts injected the
// way Safari injects them (document_start, every frame, manifest order) on an
// iPhone profile, then records screenshots, engine timing, keystroke latency,
// time-to-themed and Aura-caused layout shifts. See README.md.
//
//   node run.js                          all sites, unthemed + dark + light
//   node run.js --sites reddit-post,google-aimode --themes none,dark
//   node run.js --har record             also save each load as a HAR snapshot
//   node run.js --har replay             replay saved snapshots (offline, stable)
//   node run.js --compare out/A out/B    before/after table of two runs
'use strict';

const fs = require('fs');
const path = require('path');
const pw = require('playwright');
const SITES = require('./sites');

const HERE = __dirname;
const REPO = path.resolve(HERE, '../..');
// AURA_EXT_DIR points at another copy of the Resources folder, e.g. a git
// worktree of an older commit, for A/B runs.
const EXT = process.env.AURA_EXT_DIR ? path.resolve(process.env.AURA_EXT_DIR) : path.join(REPO, 'ios/TintExtension Extension/Resources');
const FIXTURE_ORIGIN = 'https://fixture.aura.test';

// ---- CLI -------------------------------------------------------------------

function parseArgs(argv) {
    const a = { themes: 'none,dark,light', browser: 'webkit', har: 'auto', shots: true, typing: true, scenarios: 'visual,typing' };
    for (let i = 2; i < argv.length; i++) {
        const k = argv[i];
        const next = () => argv[++i];
        if (k === '--sites') a.sites = next();
        else if (k === '--themes') a.themes = next();
        else if (k === '--browser') a.browser = next();
        else if (k === '--har') a.har = next();
        else if (k === '--headed') a.headed = true;
        else if (k === '--out') a.out = next();
        else if (k === '--label') a.label = next();
        else if (k === '--no-shots') a.shots = false;
        else if (k === '--scenarios') a.scenarios = next();
        else if (k === '--repeat') a.repeat = parseInt(next(), 10);
        else if (k === '--keep-storage') a.keepStorage = true;
        else if (k === '--compare') { a.compare = [next(), next()]; }
        else if (k === '--help' || k === '-h') { a.help = true; }
        else throw new Error('Unknown arg ' + k);
    }
    return a;
}

const THEMES = {
    // Same shape ThemeSelectionScreen writes (globalTheme = completeTheme).
    dark: { enabled: true, id: 'dark', background: '#1C1C1E', text: '#FFFFFF', link: '#0A84FF', backgroundType: 'color', backgroundImage: null, backgroundGradient: null },
    light: { enabled: true, id: 'light', background: '#F2F2F7', text: '#000000', link: '#007AFF', backgroundType: 'color', backgroundImage: null, backgroundGradient: null },
};

function themeData(theme) {
    return {
        globalTheme: theme, siteThemes: {}, nativeDarkModeEnabled: false, customThemes: [],
        timeBasedRule: { enabled: false }, contentBlockerSettings: { enabled: false, categories: {} },
    };
}

// ---- Aura script injection ------------------------------------------------

function auraScripts() {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
    const files = manifest.content_scripts[0].js.filter(f => f !== 'auraDebug.js'); // probe.js provides the hooks
    return files.map(f => {
        let src = fs.readFileSync(path.join(EXT, f), 'utf8');
        if (f === 'content.js') {
            // Per-sub-pass timing. Harness-only source patch; the shipped file
            // is untouched.
            const re = /function safePass\(fn\) \{\s*try \{ (return )?fn\(\); \} catch \(e\) \{\}\s*\}/;
            if (re.test(src)) src = src.replace(re, 'function safePass(fn) { try { return window.__AH ? window.__AH.subPass(fn) : fn(); } catch (e) {} }');
            else console.warn('[harness] safePass pattern not found; sub-pass timing disabled');
        }
        // Safari runs content scripts in an isolated world. Approximate that
        // with a function scope, and shadow the scheduling APIs with timed
        // versions so every Aura task is attributed.
        return '(function (browser, chrome, module, setTimeout, setInterval, requestAnimationFrame, MutationObserver) {\n'
            + src
            + '\n}).call(window, window.__AH.browser, undefined, undefined, window.__AH.wrap.setTimeout, window.__AH.wrap.setInterval, window.__AH.wrap.requestAnimationFrame, window.__AH.wrap.MutationObserver);\n'
            + '//# sourceURL=aura/' + f;
    });
}

// ---- helpers ---------------------------------------------------------------

const sleep = ms => new Promise(r => setTimeout(r, ms));
const wallNow = () => performance.timeOrigin + performance.now();
const r1 = v => (v == null || Number.isNaN(v) ? null : Math.round(v * 10) / 10);

function pct(arr, p) {
    if (!arr.length) return null;
    const s = [...arr].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function firstVisible(page, selectors, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        for (const sel of selectors) {
            try {
                const loc = page.locator(sel).first();
                if (await loc.isVisible({ timeout: 50 })) return { loc, sel };
            } catch (e) {}
        }
        await sleep(50);
    }
    return null;
}

// ---- in-page measurements ------------------------------------------------

// Window summary over [from, to) in page time (ms since navigation start).
function summarizeInPage(args) {
    const AH = window.__AH;
    const { from, to } = args;
    const inWin = t => t >= from && t < to;
    const tasks = AH.tasks.filter(t => inWin(t[0]));
    const auraMs = tasks.reduce((s, t) => s + t[1], 0);
    const long = tasks.filter(t => t[1] >= 50);
    const passes = AH.passes.filter(p => inWin(p.start));
    const frames = AH.frames.filter(inWin);
    let maxGap = 0, gaps50 = 0;
    for (let i = 1; i < frames.length; i++) {
        const g = frames[i] - frames[i - 1];
        if (g > maxGap) maxGap = g;
        if (g >= 50) gaps50++;
    }
    const muts = AH.mutations.filter(m => inWin(m[0]));
    const all = (AH.allMutations || []).filter(m => inWin(m[0]));
    const byKind = {};
    tasks.forEach(t => { byKind[t[2]] = (byKind[t[2]] || 0) + t[1]; });
    return {
        auraMs, auraTasks: tasks.length, auraMaxTaskMs: tasks.reduce((m, t) => Math.max(m, t[1]), 0),
        auraLongTasks: long.length, auraByKind: byKind,
        passes: passes.length,
        passesFullDoc: passes.filter(p => p.root === 'html').length,
        passMaxSyncMs: passes.reduce((m, p) => Math.max(m, p.sync || 0), 0),
        passAvgElements: passes.length ? passes.reduce((s, p) => s + p.elements, 0) / passes.length : 0,
        frames: frames.length, frameGapsOver50: gaps50, frameMaxGapMs: maxGap,
        siteMutationRecords: all.reduce((s, m) => s + m[1], 0),
        auraSeenSite: muts.reduce((s, m) => s + m[1], 0), auraSeenOwn: muts.reduce((s, m) => s + m[2], 0),
    };
}

// Snapshot visible element rects, disable Aura's sheets (document + shadow
// copies), snapshot again, restore. Anything that moved/resized > 1px is an
// Aura-caused layout change.
function layoutDiffInPage() {
    const els = [];
    const collect = (root) => {
        const all = root.querySelectorAll('*');
        for (let i = 0; i < all.length && els.length < 6000; i++) {
            const el = all[i];
            if (el.shadowRoot) collect(el.shadowRoot);
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.bottom > -2000 && r.top < 6000) els.push(el);
        }
    };
    collect(document);
    const sheets = [];
    const findSheets = (root) => {
        root.querySelectorAll('style[id^="aura-"], style[data-aura-shadow]').forEach(s => sheets.push(s));
        root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) findSheets(el.shadowRoot); });
    };
    findSheets(document);
    const sx = scrollX, sy = scrollY;
    const on = els.map(el => el.getBoundingClientRect());
    let off;
    try {
        sheets.forEach(s => { s.disabled = true; });
        off = els.map(el => el.getBoundingClientRect());
    } finally {
        sheets.forEach(s => { s.disabled = false; });
        scrollTo(sx, sy);
    }
    const diffs = [];
    els.forEach((el, i) => {
        const a = on[i], b = off[i];
        const d = [a.left - b.left, a.top - b.top, a.width - b.width, a.height - b.height];
        if (d.some(v => Math.abs(v) > 1)) diffs.push({ el: window.__AH.describeNode(el), d: d.map(Math.round) });
    });
    // Report the outermost changes: a resized parent moves all its children.
    return { checked: els.length, sheets: sheets.length, changed: diffs.length, top: diffs.slice(0, 12) };
}

// Computed paint of every element (light + open shadow DOM), in document
// order. Two runs of a deterministic page (fixture or HAR replay) should
// match element for element; compare() diffs them.
function paintSignatureInPage() {
    const out = [];
    const walk = (root, prefix) => {
        const all = root.querySelectorAll('*');
        for (let i = 0; i < all.length && out.length < 12000; i++) {
            const el = all[i];
            if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
            const cs = getComputedStyle(el);
            // Last column: background-image, plus a non-normal blend mode.
            const img = cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 60);
            const row = [prefix + window.__AH.describeNode(el), cs.backgroundColor, cs.color, cs.mixBlendMode !== 'normal' ? img + ' blend:' + cs.mixBlendMode : img];
            // Debug only: the element's inline style and data-aura-* marks.
            if (window.__AH_DUMP_INLINE) row.push(el.style.cssText.slice(0, 120) + ' ' + Array.from(el.attributes).filter(a => a.name.startsWith('data-aura')).map(a => a.name).join(' '));
            out.push(row);
            if (el.shadowRoot) walk(el.shadowRoot, prefix + '›');
        }
    };
    walk(document, '');
    return out;
}

// ---- one load --------------------------------------------------------------

async function runLoad(browser, opts) {
    const { site, theme, scenario, outDir, args } = opts;
    const device = pw.devices['iPhone 15 Pro'];
    const ctxOpts = { ...device };
    const harPath = path.join(HERE, 'har', site.id + '.har');
    const harMode = site.fixture ? 'off' : args.har === 'auto' ? (fs.existsSync(harPath) ? 'replay' : 'live') : args.har;
    if (harMode === 'record') ctxOpts.recordHar = { path: harPath, mode: 'full', content: 'embed' };
    // --keep-storage: the page's localStorage (Aura's per-site theme cache)
    // carries over from the previous load of the same site and theme.
    const stateKey = `${site.id}|${theme}`;
    if (args.keepStorage && opts.storageStates && opts.storageStates[stateKey]) ctxOpts.storageState = opts.storageStates[stateKey];
    const ctx = await browser.newContext(ctxOpts);
    if (harMode === 'replay') await ctx.routeFromHAR(harPath, { notFound: 'abort' });
    // A fixture can be served from a real site's origin (`origin` in
    // sites.js) so host-gated engine code (SITE_FIXES, Google passes) runs.
    const fixtureOrigin = site.origin || FIXTURE_ORIGIN;
    if (site.fixture) {
        await ctx.route(fixtureOrigin + '/**', route => {
            const name = new URL(route.request().url()).pathname.replace(/^\//, '') || site.id;
            const file = path.join(HERE, 'fixtures', name.endsWith('.html') ? name : name + '.html');
            if (fs.existsSync(file)) route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(file) });
            else route.fulfill({ status: 404, body: 'no fixture' });
        });
    }
    const themed = theme !== 'none';
    // AURA_HARNESS_STORAGE_MS simulates a slow storage.local read (a cold
    // extension process); the default is 5 ms, a warm cache.
    const storageDelayMs = process.env.AURA_HARNESS_STORAGE_MS ? Number(process.env.AURA_HARNESS_STORAGE_MS) : undefined;
    await ctx.addInitScript({ content: 'window.__AH_CONFIG = ' + JSON.stringify({ themed, themeData: themed ? themeData(THEMES[theme]) : null, storageDelayMs, timeline: !!process.env.AURA_HARNESS_TIMELINE }) + ';' });
    await ctx.addInitScript({ path: path.join(HERE, 'probe.js') });
    if (themed) for (const s of auraScripts()) await ctx.addInitScript({ content: s });

    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
    const res = { site: site.id, theme, scenario, har: harMode, url: null, errors };
    const shot = async (name) => {
        if (!args.shots) return;
        try { await page.screenshot({ path: path.join(outDir, `${site.id}--${theme}--${name}.png`) }); } catch (e) {}
    };

    try {
        let url = site.fixture ? `${fixtureOrigin}/${site.id}` : site.url;
        if (!url && site.resolve) url = opts.resolvedUrls[site.id];
        res.url = url;
        const navSentWall = wallNow();
        const resp = await page.goto(url, { waitUntil: 'commit', timeout: 45000 });
        res.status = resp ? resp.status() : null;
        try { await page.waitForLoadState('load', { timeout: 30000 }); } catch (e) { res.loadTimeout = true; }
        const nav = await page.evaluate(() => {
            const n = performance.getEntriesByType('navigation')[0] || {};
            return { timeOrigin: performance.timeOrigin, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd || performance.now(), title: document.title, elements: document.getElementsByTagName('*').length };
        });
        res.nav = { dcl: r1(nav.dcl), load: r1(nav.load), title: nav.title };
        const toPage = w => w - nav.timeOrigin;

        if (scenario === 'visual') {
            await shot('load');
            const target = nav.load + 5000;
            const nowPage = toPage(wallNow());
            if (target > nowPage) await sleep(target - nowPage);
            await shot('5s');
            if (themed && process.env.AURA_HARNESS_TIMELINE) res.timeline = await page.evaluate(() => window.__AH.timelineSummary ? window.__AH.timelineSummary() : null).catch(e => ({ error: String(e.message).slice(0, 200) }));
            if (themed) res.layout = await page.evaluate(layoutDiffInPage).catch(e => ({ error: String(e).slice(0, 200) }));
            try {
                if (process.env.AURA_HARNESS_DUMP_INLINE) await page.evaluate(() => { window.__AH_DUMP_INLINE = true; });
                const sig = await page.evaluate(paintSignatureInPage);
                fs.writeFileSync(path.join(outDir, `${site.id}--${theme}--paint${res.rep ? '-' + res.rep : ''}.json`), JSON.stringify(sig));
            } catch (e) {}
            res.tint = { '5s': await page.evaluate(() => window.__AH.tint()).catch(e => ({ error: String(e.message).slice(0, 120) })) };
            for (const act of site.actions || []) {
                if (act.click) { try { await page.locator(act.click).first().click({ timeout: 3000 }); } catch (e) { res.actionError = (res.actionError || '') + `click ${act.click} failed; `; } }
                if (act.wait) await sleep(act.wait);
                if (act.shot) {
                    await shot(act.shot);
                    res.tint[act.shot] = await page.evaluate(() => window.__AH.tint()).catch(e => ({ error: String(e.message).slice(0, 120) }));
                }
            }
            if (site.actions && site.actions.length) { await page.goBack().catch(() => {}); }
            // Scroll three screens like a thumb flick, then settle.
            const scrollStart = toPage(wallNow());
            for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 200).catch(() => {}); await page.evaluate(() => window.scrollBy(0, 200)).catch(() => {}); await sleep(60); }
            await sleep(800);
            await shot('scrolled');
            // Second paint dump after scrolling: layers must keep their
            // paint through scroll (compare diffs this one too).
            try {
                const sig = await page.evaluate(paintSignatureInPage);
                fs.writeFileSync(path.join(outDir, `${site.id}--${theme}--paint-scrolled${res.rep ? '-' + res.rep : ''}.json`), JSON.stringify(sig));
            } catch (e) {}
            const scrollEnd = toPage(wallNow());
            res.load = await page.evaluate(summarizeInPage, { from: 0, to: nav.load + 5000 });
            // The five longest Aura tasks [start ms, duration ms, kind]: which
            // task a "max task" regression is.
            res.passList = await page.evaluate(() => window.__AH.passes.map(p => [Math.round(p.start), p.root, p.elements])).catch(() => null);
            res.topTasks = await page.evaluate(() => window.__AH.tasks.slice().sort((a, b) => b[1] - a[1]).slice(0, 5).map(t => [Math.round(t[0]), Math.round(t[1] * 10) / 10, t[2]])).catch(() => null);
            res.scroll = await page.evaluate(summarizeInPage, { from: scrollStart, to: scrollEnd });
            res.themeTiming = await page.evaluate(() => {
                const AH = window.__AH;
                const ends = AH.passes.filter(p => p.end != null).map(p => p.end);
                // Settled = end of the last pass that wasn't followed by
                // another pass within 1 s, among passes in the first 10 s.
                let settled = null;
                const early = AH.passes.filter(p => p.start < 10000);
                for (let i = 0; i < early.length; i++) {
                    const p = early[i], nx = early[i + 1];
                    if (p.end != null && (!nx || nx.start - p.end > 1000)) { settled = p.end; break; }
                }
                // First paint vs CSS applied: how long the page was on screen
                // before Aura's stylesheet landed (the load flash).
                const fp = performance.getEntriesByType('paint').find(e => e.name === 'first-paint');
                return { firstPaint: fp ? fp.startTime : null, storageResolved: AH.marks.storageResolved, cssApplied: AH.marks.cssApplied, firstPassEnd: ends.length ? ends[0] : null, settled };
            });
            Object.keys(res.themeTiming).forEach(k => { res.themeTiming[k] = r1(res.themeTiming[k]); });
        }

        if (scenario === 'switch' && themed) {
            // Theme change in the app, seen from an open tab: theme A loaded,
            // then storage switches to B (live onChanged), then a reload with
            // B in storage, then the theme turned off live. Every surface
            // that can carry a theme color is dumped at each step, plus the
            // mean color of the screen's bottom 60 px.
            const other = theme === 'dark' ? 'light' : 'dark';
            const tdB = themeData(THEMES[other]);
            const tdOff = themeData({ ...THEMES[other], enabled: false });
            res.switch = [];
            let t0 = wallNow();
            const snap = async (label) => {
                const s = await page.evaluate(() => window.__AH.surfaces()).catch(e => ({ error: String(e.message).slice(0, 120) }));
                const vp = page.viewportSize();
                try {
                    const buf = await page.screenshot({ clip: { x: 0, y: vp.height - 60, width: vp.width, height: 60 } });
                    s.bottomStrip = await page.evaluate(b => window.__AH.meanColor(b), buf.toString('base64'));
                } catch (e) { s.bottomStrip = null; }
                res.switch.push({ label, ms: Math.round(wallNow() - t0), ...s });
            };
            const at = async (ms) => { const d = t0 + ms - wallNow(); if (d > 0) await sleep(d); };
            const setAll = td => Promise.all(page.frames().map(f => f.evaluate(x => window.__AH && window.__AH.setThemeData(x), td).catch(() => {})));
            await sleep(2000);
            await snap(`${theme} settled`);
            t0 = wallNow();
            await setAll(tdB);
            for (const ms of [0, 100, 500, 2000]) { await at(ms); await snap(`live → ${other} +${ms}`); }
            await shot('switch-live');
            await page.evaluate(td => sessionStorage.setItem('__AH_TD', JSON.stringify(td)), tdB);
            t0 = wallNow();
            await page.reload({ waitUntil: 'commit' });
            await page.waitForLoadState('load').catch(() => {});
            await snap(`reload ${other} +load`);
            await at(2000);
            await snap(`reload ${other} +2s`);
            await shot('switch-reload');
            t0 = wallNow();
            await setAll(tdOff);
            for (const ms of [100, 2000]) { await at(ms); await snap(`live → off +${ms}`); }
            await shot('switch-off');
            await page.evaluate(td => sessionStorage.setItem('__AH_TD', JSON.stringify(td)), tdOff);
            t0 = wallNow();
            await page.reload({ waitUntil: 'load' }).catch(() => {});
            await snap('reload off +load');
        }

        if (scenario === 'settings' && themed) {
            // The app's per-site and native switches (X-4, X-5), seen from an
            // open tab: native Dark Mode on live, a site mutation, a reload,
            // native off live, then this site set to "Disabled" live and a
            // reload. Same surface dump as the switch scenario, plus the
            // page's data-color-mode and how many elements carry an Aura
            // inline paint.
            const host = new URL(page.url()).hostname;
            const base = themeData(THEMES[theme]);
            const native = { ...base, nativeDarkModeEnabled: true };
            const disabled = { ...base, siteThemes: { [host]: { ...THEMES[theme], enabled: false } } };
            res.switch = [];
            let t0 = wallNow();
            const snap = async (label) => {
                const s = await page.evaluate(() => window.__AH.surfaces()).catch(e => ({ error: String(e.message).slice(0, 120) }));
                res.switch.push({ label, ms: Math.round(wallNow() - t0), ...s });
            };
            const setAll = td => Promise.all(page.frames().map(f => f.evaluate(x => window.__AH && window.__AH.setThemeData(x), td).catch(() => {})));
            const reloadWith = async (td) => {
                await page.evaluate(x => sessionStorage.setItem('__AH_TD', JSON.stringify(x)), td);
                t0 = wallNow();
                await page.reload({ waitUntil: 'load' }).catch(() => {});
            };
            await sleep(2000);
            await snap(`${theme} settled`);
            t0 = wallNow();
            await setAll(native);
            await sleep(500);
            await snap('native on, live +500');
            await page.evaluate(() => { const d = document.createElement('div'); d.className = 'late'; d.style.cssText = 'position:fixed;top:0;left:0;right:0;height:48px;background:#fff'; d.textContent = 'late banner'; document.body.appendChild(d); });
            await sleep(1000);
            await snap('native on, site mutation +1s');
            await reloadWith(native);
            await snap('native on, reload +load');
            await sleep(2000);
            await snap('native on, reload +2s');
            await shot('native');
            t0 = wallNow();
            await setAll(base);
            await sleep(500);
            await snap('native off, live +500');
            t0 = wallNow();
            await setAll(disabled);
            await sleep(500);
            await snap('site Disabled, live +500');
            await reloadWith(disabled);
            await snap('site Disabled, reload +load');
            await sleep(1500);
            await snap('site Disabled, reload +1.5s');
            await shot('disabled');
        }

        if (scenario === 'typing' && site.type) {
            // Type as early as the box exists, until nav+5 s; idle to nav+9 s;
            // then one settled burst. 85 ms per key ≈ a fast phone typist.
            const KEY_MS = 85;
            const text = 'the quick brown fox jumps over the lazy dog and keeps typing ';
            if (site.type.open) {
                const o = await firstVisible(page, site.type.open, 4000);
                if (o) { try { await o.loc.click({ timeout: 2000 }); } catch (e) {} }
            }
            const found = await firstVisible(page, site.type.selectors, 8000);
            if (!found) { res.typingError = 'no typing target visible'; }
            else {
                res.typingTarget = found.sel;
                await found.loc.click({ timeout: 3000 }).catch(() => {});
                const sends = [];
                const typeUntil = async (endPage, max) => {
                    let i = 0;
                    while (toPage(wallNow()) < endPage && i < max) {
                        const ch = text[sends.length % text.length];
                        const t = wallNow();
                        sends.push(t);
                        await page.keyboard.press(ch === ' ' ? 'Space' : ch);
                        const next = t + KEY_MS;
                        const wait = next - wallNow();
                        if (wait > 0) await sleep(wait);
                        i++;
                    }
                };
                const earlyStart = toPage(wallNow());
                await typeUntil(5000, 200);
                const earlyEnd = toPage(wallNow());
                const idleTo = 9000 - toPage(wallNow());
                if (idleTo > 0) await sleep(idleTo);
                const lateStart = toPage(wallNow());
                const nEarly = sends.length;
                await typeUntil(Infinity, 30);
                const lateEnd = toPage(wallNow());
                await sleep(400);
                const keys = await page.evaluate(() => window.__AH.keys);
                const lat = keys.map((k, i) => ({
                    sendPage: sends[i] != null ? toPage(sends[i]) : null,
                    latency: (k.frameWall != null && sends[i] != null) ? k.frameWall - sends[i] : null,
                    queue: sends[i] != null ? k.handlerWall - sends[i] : null,
                }));
                const stats = (list) => {
                    const v = list.map(x => x.latency).filter(x => x != null);
                    const q = list.map(x => x.queue).filter(x => x != null);
                    return { keys: list.length, p50: r1(pct(v, 50)), p95: r1(pct(v, 95)), max: r1(v.length ? Math.max(...v) : null), over50: v.filter(x => x > 50).length, over100: v.filter(x => x > 100).length, queueP95: r1(pct(q, 95)) };
                };
                // Keys are matched to sends by order; a dropped or extra
                // keydown shifts every pair after it. Negative latency (or a
                // count mismatch) means the pairing is wrong: flag the run.
                const misaligned = keys.length !== sends.length || lat.some(x => x.latency != null && x.latency < 0);
                res.typing = {
                    invalid: misaligned ? `key/send pairing off (${keys.length} keydowns, ${sends.length} sends)` : null,
                    early: { from: r1(earlyStart), to: r1(earlyEnd), ...stats(lat.slice(0, nEarly)) },
                    first4s: stats(lat.slice(0, nEarly).filter(x => x.sendPage < 4000)),
                    settled: { from: r1(lateStart), to: r1(lateEnd), ...stats(lat.slice(nEarly)) },
                    perKey: lat.map(x => [r1(x.sendPage), r1(x.latency)]),
                };
                res.typingEngine = {
                    early: await page.evaluate(summarizeInPage, { from: earlyStart, to: earlyEnd }),
                    settled: await page.evaluate(summarizeInPage, { from: lateStart, to: lateEnd }),
                };
            }
        }

        // Sub-pass breakdown (whole load) and Aura errors.
        const extra = await page.evaluate(() => ({ sub: window.__AH.subPasses, errors: window.__AH.errors.slice(0, 5) }));
        res.subPasses = Object.fromEntries(Object.entries(extra.sub).sort((a, b) => b[1].ms - a[1].ms).slice(0, 12)
            .map(([k, v]) => [k, { n: v.n, ms: r1(v.ms), max: r1(v.max) }]));
        res.auraErrors = extra.errors;
    } catch (e) {
        res.error = String(e.message || e).split('\n')[0];
    } finally {
        if (args.keepStorage && opts.storageStates) {
            try { opts.storageStates[stateKey] = await ctx.storageState(); } catch (e) {}
        }
        await ctx.close().catch(() => {});
    }
    return res;
}

// ---- report ------------------------------------------------------------------

// How long the page was on screen before Aura's stylesheet (0 when the
// sheet landed before the first paint).
function unthemedMs(t) { return t && t.cssApplied != null && t.firstPaint != null ? Math.max(0, t.cssApplied - t.firstPaint) : null; }

function fmt(v, d = 0) { return v == null ? '–' : (typeof v === 'number' ? v.toFixed(d) : String(v)); }

function report(results, meta) {
    const L = [];
    L.push(`# Aura harness run ${meta.label || ''}`.trim());
    L.push('');
    L.push(`- When: ${meta.when}  ·  commit \`${meta.commit}\`${meta.dirty ? ' (+ uncommitted changes)' : ''}  ·  browser: ${meta.browser}  ·  device: iPhone 15 Pro profile`);
    L.push(`- Times are ms since navigation start unless noted. "Aura ms" = time inside Aura-scheduled tasks. Frame gap = longest time between two rendered frames (any cause).`);
    L.push('');
    L.push('## Load (navigation → load + 5 s)');
    L.push('| Site | Theme | Snapshot | load | CSS applied | Unthemed ms | Settled | Aura ms | Max task | Tasks ≥50ms | Passes (full-doc) | Max sync | Frame gaps ≥50 | Max gap | Layout Δ |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of results.filter(x => x.scenario === 'visual')) {
        if (r.error) { L.push(`| ${r.site} | ${r.theme} | ${r.har} | ERROR: ${r.error} |||||||||||`); continue; }
        const l = r.load || {}, t = r.themeTiming || {};
        L.push(`| ${r.site} | ${r.theme} | ${r.har} | ${fmt(r.nav && r.nav.load)} | ${fmt(t.cssApplied)} | ${fmt(unthemedMs(t))} | ${fmt(t.settled)} | ${fmt(l.auraMs)} | ${fmt(l.auraMaxTaskMs)} | ${fmt(l.auraLongTasks)} | ${fmt(l.passes)} (${fmt(l.passesFullDoc)}) | ${fmt(l.passMaxSyncMs)} | ${fmt(l.frameGapsOver50)} | ${fmt(l.frameMaxGapMs)} | ${r.layout ? (r.layout.error ? 'err' : r.layout.changed + '/' + r.layout.checked) : '–'} |`);
    }
    L.push('');
    L.push('## Typing (keystroke → next frame, ms)');
    L.push('| Site | Theme | Target | First 4 s p50 / p95 / max | >100ms | Settled p50 / p95 / max | Aura ms while typing early | Passes early (full-doc) |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const r of results.filter(x => x.scenario === 'typing')) {
        if (r.typing && r.typing.invalid) { L.push(`| ${r.site} | ${r.theme} | INVALID: ${r.typing.invalid} ||||||`); continue; }
        if (r.error || r.typingError || !r.typing) { L.push(`| ${r.site} | ${r.theme} | ${r.error || r.typingError || 'no typing'} ||||||`); continue; }
        const a = r.typing.first4s, b = r.typing.settled, e = (r.typingEngine && r.typingEngine.early) || {};
        L.push(`| ${r.site} | ${r.theme} | \`${r.typingTarget}\` | ${fmt(a.p50)} / ${fmt(a.p95)} / ${fmt(a.max)} (${a.keys} keys) | ${a.over100} | ${fmt(b.p50)} / ${fmt(b.p95)} / ${fmt(b.max)} | ${fmt(e.auraMs)} | ${fmt(e.passes)} (${fmt(e.passesFullDoc)}) |`);
    }
    L.push('');
    const sw = results.filter(r => r.switch && r.switch.length);
    if (sw.length) {
        L.push('## Theme switch (surfaces per step)');
        for (const r of sw) {
            L.push(`### ${r.site} / starts ${r.theme}`);
            L.push('| Step | ms | html bg | body bg | scheme | theme-color metas | shield | core sheet | shadow copies | iframe copies | cache | bottom strip | color-mode | Aura inline |');
            L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
            for (const s of r.switch) {
                if (s.error) { L.push(`| ${s.label} | ${s.ms} | ERROR ${s.error} ||||||||||||`); continue; }
                const j = o => Object.entries(o || {}).map(([k, v]) => `${k}×${v}`).join(' ') || '–';
                L.push(`| ${s.label} | ${s.ms} | ${s.htmlBg}${s.htmlBgImage ? ' + img' : ''} | ${s.bodyBg} | ${s.colorScheme} | ${(s.themeColorMetas || []).join(' · ') || '–'} | ${s.shield ? 'yes' : '–'} | ${s.coreSheet || '–'} | ${j(s.shadowCopies)} | ${j(s.iframeCopies)} | ${s.cache ? s.cache.slice(0, 40) : '–'} | ${s.bottomStrip || '–'} | ${s.colorMode || '–'} | ${s.auraInline} |`);
            }
        }
        L.push('');
    }
    const tl = results.filter(r => Array.isArray(r.timeline));
    if (tl.length) {
        L.push('## Color timeline (viewport, sampled every 100 ms to 6 s)');
        L.push('Late = a visible color change after the first full pass ended. Cause = the Aura write on that element (or, for text color, an ancestor) that preceded it; "site" = no Aura write.');
        L.push('');
        L.push('| Site | Theme | CSS applied | First pass end | Last change | Last Aura-caused change | Late changes (Aura / site) |');
        L.push('|---|---|---|---|---|---|---|');
        for (const r of tl) {
            const t = r.themeTiming || {};
            const fp = t.firstPassEnd || 0;
            const ch = r.timeline;
            const last = ch.length ? ch[ch.length - 1].t : null;
            const aura = ch.filter(c => c.cause);
            const lastAura = aura.length ? aura[aura.length - 1].t : null;
            const late = ch.filter(c => c.t > fp);
            L.push(`| ${r.site} | ${r.theme} | ${fmt(t.cssApplied)} | ${fmt(fp)} | ${fmt(last)} | ${fmt(lastAura)} | ${late.filter(c => c.cause).length} / ${late.filter(c => !c.cause).length} |`);
        }
        for (const r of tl) {
            const fp = (r.themeTiming && r.themeTiming.firstPassEnd) || 0;
            const late = r.timeline.filter(c => c.t > fp && c.cause);
            if (!late.length) continue;
            const by = {};
            late.forEach(c => { const k = c.cause.chain; (by[k] = by[k] || []).push(c); });
            L.push(`- **${r.site} / ${r.theme}** late Aura-caused changes by writer: ` + Object.entries(by).map(([k, v]) => `\`${k}\` ×${v.length} (${v[0].t}–${v[v.length - 1].t} ms, e.g. ${v[0].el}: ${v[0].from} → ${v[0].to})`).join('; '));
        }
        L.push('');
    }
    L.push('## Hottest sub-passes (whole load, themed runs)');
    for (const r of results.filter(x => x.theme !== 'none' && x.subPasses && Object.keys(x.subPasses).length)) {
        L.push(`- **${r.site} / ${r.theme} / ${r.scenario}**: ` + Object.entries(r.subPasses).slice(0, 6).map(([k, v]) => `${k} ${v.ms}ms/${v.n}×`).join(', '));
    }
    const lay = results.filter(r => r.layout && r.layout.changed);
    if (lay.length) {
        L.push('');
        L.push('## Layout changes caused by Aura (sheets on vs off)');
        for (const r of lay) L.push(`- **${r.site} / ${r.theme}** ${r.layout.changed} of ${r.layout.checked}: ` + r.layout.top.slice(0, 6).map(x => `\`${x.el}\` [dx ${x.d[0]} dy ${x.d[1]} dw ${x.d[2]} dh ${x.d[3]}]`).join(', '));
    }
    const errs = results.filter(r => (r.auraErrors && r.auraErrors.length) || (r.errors && r.errors.length));
    if (errs.length) {
        L.push('');
        L.push('## Errors');
        for (const r of errs) L.push(`- ${r.site}/${r.theme}/${r.scenario}: ${[...(r.auraErrors || []), ...(r.errors || []).slice(0, 2)].join(' | ').slice(0, 300)}`);
    }
    return L.join('\n') + '\n';
}

function compare(dirA, dirB) {
    const A = JSON.parse(fs.readFileSync(path.join(dirA, 'results.json'), 'utf8')).results;
    const B = JSON.parse(fs.readFileSync(path.join(dirB, 'results.json'), 'utf8')).results;
    const key = r => `${r.site}|${r.theme}|${r.scenario}`;
    const mapB = new Map(B.map(r => [key(r), r]));
    const L = [`# Compare ${path.basename(dirA)} → ${path.basename(dirB)}`, '',
        '| Site | Theme | Metric | Before | After |', '|---|---|---|---|---|'];
    for (const a of A) {
        const b = mapB.get(key(a));
        if (!b) continue;
        const rows = [];
        if (a.scenario === 'visual' && a.load && b.load) {
            rows.push(['Aura ms (load+5s)', a.load.auraMs, b.load.auraMs], ['Max Aura task', a.load.auraMaxTaskMs, b.load.auraMaxTaskMs],
                ['Max frame gap', a.load.frameMaxGapMs, b.load.frameMaxGapMs], ['Passes (full-doc)', `${a.load.passes} (${a.load.passesFullDoc})`, `${b.load.passes} (${b.load.passesFullDoc})`],
                ['Settled', a.themeTiming && a.themeTiming.settled, b.themeTiming && b.themeTiming.settled],
                ['Unthemed ms', unthemedMs(a.themeTiming), unthemedMs(b.themeTiming)],
                ['Layout Δ', a.layout && a.layout.changed, b.layout && b.layout.changed]);
        }
        if (a.scenario === 'typing' && a.typing && b.typing) {
            rows.push(['Type first 4 s p95', a.typing.first4s.p95, b.typing.first4s.p95], ['Type first 4 s max', a.typing.first4s.max, b.typing.first4s.max],
                ['Type settled p95', a.typing.settled.p95, b.typing.settled.p95]);
        }
        for (const [m, x, y] of rows) L.push(`| ${a.site} | ${a.theme} | ${m} | ${fmt(x)} | ${fmt(y)} |`);
    }
    // Paint diff (meaningful for fixtures and HAR replays).
    const paintFiles = fs.readdirSync(dirA).filter(f => /--paint(-scrolled)?\.json$/.test(f));
    const P = [];
    for (const f of paintFiles) {
        const fb = path.join(dirB, f);
        if (!fs.existsSync(fb)) continue;
        // Head-only elements never paint, and Aura's own theme-color meta
        // sits at a different position across engines: leave them out.
        const painted = e => !/^(meta|title|head|link|base|noscript)\b/.test(e[0]);
        const pa = JSON.parse(fs.readFileSync(path.join(dirA, f), 'utf8')).filter(painted);
        const pb = JSON.parse(fs.readFileSync(fb, 'utf8')).filter(painted);
        const n = Math.min(pa.length, pb.length);
        const diffs = [];
        let aligned = true;
        for (let i = 0; i < n; i++) {
            if (pa[i][0] !== pb[i][0]) { aligned = false; break; }
            if (pa[i][1] !== pb[i][1] || pa[i][2] !== pb[i][2] || pa[i][3] !== pb[i][3]) diffs.push(pa[i][0] + ': ' + pa[i].slice(1).join(' ') + '  →  ' + pb[i].slice(1).join(' '));
        }
        P.push(`- **${f.replace(/--paint(-scrolled)?\.json$/, (m, sc) => sc ? ' (after scroll)' : '')}**: ` + (!aligned || pa.length !== pb.length ? `DOM differs (${pa.length} vs ${pb.length} elements), not comparable` : `${diffs.length} of ${n} elements paint differently`) + (diffs.length ? '\n' + diffs.slice(0, 60).map(d => '  - `' + d + '`').join('\n') : ''));
    }
    if (P.length) L.push('', '## Paint diff (computed bg / color / bg-image per element)', ...P);
    return L.join('\n') + '\n';
}

// ---- main --------------------------------------------------------------------

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) { console.log(fs.readFileSync(path.join(HERE, 'README.md'), 'utf8')); return; }
    if (args.compare) { process.stdout.write(compare(args.compare[0], args.compare[1])); return; }

    const want = args.sites ? args.sites.split(',') : null;
    const sites = SITES.filter(s => (want ? want.includes(s.id) : !s.fixture));
    if (!sites.length) throw new Error('No sites matched ' + args.sites);
    const themes = args.themes.split(',');
    const scenarios = args.scenarios.split(',');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outDir = args.out ? path.resolve(args.out) : path.join(HERE, 'out', stamp + (args.label ? '-' + args.label : ''));
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(path.join(HERE, 'har'), { recursive: true });

    const { execSync } = require('child_process');
    const git = cmd => { try { return execSync(cmd, { cwd: REPO }).toString().trim(); } catch (e) { return '?'; } };
    const meta = { when: new Date().toISOString(), commit: git('git rev-parse --short HEAD'), dirty: !!git('git status --porcelain -- "ios/TintExtension Extension/Resources"'), browser: args.browser, label: args.label };

    const launchOpts = { headless: !args.headed };
    if (process.env.AURA_HARNESS_BROWSER_PATH) launchOpts.executablePath = process.env.AURA_HARNESS_BROWSER_PATH;
    const browser = await pw[args.browser].launch(launchOpts);

    // Resolve dynamic URLs once per run (stored so HAR replays reuse them).
    const urlsFile = path.join(HERE, 'har', 'urls.json');
    const savedUrls = fs.existsSync(urlsFile) ? JSON.parse(fs.readFileSync(urlsFile, 'utf8')) : {};
    const resolvedUrls = {};
    for (const s of sites.filter(x => x.resolve)) {
        const harPath = path.join(HERE, 'har', s.id + '.har');
        const replaying = args.har === 'replay' || (args.har === 'auto' && fs.existsSync(harPath));
        if (replaying && savedUrls[s.id]) { resolvedUrls[s.id] = savedUrls[s.id]; continue; }
        const ctx = await browser.newContext({ ...pw.devices['iPhone 15 Pro'] });
        const page = await ctx.newPage();
        try { resolvedUrls[s.id] = await s.resolve(page); } catch (e) { console.warn(`[harness] ${s.id}: could not resolve URL (${String(e.message).split('\n')[0]})`); }
        await ctx.close();
    }
    Object.assign(savedUrls, resolvedUrls);
    fs.writeFileSync(urlsFile, JSON.stringify(savedUrls, null, 2));

    const results = [];
    const storageStates = {};
    const repeat = args.repeat || 1;
    for (const site of sites) {
        for (const theme of themes) {
            for (const scenario of scenarios) {
                if (scenario === 'typing' && !site.type) continue;
                if ((scenario === 'switch' || scenario === 'settings') && theme === 'none') continue;
                for (let k = 0; k < repeat; k++) {
                    const t = Date.now();
                    process.stdout.write(`${site.id} · ${theme} · ${scenario}${repeat > 1 ? ' #' + (k + 1) : ''} … `);
                    const res = await runLoad(browser, { site, theme, scenario, outDir, args, resolvedUrls, storageStates });
                    if (repeat > 1) res.rep = k;
                    results.push(res);
                    console.log(res.error ? 'ERROR ' + res.error : `${((Date.now() - t) / 1000).toFixed(1)}s`);
                }
            }
        }
    }
    await browser.close();

    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ meta, results }, null, 2));
    const md = report(repeat > 1 ? mergeRepeats(results, args.keepStorage) : results, meta);
    fs.writeFileSync(path.join(outDir, 'report.md'), md);
    console.log('\n' + md);
    console.log('Output: ' + outDir);
}

// With --repeat N, report the median run per site/theme/scenario (by the
// metric the scenario is about) so one noisy load doesn't decide a verdict.
// With --keep-storage the first load of each group is the cold one (no
// cache yet), so the median is taken over the warm loads only.
function mergeRepeats(results, warmOnly) {
    const groups = new Map();
    for (const r of results) {
        if (warmOnly && r.rep === 0) continue;
        const k = `${r.site}|${r.theme}|${r.scenario}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
    }
    const out = [];
    for (const list of groups.values()) {
        const score = r => r.scenario === 'typing' ? (r.typing ? r.typing.first4s.p95 || 0 : 0) : (r.load ? r.load.auraMs : 0);
        const sorted = list.filter(r => !r.error && !(r.typing && r.typing.invalid)).sort((a, b) => score(a) - score(b));
        out.push(sorted.length ? sorted[Math.floor(sorted.length / 2)] : list[0]);
    }
    return out;
}

main().catch(e => { console.error(e); process.exit(1); });
