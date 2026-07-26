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
