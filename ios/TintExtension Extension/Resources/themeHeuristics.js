/**
 * Pure / DOM-light heuristics shared by the Aura theme engine and Jest tests.
 * Loaded as a classic script before content.js in the Safari extension.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AuraThemeHeuristics = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var OVERLAY_SELECTOR =
        'dialog, [popover], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"]';

    var BRIGHT_SKIP_TAGS = {
        BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, OPTION: 1,
        IMG: 1, SVG: 1, VIDEO: 1, CANVAS: 1, IFRAME: 1,
        SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, BR: 1, HR: 1,
        PATH: 1, USE: 1, CIRCLE: 1, RECT: 1, LINE: 1, POLYLINE: 1, POLYGON: 1, G: 1,
    };

    var SPA_SHELL_IDS = {
        app: 1,
        'app-mount': 1,
        root: 1,
        __next: 1,
        __nuxt: 1,
    };

    var LIGHT_SURFACE_LUM = 0.55;
    var LIGHT_SURFACE_CHROMA = 40;
    var LIGHT_SURFACE_ALPHA = 0.4;
    var MODAL_MIN_WIDTH = 160;
    var MODAL_MIN_HEIGHT = 80;
    var MODAL_MIN_TEXT = 8;
    var SEARCH_CHROME_MAX_HEIGHT = 180;
    var TOP_CHROME_MAX_VH = 0.32;
    var TOP_CHROME_MIN_HEIGHT = 40;
    var TOP_CHROME_MIN_WIDTH_FRAC = 0.7;
    var COVERING_SHEET_MIN_VW = 0.75;
    var COVERING_SHEET_MIN_VH = 0.45;
    var STICKY_SKIP_TAGS = {
        IFRAME: 1, VIDEO: 1, CANVAS: 1,
    };

    /** Host suffixes for ad creatives (aligned with content-blocker ads list). */
    var AD_NETWORK_HOST_SUFFIXES = [
        'googlesyndication.com',
        'doubleclick.net',
        'googleadservices.com',
        'googletagservices.com',
        'amazon-adsystem.com',
        'adnxs.com',
        'criteo.com',
        'criteo.net',
        'taboola.com',
        'outbrain.com',
        'moatads.com',
        'adsrvr.org',
        '2mdn.net',
        'advertising.com',
        'pubmatic.com',
        'rubiconproject.com',
        'openx.net',
        'casalemedia.com',
        'media.net',
        'lijit.com',
        'sovrn.com',
        'yieldmo.com',
        'adsafeprotected.com',
        'scorecardresearch.com',
        'indexexchange.com',
        'smartadserver.com',
        'adform.net',
        'adroll.com',
        'freewheel.tv',
        'sonobi.com',
        'gumgum.com',
        '33across.com',
        'triplelift.com',
        'spotxchange.com',
        'sharethrough.com',
        'undertone.com',
        'contextweb.com',
        'bidswitch.net',
        'loopme.com',
    ];

    /**
     * Known ad-slot id/class tokens, used by JS-only matching
     * (AD_SURFACE_ID_CLASS_RE / isLikelyAdSurfaceInfo / isInsideAdSurface,
     * which feed the 6 JS safety-net passes' isAdThemingSkipped guard in
     * content.js). Avoid bare "ad" (false positives: header, badge, load,
     * reading).
     *
     * Over-matching here is SAFE: isAdThemingSkipped only ever causes a
     * pass to skip an ADDITIVE corrective touch (it can only cause more
     * skipping, never repaint an element that was otherwise protected).
     * This is NOT the list the CSS `:not()` ad-exclusion is built from —
     * see AD_SURFACE_CSS_SAFE_TOKENS below for why that must stay far more
     * conservative.
     */
    var AD_SURFACE_ID_CLASS_TOKENS = [
        'ad-unit', 'ad-unit__', 'adsbygoogle', 'google_ads_iframe',
        'acm-ad-tag', 'gpt-ad', 'dfp-ad', 'ad-slot', 'adslot',
        'ad-container', 'adhesion',
    ];
    var AD_SURFACE_ID_CLASS_RE = new RegExp(
        '(?:^|[\\s_-])(?:' + AD_SURFACE_ID_CLASS_TOKENS.join('|') + ')(?:$|[\\s_-])',
        'i'
    );
    var AD_SURFACE_ARIA_TOKENS = ['advertisement', 'sponsored'];
    var AD_SURFACE_ARIA_ATTRS = ['aria-label', 'aria-roledescription'];
    var AD_SURFACE_ARIA_RE = new RegExp(AD_SURFACE_ARIA_TOKENS.join('|'), 'i');

    /**
     * Strict subset of AD_SURFACE_ID_CLASS_TOKENS safe to feed the CSS
     * `:not()` ad-exclusion selector (buildAdSurfaceCssNotSelector).
     *
     * CSS-level exclusion is categorically more dangerous than JS-level:
     * it opts an element OUT of getFullStyleSheet's universal
     * `background-color: transparent !important` rule — the ONE rule that
     * guarantees a CMP/cookie-consent/curtain wrapper can never show a
     * solid background. `ad-slot` / `adslot` / `ad-container` / `adhesion`
     * are deliberately excluded here: generic, English-word-adjacent
     * tokens that collide with unrelated wrapper class names ("adhesion"
     * is a standard ad-industry term for sticky/full-width units, and
     * shares naming conventions with news-CMS cookie-consent curtains —
     * confirmed root cause of a fox5sandiego.com full-page curtain
     * regression when these were briefly included here). `gpt-ad` /
     * `dfp-ad` / `acm-ad-tag` are kept: vendor- or CMS-specific compound
     * tokens with no known collision risk.
     */
    var AD_SURFACE_CSS_SAFE_TOKENS = [
        'ad-unit', 'ad-unit__', 'adsbygoogle', 'google_ads_iframe',
        'acm-ad-tag', 'gpt-ad', 'dfp-ad',
    ];

    /**
     * Builds the CSS `:not(:is(...))` fragment content.js appends to every
     * ad-exclusion rule in the generated stylesheet. Derived from
     * AD_SURFACE_CSS_SAFE_TOKENS (NOT the broader AD_SURFACE_ID_CLASS_TOKENS
     * JS-matching list above) plus the aria advertisement/sponsored checks
     * (attribute-value matches, not generic substrings — no collision risk).
     */
    function buildAdSurfaceCssNotSelector() {
        var fragments = [];
        for (var i = 0; i < AD_SURFACE_CSS_SAFE_TOKENS.length; i++) {
            var token = AD_SURFACE_CSS_SAFE_TOKENS[i];
            fragments.push('[class*="' + token + '" i]');
            fragments.push('[class*="' + token + '" i] *');
            fragments.push('[id*="' + token + '" i]');
            fragments.push('[id*="' + token + '" i] *');
        }
        for (var a = 0; a < AD_SURFACE_ARIA_ATTRS.length; a++) {
            var attr = AD_SURFACE_ARIA_ATTRS[a];
            for (var w = 0; w < AD_SURFACE_ARIA_TOKENS.length; w++) {
                var word = AD_SURFACE_ARIA_TOKENS[w];
                fragments.push('[' + attr + '*="' + word + '" i]');
                fragments.push('[' + attr + '*="' + word + '" i] *');
            }
        }
        return ':not(:is(' + fragments.join(', ') + '))';
    }

    function parseCssRgb(color) {
        if (!color || color === 'transparent') return null;
        var m = String(color).match(
            /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
        );
        if (!m) {
            m = String(color).match(
                /rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+%?))?\s*\)/i
            );
        }
        if (!m) return null;
        var alpha = 1;
        if (m[4] != null) {
            alpha = String(m[4]).indexOf('%') >= 0
                ? parseFloat(m[4]) / 100
                : parseFloat(m[4]);
        }
        return {
            r: parseInt(m[1], 10),
            g: parseInt(m[2], 10),
            b: parseInt(m[3], 10),
            a: alpha,
        };
    }

    function relativeLuminance(r, g, b) {
        function lin(c) {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    /** Near-white opaque fill that the bright pass should clear. */
    function isNearWhiteSurface(parsed) {
        if (!parsed || parsed.a < 0.85) return false;
        return relativeLuminance(parsed.r, parsed.g, parsed.b) >= 0.9;
    }

    function isLowChroma(parsed) {
        if (!parsed) return false;
        return Math.max(parsed.r, parsed.g, parsed.b) - Math.min(parsed.r, parsed.g, parsed.b)
            <= LIGHT_SURFACE_CHROMA;
    }

    /**
     * Light gray / off-white content surfaces (Zillow cards, etc.).
     * Low-chroma guard leaves saturated brand fills and Wikipedia #B2C8FF alone.
     */
    function isLightContentSurface(parsed) {
        if (!parsed || parsed.a < LIGHT_SURFACE_ALPHA) return false;
        if (!isLowChroma(parsed)) return false;
        return relativeLuminance(parsed.r, parsed.g, parsed.b) >= LIGHT_SURFACE_LUM;
    }

    function isFullViewportRect(rect, vh, vw) {
        return (
            vh > 0 &&
            vw > 0 &&
            rect.height >= vh * 0.85 &&
            rect.width >= vw * 0.85
        );
    }

    /**
     * Visible intersection with the viewport is a wide, tall sheet — cookie
     * CMP wrappers, click-catchers, `top: header; bottom: 0` locks, iOS
     * 100dvh vs innerHeight mismatch. Not a chrome bar (typically < 180px).
     * Raw layout height is ignored so a tall sticky hero still counts when
     * it occupies the screen.
     */
    function isCoveringSheetRect(rect, vh, vw) {
        if (!rect || vh <= 0 || vw <= 0) return false;
        var width = rect.width || 0;
        var height = rect.height || 0;
        if (width < 1 || height < 1) return false;
        var top = typeof rect.top === 'number' ? rect.top : 0;
        var left = typeof rect.left === 'number' ? rect.left : 0;
        var interW = Math.min(left + width, vw) - Math.max(left, 0);
        var interH = Math.min(top + height, vh) - Math.max(top, 0);
        if (interW <= 0 || interH <= 0) return false;
        return interW >= vw * COVERING_SHEET_MIN_VW
            && interH >= vh * COVERING_SHEET_MIN_VH;
    }

    function isDialogOrPopover(el) {
        if (!el || el.nodeType !== 1) return false;
        var tag = el.tagName;
        if (tag === 'DIALOG') return true;
        if (el.hasAttribute && el.hasAttribute('popover')) return true;
        return false;
    }

    /** True for the dialog / alertdialog / aria-modal / popover root only. */
    function isOverlayRoot(el) {
        if (!el || el.nodeType !== 1 || !el.getAttribute) return false;
        if (isDialogOrPopover(el)) return true;
        var role = el.getAttribute('role');
        if (role === 'dialog' || role === 'alertdialog') return true;
        if (role === 'menu' || role === 'listbox') return true;
        if (el.getAttribute('aria-modal') === 'true') return true;
        return false;
    }

    /** True for overlay roots or anything inside them (menus included). */
    function isOverlayChrome(el) {
        if (!el || el.nodeType !== 1) return false;
        if (isOverlayRoot(el)) return true;
        var role = el.getAttribute ? el.getAttribute('role') : null;
        if (role === 'menu' || role === 'listbox') return true;
        if (typeof el.closest === 'function' && el.closest(OVERLAY_SELECTOR)) {
            return true;
        }
        return false;
    }

    function resolveViewport(viewport) {
        var vh = (viewport && viewport.vh) || 0;
        var vw = (viewport && viewport.vw) || 0;
        if ((!vh || !vw) && typeof window !== 'undefined') {
            vh = window.innerHeight || 0;
            vw = window.innerWidth || 0;
        }
        return { vh: vh, vw: vw };
    }

    /** True when hostname is an ad-network creative frame (safeframe, GPT, etc.). */
    function isAdNetworkHost(hostname) {
        if (!hostname) return false;
        var host = String(hostname).toLowerCase();
        if (host.indexOf(':') >= 0) {
            host = host.split(':')[0];
        }
        for (var i = 0; i < AD_NETWORK_HOST_SUFFIXES.length; i++) {
            var suffix = AD_NETWORK_HOST_SUFFIXES[i];
            if (host === suffix || host.slice(-(suffix.length + 1)) === '.' + suffix) {
                return true;
            }
        }
        return false;
    }

    /**
     * AMP consent UIs load a full-viewport iframe from an amp-privacy.* host
     * (e.g. amp-privacy.fox5sandiego.com). With all_frames:true, Aura would
     * paint that iframe's html/body as an opaque theme curtain over the
     * article — the fox5 /amp/ failure mode. Never theme those frames.
     */
    function isAmpPrivacyFrameHost(hostname) {
        if (!hostname) return false;
        var host = String(hostname).toLowerCase();
        if (host.indexOf(':') >= 0) {
            host = host.split(':')[0];
        }
        return host === 'amp-privacy' || host.indexOf('amp-privacy.') === 0;
    }

    /** True when this document is an AMP page (html[amp] / html[⚡]). */
    function isAmpDocument(doc) {
        var d = doc || (typeof document !== 'undefined' ? document : null);
        if (!d || !d.documentElement) return false;
        try {
            var el = d.documentElement;
            return el.hasAttribute('amp') || el.hasAttribute('\u26A1') || el.hasAttribute('⚡');
        } catch (e) {
            return false;
        }
    }

    /**
     * AMP runtime / consent / sticky-ad chrome must never receive sticky
     * re-opaque (--aura-bg). Custom elements aren't covered by the universal
     * div transparency rule, so painting them is especially dangerous.
     */
    function isAmpOverlayChromeInfo(info) {
        if (!info) return false;
        var tag = (info.tag || '').toUpperCase();
        if (tag.indexOf('AMP-') === 0 || tag.indexOf('I-AMPHTML-') === 0) {
            return true;
        }
        var id = String(info.id || '');
        var cls = String(info.className || '');
        if (/popupOverlay|consentPopup|amp-sticky-ad|amp-consent|i-amphtml-consent/i.test(id + ' ' + cls)) {
            return true;
        }
        return false;
    }

    function isAmpOverlayChrome(el) {
        if (!el || el.nodeType !== 1) return false;
        return isAmpOverlayChromeInfo({
            tag: el.tagName,
            id: el.id,
            className: typeof el.className === 'string' ? el.className : '',
        });
    }

    /**
     * True when the current frame identifies itself as an ad creative via
     * an industry-standard runtime signal, regardless of what domain it's
     * hosted on. `$sf` is the IAB SafeFrames API object (a cross-vendor
     * spec many exchanges implement, not just Google); `inDapIF` is
     * Google Publisher Tag's own SafeFrame flag, kept as a redundant,
     * cheap-to-check fallback. This generalizes far better than
     * AD_NETWORK_HOST_SUFFIXES, which can only ever cover domains someone
     * happened to add — an ad served from any unlisted exchange/creative
     * CDN still identifies itself this way if it uses a SafeFrame.
     *
     * Caveat: these globals are set by the ad network's OWN bootstrap
     * script, which runs after document_start — so this is only useful in
     * an async recheck (after the frame has had a moment to load its own
     * script), never in the synchronous document_start bail-out.
     */
    function isAdSafeFrameContext(win) {
        var w = win || (typeof window !== 'undefined' ? window : null);
        if (!w) return false;
        try {
            return !!(w.$sf || w.inDapIF === true);
        } catch (e) {
            return false;
        }
    }

    /**
     * Parent-page ad slot / wrapper (not a bare "*ad*" class match).
     * @param {{ tag?: string, id?: string|null, className?: string,
     *   ariaLabel?: string|null, ariaRoledescription?: string|null }} info
     */
    function isLikelyAdSurfaceInfo(info) {
        if (!info) return false;
        var tag = (info.tag || '').toUpperCase();
        var id = String(info.id || '');
        var className = String(info.className || '');
        var aria = String(info.ariaLabel || '');
        var roleDesc = String(info.ariaRoledescription || '');
        if (AD_SURFACE_ARIA_RE.test(aria) || AD_SURFACE_ARIA_RE.test(roleDesc)) {
            return true;
        }
        if (id && (/^google_ads_iframe/i.test(id) || /acm-ad-tag/i.test(id)
            || AD_SURFACE_ID_CLASS_RE.test(id))) {
            return true;
        }
        if (className && AD_SURFACE_ID_CLASS_RE.test(className)) {
            return true;
        }
        // ClassList-style tokens without relying on word boundaries alone
        if (/\bad-unit\b/i.test(className) || /\badsbygoogle\b/i.test(className)
            || /\badhesion\b/i.test(className) || /\bgpt-ad\b/i.test(className)
            || /\bdfp-ad\b/i.test(className) || /\bad-slot\b/i.test(className)
            || /\badslot\b/i.test(className) || /\bad-container\b/i.test(className)) {
            return true;
        }
        if (tag === 'INS' && /\badsbygoogle\b/i.test(className)) return true;
        return false;
    }

    function adSurfaceInfoFromElement(el) {
        if (!el || el.nodeType !== 1) return null;
        var className = '';
        try {
            className = typeof el.className === 'string'
                ? el.className
                : (el.getAttribute && el.getAttribute('class')) || '';
        } catch (e) {
            className = '';
        }
        return {
            tag: el.tagName,
            id: el.id || null,
            className: className,
            ariaLabel: el.getAttribute ? el.getAttribute('aria-label') : null,
            ariaRoledescription: el.getAttribute
                ? el.getAttribute('aria-roledescription')
                : null,
        };
    }

    /** True when el is an ad slot or sits under one (ancestor walk capped). */
    function isInsideAdSurface(el) {
        if (!el || el.nodeType !== 1) return false;
        var node = el;
        var depth = 0;
        var root = (typeof document !== 'undefined') ? document.documentElement : null;
        while (
            node &&
            node.nodeType === 1 &&
            node !== root &&
            depth < 8
        ) {
            if (isLikelyAdSurfaceInfo(adSurfaceInfoFromElement(node))) {
                return true;
            }
            node = node.parentElement;
            depth += 1;
        }
        return false;
    }

    /**
     * True when any hostname in the given list is a known ad-network host.
     * Pure predicate over an already-resolved list of <iframe src>
     * hostnames — content.js owns the live DOM walk (resolving relative
     * URLs, data-src lazy-load attrs) and passes the resolved strings in
     * here. Used to mark a page's own ad-wrapper divs as ad surfaces
     * structurally (by what they contain) rather than only by their own
     * id/class naming convention.
     */
    function hasAdNetworkIframeAmong(hostnames) {
        if (!hostnames || !hostnames.length) return false;
        for (var i = 0; i < hostnames.length; i++) {
            if (isAdNetworkHost(hostnames[i])) return true;
        }
        return false;
    }

    function resolveStyleFn(getStyle) {
        return getStyle || (typeof getComputedStyle !== 'undefined' ? getComputedStyle : null);
    }

    /** True when el itself is a visible fixed/absolute z>=1 non-fullscreen shell. */
    function isFloatingBannerRoot(el, getStyle, viewport) {
        if (!el || el.nodeType !== 1) return false;
        var vp = resolveViewport(viewport);
        var styleFn = resolveStyleFn(getStyle);
        if (!styleFn) return false;
        var style;
        try { style = styleFn(el); } catch (e) { return false; }
        var pos = style.position;
        if (pos !== 'fixed' && pos !== 'absolute') return false;
        if (style.visibility === 'hidden' || style.opacity === '0') return false;
        var z = parseInt(style.zIndex, 10);
        if (isNaN(z) || z < 1) return false;
        var rect;
        try { rect = el.getBoundingClientRect(); } catch (e2) { return false; }
        if (rect.width < 1 || rect.height < 1) return false;
        return !isFullViewportRect(rect, vp.vh, vp.vw);
    }

    /**
     * True when el sits under a visible fixed/absolute, z-index>=1 shell that
     * is not a full-viewport curtain (snackbars / signed-out banners).
     */
    function isInsideFloatingBanner(el, getStyle, viewport) {
        if (!el || !el.parentElement) return false;
        var vp = resolveViewport(viewport);
        var styleFn = resolveStyleFn(getStyle);
        if (!styleFn) return false;

        var node = el.parentElement;
        while (
            node &&
            node.nodeType === 1 &&
            node !== document.documentElement &&
            node !== document.body
        ) {
            var style;
            try {
                style = styleFn(node);
            } catch (e) {
                node = node.parentElement;
                continue;
            }
            var pos = style.position;
            if (pos === 'fixed' || pos === 'absolute') {
                if (style.visibility === 'hidden' || style.opacity === '0') {
                    node = node.parentElement;
                    continue;
                }
                var z = parseInt(style.zIndex, 10);
                if (!isNaN(z) && z >= 1) {
                    var rect;
                    try {
                        rect = node.getBoundingClientRect();
                    } catch (e2) {
                        node = node.parentElement;
                        continue;
                    }
                    if (
                        rect.width >= 1 &&
                        rect.height >= 1 &&
                        !isFullViewportRect(rect, vp.vh, vp.vw)
                    ) {
                        return true;
                    }
                }
            }
            node = node.parentElement;
        }
        return false;
    }

    /**
     * Search / AI-composer chrome must never be treated as a modal sheet.
     * @param {{ role?: string|null, searchChrome?: boolean,
     *   hasSearchField?: boolean, height?: number }} info
     */
    function isSearchChromeInfo(info) {
        if (!info) return false;
        if (info.searchChrome) return true;
        if ((info.role || '') === 'search') return true;
        if (info.hasSearchField && (info.height || 0) > 0 && (info.height || 0) < SEARCH_CHROME_MAX_HEIGHT) {
            return true;
        }
        return false;
    }

    function elementHasSearchField(el) {
        if (!el || typeof el.querySelector !== 'function') return false;
        var tag = (el.tagName || '').toUpperCase();
        if (tag === 'TEXTAREA' || tag === 'INPUT') return true;
        try {
            return !!el.querySelector(
                'textarea, input[type="search"], input[name="q"], input[role="combobox"],' +
                ' [role="combobox"], input[aria-label*="Search" i], input[aria-label*="Ask" i],' +
                ' textarea[aria-label*="Ask" i], textarea[aria-label*="Search" i]'
            );
        } catch (e) {
            return false;
        }
    }

    function isSearchChrome(el) {
        if (!el || el.nodeType !== 1) return false;
        if ((el.getAttribute('role') || '') === 'search') return true;
        try {
            if (typeof el.closest === 'function' && el.closest('[role="search"]')) return true;
        } catch (e) {}
        var height = 0;
        try { height = el.getBoundingClientRect().height; } catch (e2) { height = 0; }
        return isSearchChromeInfo({
            role: el.getAttribute('role'),
            hasSearchField: elementHasSearchField(el),
            height: height,
        });
    }

    /**
     * Shared size/content gates for a promo card (used for both document-level
     * fixed sheets and inner cards under a full-viewport scrim).
     */
    function isModalCardShape(info) {
        if (!info) return false;
        if (info.visibility === 'hidden' || info.opacity === '0') return false;
        if (isSearchChromeInfo(info)) return false;
        var width = info.width || 0;
        var height = info.height || 0;
        if (width < MODAL_MIN_WIDTH || height < MODAL_MIN_HEIGHT) return false;
        var sheetRect = {
            width: width,
            height: height,
            top: typeof info.top === 'number' ? info.top : 0,
            left: typeof info.left === 'number' ? info.left : 0,
        };
        if (isFullViewportRect(sheetRect, info.vh || 0, info.vw || 0)) {
            return false;
        }
        if (isCoveringSheetRect(sheetRect, info.vh || 0, info.vw || 0)) {
            return false;
        }
        if ((info.textLength || 0) < MODAL_MIN_TEXT) return false;
        return !!info.hasAction;
    }

    /**
     * Document-level promo / interstitial: position:fixed only.
     * Absolute is too common (Shopping carousels, result tiles) and must not
     * be painted as --aura-overlay.
     * @param {{ position?: string, zIndex?: number|string, visibility?: string,
     *   opacity?: string, width?: number, height?: number, vh?: number,
     *   vw?: number, textLength?: number, hasAction?: boolean,
     *   role?: string|null, searchChrome?: boolean, hasSearchField?: boolean }} info
     */
    function isLikelyModalCardInfo(info) {
        if (!isModalCardShape(info)) return false;
        if (info.position !== 'fixed') return false;
        var z = parseInt(info.zIndex, 10);
        if (isNaN(z) || z < 1) return false;
        return true;
    }

    /** Inner sheet under a scrim — any in-flow position is fine. */
    function isInnerModalCardInfo(info) {
        return isModalCardShape(info);
    }

    function elementHasAction(el) {
        if (!el || typeof el.querySelector !== 'function') return false;
        try {
            return !!el.querySelector(
                'button, a, [role="button"], input[type="submit"], input[type="button"]'
            );
        } catch (e) {
            return false;
        }
    }

    function modalCardInfoFromElement(el, style, rect, viewport) {
        var vp = resolveViewport(viewport);
        var text = '';
        try { text = String(el.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) {}
        return {
            position: style.position,
            zIndex: style.zIndex,
            visibility: style.visibility,
            opacity: style.opacity,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            vh: vp.vh,
            vw: vp.vw,
            textLength: text.length,
            hasAction: elementHasAction(el),
            role: el.getAttribute ? el.getAttribute('role') : null,
            hasSearchField: elementHasSearchField(el),
        };
    }

    function isLikelyModalCard(el, getStyle, viewport) {
        if (!el || el.nodeType !== 1) return false;
        if (isSearchChrome(el)) return false;
        var styleFn = resolveStyleFn(getStyle);
        if (!styleFn) return false;
        var style;
        try { style = styleFn(el); } catch (e) { return false; }
        var rect;
        try { rect = el.getBoundingClientRect(); } catch (e2) { return false; }
        return isLikelyModalCardInfo(modalCardInfoFromElement(el, style, rect, viewport));
    }

    /**
     * Largest non-fullscreen card-like child under a full-viewport scrim.
     * Walks a few levels so portals that wrap the card in extra divs still hit.
     */
    function findInnerModalCard(el, getStyle, viewport, depth) {
        if (!el || !el.children || !el.children.length) return null;
        if (depth == null) depth = 0;
        if (depth > 3) return null;
        var best = null;
        var bestArea = 0;
        var children = el.children;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            var childIsCard = false;
            if (child && child.nodeType === 1 && !isSearchChrome(child)) {
                var styleFn = resolveStyleFn(getStyle);
                var childStyle;
                var childRect;
                try { childStyle = styleFn && styleFn(child); } catch (e0) { childStyle = null; }
                try { childRect = child.getBoundingClientRect(); } catch (e1) { childRect = null; }
                if (childStyle && childRect) {
                    childIsCard = isInnerModalCardInfo(
                        modalCardInfoFromElement(child, childStyle, childRect, viewport)
                    );
                }
            }
            if (childIsCard) {
                var rect;
                try { rect = child.getBoundingClientRect(); } catch (e) { continue; }
                var area = (rect.width || 0) * (rect.height || 0);
                if (area > bestArea) {
                    bestArea = area;
                    best = child;
                }
            }
            var nested = findInnerModalCard(child, getStyle, viewport, depth + 1);
            if (nested) {
                var nRect;
                try { nRect = nested.getBoundingClientRect(); } catch (e2) { nRect = null; }
                var nArea = nRect ? (nRect.width || 0) * (nRect.height || 0) : 0;
                if (nArea > bestArea) {
                    bestArea = nArea;
                    best = nested;
                }
            }
        }
        return best;
    }

    /**
     * Predicate inputs for unit tests without a live DOM walk.
     * @param {{ tag?: string, role?: string|null, ariaModal?: string|null,
     *   className?: string, inSvg?: boolean, mask?: string, visibility?: string,
     *   opacity?: string, width?: number, height?: number, overlayRoot?: boolean,
     *   insideFloatingBanner?: boolean, modalCard?: boolean,
     *   hasSearchField?: boolean }} info
     */
    function shouldSkipBrightElement(info) {
        if (!info) return true;
        var tag = (info.tag || '').toUpperCase();
        if (tag === 'HTML' || tag === 'BODY') return true;
        if (BRIGHT_SKIP_TAGS[tag]) return true;
        if (info.role === 'button') {
            // Large Ask/search composer shells are role=button but must still
            // have their white fill cleared. Small chips / Reserve stay skipped.
            var composer = !!info.hasSearchField
                && (info.width || 0) >= MODAL_MIN_WIDTH
                && (info.height || 0) >= TOP_CHROME_MIN_HEIGHT;
            if (!composer) return true;
        }
        if (info.className && /icon/i.test(info.className)) return true;
        if (info.inSvg) return true;
        if (info.mask && info.mask !== 'none') return true;
        if (info.visibility === 'hidden' || info.opacity === '0') return true;
        // Skip clearing the dialog / floating-banner / modal-card ROOT;
        // descendants may still clear so white inner cards don't sit under themed text.
        if (info.overlayRoot) return true;
        if (info.floatingBannerRoot) return true;
        if (info.modalCard) return true;
        if ((info.width || 0) < 1 || (info.height || 0) < 1) return true;
        if ((info.width || 0) < 32 && (info.height || 0) < 32) return true;
        return false;
    }

    /**
     * Top-of-viewport app bar / search chrome. These are often `relative`
     * (Google Shopping <header>, many SERP toolbars) so the sticky pass
     * never sees them, and site dark-mode fills beat `header { transparent }`.
     * @param {{ tag?: string, role?: string|null, hasSearchField?: boolean,
     *   top?: number, width?: number, height?: number, vh?: number, vw?: number,
     *   visibility?: string, opacity?: string }} info
     */
    function isTopChromeBarInfo(info) {
        if (!info) return false;
        if (info.visibility === 'hidden' || info.opacity === '0') return false;
        var vh = info.vh || 0;
        var vw = info.vw || 0;
        if (vh < 1 || vw < 1) return false;
        if ((info.width || 0) < vw * TOP_CHROME_MIN_WIDTH_FRAC) return false;
        var height = info.height || 0;
        if (height < TOP_CHROME_MIN_HEIGHT || height > vh * TOP_CHROME_MAX_VH) return false;
        var top = info.top;
        if (typeof top !== 'number' || top < -20 || top > 80) return false;
        var tag = (info.tag || '').toUpperCase();
        if (tag === 'HEADER' || tag === 'NAV') return true;
        if (info.role === 'banner' || info.role === 'search') return true;
        return !!info.hasSearchField;
    }

    function isTopChromeBar(el, getStyle, viewport) {
        if (!el || el.nodeType !== 1) return false;
        if (el === document.documentElement || el === document.body) return false;
        var vp = resolveViewport(viewport);
        var styleFn = resolveStyleFn(getStyle);
        var style = null;
        if (styleFn) {
            try { style = styleFn(el); } catch (e) { style = null; }
        }
        var rect;
        try { rect = el.getBoundingClientRect(); } catch (e2) { return false; }
        return isTopChromeBarInfo({
            tag: el.tagName,
            role: el.getAttribute ? el.getAttribute('role') : null,
            hasSearchField: elementHasSearchField(el),
            top: rect.top,
            width: rect.width,
            height: rect.height,
            vh: vp.vh,
            vw: vp.vw,
            visibility: style ? style.visibility : 'visible',
            opacity: style ? style.opacity : '1',
        });
    }

    /**
     * Sticky/fixed re-opaque is ONLY for chrome-like bars (headers, thin
     * toolbars). Overlay-tier z-index, drawers, video floats, CMP shells, and
     * anything taller than top-chrome height must be skipped — painting those
     * is the fox5sandiego / usopen "solid curtain over content" failure mode.
     * @param {{ position?: string, mask?: string, visibility?: string,
     *   opacity?: string, overlayChrome?: boolean, width?: number, height?: number,
     *   top?: number, left?: number, vh?: number, vw?: number, tag?: string,
     *   zIndex?: number|string, id?: string, className?: string }} info
     */
    function shouldSkipStickyElement(info) {
        if (!info) return true;
        var pos = info.position;
        if (pos !== 'fixed' && pos !== 'sticky') return true;
        var tag = (info.tag || '').toUpperCase();
        if (STICKY_SKIP_TAGS[tag]) return true;
        if (info.mask && info.mask !== 'none') return true;
        if (info.visibility === 'hidden' || info.opacity === '0') return true;
        if (info.overlayChrome) return true;
        if (isAmpOverlayChromeInfo(info)) return true;
        if ((info.width || 0) < 1 || (info.height || 0) < 1) return true;
        var sheetRect = {
            width: info.width || 0,
            height: info.height || 0,
            top: typeof info.top === 'number' ? info.top : 0,
            left: typeof info.left === 'number' ? info.left : 0,
        };
        if (isFullViewportRect(sheetRect, info.vh || 0, info.vw || 0)) {
            return true;
        }
        if (isCoveringSheetRect(sheetRect, info.vh || 0, info.vw || 0)) {
            return true;
        }
        // Chrome bars are short. Taller fixed layers are drawers / players /
        // promo shells — never re-opaque them as --aura-bg.
        var vh = info.vh || 0;
        if (vh > 0 && (info.height || 0) > vh * TOP_CHROME_MAX_VH) {
            return true;
        }
        // Overlay / CMP / notification tiers (OneSignal, OneTrust, video float).
        var z = parseInt(info.zIndex, 10);
        if (!isNaN(z) && z >= 1000) {
            return true;
        }
        return false;
    }


    function contrastRatio(L1, L2) {
        var lighter = Math.max(L1, L2);
        var darker = Math.min(L1, L2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    function parseHexColor(hex) {
        if (!hex || typeof hex !== 'string') return null;
        var h = hex.replace('#', '').trim();
        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
            a: 1,
        };
    }

    /**
     * First opaque computed background walking from el up to html.
     * Falls back to `fallbackHex` (theme background) when the stack is glass.
     */
    function effectiveBackground(el, getStyle, fallbackHex) {
        var styleFn = resolveStyleFn(getStyle);
        var node = el;
        while (node && node.nodeType === 1) {
            if (styleFn) {
                var style;
                try { style = styleFn(node); } catch (e) { style = null; }
                if (style) {
                    var parsed = parseCssRgb(style.backgroundColor);
                    if (parsed && parsed.a >= 0.5) return parsed;
                }
            }
            if (typeof document !== 'undefined') {
                if (node === document.documentElement || node === document.body) break;
            }
            node = node.parentElement;
        }
        return parseHexColor(fallbackHex) || null;
    }

    /**
     * Pick a text color readable on `bgParsed`.
     * Keeps `preferredHex` when it already meets minRatio; else black/white.
     */
    function pickReadableAgainstSurface(bgParsed, preferredHex, minRatio) {
        minRatio = minRatio == null ? 3.0 : minRatio;
        if (!bgParsed) return preferredHex || '#ffffff';
        var Lb = relativeLuminance(bgParsed.r, bgParsed.g, bgParsed.b);
        if (preferredHex) {
            var pref = parseHexColor(preferredHex);
            if (pref) {
                var Lp = relativeLuminance(pref.r, pref.g, pref.b);
                if (contrastRatio(Lp, Lb) >= minRatio) return preferredHex;
            }
        }
        var whiteScore = contrastRatio(1, Lb);
        var blackScore = contrastRatio(0, Lb);
        return whiteScore >= blackScore ? '#ffffff' : '#000000';
    }

    /**
     * Pick a text color readable on both wedge backgrounds.
     * Prefers `preferred` when it meets minRatio against both; else black/white.
     */
    function pickReadableAgainstBoth(preferredHex, darkHex, lightHex, minRatio) {
        minRatio = minRatio == null ? 3.0 : minRatio;
        var dark = parseHexColor(darkHex);
        var light = parseHexColor(lightHex);
        if (!dark || !light) return preferredHex || '#ffffff';
        var Ld = relativeLuminance(dark.r, dark.g, dark.b);
        var Ll = relativeLuminance(light.r, light.g, light.b);

        function ok(hex) {
            var c = parseHexColor(hex);
            if (!c) return false;
            var L = relativeLuminance(c.r, c.g, c.b);
            return contrastRatio(L, Ld) >= minRatio && contrastRatio(L, Ll) >= minRatio;
        }

        if (preferredHex && ok(preferredHex)) return preferredHex;

        var whiteScore = Math.min(
            contrastRatio(1, Ld),
            contrastRatio(1, Ll)
        );
        var blackScore = Math.min(
            contrastRatio(0, Ld),
            contrastRatio(0, Ll)
        );
        return whiteScore >= blackScore ? '#ffffff' : '#000000';
    }

    function hasPoorContrast(fgParsed, bgParsed, minRatio) {
        minRatio = minRatio == null ? 3.0 : minRatio;
        if (!fgParsed || !bgParsed) return false;
        if (bgParsed.a < 0.5) return false;
        var Lf = relativeLuminance(fgParsed.r, fgParsed.g, fgParsed.b);
        var Lb = relativeLuminance(bgParsed.r, bgParsed.g, bgParsed.b);
        return contrastRatio(Lf, Lb) < minRatio;
    }

    function isSpaShellId(id) {
        if (!id) return false;
        return !!SPA_SHELL_IDS[String(id)];
    }

    function isStackedDuplicateLabel(el) {
        if (!el || !el.parentElement || el.nodeType !== 1) return false;
        var text = '';
        try { text = String(el.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { return false; }
        if (!text || text.length > 96) return false;
        var kids = el.parentElement.children;
        if (!kids || kids.length < 2) return false;
        var matches = 0;
        for (var i = 0; i < kids.length; i++) {
            var t = '';
            try { t = String(kids[i].textContent || '').replace(/\s+/g, ' ').trim(); } catch (e2) { continue; }
            if (t === text) matches++;
            if (matches >= 2) return true;
        }
        return false;
    }

    /**
     * True when contrast should not rewrite this node: it is not painted for
     * sighted users. Visible aria-hidden presentational copies (Airbnb host
     * stats, icon SVGs using currentColor) must NOT be skipped here.
     */
    function isUnpaintedForContrast(info) {
        if (!info) return true;
        if (info.visibility === 'hidden') return true;
        if (info.display === 'none') return true;
        var opacity = parseFloat(info.opacity);
        if (!isNaN(opacity) && opacity === 0) return true;
        if ((info.width || 0) < 1 || (info.height || 0) < 1) return true;
        return false;
    }

    function isThemeBackgroundLight(hex) {
        var c = parseHexColor(hex);
        if (!c) return false;
        return relativeLuminance(c.r, c.g, c.b) >= LIGHT_SURFACE_LUM;
    }

    function isCustomElementTag(tag) {
        return typeof tag === 'string' && tag.indexOf('-') !== -1;
    }

    function isLargeLayoutShell(info) {
        if (!info) return false;
        if (isSpaShellId(info.id)) return true;
        var area = (info.width || 0) * (info.height || 0);
        var vp = (info.vh || 0) * (info.vw || 0);
        return vp > 0 && area >= vp * 0.5;
    }

    /** Card / section sized box — used to clear leftover gradients. */
    function isLargeLayoutNode(info) {
        if (!info) return false;
        var w = info.width || 0;
        var h = info.height || 0;
        if (w < 80 || h < 48) return false;
        var area = w * h;
        if (area >= 12000) return true;
        var vp = (info.vh || 0) * (info.vw || 0);
        return vp > 0 && area >= vp * 0.08;
    }

    /** Hyphenated custom element that behaves like a large layout div. */
    function isCustomLayoutElement(info) {
        if (!info || !isCustomElementTag(info.tag)) return false;
        return isLargeLayoutShell(info) || isLargeLayoutNode(info);
    }

    function isGradientBackgroundImage(value) {
        if (!value || value === 'none') return false;
        var s = String(value);
        if (/url\s*\(/i.test(s)) return false;
        return /gradient\s*\(/i.test(s);
    }

    function isPhotographicBackgroundImage(value) {
        if (!value || value === 'none') return false;
        return /url\s*\(/i.test(String(value));
    }

    function shouldClearShellBackground(info) {
        if (!info) return false;
        var tag = (info.tag || '').toUpperCase();
        if (tag === 'HTML' || tag === 'BODY') return false;
        if (info.overlayRoot || info.overlayChrome) return false;
        if (info.isControl) return false;
        if (isPhotographicBackgroundImage(info.backgroundImage)) return false;
        if (isGradientBackgroundImage(info.backgroundImage) && shouldClearLayoutGradient(info)) {
            return true;
        }
        if (!isLargeLayoutShell(info) && !isCustomLayoutElement(info)) return false;
        if (isGradientBackgroundImage(info.backgroundImage)) return true;
        return !!info.opaqueFill;
    }

    /**
     * Clear CSS gradients (never url()) on large layout nodes / custom
     * elements — not only #app / top chrome.
     */
    function shouldClearLayoutGradient(info) {
        if (!info) return false;
        var tag = (info.tag || '').toUpperCase();
        if (tag === 'HTML' || tag === 'BODY') return false;
        if (info.overlayRoot || info.overlayChrome) return false;
        if (info.isControl) return false;
        // Google AI Overview collapse-fade: a large absolute gradient over
        // clipped text. Clearing it makes "Show more" glass.
        if (info.collapseFade) return false;
        if (!isGradientBackgroundImage(info.backgroundImage)) return false;
        if (isPhotographicBackgroundImage(info.backgroundImage)) return false;
        return isLargeLayoutShell(info) || isLargeLayoutNode(info) || isCustomLayoutElement(info);
    }

    return {
        OVERLAY_SELECTOR: OVERLAY_SELECTOR,
        BRIGHT_SKIP_TAGS: BRIGHT_SKIP_TAGS,
        SPA_SHELL_IDS: SPA_SHELL_IDS,
        LIGHT_SURFACE_LUM: LIGHT_SURFACE_LUM,
        LIGHT_SURFACE_ALPHA: LIGHT_SURFACE_ALPHA,
        parseCssRgb: parseCssRgb,
        relativeLuminance: relativeLuminance,
        contrastRatio: contrastRatio,
        parseHexColor: parseHexColor,
        pickReadableAgainstBoth: pickReadableAgainstBoth,
        pickReadableAgainstSurface: pickReadableAgainstSurface,
        hasPoorContrast: hasPoorContrast,
        isNearWhiteSurface: isNearWhiteSurface,
        isLightContentSurface: isLightContentSurface,
        isLowChroma: isLowChroma,
        isFullViewportRect: isFullViewportRect,
        isCoveringSheetRect: isCoveringSheetRect,
        isAdNetworkHost: isAdNetworkHost,
        isAmpPrivacyFrameHost: isAmpPrivacyFrameHost,
        isAmpDocument: isAmpDocument,
        isAmpOverlayChrome: isAmpOverlayChrome,
        isAmpOverlayChromeInfo: isAmpOverlayChromeInfo,
        hasAdNetworkIframeAmong: hasAdNetworkIframeAmong,
        isAdSafeFrameContext: isAdSafeFrameContext,
        isLikelyAdSurfaceInfo: isLikelyAdSurfaceInfo,
        isInsideAdSurface: isInsideAdSurface,
        buildAdSurfaceCssNotSelector: buildAdSurfaceCssNotSelector,
        AD_NETWORK_HOST_SUFFIXES: AD_NETWORK_HOST_SUFFIXES,
        AD_SURFACE_ID_CLASS_TOKENS: AD_SURFACE_ID_CLASS_TOKENS,
        AD_SURFACE_CSS_SAFE_TOKENS: AD_SURFACE_CSS_SAFE_TOKENS,
        isOverlayRoot: isOverlayRoot,
        isOverlayChrome: isOverlayChrome,
        isFloatingBannerRoot: isFloatingBannerRoot,
        isInsideFloatingBanner: isInsideFloatingBanner,
        isLikelyModalCard: isLikelyModalCard,
        isLikelyModalCardInfo: isLikelyModalCardInfo,
        isInnerModalCardInfo: isInnerModalCardInfo,
        isSearchChrome: isSearchChrome,
        isSearchChromeInfo: isSearchChromeInfo,
        elementHasSearchField: elementHasSearchField,
        isTopChromeBar: isTopChromeBar,
        isTopChromeBarInfo: isTopChromeBarInfo,
        findInnerModalCard: findInnerModalCard,
        effectiveBackground: effectiveBackground,
        shouldSkipBrightElement: shouldSkipBrightElement,
        shouldSkipStickyElement: shouldSkipStickyElement,
        isSpaShellId: isSpaShellId,
        isLargeLayoutShell: isLargeLayoutShell,
        isLargeLayoutNode: isLargeLayoutNode,
        isCustomElementTag: isCustomElementTag,
        isStackedDuplicateLabel: isStackedDuplicateLabel,
        isUnpaintedForContrast: isUnpaintedForContrast,
        isThemeBackgroundLight: isThemeBackgroundLight,
        isCustomLayoutElement: isCustomLayoutElement,
        isGradientBackgroundImage: isGradientBackgroundImage,
        isPhotographicBackgroundImage: isPhotographicBackgroundImage,
        shouldClearShellBackground: shouldClearShellBackground,
        shouldClearLayoutGradient: shouldClearLayoutGradient,
    };
});
