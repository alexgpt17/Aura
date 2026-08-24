/**
 * Pure helpers for static hard-diagonal split themes.
 * Loaded before content.js in the Safari extension; also required by Jest.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AuraSplitTheme = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // pct is the size of the DARK side of the diagonal.
    // 105deg: iso-line hits the TOP edge ~75–80% from the left on a tall
    // phone (the reference), not the right edge (135deg / to bottom right).
    var SPLIT_PCT_START = 50;
    var SPLIT_ANGLE = '105deg';
    var SPLIT_SIZE = '100vw 100lvh';
    var SPLIT_SIZE_MID = '100vw 100dvh';
    var SPLIT_SIZE_FALLBACK = '100vw 100vh';
    var SPLIT_INVERT_TEXT = '#ffffff';
    var SPLIT_INVERT_TEXT_ON_LIGHT = '#000000';
    var SPLIT_INVERT_LINK = '#8ab4f8';
    var SPLIT_INVERT_LINK_ON_LIGHT = '#1558d6';

    /** Extract first two #RRGGBB colors from a gradient / color string. */
    function parseSplitColors(gradientOrTheme) {
        if (!gradientOrTheme) return null;
        if (typeof gradientOrTheme === 'object') {
            var dark = gradientOrTheme.dark || gradientOrTheme.background;
            var light = gradientOrTheme.light;
            if (dark && light) return { dark: dark, light: light };
            gradientOrTheme = gradientOrTheme.backgroundGradient || '';
        }
        var matches = String(gradientOrTheme).match(/#[0-9a-fA-F]{6}/g);
        if (!matches || matches.length < 2) return null;
        return { dark: matches[0], light: matches[1] };
    }

    function isSplitThemeRecord(theme) {
        if (!theme) return false;
        if (theme.backgroundType === 'split') return true;
        // Legacy: treat known split ids as split even if type not updated yet.
        var id = theme.id || theme.presetId;
        if (id === 'monochrome' || id === 'ocean-split' || id === 'forest-split' || id === 'sunset-split') {
            return !!theme.backgroundGradient;
        }
        return false;
    }

    /** Dual themes are retired from the product; leftover records paint as solid. */
    var LIVE_SPLIT_ENABLED = false;

    function isSplitTheme(theme) {
        if (!LIVE_SPLIT_ENABLED) return false;
        return isSplitThemeRecord(theme);
    }

    function isMonochromeSplit(theme) {
        if (!theme) return false;
        var id = theme.id || theme.presetId;
        if (id === 'monochrome') return true;
        var colors = parseSplitColors(theme.backgroundGradient || theme);
        if (!colors) return false;
        var d = colors.dark.toLowerCase();
        var l = colors.light.toLowerCase();
        return (d === '#000000' || d === '#000') && (l === '#ffffff' || l === '#fff');
    }

    /**
     * Clip-path for the dark wedge (top-left) of a hard split.
     * pct is dark share (e.g. 50). Extent 2*pct maps 50 → full corner triangle.
     * Used by app previews / tests.
     */
    function buildDarkClipPath(pctStop) {
        var pct = typeof pctStop === 'number' ? pctStop : parseFloat(pctStop);
        if (!isFinite(pct)) pct = SPLIT_PCT_START;
        var extent = Math.max(0, pct * 2);
        return 'polygon(0 0, ' + extent + '% 0, 0 ' + extent + '%)';
    }

    /**
     * Hard-diagonal CSS gradient for live paint and app previews.
     * Live page paints this on html::before (position:fixed, inset 0) so the
     * compositor holds the wedges — no JS background-position pin.
     */
    function buildSplitGradient(dark, light, pctStop) {
        var darkStop;
        if (typeof pctStop === 'number') {
            darkStop = pctStop + '%';
        } else {
            var pct = String(pctStop);
            if (/^\d+(\.\d+)?%?$/.test(pct) && pct.indexOf('var(') === -1) {
                darkStop = parseFloat(pct) + '%';
            } else {
                darkStop = pct.indexOf('var(') === 0 || pct.indexOf('%') !== -1
                    ? pct
                    : 'var(--aura-split-pct)';
            }
        }
        return (
            'linear-gradient(' +
            SPLIT_ANGLE +
            ', ' +
            dark +
            ' 0%, ' +
            dark +
            ' ' +
            darkStop +
            ', ' +
            light +
            ' ' +
            darkStop +
            ', ' +
            light +
            ' 100%)'
        );
    }

    function splitSizeCss() {
        return (
            'background-size:' + SPLIT_SIZE_FALLBACK + '!important;' +
            'background-size:' + SPLIT_SIZE_MID + '!important;' +
            'background-size:' + SPLIT_SIZE + '!important;'
        );
    }

    /** Viewport-locked paint: large viewport so toolbar-hide does not leave a gap. */
    function liveSplitBackground(dark, light, pctStop) {
        return {
            image: buildSplitGradient(dark, light, pctStop),
            size: SPLIT_SIZE,
            sizeMid: SPLIT_SIZE_MID,
            sizeFallback: SPLIT_SIZE_FALLBACK,
            repeat: 'no-repeat',
            position: 'fixed',
        };
    }

    /**
     * html background (mix-blend is unreliable on iOS). attachment:fixed;
     * sized to 100lvh so scroll-down toolbar hide is already covered.
     */
    function liveSplitHtmlCss(dark, light, pctStop) {
        var paint = liveSplitBackground(dark, light, pctStop);
        return (
            'html{' +
                'background-image:' + paint.image + '!important;' +
                splitSizeCss() +
                'background-repeat:no-repeat!important;' +
                'background-attachment:fixed!important;' +
                'background-position:0 0!important;' +
            '}'
        );
    }

    /** Visual lock: 100lvh from the top — covers toolbar hide, no bottom:0 stretch. */
    function liveSplitLayerCss(dark, light, pctStop) {
        var paint = liveSplitBackground(dark, light, pctStop);
        return (
            'html::before{' +
                'content:""!important;' +
                'position:fixed!important;' +
                'top:0!important;left:0!important;' +
                'width:100vw!important;' +
                'height:100vh!important;' +
                'height:100dvh!important;' +
                'height:100lvh!important;' +
                'pointer-events:none!important;' +
                'background-image:' + paint.image + '!important;' +
                'background-size:100% 100%!important;' +
                'background-repeat:no-repeat!important;' +
            '}'
        );
    }

    function liveSplitPaintCss(dark, light, pctStop) {
        return liveSplitHtmlCss(dark, light, pctStop) + liveSplitLayerCss(dark, light, pctStop);
    }

    /** White on the dark wedge, black on the light wedge — same geometry as the split. */
    function liveSplitTextGradient(pctStop) {
        return buildSplitGradient(SPLIT_INVERT_TEXT, SPLIT_INVERT_TEXT_ON_LIGHT, pctStop);
    }

    function liveSplitLinkGradient(pctStop) {
        return buildSplitGradient(SPLIT_INVERT_LINK, SPLIT_INVERT_LINK_ON_LIGHT, pctStop);
    }

    /** Properties that clip a viewport-fixed gradient to glyphs. */
    function liveSplitTextFillCss(gradient) {
        return (
            'background-image:' + gradient + '!important;' +
            splitSizeCss() +
            'background-repeat:no-repeat!important;' +
            'background-attachment:fixed!important;' +
            'background-position:0 0!important;' +
            '-webkit-background-clip:text!important;' +
            'background-clip:text!important;' +
            'color:transparent!important;' +
            '-webkit-text-fill-color:transparent!important;' +
            'mix-blend-mode:normal!important;'
        );
    }

    return {
        SPLIT_PCT_START: SPLIT_PCT_START,
        SPLIT_ANGLE: SPLIT_ANGLE,
        SPLIT_SIZE: SPLIT_SIZE,
        SPLIT_INVERT_TEXT: SPLIT_INVERT_TEXT,
        SPLIT_INVERT_TEXT_ON_LIGHT: SPLIT_INVERT_TEXT_ON_LIGHT,
        LIVE_SPLIT_ENABLED: LIVE_SPLIT_ENABLED,
        parseSplitColors: parseSplitColors,
        isSplitTheme: isSplitTheme,
        isSplitThemeRecord: isSplitThemeRecord,
        isMonochromeSplit: isMonochromeSplit,
        buildSplitGradient: buildSplitGradient,
        buildDarkClipPath: buildDarkClipPath,
        liveSplitBackground: liveSplitBackground,
        liveSplitHtmlCss: liveSplitHtmlCss,
        liveSplitLayerCss: liveSplitLayerCss,
        liveSplitPaintCss: liveSplitPaintCss,
        liveSplitTextGradient: liveSplitTextGradient,
        liveSplitLinkGradient: liveSplitLinkGradient,
        liveSplitTextFillCss: liveSplitTextFillCss,
    };
});
