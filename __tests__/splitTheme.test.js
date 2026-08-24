'use strict';

const path = require('path');
const Split = require(path.join(
  __dirname,
  '../ios/TintExtension Extension/Resources/splitTheme.js'
));

/**
 * Live Safari paint: html + html::before at 100lvh / 105deg so the edge
 * meets the top of the screen and toolbar-hide does not leave a gap.
 * Text uses background-clip, not mix-blend (iOS will not invert).
 */
describe('buildSplitGradient / parse / flags', () => {
  test('live paint is 100lvh and 105deg, not inset-stretched', () => {
    const paint = Split.liveSplitBackground('#000000', '#ffffff', 50);
    expect(paint.image).toContain('linear-gradient(105deg');
    expect(paint.size).toBe('100vw 100lvh');
    expect(paint.repeat).toBe('no-repeat');
    expect(paint.position).toBe('fixed');
    const css = Split.liveSplitPaintCss('#000000', '#ffffff', 50);
    expect(css).toContain('html{');
    expect(css).toContain('background-attachment:fixed');
    expect(css).toContain('html::before{');
    expect(css).toContain('position:fixed');
    expect(css).toContain('height:100lvh');
    expect(css).not.toContain('bottom:0');
    expect(Split.SPLIT_INVERT_TEXT).toBe('#ffffff');
  });

  test('text fill is white on the dark wedge and black on the light wedge', () => {
    const fill = Split.liveSplitTextGradient(50);
    expect(fill).toBe(
      'linear-gradient(105deg, #ffffff 0%, #ffffff 50%, #000000 50%, #000000 100%)'
    );
    const css = Split.liveSplitTextFillCss(fill);
    expect(css).toContain('background-clip:text');
    expect(css).toContain('-webkit-text-fill-color:transparent');
    expect(css).toContain('100lvh');
  });

  test('clip-path helpers remain for previews', () => {
    const clip = Split.buildDarkClipPath(Split.SPLIT_PCT_START);
    expect(clip).toMatch(/^polygon\(/);
    expect(Split.buildSplitGradient('#000000', '#ffffff', 52)).toContain('linear-gradient');
  });

  test('angle hits the top edge on a tall phone, not the right edge', () => {
    expect(Split.SPLIT_ANGLE).toBe('105deg');
    expect(Split.SPLIT_PCT_START).toBe(50);
  });

  test('buildDarkClipPath maps pct to corner triangle', () => {
    expect(Split.buildDarkClipPath(50)).toBe('polygon(0 0, 100% 0, 0 100%)');
    expect(Split.buildDarkClipPath(52)).toBe('polygon(0 0, 104% 0, 0 104%)');
  });

  test('hard-stop gradient string (dark left / light right)', () => {
    expect(Split.buildSplitGradient('#000000', '#ffffff', 50)).toBe(
      'linear-gradient(105deg, #000000 0%, #000000 50%, #ffffff 50%, #ffffff 100%)'
    );
    expect(Split.buildSplitGradient('#001f3f', '#b3d9ff', 'var(--aura-split-pct)')).toBe(
      'linear-gradient(105deg, #001f3f 0%, #001f3f var(--aura-split-pct), #b3d9ff var(--aura-split-pct), #b3d9ff 100%)'
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

  test('isSplitTheme is disabled; isSplitThemeRecord still detects leftover duals', () => {
    expect(Split.LIVE_SPLIT_ENABLED).toBe(false);
    expect(Split.isSplitTheme({ backgroundType: 'split', backgroundGradient: 'x' })).toBe(false);
    expect(Split.isSplitThemeRecord({ backgroundType: 'split', backgroundGradient: 'x' })).toBe(true);
    expect(Split.isSplitTheme({ backgroundType: 'color' })).toBe(false);
    expect(Split.isSplitThemeRecord({
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
