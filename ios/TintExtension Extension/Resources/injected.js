// Runs at document_start, before content.js.
// Reads the per-site theme cache and paints a sync html/body shield so the
// first frame is never the site's own page, and starts the storage read
// content.js shares. Every theme surface after that is content.js's
// applyTheme/removeTheme.

(function() {
    'use strict';

    var H = typeof AuraThemeHeuristics !== 'undefined' ? AuraThemeHeuristics : null;
    var SHIELD_ID = 'aura-early-shield';
    try {
        var host = typeof location !== 'undefined' ? location.hostname : '';
        // Ad creative frames (GPT/SafeFrame, exchange iframes, ...): never
        // touch these at all, not even cosmetically. SafeFrame / "friendly
        // iframe" rendering pipelines commonly assume the frame's document
        // is untouched by any other script before their own bootstrap code
        // runs (some ad-fraud heuristics treat early third-party DOM
        // mutation inside the frame as a signal to abort rendering). A
        // previous attempt injected a transparent-canvas <style> tag here to
        // fix empty slots showing white — confirmed (extension off vs. on)
        // to break the ad loading entirely, not just its color. Do nothing.
        if (H && H.isAdNetworkHost && H.isAdNetworkHost(host)) {
            return;
        }
        // AMP consent widget iframes (e.g. OneTrust's amp-privacy.<site>) are
        // layout="fill" overlays meant to stay invisible except where they
        // actually draw a dialog. The early shield below only ever forces an
        // opaque html/body fill, which would curtain the whole 100vw x 100vh
        // frame over the host article before content.js's more careful,
        // element-scoped theming (see IS_AMP_CONSENT_FRAME) even runs.
        if (H && H.isAmpPrivacyFrameHost && H.isAmpPrivacyFrameHost(host)) {
            return;
        }
    } catch (eBail) {}

    window.__TINT_THEME_DATA__ = {
        globalTheme: null,
        siteThemes: {},
        _ready: false
    };

    var cachedTheme = readThemeCache();
    // content.js (same isolated world, runs right after this file) applies
    // it synchronously through its own applyTheme, so the first frame
    // already has the full stylesheet; storage reconciles later.
    window.__AURA_CACHED_THEME__ = cachedTheme;
    whenDocumentElement(function () { injectEarlyShield(cachedTheme); });
    loadFromStorage();

    // Safari runs document_start scripts after <html> exists; other engines
    // (and the harness's Chromium) can run them before it.
    function whenDocumentElement(fn) {
        if (document.documentElement) return fn();
        try {
            var mo = new MutationObserver(function () {
                if (!document.documentElement) return;
                mo.disconnect();
                fn();
            });
            mo.observe(document, { childList: true });
        } catch (e) {}
    }

    // Per-site theme cache (see themeResolve.js). Top frame only: a frame's
    // ad/SafeFrame status is only known after its own scripts run, and an
    // iframe shares the key with every page of its origin.
    function readThemeCache() {
        try {
            if (window.top !== window) return null;
            var Resolve = typeof AuraThemeResolve !== 'undefined' ? AuraThemeResolve : null;
            if (!Resolve || !Resolve.parseThemeCache) return null;
            return Resolve.parseThemeCache(window.localStorage.getItem(Resolve.THEME_CACHE_KEY));
        } catch (e) {
            return null;
        }
    }

    // Covers html/body until content.js applies the theme. With a cached
    // theme that's the same task; without one (a site's first visit) it
    // holds until storage resolves, in the OS appearance's colors.
    function injectEarlyShield(theme) {
        try {
            if (document.getElementById(SHIELD_ID)) return;
            var bg;
            if (theme && theme.background) {
                bg = theme.background;
            } else {
                var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
                bg = prefersLight ? '#F2F2F7' : '#121212';
            }
            var scheme = (H && H.isThemeBackgroundLight && H.isThemeBackgroundLight(bg)) ? 'light' : 'dark';
            var style = document.createElement('style');
            style.id = SHIELD_ID;
            style.textContent =
                'html{background-color:' + bg + '!important;color-scheme:' + scheme + '!important;}' +
                'body{background-color:' + bg + '!important;}';
            (document.documentElement || document.head).appendChild(style);
        } catch (e) {}
    }

    function loadFromStorage() {
        if (typeof browser !== 'undefined' && browser.storage) {
            // Shared with content.js (same isolated world) so the page makes
            // one storage read instead of two. content.js applies the theme
            // (and every root surface) when it resolves.
            var storagePromise = browser.storage.local.get('tintThemeData');
            window.__AURA_STORAGE_PROMISE__ = storagePromise;
            storagePromise.then(function (result) {
                // Ad networks' own SafeFrame bootstrap scripts run after
                // document_start (when the isAdNetworkHost bail-out above
                // already ran), so this is the earliest point we can
                // reliably see the flag — by now the ad iframe's own
                // script has usually executed.
                if (H && H.isAdSafeFrameContext && H.isAdSafeFrameContext()) {
                    var earlyShield = document.getElementById(SHIELD_ID);
                    if (earlyShield) earlyShield.remove();
                }
                if (result && result.tintThemeData) {
                    window.__TINT_THEME_DATA__ = result.tintThemeData;
                }
                window.__TINT_THEME_DATA__._ready = true;
            }).catch(function () {
                window.__TINT_THEME_DATA__._ready = true;
            });
        } else {
            window.__TINT_THEME_DATA__._ready = true;
        }
    }

    function injectViewportMeta() {
        if (!document.head) return;
        var viewportMeta = document.querySelector('meta[name="viewport"]');
        if (!viewportMeta) {
            viewportMeta = document.createElement('meta');
            viewportMeta.setAttribute('name', 'viewport');
            viewportMeta.setAttribute(
                'content',
                'width=device-width, initial-scale=1, viewport-fit=cover'
            );
            document.head.appendChild(viewportMeta);
        } else {
            var content = viewportMeta.getAttribute('content') || '';
            if (content.indexOf('viewport-fit=cover') === -1) {
                viewportMeta.setAttribute('content', content + ', viewport-fit=cover');
            }
        }
    }

    if (document.head) {
        injectViewportMeta();
    } else {
        document.addEventListener('DOMContentLoaded', injectViewportMeta);
    }
})();
