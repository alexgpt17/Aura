/**
 * Pure helpers for scroll-linked hard-diagonal split themes.
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
    // Angle "to top left" keeps the edge running top-right → bottom-left.
    // Color order is light (0% / right) → dark (100% / left) so dark sits on
    // the left and light on the right.
    var SPLIT_PCT_START = 52; // scroll 0: near mid-split; light reaches top of screen
    var SPLIT_PCT_END = 18;   // scroll bottom: light dominates
    var SPLIT_ANGLE = 'to top left';

    function lerp(a, b, t) {
        if (t <= 0) return a;
        if (t >= 1) return b;
        return a + (b - a) * t;
    }

    /**
     * Map page scroll progress (0..1) to the dark-side hard-stop percentage.
     * Dark side shrinks (light wedge grows) as the user scrolls down.
     */
    function scrollProgressToSplitPct(progress) {
        var t = Number(progress);
        if (!isFinite(t)) t = 0;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        return lerp(SPLIT_PCT_START, SPLIT_PCT_END, t);
    }

    function computeScrollProgress(scrollY, scrollHeight, viewportHeight) {
        var maxScroll = Math.max(1, (scrollHeight || 0) - (viewportHeight || 0));
        var y = Number(scrollY) || 0;
        if (y < 0) y = 0;
        return Math.min(1, y / maxScroll);
    }

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

    function isSplitTheme(theme) {
        if (!theme) return false;
        if (theme.backgroundType === 'split') return true;
        // Legacy: treat known split ids as split even if type not updated yet.
        var id = theme.id || theme.presetId;
        if (id === 'monochrome' || id === 'ocean-split' || id === 'forest-split' || id === 'sunset-split') {
            return !!theme.backgroundGradient;
        }
        return false;
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
     * Build the hard-diagonal CSS gradient string.
     * Dark share `pctStop` is measured from the 100% end (left); light fills
     * the remainder from the 0% end (right).
     * @param {string} dark
     * @param {string} light
     * @param {string|number} pctStop - dark share, e.g. 52, "52%", or var(...)
     */
    function buildSplitGradient(dark, light, pctStop) {
        var lightStop;
        if (typeof pctStop === 'number') {
            lightStop = (100 - pctStop) + '%';
        } else {
            var pct = String(pctStop);
            if (/^\d+(\.\d+)?%?$/.test(pct) && pct.indexOf('var(') === -1) {
                lightStop = (100 - parseFloat(pct)) + '%';
            } else {
                // CSS var: light ends where dark begins.
                lightStop = 'calc(100% - ' + pct + ')';
            }
        }
        return (
            'linear-gradient(' +
            SPLIT_ANGLE +
            ', ' +
            light +
            ' 0%, ' +
            light +
            ' ' +
            lightStop +
            ', ' +
            dark +
            ' ' +
            lightStop +
            ', ' +
            dark +
            ' 100%)'
        );
    }

    return {
        SPLIT_PCT_START: SPLIT_PCT_START,
        SPLIT_PCT_END: SPLIT_PCT_END,
        SPLIT_ANGLE: SPLIT_ANGLE,
        lerp: lerp,
        scrollProgressToSplitPct: scrollProgressToSplitPct,
        computeScrollProgress: computeScrollProgress,
        parseSplitColors: parseSplitColors,
        isSplitTheme: isSplitTheme,
        isMonochromeSplit: isMonochromeSplit,
        buildSplitGradient: buildSplitGradient,
    };
});
