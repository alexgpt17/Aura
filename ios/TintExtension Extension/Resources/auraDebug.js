// Aura debug HUD. Loaded before content.js in Debug builds; the Release build
// replaces this file with a one-line stub (Xcode "Stub auraDebug.js" phase).
// Opt in per tab by adding #aura-debug to the URL (remembered for the tab in
// sessionStorage); #aura-debug-off turns it back off.
// content.js calls these hooks as DBG?.x(), so a disabled HUD costs nothing.

(function () {
    'use strict';

    var STORAGE_KEY = 'aura-debug';
    var scriptStartMs = (typeof performance !== 'undefined') ? performance.now() : 0;

    function readEnabled() {
        if (window.top !== window) return false; // top frame only
        var hash = '';
        try { hash = String(location.hash || ''); } catch (e) {}
        try {
            if (hash.indexOf('aura-debug-off') >= 0) sessionStorage.removeItem(STORAGE_KEY);
            else if (hash.indexOf('aura-debug') >= 0) sessionStorage.setItem(STORAGE_KEY, '1');
            return sessionStorage.getItem(STORAGE_KEY) === '1';
        } catch (e) {
            return hash.indexOf('aura-debug') >= 0 && hash.indexOf('aura-debug-off') < 0;
        }
    }

    if (!readEnabled()) {
        globalThis.AuraDebug = { enabled: false };
        return;
    }

    var H = (typeof AuraThemeHeuristics !== 'undefined') ? AuraThemeHeuristics : null;
    var engine = { sets: {}, explain: null };
    var RATE_WINDOW_MS = 10000;

    var stats = {
        storageResolvedMs: null,
        cssAppliedMs: null,
        passStarts: [],        // timestamps (ms) of pass starts in the last RATE_WINDOW_MS
        passTotal: 0,
        passRoot: '-',
        passElements: 0,
        passStartedAt: 0,
        lastSyncMs: 0,
        lastTotalMs: 0,
        maxSyncMs: 0,
        siteRecords: [],       // [timestamp, count]
        ownRecords: [],
        scrollPasses: 0,
        storageChanges: 0,
    };

    function now() { return performance.now(); }

    function prune(list, t) {
        while (list.length && (t - (Array.isArray(list[0]) ? list[0][0] : list[0])) > RATE_WINDOW_MS) list.shift();
    }

    function sumWithin(list, t, windowMs) {
        var total = 0;
        for (var i = list.length - 1; i >= 0; i--) {
            var entry = list[i];
            var ts = Array.isArray(entry) ? entry[0] : entry;
            if (t - ts > windowMs) break;
            total += Array.isArray(entry) ? entry[1] : 1;
        }
        return total;
    }

    function describeNode(el) {
        if (!el) return '-';
        if (el.nodeType === 11) return '#shadow-root(' + describeNode(el.host) + ')';
        if (el === document.documentElement) return 'html';
        if (el.nodeType !== 1) return String(el.nodeName || '?');
        var out = el.tagName.toLowerCase();
        if (el.id) out += '#' + el.id;
        var cls = typeof el.className === 'string' ? el.className.trim() : '';
        if (cls) out += '.' + cls.split(/\s+/).slice(0, 3).join('.');
        return out.length > 70 ? out.slice(0, 69) + '…' : out;
    }

    function isOwnElement(el) {
        if (!el || el.nodeType !== 1) return false;
        var id = el.id || '';
        if (id.indexOf('aura-') === 0) return true;
        if (el.hasAttribute && (el.hasAttribute('data-aura-shadow') || el.hasAttribute('data-aura-iframe'))) return true;
        return el.tagName === 'AURA-DEBUG-HUD';
    }

    function inAnySet(el) {
        for (var name in engine.sets) {
            var set = engine.sets[name];
            if (set && set.has && set.has(el)) return true;
        }
        return false;
    }

    // Own = inline-style writes on elements Aura tracks, or Aura's own nodes
    // being added/removed. Approximate (a site restyling a tracked element
    // counts as own), but good enough to see who is driving the passes.
    function isOwnRecord(r) {
        if (r.type === 'attributes') {
            if (isOwnElement(r.target)) return true;
            return r.attributeName === 'style' && inAnySet(r.target);
        }
        if (r.type === 'childList') {
            var nodes = [];
            for (var i = 0; i < r.addedNodes.length; i++) nodes.push(r.addedNodes[i]);
            for (var j = 0; j < r.removedNodes.length; j++) nodes.push(r.removedNodes[j]);
            if (!nodes.length) return false;
            for (var k = 0; k < nodes.length; k++) if (!isOwnElement(nodes[k])) return false;
            return true;
        }
        return false;
    }

    // ---- Hooks called from content.js ----------------------------------

    var api = {
        enabled: true,
        registerEngine: function (opts) {
            engine.sets = (opts && opts.sets) || {};
            engine.explain = (opts && opts.explain) || null;
        },
        storageResolved: function () {
            if (stats.storageResolvedMs === null) stats.storageResolvedMs = now();
        },
        cssApplied: function () {
            if (stats.cssAppliedMs === null) stats.cssAppliedMs = now();
        },
        passStart: function (root) {
            var t = now();
            stats.passStartedAt = t;
            stats.passStarts.push(t);
            prune(stats.passStarts, t);
            stats.passTotal++;
            stats.passRoot = describeNode(root);
        },
        passElements: function (n) { stats.passElements = n; },
        passSync: function () {
            stats.lastSyncMs = now() - stats.passStartedAt;
            if (stats.lastSyncMs > stats.maxSyncMs) stats.maxSyncMs = stats.lastSyncMs;
        },
        passEnd: function () { stats.lastTotalMs = now() - stats.passStartedAt; },
        mutations: function (records) {
            var own = 0;
            for (var i = 0; i < records.length; i++) if (isOwnRecord(records[i])) own++;
            var t = now();
            if (own) stats.ownRecords.push([t, own]);
            if (records.length - own) stats.siteRecords.push([t, records.length - own]);
            prune(stats.ownRecords, t);
            prune(stats.siteRecords, t);
        },
        scrollPass: function () { stats.scrollPasses++; },
        storageChanged: function () { stats.storageChanges++; },
    };
    globalThis.AuraDebug = api;

    // ---- HUD -------------------------------------------------------------

    var host = null, shadow = null, hudBody = null, panel = null, collapsed = false;

    var HUD_CSS = [
        ':host { all: initial; }',
        '.hud { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); right: 4px; z-index: 2147483647;',
        '  max-width: min(94vw, 420px); font: 10px/1.35 ui-monospace, Menlo, monospace; color: #e8e8e8;',
        '  background: rgba(0,0,0,.82); border: 1px solid #5c5c5c; border-radius: 6px; padding: 4px 6px;',
        '  -webkit-text-size-adjust: 100%; pointer-events: auto; }',
        '.row { white-space: pre-wrap; word-break: break-word; }',
        '.bar { display: flex; gap: 4px; margin-top: 3px; flex-wrap: wrap; }',
        'button { font: inherit; color: #fff; background: #333; border: 1px solid #777; border-radius: 4px; padding: 2px 6px; }',
        'button.on { background: #7a4b00; }',
        '.panel { margin-top: 4px; border-top: 1px solid #555; padding-top: 3px; max-height: 45vh; overflow: auto; }',
        '.k { color: #9ab; }',
        '.warn { color: #ffb347; }',
        '.ok { color: #8f8; }',
    ].join('\n');

    function ms(v) { return v === null || v === undefined ? '-' : Math.round(v) + 'ms'; }

    function navTimings() {
        try {
            var nav = performance.getEntriesByType('navigation')[0];
            if (nav) return { responseEnd: nav.responseEnd, domInteractive: nav.domInteractive || null };
        } catch (e) {}
        return { responseEnd: null, domInteractive: null };
    }

    function render() {
        if (!hudBody) return;
        var t = now();
        var nav = navTimings();
        var p1 = sumWithin(stats.passStarts, t, 1000);
        var p10 = sumWithin(stats.passStarts, t, RATE_WINDOW_MS) / (RATE_WINDOW_MS / 1000);
        var site1 = sumWithin(stats.siteRecords, t, 1000);
        var own1 = sumWithin(stats.ownRecords, t, 1000);
        var lines = [
            'load  script ' + ms(scriptStartMs) + '  (respEnd ' + ms(nav.responseEnd) + ', domInt ' + ms(nav.domInteractive) + ')',
            '      storage ' + ms(stats.storageResolvedMs) + '  css ' + ms(stats.cssAppliedMs),
            'pass  ' + p1 + '/s (10s avg ' + p10.toFixed(1) + '/s)  total ' + stats.passTotal,
            '      sync ' + ms(stats.lastSyncMs) + ' (max ' + ms(stats.maxSyncMs) + ')  full ' + ms(stats.lastTotalMs) + '  els ' + stats.passElements,
            '      root ' + stats.passRoot,
            'mut   site ' + site1 + '/s  own ' + own1 + '/s',
            'misc  scroll passes ' + stats.scrollPasses + '  storage.onChanged ' + stats.storageChanges,
        ];
        hudBody.textContent = lines.join('\n');
    }

    function button(label, onClick) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            onClick(b);
        });
        return b;
    }

    function showPanel(nodes) {
        panel.hidden = false;
        panel.textContent = '';
        nodes.forEach(function (n) { panel.appendChild(n); });
    }

    function line(text, cls) {
        var d = document.createElement('div');
        d.className = 'row' + (cls ? ' ' + cls : '');
        d.textContent = text;
        return d;
    }

    function mountHud() {
        if (host || !document.documentElement) return;
        // display:contents: the host has no box of its own, so the engine's
        // fixed/sticky passes never see or paint it.
        host = document.createElement('aura-debug-hud');
        host.style.setProperty('display', 'contents', 'important');
        shadow = host.attachShadow({ mode: 'closed' });
        var style = document.createElement('style');
        style.textContent = HUD_CSS;
        var box = document.createElement('div');
        box.className = 'hud';
        hudBody = document.createElement('div');
        hudBody.className = 'row';
        var bar = document.createElement('div');
        bar.className = 'bar';
        bar.appendChild(button('Inspect', function (b) { toggleInspect(b); }));
        bar.appendChild(button('Layout diff', function () { showPanel(layoutDiff()); }));
        bar.appendChild(button('Reset', function () {
            stats.passTotal = 0; stats.maxSyncMs = 0; stats.scrollPasses = 0; stats.storageChanges = 0;
            panel.hidden = true;
        }));
        bar.appendChild(button('–', function (b) {
            collapsed = !collapsed;
            hudBody.hidden = collapsed;
            panel.hidden = true;
            b.textContent = collapsed ? '+' : '–';
        }));
        panel = document.createElement('div');
        panel.className = 'panel';
        panel.hidden = true;
        box.appendChild(hudBody);
        box.appendChild(bar);
        box.appendChild(panel);
        shadow.appendChild(style);
        shadow.appendChild(box);
        document.documentElement.appendChild(host);
        render();
        setInterval(render, 500);
    }

    // ---- Authored paint probe (debug only) --------------------------------
    // Reads what the SITE painted on an element, before Aura: disables Aura's
    // stylesheets in the element's root and lifts Aura's inline overrides on
    // that one element, reads computed values, then restores everything.
    // transition:none during the read so a transitioned background reports
    // its real value rather than the transition's start value.

    // Longhands only: restoring a `background` shorthand after its longhands
    // would clobber them. `transition` must stay last (restored in rAF).
    var INLINE_PROPS = ['background-color', 'background-image', 'color', '-webkit-text-fill-color', 'transition'];

    function auraSheetsFor(el) {
        var root = el.getRootNode ? el.getRootNode() : document;
        var sheets = [];
        try {
            root.querySelectorAll('style#aura-core-engine, style#aura-pseudo-overrides, style[data-aura-shadow], style[data-aura-iframe]')
                .forEach(function (s) { sheets.push(s); });
        } catch (e) {}
        return sheets;
    }

    function readPaint(el) {
        var cs = getComputedStyle(el);
        return {
            bg: cs.backgroundColor,
            bgImage: cs.backgroundImage,
            backdrop: cs.webkitBackdropFilter || cs.backdropFilter || 'none',
            color: cs.color,
        };
    }

    function readAuthoredPaint(el) {
        var sheets = auraSheetsFor(el);
        var saved = INLINE_PROPS.map(function (p) {
            return [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)];
        });
        var result = null;
        try {
            sheets.forEach(function (s) { s.disabled = true; });
            INLINE_PROPS.forEach(function (p) { el.style.removeProperty(p); });
            el.style.setProperty('transition', 'none', 'important');
            result = readPaint(el);
        } finally {
            sheets.forEach(function (s) { s.disabled = false; });
            el.style.removeProperty('transition');
            saved.forEach(function (entry) {
                if (entry[1]) el.style.setProperty(entry[0], entry[1], entry[2]);
            });
            el.style.setProperty('transition', 'none', 'important');
            void getComputedStyle(el).backgroundColor; // settle without a transition
            var savedTransition = saved[saved.length - 1];
            requestAnimationFrame(function () {
                el.style.removeProperty('transition');
                if (savedTransition[1]) el.style.setProperty('transition', savedTransition[1], savedTransition[2]);
            });
        }
        return result;
    }

    function alphaOf(color) {
        var p = H && H.parseCssRgb ? H.parseCssRgb(color) : null;
        return p ? p.a : null;
    }

    // ---- Inspect mode -----------------------------------------------------

    var inspecting = false, inspectButton = null, inspected = null;

    function toggleInspect(b) {
        inspecting = !inspecting;
        inspectButton = b;
        b.classList.toggle('on', inspecting);
        b.textContent = inspecting ? 'Tap an element…' : 'Inspect';
    }

    function onInspectTap(e) {
        if (!inspecting) return;
        var path = e.composedPath ? e.composedPath() : [e.target];
        if (path.indexOf(host) >= 0) return; // taps on the HUD itself
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (e.type !== 'click') return;
        var target = path[0];
        while (target && target.nodeType !== 1) target = target.parentNode;
        inspecting = false;
        if (inspectButton) {
            inspectButton.classList.remove('on');
            inspectButton.textContent = 'Inspect';
        }
        if (target) showInspect(target);
    }

    function shadowChain(el) {
        var chain = [];
        var root = el.getRootNode ? el.getRootNode() : null;
        while (root && root.nodeType === 11 && root.host) {
            chain.push(describeNode(root.host));
            root = root.host.getRootNode();
        }
        return chain.length ? chain.join(' ⟵ ') : '(document)';
    }

    function setsContaining(el) {
        var names = [];
        for (var name in engine.sets) {
            var set = engine.sets[name];
            if (set && set.has && set.has(el)) names.push(name);
        }
        return names.length ? names.join(', ') : '(none)';
    }

    function showInspect(el) {
        inspected = el;
        var cs = getComputedStyle(el);
        var r = el.getBoundingClientRect();
        var now_ = readPaint(el);
        var authored = readAuthoredPaint(el);
        var aAlpha = authored ? alphaOf(authored.bg) : null;
        var verdict = aAlpha === null ? '?' : aAlpha >= 0.5 ? 'OPAQUE' : aAlpha > 0 ? 'translucent' : 'transparent';
        var explain = {};
        try { explain = engine.explain ? engine.explain(el) : {}; } catch (e) { explain = { error: String(e) }; }
        var explainText = Object.keys(explain).map(function (k) {
            var v = explain[k];
            return k + '=' + (v && v.nodeType === 1 ? describeNode(v) : String(v));
        }).join('  ');
        var classes = typeof el.className === 'string' ? el.className.trim() : '';
        var nodes = [
            line(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')),
            line('class ' + (classes || '-')),
            line('shadow ' + shadowChain(el)),
            line('pos ' + cs.position + '  z ' + cs.zIndex + '  ' + Math.round(r.width) + '×' + Math.round(r.height)
                + ' @' + Math.round(r.left) + ',' + Math.round(r.top)),
            line('now      bg ' + now_.bg + '  img ' + trim(now_.bgImage) + '  color ' + now_.color),
            line('authored bg ' + (authored ? authored.bg : '?') + '  img ' + (authored ? trim(authored.bgImage) : '?')
                + '  backdrop ' + (authored ? trim(authored.backdrop) : '?'), aAlpha >= 0.5 ? 'warn' : ''),
            line('authored verdict: ' + verdict
                + ((aAlpha >= 0.5 && alphaOf(now_.bg) < 0.5) ? '  ⚠ site painted it opaque, Aura left it see-through' : ''),
                (aAlpha >= 0.5 && alphaOf(now_.bg) < 0.5) ? 'warn' : ''),
            line('aura sets ' + setsContaining(el)),
            line('rules ' + (explainText || '-')),
        ];
        var bar = document.createElement('div');
        bar.className = 'bar';
        bar.appendChild(button('↑ parent', function () {
            var parent = el.parentElement || (el.getRootNode && el.getRootNode().host);
            if (parent && parent !== document.documentElement) showInspect(parent);
        }));
        bar.appendChild(button('Close', function () { panel.hidden = true; inspected = null; }));
        nodes.push(bar);
        showPanel(nodes);
    }

    function trim(v) {
        v = String(v || '');
        return v.length > 48 ? v.slice(0, 47) + '…' : v;
    }

    // ---- Layout diff ------------------------------------------------------
    // Theming must never change geometry. Snapshot fixed/sticky and overlay
    // elements with Aura's sheets on, then off, and list anything that moved
    // or resized by more than 1px. (Document-level sheets only; shadow-root
    // copies stay on.)

    function layoutCandidates() {
        var out = [];
        var overlaySel = (H && H.OVERLAY_SELECTOR) || 'dialog,[popover],[role="dialog"],[aria-modal="true"]';
        var all = document.body ? document.body.getElementsByTagName('*') : [];
        for (var i = 0; i < all.length && out.length < 400; i++) {
            var el = all[i];
            if (el === host) continue;
            var pos = getComputedStyle(el).position;
            var isOverlay = false;
            try { isOverlay = el.matches(overlaySel); } catch (e) {}
            if (pos === 'fixed' || pos === 'sticky' || isOverlay) {
                out.push(el);
                // Their direct children too (e.g. a search pill inside a header).
                for (var c = 0; c < el.children.length && c < 8; c++) out.push(el.children[c]);
            }
        }
        return out;
    }

    function layoutDiff() {
        var els = layoutCandidates();
        var on = els.map(function (el) { return el.getBoundingClientRect(); });
        var sheets = [];
        document.querySelectorAll('style#aura-core-engine, style#aura-pseudo-overrides')
            .forEach(function (s) { sheets.push(s); });
        var off;
        try {
            sheets.forEach(function (s) { s.disabled = true; });
            off = els.map(function (el) { return el.getBoundingClientRect(); });
        } finally {
            sheets.forEach(function (s) { s.disabled = false; });
        }
        var diffs = [];
        els.forEach(function (el, i) {
            var a = on[i], b = off[i];
            var d = [a.left - b.left, a.top - b.top, a.width - b.width, a.height - b.height];
            if (d.some(function (v) { return Math.abs(v) > 1; })) {
                diffs.push(describeNode(el) + '  dx ' + Math.round(d[0]) + ' dy ' + Math.round(d[1])
                    + ' dw ' + Math.round(d[2]) + ' dh ' + Math.round(d[3]));
            }
        });
        var nodes = [line('Layout diff: ' + els.length + ' fixed/sticky/overlay elements checked', diffs.length ? 'warn' : 'ok')];
        if (!diffs.length) nodes.push(line('0 moved or resized ✓', 'ok'));
        diffs.slice(0, 15).forEach(function (t) { nodes.push(line(t, 'warn')); });
        if (diffs.length > 15) nodes.push(line('…and ' + (diffs.length - 15) + ' more'));
        return nodes;
    }

    // ---- Boot ---------------------------------------------------------------

    ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(function (type) {
        window.addEventListener(type, onInspectTap, { capture: true, passive: false });
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountHud, { once: true });
    } else {
        mountHud();
    }
})();
