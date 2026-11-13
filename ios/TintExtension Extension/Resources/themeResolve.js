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
     * Concatenate CSS from every SITE_FIXES-style entry whose host matches
     * and isn't in the entry's `exclude` list (same suffix matching).
     * @param {string} hostname
     * @param {Array<{match: string[], exclude?: string[], css: string}>} siteFixes
     */
    function getSiteFix(hostname, siteFixes) {
        if (!hostname || !siteFixes || !siteFixes.length) return '';
        var out = [];
        for (var i = 0; i < siteFixes.length; i++) {
            var entry = siteFixes[i];
            if (entry && hostMatches(hostname, entry.match) && !hostMatches(hostname, entry.exclude)) {
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

    /**
     * Per-site theme cache: the resolved theme kept in the page's own
     * localStorage, so the next load can apply it synchronously at
     * document_start instead of waiting for extension storage. It holds
     * exactly the fields applyTheme keys on, so a cached apply and the
     * storage apply that follows produce the same stylesheet (and the
     * storage apply is a no-op when nothing changed).
     */
    var THEME_CACHE_KEY = '__aura';
    var THEME_CACHE_VERSION = 1;
    var THEME_CACHE_MAX_CHARS = 2048;
    var CACHE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\))$/;
    var CACHE_GRADIENT_RE = /^[\w\s#%().,-]{1,512}$/;
    var CACHE_TYPES = { color: 1, gradient: 1, image: 1, split: 1 };

    /** @returns {string|null} null when this theme must not be cached. */
    function serializeThemeCache(theme) {
        if (!theme || theme.enabled === false || theme.nativeDarkModeEnabled) return null;
        var entry = {
            v: THEME_CACHE_VERSION,
            id: theme.id == null ? null : String(theme.id),
            background: theme.background,
            text: theme.text,
            link: theme.link,
            backgroundType: theme.backgroundType || null,
            backgroundGradient: theme.backgroundGradient || null,
        };
        var json = JSON.stringify(entry);
        return parseThemeCache(json) ? json : null;
    }

    /** Validated theme from a cache string, or null for anything else. */
    function parseThemeCache(str) {
        if (typeof str !== 'string' || !str || str.length > THEME_CACHE_MAX_CHARS) return null;
        var e;
        try { e = JSON.parse(str); } catch (err) { return null; }
        if (!e || typeof e !== 'object' || e.v !== THEME_CACHE_VERSION) return null;
        if (!CACHE_COLOR_RE.test(String(e.background || ''))) return null;
        if (!CACHE_COLOR_RE.test(String(e.text || ''))) return null;
        if (!CACHE_COLOR_RE.test(String(e.link || ''))) return null;
        if (e.backgroundType != null && !CACHE_TYPES[e.backgroundType]) return null;
        if (e.backgroundGradient != null
            && (typeof e.backgroundGradient !== 'string' || !CACHE_GRADIENT_RE.test(e.backgroundGradient))) return null;
        if (e.id != null && (typeof e.id !== 'string' || e.id.length > 64)) return null;
        return {
            enabled: true,
            id: e.id,
            background: e.background,
            text: e.text,
            link: e.link,
            backgroundType: e.backgroundType,
            backgroundGradient: e.backgroundGradient,
        };
    }

    /**
     * Google's own apps on google.com subdomains (Forms/Docs, Gmail, Drive,
     * ...). The google.com SITE_FIXES and Google-only passes are written for
     * Search, Images and AI Mode; they don't apply to these.
     */
    var GOOGLE_APP_HOSTS = [
        'docs.google.com', 'mail.google.com', 'drive.google.com', 'calendar.google.com',
        'meet.google.com', 'keep.google.com', 'photos.google.com', 'myaccount.google.com',
        'accounts.google.com', 'play.google.com', 'news.google.com', 'translate.google.com',
        'sites.google.com', 'classroom.google.com', 'gemini.google.com',
    ];
    function isGoogleSearchHost(hostname) {
        return hostMatches(hostname, ['google.com']) && !hostMatches(hostname, GOOGLE_APP_HOSTS);
    }

    return {
        GOOGLE_APP_HOSTS: GOOGLE_APP_HOSTS,
        isGoogleSearchHost: isGoogleSearchHost,
        parseHHMM: parseHHMM,
        hostMatches: hostMatches,
        getSiteFix: getSiteFix,
        resolveTimeBasedTheme: resolveTimeBasedTheme,
        resolveTheme: resolveTheme,
        THEME_CACHE_KEY: THEME_CACHE_KEY,
        serializeThemeCache: serializeThemeCache,
        parseThemeCache: parseThemeCache,
    };
});
