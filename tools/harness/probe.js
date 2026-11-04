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

    var storageData = cfg.themeData ? { tintThemeData: cfg.themeData } : {};
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
