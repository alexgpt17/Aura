// Runs at document_start, before content.js.
// Paints a sync dark shield so the first frame is never the site's white page,
// then applies real html/body colors as soon as storage returns — without
// waiting for content.js safety passes.

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

    injectEarlyShield();
    loadFromStorage();

    function injectEarlyShield() {
        try {
            if (document.getElementById(SHIELD_ID)) return;
            var style = document.createElement('style');
            style.id = SHIELD_ID;
            style.textContent =
                'html{background-color:#121212!important;color-scheme:dark!important;}';
            (document.documentElement || document.head).appendChild(style);
        } catch (e) {}
    }

    function resolveEarlyTheme(themeData) {
        if (!themeData) return null;
        var Resolve = typeof AuraThemeResolve !== 'undefined' ? AuraThemeResolve : null;
        if (Resolve && Resolve.resolveTheme) {
            try {
                return Resolve.resolveTheme(
                    themeData,
                    typeof location !== 'undefined' ? location.hostname : ''
                );
            } catch (e) {}
        }
        return themeData.globalTheme || null;
    }

    function paintEarlyTheme(theme) {
        if (!theme || theme.enabled === false) return;
        var bg = theme.background || '#121212';
        var Split = typeof AuraSplitTheme !== 'undefined' ? AuraSplitTheme : null;
        var splitColors = Split && Split.isSplitTheme(theme)
            ? Split.parseSplitColors(theme.backgroundGradient || theme)
            : null;
        var isSplit = !!(splitColors && splitColors.dark && splitColors.light);
        var isGradient = !isSplit && theme.backgroundType === 'gradient' && !!theme.backgroundGradient;
        var bodyTransparent = isSplit || isGradient;
        var splitLayerCss = (isSplit && Split && Split.liveSplitPaintCss)
            ? Split.liveSplitPaintCss(splitColors.dark, splitColors.light, Split.SPLIT_PCT_START)
            : (isSplit && Split && Split.liveSplitLayerCss)
                ? Split.liveSplitLayerCss(splitColors.dark, splitColors.light, Split.SPLIT_PCT_START)
                : '';
        var H = typeof AuraThemeHeuristics !== 'undefined' ? AuraThemeHeuristics : null;
        var scheme = (H && H.isThemeBackgroundLight && H.isThemeBackgroundLight(bg))
            ? 'light'
            : 'dark';
        injectThemeColorMeta(isSplit ? splitColors.dark : bg);
        try {
            var de = document.documentElement && document.documentElement.style;
            if (de) {
                de.setProperty('color-scheme', scheme, 'important');
                if (isSplit) {
                    var paint = Split.liveSplitBackground
                        ? Split.liveSplitBackground(splitColors.dark, splitColors.light, Split.SPLIT_PCT_START)
                        : null;
                    var grad = paint
                        ? paint.image
                        : Split.buildSplitGradient(splitColors.dark, splitColors.light, Split.SPLIT_PCT_START);
                    de.setProperty('background-color', splitColors.dark, 'important');
                    de.setProperty('background-image', grad, 'important');
                    de.setProperty('background-repeat', 'no-repeat', 'important');
                    de.setProperty('background-attachment', 'fixed', 'important');
                    de.setProperty('background-position', '0 0', 'important');
                    de.setProperty('background-size', paint && paint.size ? paint.size : '100vw 100lvh', 'important');
                } else {
                    de.setProperty('background-color', bg, 'important');
                    if (isGradient) {
                        de.setProperty('background-image', theme.backgroundGradient, 'important');
                        de.setProperty('background-attachment', 'fixed', 'important');
                        de.setProperty('background-repeat', 'no-repeat', 'important');
                        de.setProperty('background-size', 'cover', 'important');
                    }
                }
            }
            if (document.body) {
                if (bodyTransparent) {
                    document.body.style.setProperty('background-color', 'transparent', 'important');
                } else {
                    document.body.style.setProperty('background-color', bg, 'important');
                    document.body.style.setProperty('background', bg, 'important');
                }
            }
        } catch (e) {}
        var shield = document.getElementById(SHIELD_ID);
        if (shield) {
            if (isSplit) {
                shield.textContent =
                    'html{background-color:' + splitColors.dark + '!important;color-scheme:' + scheme + '!important;}' +
                    splitLayerCss +
                    'body{background-color:transparent!important;}';
            } else {
                shield.textContent =
                    'html{background-color:' + bg + '!important;color-scheme:' + scheme + '!important;}' +
                    'body{background-color:' + (bodyTransparent ? 'transparent' : bg) + '!important;}';
            }
        }
    }

    function loadFromStorage() {
        if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get('tintThemeData').then(function (result) {
                // Ad networks' own SafeFrame bootstrap scripts run after
                // document_start (when the isAdNetworkHost bail-out above
                // already ran), so this is the earliest point we can
                // reliably see the flag — by now the ad iframe's own
                // script has usually executed.
                if (H && H.isAdSafeFrameContext && H.isAdSafeFrameContext()) {
                    var earlyShield = document.getElementById(SHIELD_ID);
                    if (earlyShield) earlyShield.remove();
                    window.__TINT_THEME_DATA__._ready = true;
                    return;
                }
                if (result.tintThemeData) {
                    window.__TINT_THEME_DATA__ = result.tintThemeData;
                    window.__TINT_THEME_DATA__._ready = true;
                    paintEarlyTheme(resolveEarlyTheme(result.tintThemeData));
                } else {
                    window.__TINT_THEME_DATA__._ready = true;
                }
            }).catch(function () {
                window.__TINT_THEME_DATA__._ready = true;
            });
        } else {
            window.__TINT_THEME_DATA__._ready = true;
        }
    }

    if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
        browser.storage.onChanged.addListener(function (changes, areaName) {
            if (areaName === 'local' && changes.tintThemeData && changes.tintThemeData.newValue) {
                window.__TINT_THEME_DATA__ = changes.tintThemeData.newValue;
                window.__TINT_THEME_DATA__._ready = true;
                paintEarlyTheme(resolveEarlyTheme(changes.tintThemeData.newValue));
                var event = new CustomEvent('aura-theme-updated', {
                    detail: { themeData: changes.tintThemeData.newValue }
                });
                window.dispatchEvent(event);
            }
        });
    }

    function injectThemeColorMeta(bgColor) {
        if (!bgColor) return;
        try {
            var head = document.head || document.documentElement;
            if (!head) return;
            var themeColorMeta = document.querySelector('meta[name="theme-color"]');
            if (themeColorMeta) {
                themeColorMeta.setAttribute('content', bgColor);
            } else {
                themeColorMeta = document.createElement('meta');
                themeColorMeta.setAttribute('name', 'theme-color');
                themeColorMeta.setAttribute('content', bgColor);
                head.appendChild(themeColorMeta);
            }
        } catch (e) {}
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
