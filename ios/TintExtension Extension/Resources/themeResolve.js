/**
 * Pure theme resolution helpers (site > time-based > global) + host matching.
 * Loaded before content.js; also required by Jest.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AuraThemeResolve = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function parseHHMM(value) {
        var parts = String(value || '0:0').split(':');
        var h = parseInt(parts[0], 10) || 0;
        var m = parseInt(parts[1], 10) || 0;
        return h * 60 + m;
    }

    /**
     * True when hostname equals a listed host or is a subdomain suffix match
     * (e.g. www.google.com matches "google.com").
     */
    function hostMatches(hostname, matchHosts) {
        if (!hostname || !matchHosts || !matchHosts.length) return false;
        var host = String(hostname).toLowerCase();
        for (var i = 0; i < matchHosts.length; i++) {
            var h = String(matchHosts[i] || '').toLowerCase();
            if (!h) continue;
            if (host === h || host.endsWith('.' + h)) return true;
        }
        return false;
    }

    /**
     * Concatenate CSS from every SITE_FIXES-style entry whose host matches.
     * @param {string} hostname
     * @param {Array<{match: string[], css: string}>} siteFixes
     */
    function getSiteFix(hostname, siteFixes) {
        if (!hostname || !siteFixes || !siteFixes.length) return '';
        var out = [];
        for (var i = 0; i < siteFixes.length; i++) {
            var entry = siteFixes[i];
            if (entry && hostMatches(hostname, entry.match)) {
                out.push(entry.css || '');
            }
        }
        return out.join('\n');
    }

    /**
     * @param {object|null} rule
     * @param {number} [mins] - minutes since midnight; defaults to now
     */
    function resolveTimeBasedTheme(rule, mins) {
        if (!rule || rule.enabled !== true) return null;

        var dayColors = rule.dayThemeColors;
        var nightColors = rule.nightThemeColors;
        if (!dayColors && !nightColors) return null;

        var minutes = mins;
        if (minutes == null || !isFinite(minutes)) {
            var now = new Date();
            minutes = now.getHours() * 60 + now.getMinutes();
        }

        var dayStart = parseHHMM(rule.dayStartTime || '07:00');
        var nightStart = parseHHMM(rule.nightStartTime || '19:00');

        var isDay;
        if (dayStart <= nightStart) {
            isDay = minutes >= dayStart && minutes < nightStart;
        } else {
            isDay = minutes >= dayStart || minutes < nightStart;
        }

        var chosen = isDay ? dayColors : nightColors;
        return chosen || null;
    }

    /**
     * Precedence: per-site theme > time-based day/night > global theme.
     * @param {object|null} themeData
     * @param {string} hostname
     * @param {number} [mins] - optional override for time-based tests
     */
    function resolveTheme(themeData, hostname, mins) {
        if (!themeData) return null;
        var host = hostname || '';
        var siteTheme = themeData.siteThemes && themeData.siteThemes[host];
        if (siteTheme && siteTheme.enabled !== false) {
            return siteTheme;
        }

        var timed = resolveTimeBasedTheme(themeData.timeBasedRule, mins);
        if (timed) return timed;

        return themeData.globalTheme || null;
    }

    return {
        parseHHMM: parseHHMM,
        hostMatches: hostMatches,
        getSiteFix: getSiteFix,
        resolveTimeBasedTheme: resolveTimeBasedTheme,
        resolveTheme: resolveTheme,
    };
});
