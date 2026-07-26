'use strict';

jest.mock('react-native-shared-group-preferences', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const { validateThemeData, getDefaultThemeData } = require('../src/storage.js');

describe('validateThemeData / defaults', () => {
  test('defaults include timeBasedRule, contentBlockerSettings, favorites', () => {
    const d = getDefaultThemeData();
    expect(d.timeBasedRule).toMatchObject({
      enabled: false,
      mode: 'manual',
      dayStartTime: '07:00',
      nightStartTime: '19:00',
    });
    expect(d.contentBlockerSettings).toMatchObject({
      enabled: true,
      categories: expect.objectContaining({
        ads: true,
        trackers: true,
        socialWidgets: false,
        annoyances: true,
      }),
    });
    expect(Array.isArray(d.favoriteThemes)).toBe(true);
    expect(d.favoriteThemes).toEqual([]);
    expect(d.hasCompletedOnboarding).toBe(false);
  });

  test('accepts valid shape', () => {
    expect(validateThemeData(getDefaultThemeData())).toBe(true);
    expect(validateThemeData({
      globalTheme: { background: '#000', text: '#fff', link: '#0af' },
      siteThemes: {},
      favoriteThemes: ['dark'],
      timeBasedRule: { enabled: false },
      contentBlockerSettings: { enabled: true, categories: {} },
    })).toBe(true);
  });

  test('rejects arrays, empty junk, oversized customThemes', () => {
    expect(validateThemeData(null)).toBe(false);
    expect(validateThemeData([])).toBe(false);
    expect(validateThemeData({ foo: 1 })).toBe(false);
    expect(validateThemeData({
      globalTheme: { background: '#000' },
      customThemes: [1, 2, 3, 4, 5, 6],
    })).toBe(false);
    expect(validateThemeData({
      globalTheme: 'not-an-object',
    })).toBe(false);
  });
});
