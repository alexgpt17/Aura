'use strict';

const path = require('path');
const R = require(path.join(
  __dirname,
  '../ios/TintExtension Extension/Resources/themeResolve.js'
));

describe('hostMatches / getSiteFix', () => {
  test('exact and suffix host match (www.google.com → google.com)', () => {
    expect(R.hostMatches('google.com', ['google.com'])).toBe(true);
    expect(R.hostMatches('www.google.com', ['google.com'])).toBe(true);
    expect(R.hostMatches('news.google.com', ['google.com'])).toBe(true);
    expect(R.hostMatches('notgoogle.com', ['google.com'])).toBe(false);
    expect(R.hostMatches('en.wikipedia.org', ['wikipedia.org'])).toBe(true);
  });

  test('getSiteFix concatenates matching CSS only', () => {
    const fixes = [
      { match: ['google.com'], css: '/* google */' },
      { match: ['wikipedia.org'], css: '/* wiki */' },
      { match: ['example.com'], css: '/* example */' },
    ];
    expect(R.getSiteFix('www.google.com', fixes)).toBe('/* google */');
    expect(R.getSiteFix('en.wikipedia.org', fixes)).toContain('/* wiki */');
    expect(R.getSiteFix('other.test', fixes)).toBe('');
  });
});

describe('resolveTheme precedence', () => {
  const day = { background: '#fff', text: '#000', link: '#00f' };
  const night = { background: '#000', text: '#fff', link: '#0ff' };
  const global = { background: '#111', text: '#eee', link: '#8af' };
  const site = { background: '#222', text: '#ddd', link: '#f80', enabled: true };

  test('siteThemes wins over time-based and global', () => {
    const data = {
      globalTheme: global,
      siteThemes: { 'news.example.com': site },
      timeBasedRule: {
        enabled: true,
        dayStartTime: '07:00',
        nightStartTime: '19:00',
        dayThemeColors: day,
        nightThemeColors: night,
      },
    };
    expect(R.resolveTheme(data, 'news.example.com', 12 * 60)).toEqual(site);
  });

  test('disabled site theme falls through', () => {
    const data = {
      globalTheme: global,
      siteThemes: { 'news.example.com': { ...site, enabled: false } },
      timeBasedRule: {
        enabled: true,
        dayStartTime: '07:00',
        nightStartTime: '19:00',
        dayThemeColors: day,
        nightThemeColors: night,
      },
    };
    expect(R.resolveTheme(data, 'news.example.com', 12 * 60)).toEqual(day);
  });

  test('time-based day vs night window', () => {
    const data = {
      globalTheme: global,
      siteThemes: {},
      timeBasedRule: {
        enabled: true,
        dayStartTime: '07:00',
        nightStartTime: '19:00',
        dayThemeColors: day,
        nightThemeColors: night,
      },
    };
    expect(R.resolveTheme(data, 'example.com', 8 * 60)).toEqual(day);
    expect(R.resolveTheme(data, 'example.com', 20 * 60)).toEqual(night);
    expect(R.resolveTheme(data, 'example.com', 6 * 60)).toEqual(night);
  });

  test('global when time-based disabled', () => {
    const data = {
      globalTheme: global,
      siteThemes: {},
      timeBasedRule: { enabled: false, dayThemeColors: day, nightThemeColors: night },
    };
    expect(R.resolveTheme(data, 'example.com', 12 * 60)).toEqual(global);
  });

  test('parseHHMM', () => {
    expect(R.parseHHMM('07:30')).toBe(7 * 60 + 30);
    expect(R.parseHHMM('19:00')).toBe(19 * 60);
  });
});

describe('theme cache', () => {
  const dark = { enabled: true, id: 'dark', background: '#1C1C1E', text: '#FFFFFF', link: '#0A84FF', backgroundType: 'color', backgroundGradient: null };

  test('round-trips the fields applyTheme keys on', () => {
    const s = R.serializeThemeCache(dark);
    expect(R.parseThemeCache(s)).toEqual(dark);
  });

  test('gradient theme round-trips', () => {
    const g = { ...dark, backgroundType: 'gradient', backgroundGradient: 'linear-gradient(135deg, #0f2027 0%, #2c5364 100%)' };
    expect(R.parseThemeCache(R.serializeThemeCache(g))).toEqual(g);
  });

  test('never caches theme off or native dark mode', () => {
    expect(R.serializeThemeCache({ ...dark, enabled: false })).toBeNull();
    expect(R.serializeThemeCache({ ...dark, nativeDarkModeEnabled: true })).toBeNull();
    expect(R.serializeThemeCache(null)).toBeNull();
  });

  test('rejects junk, oversize, wrong version and unsafe values', () => {
    const ok = JSON.parse(R.serializeThemeCache(dark));
    expect(R.parseThemeCache(null)).toBeNull();
    expect(R.parseThemeCache('')).toBeNull();
    expect(R.parseThemeCache('{not json')).toBeNull();
    expect(R.parseThemeCache('[]')).toBeNull();
    expect(R.parseThemeCache(JSON.stringify({ ...ok, v: 0 }))).toBeNull();
    expect(R.parseThemeCache(JSON.stringify({ ...ok, background: 'red;}body{display:none' }))).toBeNull();
    expect(R.parseThemeCache(JSON.stringify({ ...ok, text: 'url(x)' }))).toBeNull();
    expect(R.parseThemeCache(JSON.stringify({ ...ok, backgroundGradient: 'linear-gradient(red, blue)}*{color:red' }))).toBeNull();
    expect(R.parseThemeCache(JSON.stringify({ ...ok, backgroundType: 'video' }))).toBeNull();
    expect(R.parseThemeCache(JSON.stringify({ ...ok, id: 'x'.repeat(65) }))).toBeNull();
    expect(R.parseThemeCache(JSON.stringify({ ...ok, pad: 'x'.repeat(3000) }))).toBeNull();
    expect(R.parseThemeCache(JSON.stringify({ ...ok, background: 'rgb(28, 28, 30)' }))).not.toBeNull();
  });
});

describe('Google Search vs Google apps', () => {
  test('getSiteFix honors exclude', () => {
    const fixes = [{ match: ['google.com'], exclude: R.GOOGLE_APP_HOSTS, css: '/* g */' }];
    expect(R.getSiteFix('www.google.com', fixes)).toBe('/* g */');
    expect(R.getSiteFix('google.com', fixes)).toBe('/* g */');
    expect(R.getSiteFix('docs.google.com', fixes)).toBe('');
    expect(R.getSiteFix('mail.google.com', fixes)).toBe('');
  });
  test('isGoogleSearchHost', () => {
    expect(R.isGoogleSearchHost('www.google.com')).toBe(true);
    expect(R.isGoogleSearchHost('images.google.com')).toBe(true);
    expect(R.isGoogleSearchHost('docs.google.com')).toBe(false);
    expect(R.isGoogleSearchHost('notgoogle.com')).toBe(false);
  });
});
