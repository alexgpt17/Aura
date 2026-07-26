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
        '[role="dialog"], [role="alertdialog"], [role="menu"], [aria-modal="true"]';

    var BRIGHT_SKIP_TAGS = {
        BUTTON: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, OPTION: 1,
        IMG: 1, SVG: 1, VIDEO: 1, CANVAS: 1, IFRAME: 1,
        SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, BR: 1, HR: 1,
        PATH: 1, USE: 1, CIRCLE: 1, RECT: 1, LINE: 1, POLYLINE: 1, POLYGON: 1, G: 1,
    };

    function parseCssRgb(color) {
        if (!color || color === 'transparent') return null;
        var m = String(color).match(
            /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
        );
        if (!m) return null;
        return {
            r: parseInt(m[1], 10),
            g: parseInt(m[2], 10),
            b: parseInt(m[3], 10),
            a: m[4] == null ? 1 : parseFloat(m[4]),
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

    function isFullViewportRect(rect, vh, vw) {
        return (
            vh > 0 &&
            vw > 0 &&
            rect.height >= vh * 0.85 &&
            rect.width >= vw * 0.85
        );
    }

    /** True for the dialog / alertdialog / aria-modal root only (not descendants). */
    function isOverlayRoot(el) {
        if (!el || el.nodeType !== 1 || !el.getAttribute) return false;
        var role = el.getAttribute('role');
        if (role === 'dialog' || role === 'alertdialog') return true;
        if (el.getAttribute('aria-modal') === 'true') return true;
        return false;
    }

    /** True for overlay roots or anything inside them (menus included). */
    function isOverlayChrome(el) {
        if (!el || el.nodeType !== 1) return false;
        if (isOverlayRoot(el)) return true;
        var role = el.getAttribute ? el.getAttribute('role') : null;
        if (role === 'menu') return true;
        if (typeof el.closest === 'function' && el.closest(OVERLAY_SELECTOR)) {
            return true;
        }
        return false;
    }

    /** True when el itself is a visible fixed/absolute z>=1 non-fullscreen shell. */
    function isFloatingBannerRoot(el, getStyle, viewport) {
        if (!el || el.nodeType !== 1) return false;
        var vh = (viewport && viewport.vh) || 0;
        var vw = (viewport && viewport.vw) || 0;
        if ((!vh || !vw) && typeof window !== 'undefined') {
            vh = window.innerHeight || 0;
            vw = window.innerWidth || 0;
        }
        var styleFn = getStyle || (typeof getComputedStyle !== 'undefined' ? getComputedStyle : null);
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
        return !isFullViewportRect(rect, vh, vw);
    }

    /**
     * True when el sits under a visible fixed/absolute, z-index>=1 shell that
     * is not a full-viewport curtain (snackbars / signed-out banners).
     */
    function isInsideFloatingBanner(el, getStyle, viewport) {
        if (!el || !el.parentElement) return false;
        var vh = (viewport && viewport.vh) || 0;
        var vw = (viewport && viewport.vw) || 0;
        if ((!vh || !vw) && typeof window !== 'undefined') {
            vh = window.innerHeight || 0;
            vw = window.innerWidth || 0;
        }
        var styleFn = getStyle || (typeof getComputedStyle !== 'undefined' ? getComputedStyle : null);
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
                        !isFullViewportRect(rect, vh, vw)
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
     * Predicate inputs for unit tests without a live DOM walk.
     * @param {{ tag?: string, role?: string|null, ariaModal?: string|null,
     *   className?: string, inSvg?: boolean, mask?: string, visibility?: string,
     *   opacity?: string, width?: number, height?: number, overlayRoot?: boolean,
     *   insideFloatingBanner?: boolean }} info
     */
    function shouldSkipBrightElement(info) {
        if (!info) return true;
        var tag = (info.tag || '').toUpperCase();
        if (BRIGHT_SKIP_TAGS[tag]) return true;
        if (info.role === 'button') return true;
        if (info.className && /icon/i.test(info.className)) return true;
        if (info.inSvg) return true;
        if (info.mask && info.mask !== 'none') return true;
        if (info.visibility === 'hidden' || info.opacity === '0') return true;
        // Skip clearing the dialog / floating-banner ROOT; descendants may
        // still clear so white inner cards don't sit under themed text.
        if (info.overlayRoot) return true;
        if (info.floatingBannerRoot) return true;
        if ((info.width || 0) < 1 || (info.height || 0) < 1) return true;
        if ((info.width || 0) < 32 && (info.height || 0) < 32) return true;
        return false;
    }

    /**
     * @param {{ position?: string, mask?: string, visibility?: string,
     *   opacity?: string, overlayChrome?: boolean, width?: number, height?: number,
     *   vh?: number, vw?: number }} info
     */
    function shouldSkipStickyElement(info) {
        if (!info) return true;
        var pos = info.position;
        if (pos !== 'fixed' && pos !== 'sticky') return true;
        if (info.mask && info.mask !== 'none') return true;
        if (info.visibility === 'hidden' || info.opacity === '0') return true;
        if (info.overlayChrome) return true;
        if ((info.width || 0) < 1 || (info.height || 0) < 1) return true;
        if (
            isFullViewportRect(
                { width: info.width || 0, height: info.height || 0 },
                info.vh || 0,
                info.vw || 0
            )
        ) {
            return true;
        }
        return false;
    }

    return {
        OVERLAY_SELECTOR: OVERLAY_SELECTOR,
        BRIGHT_SKIP_TAGS: BRIGHT_SKIP_TAGS,
        parseCssRgb: parseCssRgb,
        relativeLuminance: relativeLuminance,
        isNearWhiteSurface: isNearWhiteSurface,
        isFullViewportRect: isFullViewportRect,
        isOverlayRoot: isOverlayRoot,
        isOverlayChrome: isOverlayChrome,
        isFloatingBannerRoot: isFloatingBannerRoot,
        isInsideFloatingBanner: isInsideFloatingBanner,
        shouldSkipBrightElement: shouldSkipBrightElement,
        shouldSkipStickyElement: shouldSkipStickyElement,
    };
});
