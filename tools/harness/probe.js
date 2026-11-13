// In-page probe for the Aura WebKit harness. Injected as the first init
// script in every frame (themed and unthemed runs alike, so its own overhead
// cancels out in comparisons). It:
//   - stubs the extension APIs the content scripts use (storage, runtime)
//   - provides timed setTimeout/setInterval/requestAnimationFrame/
//     MutationObserver wrappers that run.js passes into the Aura scripts as
//     shadowing parameters, so every task Aura schedules is timed, including
//     ones scheduled after an `await`
//   - implements the AuraDebug hook interface content.js calls (DBG?.x())
//   - records frames, keystroke→frame latency and mutation counts
// Everything lands in window.__AH, which run.js reads with page.evaluate.
// Config arrives as window.__AH_CONFIG (an earlier init script).
(function () {
    'use strict';
    if (window.__AH) return;
    var cfg = window.__AH_CONFIG || {};
    var isTop = window.top === window;
    var perf = performance;
    var now = function () { return perf.now(); };
    var origSetTimeout = window.setTimeout.bind(window);
    var origSetInterval = window.setInterval.bind(window);
    var origRaf = window.requestAnimationFrame.bind(window);
    var OrigMO = window.MutationObserver;

    var AH = {
        top: isTop,
        tasks: [],          // [start, dur, kind] — every Aura-scheduled task
        passes: [],         // {start, sync, end, root, elements}
        subPasses: {},      // name -> {n, ms, max}
        frames: [],         // rAF timestamps (top frame only)
        keys: [],           // {key, sendWall, handlerWall, evWall, frameWall}
        mutations: [],      // [t, siteCount, ownCount]
        marks: {},          // storageResolved, cssApplied, ...
        scrollPasses: 0,
        storageChanges: 0,
        errors: [],
        sets: null,
        depth: 0,
    };
    Object.defineProperty(window, '__AH', { value: AH, enumerable: false });

    // ---- timing wrappers -------------------------------------------------

    function timed(kind, fn) {
        if (typeof fn !== 'function') return fn;
        return function () {
            var t0 = now();
            AH.depth++;
            try {
                return fn.apply(this, arguments);
            } catch (e) {
                AH.errors.push(String(e && e.stack || e).slice(0, 400));
                throw e;
            } finally {
                AH.depth--;
                AH.tasks.push([t0, now() - t0, kind]);
            }
        };
    }

    AH.wrap = {
        setTimeout: function (fn, ms) {
            var rest = Array.prototype.slice.call(arguments, 2);
            return origSetTimeout.apply(null, [timed('timeout', fn), ms].concat(rest));
        },
        setInterval: function (fn, ms) {
            return origSetInterval(timed('interval', fn), ms);
        },
        requestAnimationFrame: function (fn) {
            return origRaf(timed('raf', fn));
        },
        MutationObserver: (function () {
            function AuraMO(cb) { return new OrigMO(timed('mutation', cb)); }
            AuraMO.prototype = OrigMO.prototype;
            return AuraMO;
        })(),
    };

    // Event listeners Aura registers (scroll/change/visibilitychange/...).
    // They're registered from code that ran after an await, so tag by stack:
    // Aura scripts carry a //# sourceURL=aura/<file>.
    var origAdd = EventTarget.prototype.addEventListener;
    var origRemove = EventTarget.prototype.removeEventListener;
    var listenerMap = new WeakMap();
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
        if (typeof fn === 'function' && cfg.themed) {
            var stack = '';
            try { stack = new Error().stack || ''; } catch (e) {}
            if (stack.indexOf('aura/') >= 0 && stack.indexOf('aura/probe') < 0) {
                var w = listenerMap.get(fn);
                if (!w) { w = timed('event:' + type, fn); listenerMap.set(fn, w); }
                return origAdd.call(this, type, w, opts);
            }
        }
        return origAdd.call(this, type, fn, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
        var w = (typeof fn === 'function') && listenerMap.get(fn);
        return origRemove.call(this, type, w || fn, opts);
    };

    // ---- extension API stub --------------------------------------------

    // The switch scenario reloads with different storage: run.js leaves the
    // replacement theme data in sessionStorage (survives the reload, per tab).
    var tdOverride = null;
    try { tdOverride = sessionStorage.getItem('__AH_TD'); } catch (e) {}
    var startTd = tdOverride ? JSON.parse(tdOverride) : cfg.themeData;
    var storageData = startTd ? { tintThemeData: startTd } : {};
    var changeListeners = [];
    var STORAGE_DELAY_MS = typeof cfg.storageDelayMs === 'number' ? cfg.storageDelayMs : 5;
    AH.browser = {
        storage: {
            local: {
                get: function (key) {
                    return new Promise(function (resolve) {
                        origSetTimeout(function () {
                            var out = {};
                            if (typeof key === 'string') { if (key in storageData) out[key] = storageData[key]; }
                            else out = Object.assign({}, storageData);
                            resolve(JSON.parse(JSON.stringify(out)));
                        }, STORAGE_DELAY_MS);
                    });
                },
                set: function (obj) {
                    var changes = {};
                    Object.keys(obj).forEach(function (k) {
                        changes[k] = { oldValue: storageData[k], newValue: obj[k] };
                        storageData[k] = obj[k];
                    });
                    origSetTimeout(function () {
                        changeListeners.forEach(function (l) { try { l(changes, 'local'); } catch (e) {} });
                    }, 0);
                    return Promise.resolve();
                },
            },
            onChanged: { addListener: function (l) { changeListeners.push(l); } },
        },
        runtime: {
            lastError: null,
            sendMessage: function () { return Promise.resolve({ success: false }); },
            sendNativeMessage: function (app, msg, cb) {
                origSetTimeout(function () { if (cb) cb(null); }, 0);
            },
            onMessage: { addListener: function () {} },
        },
    };
    // Harness-only: swap theme data live (used for the theme-switch check).
    AH.setThemeData = function (td) { return AH.browser.storage.local.set({ tintThemeData: td }); };

    // Every surface that can carry a theme color (theme-switch check).
    // Sheet copies are identified by the --aura-bg they were built with.
    AH.surfaces = function () {
        var de = document.documentElement, b = document.body;
        var sheetBg = function (s) { var m = s && /--aura-bg:\s*([^;]+);/.exec(s.textContent || ''); return m ? m[1].trim() : (s ? '(no --aura-bg)' : null); };
        var tally = function (list) { var o = {}; list.forEach(function (v) { o[v] = (o[v] || 0) + 1; }); return o; };
        var shadowCopies = [];
        var walk = function (root) {
            var all = root.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                var sr = all[i].shadowRoot;
                if (!sr) continue;
                var s = sr.querySelector('style[data-aura-shadow]');
                shadowCopies.push(s ? sheetBg(s) : 'none');
                walk(sr);
            }
        };
        walk(document);
        var iframeCopies = [];
        Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (f) {
            try { var d = f.contentDocument; iframeCopies.push(d ? sheetBg(d.querySelector('style[data-aura-iframe]')) || 'none' : 'x-origin'); } catch (e) { iframeCopies.push('x-origin'); }
        });
        var cs = getComputedStyle(de), before = getComputedStyle(de, '::before');
        var shield = document.getElementById('aura-early-shield');
        return {
            htmlBg: cs.backgroundColor,
            htmlBgImage: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 60),
            colorScheme: cs.colorScheme,
            htmlInline: de.style.cssText.slice(0, 160),
            bodyBg: b ? getComputedStyle(b).backgroundColor : null,
            bodyInline: b ? b.style.cssText.slice(0, 160) : null,
            htmlBefore: before.content === 'none' ? '' : before.backgroundColor + ' ' + before.backgroundImage.slice(0, 40),
            themeColorMetas: Array.prototype.map.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) {
                return (m.getAttribute('media') ? '[' + m.getAttribute('media') + '] ' : '') + m.getAttribute('content');
            }),
            shield: shield ? shield.textContent.slice(0, 120) : null,
            coreSheet: sheetBg(document.getElementById('aura-core-engine')),
            splitLayer: !!document.getElementById('aura-split-bg'),
            pseudoSheet: !!document.getElementById('aura-pseudo-overrides'),
            shadowCopies: tally(shadowCopies),
            iframeCopies: tally(iframeCopies),
            cache: (function () { try { return localStorage.getItem('__aura'); } catch (e) { return 'throws'; } })(),
        };
    };

    // Mean color of the bottom strip of a screenshot (PNG as base64).
    AH.meanColor = function (b64) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                var c = document.createElement('canvas');
                c.width = img.width; c.height = img.height;
                var g = c.getContext('2d');
                g.drawImage(img, 0, 0);
                var d = g.getImageData(0, 0, c.width, c.height).data, r = 0, gg = 0, bb = 0, n = d.length / 4;
                for (var i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
                resolve('rgb(' + Math.round(r / n) + ', ' + Math.round(gg / n) + ', ' + Math.round(bb / n) + ')');
            };
            img.onerror = function () { resolve(null); };
            img.src = 'data:image/png;base64,' + b64;
        });
    };

    // ---- AuraDebug-compatible hooks (content.js calls DBG?.x()) ----------

    function describeNode(el) {
        if (!el) return '-';
        if (el.nodeType === 11) return '#shadow-root(' + describeNode(el.host) + ')';
        if (el === document.documentElement) return 'html';
        if (el.nodeType !== 1) return String(el.nodeName || '?');
        var out = el.tagName.toLowerCase();
        if (el.id) out += '#' + el.id;
        var cls = typeof el.className === 'string' ? el.className.trim() : '';
        if (cls) out += '.' + cls.split(/\s+/).slice(0, 2).join('.');
        return out.length > 60 ? out.slice(0, 59) + '…' : out;
    }
    AH.describeNode = describeNode;

    function inAnySet(el) {
        var sets = AH.sets;
        if (!sets) return false;
        for (var name in sets) { var s = sets[name]; if (s && s.has && s.has(el)) return true; }
        return false;
    }
    function isOwnElement(el) {
        if (!el || el.nodeType !== 1) return false;
        if ((el.id || '').indexOf('aura-') === 0) return true;
        return !!(el.hasAttribute && (el.hasAttribute('data-aura-shadow') || el.hasAttribute('data-aura-iframe')));
    }
    function isOwnRecord(r) {
        if (r.type === 'attributes') {
            if (isOwnElement(r.target)) return true;
            return r.attributeName === 'style' && inAnySet(r.target);
        }
        if (r.type === 'childList') {
            var n = 0, own = 0, i;
            for (i = 0; i < r.addedNodes.length; i++) { n++; if (isOwnElement(r.addedNodes[i])) own++; }
            for (i = 0; i < r.removedNodes.length; i++) { n++; if (isOwnElement(r.removedNodes[i])) own++; }
            return n > 0 && own === n;
        }
        return false;
    }

    var curPass = null;
    window.AuraDebug = !isTop ? { enabled: false } : {
        enabled: true,
        registerEngine: function (opts) { AH.sets = (opts && opts.sets) || null; },
        storageResolved: function () { if (AH.marks.storageResolved == null) AH.marks.storageResolved = now(); },
        cssApplied: function () { if (AH.marks.cssApplied == null) AH.marks.cssApplied = now(); },
        passStart: function (root) {
            curPass = { start: now(), sync: null, end: null, root: describeNode(root), elements: 0 };
            AH.passes.push(curPass);
        },
        passElements: function (n) { if (curPass) curPass.elements = n; },
        passSync: function () { if (curPass) curPass.sync = now() - curPass.start; },
        passEnd: function () { if (curPass) curPass.end = now(); },
        mutations: function (records) {
            var own = 0;
            for (var i = 0; i < records.length; i++) if (isOwnRecord(records[i])) own++;
            AH.mutations.push([now(), records.length - own, own]);
        },
        scrollPass: function () { AH.scrollPasses++; },
        storageChanged: function () { AH.storageChanges++; },
    };
    // run.js patches content.js's safePass to call this per sub-pass.
    AH.subPass = function (fn) {
        var name = AH.subPassName(fn);
        var t0 = now();
        try { return fn(); } finally {
            var d = now() - t0;
            var s = AH.subPasses[name] || (AH.subPasses[name] = { n: 0, ms: 0, max: 0, early: 0 });
            s.n++; s.ms += d; if (d > s.max) s.max = d;
        }
    };
    var nameCache = new Map();
    AH.subPassName = function (fn) {
        var src = String(fn);
        var hit = nameCache.get(src);
        if (hit) return hit;
        var m = /=>\s*([A-Za-z_$][\w$]*)/.exec(src);
        hit = m ? m[1] : '(inline step) ' + src.replace(/\s+/g, ' ').slice(6, 46);
        nameCache.set(src, hit);
        return hit;
    };

    if (!isTop) return;

    // ---- color timeline (6-1, opt-in: cfg.timeline) ------------------------
    // Every Aura inline-style write (element, property, Aura call chain) plus
    // the viewport's computed color/background sampled every 100 ms for the
    // first 6 s. run.js matches each late visible change to the write that
    // caused it. Stack capture per write is slow, so timing runs leave it off.
    if (cfg.timeline && cfg.themed) {
        AH.writes = [];
        AH.colorChanges = [];
        var declOwner = new WeakMap();
        [HTMLElement.prototype, SVGElement.prototype].forEach(function (proto) {
            var d = Object.getOwnPropertyDescriptor(proto, 'style') || Object.getOwnPropertyDescriptor(Element.prototype, 'style');
            if (!d || !d.get) return;
            Object.defineProperty(proto, 'style', {
                configurable: true, enumerable: d.enumerable, set: d.set,
                get: function () { var s = d.get.call(this); try { declOwner.set(s, this); } catch (e) {} return s; },
            });
        });
        var auraChain = function () {
            var st = '';
            try { st = new Error().stack || ''; } catch (e) {}
            var out = [];
            var re = /at (?:Object\.)?([\w$.]+) \(aura\/(?!probe)[\w.]+:\d+/g, m;
            while ((m = re.exec(st)) && out.length < 4) {
                if (/^(safePass|safeVisit|slice|runSteps|setProperty|removeProperty)$/.test(m[1])) continue;
                out.push(m[1]);
            }
            return out.length ? out.join('<') : null;
        };
        var CSD = CSSStyleDeclaration.prototype;
        ['setProperty', 'removeProperty'].forEach(function (name) {
            var orig = CSD[name];
            CSD[name] = function (prop) {
                var el = declOwner.get(this);
                if (el && AH.writes.length < 200000 && /color|background/.test(String(prop))) {
                    var chain = auraChain();
                    if (chain) AH.writes.push({ t: now(), el: el, prop: String(prop), chain: chain });
                }
                return orig.apply(this, arguments);
            };
        });
        var last = new Map();
        // What's on screen, from a 12 x 24 grid of points (elementsFromPoint
        // returns every element stacked at a point, so text, its card and
        // the bars above it are all sampled); open shadow roots are
        // pierced. A full-document scan every 100 ms delayed Aura's own
        // passes by seconds on big fixtures.
        var onScreen = function () {
            var set = new Set(), vh = innerHeight, vw = innerWidth;
            var add = function (root, x, y, depth) {
                var list = root.elementsFromPoint(x, y);
                for (var i = 0; i < list.length; i++) {
                    var el = list[i];
                    if (set.has(el)) continue;
                    set.add(el);
                    if (el.shadowRoot && depth < 4) add(el.shadowRoot, x, y, depth + 1);
                }
            };
            for (var gy = 0; gy < 24; gy++) for (var gx = 0; gx < 12; gx++) {
                try { add(document, (gx + 0.5) * vw / 12, (gy + 0.5) * vh / 24, 0); } catch (e) {}
            }
            return set;
        };
        var last = new Map();
        var sampleVisible = function () {
            var t = now();
            try {
                onScreen().forEach(function (el) {
                    if (el === document.documentElement) return;
                    var cs = getComputedStyle(el);
                    var v = cs.color + '|' + cs.backgroundColor;
                    var prev = last.get(el);
                    if (prev !== undefined && prev !== v) {
                        var root = el.getRootNode();
                        AH.colorChanges.push({ t: t, el: el, desc: (root !== document ? '›' : '') + describeNode(el), from: prev, to: v });
                    }
                    last.set(el, v);
                });
            } catch (e) {}
            if (t < 6000) origSetTimeout(sampleVisible, 100);
        };
        origSetTimeout(sampleVisible, 0);
        // Serializable summary for run.js: each change with the latest Aura
        // write on that element (or, for text color, an ancestor within 4
        // levels) at or before the sample that saw it.
        AH.timelineSummary = function () {
            var byEl = new Map();
            AH.writes.forEach(function (w) { var a = byEl.get(w.el); if (!a) byEl.set(w.el, a = []); a.push(w); });
            var cause = function (el, t, prop) {
                var hops = 0;
                for (var n = el; n && hops <= 4; n = n.parentElement || (n.parentNode && n.parentNode.host), hops++) {
                    var list = byEl.get(n);
                    if (list) for (var i = list.length - 1; i >= 0; i--) {
                        if (list[i].t <= t && (hops === 0 || list[i].prop === prop)) return { chain: list[i].chain, prop: list[i].prop, at: Math.round(list[i].t), hops: hops };
                    }
                    if (prop !== 'color') break;
                }
                return null;
            };
            return AH.colorChanges.map(function (c) {
                var colorChanged = c.from.split('|')[0] !== c.to.split('|')[0];
                return { t: Math.round(c.t), el: c.desc, from: c.from, to: c.to, cause: cause(c.el, c.t, colorChanged ? 'color' : 'background-color') };
            });
        };
    }

    // ---- site mutation counter (independent of Aura, also when unthemed) --
    // Counts all records so unthemed runs have a site-churn baseline.
    AH.allMutations = [];
    function startSiteObserver() {
        var mo = new OrigMO(function (recs) { AH.allMutations.push([now(), recs.length]); });
        mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    }
    if (document.documentElement) startSiteObserver();
    else document.addEventListener('readystatechange', startSiteObserver, { once: true });

    // ---- frames ------------------------------------------------------------
    function frame(t) { AH.frames.push(t); origRaf(frame); }
    origRaf(frame);

    // ---- keystroke → next frame -------------------------------------------
    // run.js sets __AH.nextSendWall right before each key press.
    var wall = function () { return perf.timeOrigin + perf.now(); };
    origAdd.call(window, 'keydown', function (e) {
        var rec = {
            key: e.key,
            sendWall: AH.nextSendWall || null,
            evWall: perf.timeOrigin + e.timeStamp,
            handlerWall: wall(),
            frameWall: null,
        };
        AH.nextSendWall = null;
        AH.keys.push(rec);
        // rAF fires at the start of the next frame; a message posted from it
        // runs after that frame's style/layout/paint.
        origRaf(function () {
            var ch = new MessageChannel();
            ch.port1.onmessage = function () { rec.frameWall = wall(); };
            ch.port2.postMessage(0);
        });
    }, true);
})();
