'use strict';

const path = require('path');
const Split = require(path.join(
  __dirname,
  '../ios/TintExtension Extension/Resources/splitTheme.js'
));

describe('lerp / scrollProgressToSplitPct', () => {
  test('lerp clamps at ends', () => {
    expect(Split.lerp(52, 18, 0)).toBe(52);
    expect(Split.lerp(52, 18, 1)).toBe(18);
    expect(Split.lerp(52, 18, 0.5)).toBe(35);
  });

  test('0 scroll → start stop, end → end stop', () => {
    expect(Split.scrollProgressToSplitPct(0)).toBe(Split.SPLIT_PCT_START);
    expect(Split.scrollProgressToSplitPct(1)).toBe(Split.SPLIT_PCT_END);
    expect(Split.scrollProgressToSplitPct(-1)).toBe(Split.SPLIT_PCT_START);
    expect(Split.scrollProgressToSplitPct(2)).toBe(Split.SPLIT_PCT_END);
  });

  test('intent: mid-ish dark share at top, light-dominant at bottom', () => {
    const top = Split.scrollProgressToSplitPct(0);
    const bottom = Split.scrollProgressToSplitPct(1);
    expect(top).toBeGreaterThanOrEqual(45);
    expect(top).toBeLessThanOrEqual(60);
    expect(bottom).toBeLessThanOrEqual(25);
  });

  test('stop decreases monotonically as progress increases', () => {
    const a = Split.scrollProgressToSplitPct(0);
    const b = Split.scrollProgressToSplitPct(0.25);
    const c = Split.scrollProgressToSplitPct(0.5);
    const d = Split.scrollProgressToSplitPct(0.75);
    const e = Split.scrollProgressToSplitPct(1);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(d);
    expect(d).toBeGreaterThan(e);
  });

  test('computeScrollProgress maps scrollY into 0..1', () => {
    expect(Split.computeScrollProgress(0, 2000, 800)).toBe(0);
    expect(Split.computeScrollProgress(1200, 2000, 800)).toBe(1);
    expect(Split.computeScrollProgress(600, 2000, 800)).toBeCloseTo(0.5, 5);
    expect(Split.computeScrollProgress(10, 100, 100)).toBe(1);
  });

  test('scroll → percent end-to-end', () => {
    const progress = Split.computeScrollProgress(0, 3000, 800);
    expect(Split.scrollProgressToSplitPct(progress)).toBe(Split.SPLIT_PCT_START);
    const end = Split.computeScrollProgress(2200, 3000, 800);
    expect(Split.scrollProgressToSplitPct(end)).toBe(Split.SPLIT_PCT_END);
  });
});

describe('buildSplitGradient / parse / flags', () => {
  test('angle makes the edge run top-right to bottom-left', () => {
    expect(Split.SPLIT_ANGLE).toBe('to top left');
  });

  test('hard-stop gradient string (dark left / light right)', () => {
    expect(Split.buildSplitGradient('#000000', '#ffffff', 52)).toBe(
      'linear-gradient(to top left, #ffffff 0%, #ffffff 48%, #000000 48%, #000000 100%)'
    );
    expect(Split.buildSplitGradient('#001f3f', '#b3d9ff', 'var(--aura-split-pct)')).toBe(
      'linear-gradient(to top left, #b3d9ff 0%, #b3d9ff calc(100% - var(--aura-split-pct)), #001f3f calc(100% - var(--aura-split-pct)), #001f3f 100%)'
    );
  });

  test('parseSplitColors from gradient string and object', () => {
    expect(
      Split.parseSplitColors('linear-gradient(135deg, #000000 0%, #ffffff 100%)')
    ).toEqual({ dark: '#000000', light: '#ffffff' });
    expect(
      Split.parseSplitColors({ background: '#001f3f', light: '#b3d9ff' })
    ).toEqual({ dark: '#001f3f', light: '#b3d9ff' });
  });

  test('isSplitTheme / isMonochromeSplit', () => {
    expect(Split.isSplitTheme({ backgroundType: 'split', backgroundGradient: 'x' })).toBe(true);
    expect(Split.isSplitTheme({ backgroundType: 'color' })).toBe(false);
    expect(Split.isSplitTheme({
      id: 'monochrome',
      backgroundGradient: 'linear-gradient(to top left, #000000 0%, #ffffff 100%)',
    })).toBe(true);
    expect(Split.isMonochromeSplit({ id: 'monochrome' })).toBe(true);
    expect(Split.isMonochromeSplit({
      backgroundType: 'split',
      backgroundGradient: 'linear-gradient(to top left, #001f3f 0%, #b3d9ff 100%)',
    })).toBe(false);
    expect(Split.isMonochromeSplit({
      backgroundType: 'split',
      backgroundGradient: 'linear-gradient(to top left, #000000 0%, #ffffff 100%)',
    })).toBe(true);
  });
});
