/**
 * @jest-environment jsdom
 */
'use strict';

const path = require('path');
const H = require(path.join(
  __dirname,
  '../ios/TintExtension Extension/Resources/themeHeuristics.js'
));

describe('parseCssRgb / relativeLuminance / isNearWhiteSurface', () => {
  test('parses rgb and rgba', () => {
    expect(H.parseCssRgb('rgb(255, 255, 255)')).toEqual({
      r: 255, g: 255, b: 255, a: 1,
    });
    expect(H.parseCssRgb('rgba(10,20,30,0.5)')).toEqual({
      r: 10, g: 20, b: 30, a: 0.5,
    });
    expect(H.parseCssRgb('transparent')).toBeNull();
  });

  test('white and near-white clear; mid tones and brand blues do not', () => {
    expect(H.isNearWhiteSurface(H.parseCssRgb('rgb(255,255,255)'))).toBe(true);
    expect(H.isNearWhiteSurface(H.parseCssRgb('rgb(250,250,250)'))).toBe(true);
    expect(H.isNearWhiteSurface(H.parseCssRgb('rgb(128,128,128)'))).toBe(false);
    // Wikipedia infobox header #B2C8FF
    expect(H.isNearWhiteSurface(H.parseCssRgb('rgb(178,200,255)'))).toBe(false);
    expect(H.isNearWhiteSurface(H.parseCssRgb('rgba(255,255,255,0.5)'))).toBe(false);
  });

  test('relative luminance of white is 1', () => {
    expect(H.relativeLuminance(255, 255, 255)).toBeCloseTo(1, 5);
  });
});

describe('contrast helpers', () => {
  test('parseHexColor handles 6 and 3 digit hex', () => {
    expect(H.parseHexColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(H.parseHexColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(H.parseHexColor('nope')).toBeNull();
  });

  test('pickReadableAgainstBoth keeps preferred when it works on both wedges', () => {
    const picked = H.pickReadableAgainstBoth('#ffffff', '#000000', '#333333', 3.0);
    expect(picked.toLowerCase()).toBe('#ffffff');
  });

  test('pickReadableAgainstBoth falls back when preferred fails both wedges', () => {
    const picked = H.pickReadableAgainstBoth('#808080', '#000000', '#ffffff', 4.5);
    expect(['#ffffff', '#000000']).toContain(picked.toLowerCase());
  });

  test('hasPoorContrast detects black on near-black', () => {
    const fg = H.parseCssRgb('rgb(20,20,20)');
    const bg = H.parseCssRgb('rgb(0,0,0)');
    expect(H.hasPoorContrast(fg, bg, 3.0)).toBe(true);
    const white = H.parseCssRgb('rgb(255,255,255)');
    expect(H.hasPoorContrast(white, bg, 3.0)).toBe(false);
  });
});

describe('shouldSkipBrightElement', () => {
  test('skips controls, icons, tiny tiles, overlays, floaters', () => {
    expect(H.shouldSkipBrightElement({ tag: 'BUTTON', width: 100, height: 40 })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', role: 'button', width: 100, height: 40,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', className: 'nav-icon', width: 100, height: 40,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 20, height: 20,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 200, height: 80, overlayRoot: true,
    })).toBe(true);
    // Descendants inside dialogs are NOT skipped — white inners may clear.
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 200, height: 80, overlayRoot: false,
    })).toBe(false);
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 200, height: 80, floatingBannerRoot: true,
    })).toBe(true);
  });

  test('overlay root skipped; overlay descendant may clear', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 280, height: 160, overlayRoot: true,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 260, height: 40, overlayRoot: false,
    })).toBe(false);
  });

  test('floating banner root skipped so sheet stays opaque', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 400, height: 72, floatingBannerRoot: true,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 360, height: 48, floatingBannerRoot: false,
    })).toBe(false);
  });

  test('allows large near-white content surfaces', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 300, height: 120, visibility: 'visible', opacity: '1',
      mask: 'none',
    })).toBe(false);
  });

  test('still skips small role=button chips', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', role: 'button', width: 100, height: 40,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', role: 'button', width: 80, height: 36, hasSearchField: true,
    })).toBe(true);
  });

  test('does not skip large role=button composer shells with a search field', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'DIV',
      role: 'button',
      hasSearchField: true,
      width: 320,
      height: 52,
      visibility: 'visible',
      opacity: '1',
      mask: 'none',
    })).toBe(false);
  });

  test('never clears html or body', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'HTML', width: 400, height: 800,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'BODY', width: 400, height: 800,
    })).toBe(true);
  });

  test('icon-sized svg stays skipped (glyph colors protected)', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'SVG', width: 24, height: 24,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'SVG', width: 47, height: 200,
    })).toBe(true);
  });

  test('large svg is eligible for background-color clearing, not blanket-skipped', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'SVG', width: 96, height: 133, visibility: 'visible', opacity: '1', mask: 'none',
    })).toBe(false);
  });

  test('a large svg is still skipped if it fails another gate (overlay root, hidden, etc.)', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'SVG', width: 96, height: 133, overlayRoot: true,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'SVG', width: 96, height: 133, visibility: 'hidden',
    })).toBe(true);
  });

  test('elements nested inside an svg (paths/rects) stay skipped regardless of size', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'RECT', width: 96, height: 133, inSvg: true, visibility: 'visible', opacity: '1', mask: 'none',
    })).toBe(true);
  });
});

describe('near-white thresholds', () => {
  test('lum 0.90 boundary and alpha gate', () => {
    // Pure white clears
    expect(H.isNearWhiteSurface({ r: 255, g: 255, b: 255, a: 1 })).toBe(true);
    // Slightly off-white still clears
    expect(H.isNearWhiteSurface({ r: 245, g: 245, b: 245, a: 0.9 })).toBe(true);
    // Semi-transparent white does not
    expect(H.isNearWhiteSurface({ r: 255, g: 255, b: 255, a: 0.84 })).toBe(false);
    // Mid gray does not
    expect(H.isNearWhiteSurface({ r: 200, g: 200, b: 200, a: 1 })).toBe(false);
  });
});

describe('shouldSkipStickyElement', () => {
  test('keeps short chrome bars', () => {
    expect(H.shouldSkipStickyElement({
      position: 'sticky',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 56,
      vh: 800,
      vw: 400,
    })).toBe(false);
    expect(H.shouldSkipStickyElement({
      position: 'sticky',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 130,
      top: 0,
      left: 0,
      vh: 800,
      vw: 400,
    })).toBe(false);
  });

  test('skips full-viewport curtains and overlay chrome', () => {
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 800,
      vh: 800,
      vw: 400,
    })).toBe(true);
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 300,
      height: 80,
      vh: 800,
      vw: 400,
      overlayChrome: true,
    })).toBe(true);
  });

  test('skips covering sheets below the 85% fullscreen gate', () => {
    // 100% × 80% — fox5 / CMP wrapper class of curtain
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 640,
      top: 0,
      left: 0,
      vh: 800,
      vw: 400,
    })).toBe(true);
    // Visible intersection of a tall sticky hero still covering the fold
    expect(H.shouldSkipStickyElement({
      position: 'sticky',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 1600,
      top: -200,
      left: 0,
      vh: 800,
      vw: 400,
    })).toBe(true);
  });

  test('skips taller-than-chrome fixed layers and overlay-tier z-index', () => {
    // Video float / mid-size promo (~40% vh) — under covering-sheet gate but
    // taller than top-chrome; must not be painted as --aura-bg.
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 344,
      top: 64,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '1000',
    })).toBe(true);
    // OneSignal / OneTrust tier
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 178,
      top: 0,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '2147483647',
    })).toBe(true);
    // Real chrome bar still paints
    expect(H.shouldSkipStickyElement({
      position: 'sticky',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 130,
      top: 0,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '7',
    })).toBe(false);
  });

  test('semantic header/nav tags get the taller TOP_CHROME_MAX_VH_SEMANTIC allowance', () => {
    // Same ~41% vh height as the video-float case above, but tagged HEADER —
    // a multi-row university/publisher header, not a curtain. Must paint.
    expect(H.shouldSkipStickyElement({
      tag: 'HEADER',
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 344,
      top: 0,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '7',
    })).toBe(false);
    // Beyond even the relaxed 0.55 cap — still skipped regardless of tag.
    expect(H.shouldSkipStickyElement({
      tag: 'HEADER',
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 500,
      top: 0,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '7',
    })).toBe(true);
  });

  test('skips AMP consent / sticky-ad / popupOverlay chrome', () => {
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      tag: 'AMP-STICKY-AD',
      width: 390,
      height: 54,
      top: 790,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '11',
    })).toBe(true);
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      tag: 'DIV',
      id: 'myConsentFlow',
      className: 'popupOverlay',
      width: 390,
      height: 200,
      top: 0,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: 'auto',
    })).toBe(true);
  });

  test('skips fixed media shells', () => {
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      tag: 'IFRAME',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 300,
      height: 80,
      vh: 800,
      vw: 400,
    })).toBe(true);
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      tag: 'VIDEO',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 300,
      height: 80,
      vh: 800,
      vw: 400,
    })).toBe(true);
  });

  test('skips invisible and non-fixed/sticky', () => {
    expect(H.shouldSkipStickyElement({
      position: 'relative', width: 100, height: 40, vh: 800, vw: 400,
    })).toBe(true);
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      visibility: 'hidden',
      opacity: '1',
      width: 100,
      height: 40,
      vh: 800,
      vw: 400,
    })).toBe(true);
  });
});

describe('isCoveringSheetRect', () => {
  test('matches wide tall visible sheets', () => {
    expect(H.isCoveringSheetRect(
      { width: 400, height: 640, top: 0, left: 0 }, 800, 400
    )).toBe(true);
    expect(H.isCoveringSheetRect(
      { width: 100, height: 640, top: 0, left: 0 }, 800, 400
    )).toBe(false);
    expect(H.isCoveringSheetRect(
      { width: 400, height: 200, top: 0, left: 0 }, 800, 400
    )).toBe(false);
  });
});

describe('isTopChromeBarInfo', () => {
  const vh = 800;
  const vw = 400;
  const bar = {
    tag: 'HEADER',
    role: null,
    hasSearchField: false,
    top: 0,
    width: 400,
    height: 140,
    vh,
    vw,
    visibility: 'visible',
    opacity: '1',
  };

  test('matches a full-width top header / search bar', () => {
    expect(H.isTopChromeBarInfo(bar)).toBe(true);
    expect(H.isTopChromeBarInfo({
      ...bar, tag: 'DIV', role: 'search', hasSearchField: true, height: 76,
    })).toBe(true);
  });

  test('rejects page-sized shells and mid-page cards', () => {
    expect(H.isTopChromeBarInfo({
      ...bar, height: 700,
    })).toBe(false);
    expect(H.isTopChromeBarInfo({
      ...bar, top: 240, tag: 'DIV', hasSearchField: true,
    })).toBe(false);
    expect(H.isTopChromeBarInfo({
      ...bar, tag: 'DIV', hasSearchField: false, role: null,
    })).toBe(false);
  });

  test('semantic header/nav tags get a taller allowance (TOP_CHROME_MAX_VH_SEMANTIC 0.55)', () => {
    // ~45% of 800px — beyond the generic 0.32 cap but within the 0.55
    // semantic-tag allowance (multi-row university/publisher headers).
    expect(H.isTopChromeBarInfo({
      ...bar, height: 360,
    })).toBe(true);
    expect(H.isTopChromeBarInfo({
      ...bar, tag: 'NAV', height: 360,
    })).toBe(true);
    // ~60% of 800px — too tall even for the relaxed semantic cap.
    expect(H.isTopChromeBarInfo({
      ...bar, height: 480,
    })).toBe(false);
  });

  test('rejects tall non-semantic bars beyond TOP_CHROME_MAX_VH (0.32)', () => {
    // ~45% of 800px — too tall for a role/search-field-matched DIV, which
    // keeps the tighter generic cap (no <header>/<nav> tag signal).
    expect(H.isTopChromeBarInfo({
      ...bar, tag: 'DIV', role: 'search', hasSearchField: true, height: 360,
    })).toBe(false);
    // Still within 0.32 * 800 = 256
    expect(H.isTopChromeBarInfo({
      ...bar, tag: 'DIV', role: 'search', hasSearchField: true, height: 240,
    })).toBe(true);
  });
});

describe('isLightContentSurface', () => {
  test('clears light gray and off-white; skips mid gray and brand color', () => {
    expect(H.isLightContentSurface(H.parseCssRgb('rgb(255,255,255)'))).toBe(true);
    expect(H.isLightContentSurface(H.parseCssRgb('rgb(232,232,232)'))).toBe(true);
    expect(H.isLightContentSurface(H.parseCssRgb('rgb(200,200,200)'))).toBe(true);
    expect(H.isLightContentSurface(H.parseCssRgb('rgb(128,128,128)'))).toBe(false);
    // Saturated brand blue
    expect(H.isLightContentSurface(H.parseCssRgb('rgb(0,122,255)'))).toBe(false);
    // Wikipedia infobox header #B2C8FF
    expect(H.isLightContentSurface(H.parseCssRgb('rgb(178,200,255)'))).toBe(false);
    expect(H.isLightContentSurface(H.parseCssRgb('rgba(232,232,232,0.5)'))).toBe(true);
    expect(H.isLightContentSurface(H.parseCssRgb('rgba(232,232,232,0.4)'))).toBe(true);
    expect(H.isLightContentSurface(H.parseCssRgb('rgba(232,232,232,0.2)'))).toBe(false);
  });
});

describe('isLikelyModalCardInfo', () => {
  const base = {
    position: 'fixed',
    zIndex: 20,
    visibility: 'visible',
    opacity: '1',
    width: 320,
    height: 220,
    vh: 800,
    vw: 400,
    textLength: 40,
    hasAction: true,
  };

  test('accepts a centered promo card', () => {
    expect(H.isLikelyModalCardInfo(base)).toBe(true);
  });

  test('rejects a full-viewport scrim', () => {
    expect(H.isLikelyModalCardInfo({
      ...base, width: 400, height: 800,
    })).toBe(false);
  });

  test('rejects a covering-sheet wrapper that is not quite fullscreen', () => {
    expect(H.isLikelyModalCardInfo({
      ...base, width: 400, height: 640, top: 0, left: 0,
    })).toBe(false);
    expect(H.isInnerModalCardInfo({
      ...base, width: 400, height: 640, top: 0, left: 0,
    })).toBe(false);
  });

  test('accepts a mid-size bottom sheet under a scrim', () => {
    expect(H.isInnerModalCardInfo({
      ...base, position: 'relative', width: 360, height: 320, top: 400, left: 20,
    })).toBe(true);
  });

  test('rejects a short sticky header', () => {
    expect(H.isLikelyModalCardInfo({
      ...base, position: 'sticky', height: 56, textLength: 4, hasAction: false,
    })).toBe(false);
    expect(H.isLikelyModalCardInfo({
      ...base, position: 'fixed', height: 56, textLength: 4, hasAction: false,
    })).toBe(false);
  });

  test('rejects absolute carousel / shopping tiles', () => {
    expect(H.isLikelyModalCardInfo({
      ...base, position: 'absolute', zIndex: 2,
    })).toBe(false);
  });

  test('rejects search / AI composer chrome', () => {
    expect(H.isLikelyModalCardInfo({
      ...base, height: 96, hasSearchField: true, textLength: 12,
    })).toBe(false);
    expect(H.isSearchChromeInfo({
      role: 'search', height: 64, hasSearchField: true,
    })).toBe(true);
  });

  test('inner card under a scrim may be in-flow', () => {
    expect(H.isInnerModalCardInfo({
      ...base, position: 'relative', zIndex: 'auto',
    })).toBe(true);
  });
});

describe('isLikelyNavDrawerInfo', () => {
  const vh = 800;
  const vw = 400;

  test('accepts a full-screen <nav> hamburger drawer', () => {
    expect(H.isLikelyNavDrawerInfo({
      position: 'fixed',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 800,
      vh, vw,
      isNavTagOrRole: true,
    })).toBe(true);
  });

  test('accepts a side drawer (80% width, full height) via role="navigation"', () => {
    expect(H.isLikelyNavDrawerInfo({
      position: 'fixed',
      visibility: 'visible',
      opacity: '1',
      width: 320,
      height: 800,
      vh, vw,
      isNavTagOrRole: true,
    })).toBe(true);
  });

  test('accepts a plain DIV drawer with a real list of nav links (>= 5)', () => {
    expect(H.isLikelyNavDrawerInfo({
      position: 'fixed',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 800,
      vh, vw,
      linkCount: 6,
    })).toBe(true);
  });

  test('rejects a covering DIV with no nav signal at all (curtain shape only)', () => {
    expect(H.isLikelyNavDrawerInfo({
      position: 'fixed',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 800,
      vh, vw,
    })).toBe(false);
  });

  test('rejects a CMP-style surface with a few buttons, not a real link list', () => {
    // OneTrust / cookie banners commonly have 2-4 buttons, well under the
    // NAV_DRAWER_MIN_LINKS (5) bar, and no <nav> tag or role.
    expect(H.isLikelyNavDrawerInfo({
      position: 'fixed',
      visibility: 'visible',
      opacity: '1',
      width: 400,
      height: 800,
      vh, vw,
      linkCount: 3,
    })).toBe(false);
  });

  test('rejects a small account/user dropdown even with nav semantics', () => {
    expect(H.isLikelyNavDrawerInfo({
      position: 'fixed',
      visibility: 'visible',
      opacity: '1',
      width: 100,
      height: 150,
      vh, vw,
      isNavTagOrRole: true,
    })).toBe(false);
  });

  test('rejects hidden / invisible / non-fixed elements', () => {
    expect(H.isLikelyNavDrawerInfo({
      position: 'fixed', visibility: 'hidden', opacity: '1',
      width: 400, height: 800, vh, vw, isNavTagOrRole: true,
    })).toBe(false);
    expect(H.isLikelyNavDrawerInfo({
      position: 'fixed', visibility: 'visible', opacity: '0',
      width: 400, height: 800, vh, vw, isNavTagOrRole: true,
    })).toBe(false);
    expect(H.isLikelyNavDrawerInfo({
      position: 'static', visibility: 'visible', opacity: '1',
      width: 400, height: 800, vh, vw, isNavTagOrRole: true,
    })).toBe(false);
  });
});

describe('isNavDrawerCollapsedInfo', () => {
  const vh = 800;
  const vw = 400;

  test('display:none / hidden attribute / aria-hidden are collapsed', () => {
    expect(H.isNavDrawerCollapsedInfo({ display: 'none', width: 400, height: 800, vh, vw })).toBe(true);
    expect(H.isNavDrawerCollapsedInfo({ hiddenAttr: true, width: 400, height: 800, vh, vw })).toBe(true);
    expect(H.isNavDrawerCollapsedInfo({ ariaHidden: true, width: 400, height: 800, vh, vw })).toBe(true);
  });

  test('visibility:hidden / near-zero opacity are collapsed', () => {
    expect(H.isNavDrawerCollapsedInfo({ visibility: 'hidden', width: 400, height: 800, vh, vw })).toBe(true);
    expect(H.isNavDrawerCollapsedInfo({ opacity: '0', width: 400, height: 800, vh, vw })).toBe(true);
  });

  test('fully off-screen is collapsed even at full drawer size', () => {
    expect(H.isNavDrawerCollapsedInfo({ offscreen: true, width: 400, height: 800, vh, vw })).toBe(true);
  });

  test('near-zero width/height is collapsed', () => {
    expect(H.isNavDrawerCollapsedInfo({ width: 0, height: 800, vh, vw })).toBe(true);
    expect(H.isNavDrawerCollapsedInfo({ width: 400, height: 0, vh, vw })).toBe(true);
  });

  test('confidently tiny relative to viewport (<=5%) is collapsed', () => {
    expect(H.isNavDrawerCollapsedInfo({ width: 10, height: 20, vh, vw })).toBe(true);
  });

  test('a mid-transition size (dead zone, above 5% below 30%) is NOT collapsed', () => {
    expect(H.isNavDrawerCollapsedInfo({ width: 100, height: 150, vh, vw })).toBe(false);
  });

  test('a fully expanded size is NOT collapsed', () => {
    expect(H.isNavDrawerCollapsedInfo({ width: 400, height: 800, vh, vw, visibility: 'visible', opacity: '1' })).toBe(false);
  });
});

describe('classifyNavDrawerStateInfo', () => {
  const vh = 800;
  const vw = 400;

  test('a full expanded drawer shape classifies as expanded', () => {
    expect(H.classifyNavDrawerStateInfo({
      position: 'fixed', visibility: 'visible', opacity: '1',
      width: 400, height: 800, vh, vw, isNavTagOrRole: true,
    })).toBe('expanded');
  });

  test('a hidden/offscreen/tiny shape classifies as collapsed', () => {
    expect(H.classifyNavDrawerStateInfo({
      display: 'none', width: 400, height: 800, vh, vw, isNavTagOrRole: true,
    })).toBe('collapsed');
    expect(H.classifyNavDrawerStateInfo({
      offscreen: true, width: 400, height: 800, vh, vw, isNavTagOrRole: true,
    })).toBe('collapsed');
    expect(H.classifyNavDrawerStateInfo({
      width: 5, height: 5, vh, vw, isNavTagOrRole: true,
    })).toBe('collapsed');
  });

  test('a mid-transition size with nav signal is ambiguous', () => {
    expect(H.classifyNavDrawerStateInfo({
      position: 'fixed', visibility: 'visible', opacity: '1',
      width: 100, height: 150, vh, vw, isNavTagOrRole: true,
    })).toBe('ambiguous');
  });

  test('regression: an ambient position:relative nav bar (wtatennis.com shape) is ambiguous, never expanded', () => {
    // wtatennis.com's <nav class="main-navigation"> is position:relative by
    // default and only ever becomes position:sticky via the site's own
    // scroll-driven class toggle — it never undergoes a hidden/collapsed ->
    // visible/expanded transition the way a real drawer opening does. It
    // must never classify as 'expanded' regardless of its full-width size.
    expect(H.classifyNavDrawerStateInfo({
      position: 'relative', visibility: 'visible', opacity: '1',
      width: 400, height: 60, vh, vw, isNavTagOrRole: true,
    })).toBe('ambiguous');
  });
});

describe('isNavDrawerOpenTransition', () => {
  test('first sighting (no prior history) never counts as an open transition', () => {
    expect(H.isNavDrawerOpenTransition(undefined, 'expanded')).toBe(false);
  });

  test('collapsed -> expanded is a genuine open transition', () => {
    expect(H.isNavDrawerOpenTransition('collapsed', 'expanded')).toBe(true);
  });

  test('already expanded does not retrigger', () => {
    expect(H.isNavDrawerOpenTransition('expanded', 'expanded')).toBe(false);
  });

  test('expanded -> collapsed is not an open transition (closing is handled elsewhere)', () => {
    expect(H.isNavDrawerOpenTransition('expanded', 'collapsed')).toBe(false);
  });

  test('collapsed -> collapsed is not an open transition', () => {
    expect(H.isNavDrawerOpenTransition('collapsed', 'collapsed')).toBe(false);
  });

  test('an ambiguous prior reading can never stand in for a confirmed collapsed baseline', () => {
    expect(H.isNavDrawerOpenTransition('ambiguous', 'expanded')).toBe(false);
  });
});

describe('isLikelyNavMenuPanelInfo / classifyNavMenuPanelStateInfo', () => {
  // Position-agnostic counterpart to isLikelyNavDrawerInfo, for menus that
  // expand in place (e.g. Bootstrap's .navbar-collapse) rather than as a
  // position:fixed/sticky overlay — the UC Davis OASIS shape.

  test('accepts a real <nav>-tagged panel with no position at all', () => {
    expect(H.isLikelyNavMenuPanelInfo({
      visibility: 'visible', opacity: '1', width: 300, height: 400,
      isNavTagOrRole: true,
    })).toBe(true);
  });

  test('accepts a div containing a nav descendant', () => {
    expect(H.isLikelyNavMenuPanelInfo({
      visibility: 'visible', opacity: '1', width: 200, height: 300,
      hasNavDescendant: true,
    })).toBe(true);
  });

  test('accepts a plain panel with a real list of nav links (>= 5), no nav tag/role/descendant', () => {
    // The Bootstrap ".navbar-collapse" shape: a plain <ul>/<div> of <li><a>
    // items with no <nav> wrapper or descendant of its own.
    expect(H.isLikelyNavMenuPanelInfo({
      visibility: 'visible', opacity: '1', width: 300, height: 400,
      linkCount: 5,
    })).toBe(true);
  });

  test('rejects a panel with only a couple of links (below the 5-link floor) and no nav tag/role', () => {
    expect(H.isLikelyNavMenuPanelInfo({
      visibility: 'visible', opacity: '1', width: 300, height: 400,
      linkCount: 3,
    })).toBe(false);
  });

  test('rejects a thin full-width bar even with nav semantics (height floor)', () => {
    // The wtatennis.com shape: a full-width sticky nav bar is not a
    // multi-item dropdown panel and must never qualify here.
    expect(H.isLikelyNavMenuPanelInfo({
      visibility: 'visible', opacity: '1', width: 400, height: 60,
      isNavTagOrRole: true,
    })).toBe(false);
  });

  test('rejects a narrow tall sliver even with nav semantics (width floor)', () => {
    expect(H.isLikelyNavMenuPanelInfo({
      visibility: 'visible', opacity: '1', width: 50, height: 400,
      isNavTagOrRole: true,
    })).toBe(false);
  });

  test('classifyNavMenuPanelStateInfo: display:none is collapsed, full panel is expanded', () => {
    expect(H.classifyNavMenuPanelStateInfo({
      display: 'none', width: 300, height: 400, isNavTagOrRole: true,
    })).toBe('collapsed');
    expect(H.classifyNavMenuPanelStateInfo({
      visibility: 'visible', opacity: '1', width: 300, height: 400, isNavTagOrRole: true,
    })).toBe('expanded');
  });

  test('classifyNavMenuPanelStateInfo: a mid-size shape is ambiguous, not collapsed or expanded', () => {
    expect(H.classifyNavMenuPanelStateInfo({
      visibility: 'visible', opacity: '1', width: 60, height: 40, isNavTagOrRole: true,
    })).toBe('ambiguous');
  });

  test('regression: the wtatennis.com thin-bar shape is ambiguous here too, never expanded', () => {
    expect(H.classifyNavMenuPanelStateInfo({
      visibility: 'visible', opacity: '1', width: 400, height: 60, isNavTagOrRole: true,
    })).toBe('ambiguous');
  });
});

describe('isLikelyNavMenuInfo', () => {
  // No position field at all — WordPress/Divi-style dropdowns commonly
  // expand in place (static/relative/absolute), not as a fixed overlay.
  test('accepts a <nav>-tagged or role="navigation" dropdown regardless of position', () => {
    expect(H.isLikelyNavMenuInfo({
      visibility: 'visible', opacity: '1', width: 300, height: 400,
      isNavTagOrRole: true,
    })).toBe(true);
  });

  test('accepts a plain UL/DIV submenu with a real list of links (>= 3)', () => {
    expect(H.isLikelyNavMenuInfo({
      visibility: 'visible', opacity: '1', width: 200, height: 150,
      linkCount: 4,
    })).toBe(true);
  });

  test('accepts an element that wraps a <nav> descendant', () => {
    expect(H.isLikelyNavMenuInfo({
      visibility: 'visible', opacity: '1', width: 300, height: 60,
      hasNavDescendant: true,
    })).toBe(true);
  });

  test('rejects with no nav signal at all', () => {
    expect(H.isLikelyNavMenuInfo({
      visibility: 'visible', opacity: '1', width: 300, height: 400,
    })).toBe(false);
  });

  test('rejects a CMP-style surface with only 2 buttons, not a real link list', () => {
    expect(H.isLikelyNavMenuInfo({
      visibility: 'visible', opacity: '1', width: 300, height: 150,
      linkCount: 2,
    })).toBe(false);
  });

  test('rejects a tiny sliver or hidden/invisible element', () => {
    expect(H.isLikelyNavMenuInfo({
      visibility: 'visible', opacity: '1', width: 10, height: 5,
      isNavTagOrRole: true,
    })).toBe(false);
    expect(H.isLikelyNavMenuInfo({
      visibility: 'hidden', opacity: '1', width: 300, height: 400,
      isNavTagOrRole: true,
    })).toBe(false);
    expect(H.isLikelyNavMenuInfo({
      visibility: 'visible', opacity: '0', width: 300, height: 400,
      isNavTagOrRole: true,
    })).toBe(false);
  });
});

describe('pickReadableAgainstSurface', () => {
  test('white-on-light-gray picks black, not theme white', () => {
    const lightGray = H.parseCssRgb('rgb(232,232,232)');
    expect(H.pickReadableAgainstSurface(lightGray, '#ffffff', 3.0).toLowerCase())
      .toBe('#000000');
  });

  test('keeps preferred when it already contrasts', () => {
    const dark = H.parseCssRgb('rgb(20,20,20)');
    expect(H.pickReadableAgainstSurface(dark, '#ffffff', 3.0).toLowerCase())
      .toBe('#ffffff');
  });
});

describe('background-image classification', () => {
  test('gradients clear; url() photos do not', () => {
    expect(H.isGradientBackgroundImage('linear-gradient(#111, #333)')).toBe(true);
    expect(H.isGradientBackgroundImage('radial-gradient(circle, #000, #444)')).toBe(true);
    expect(H.isGradientBackgroundImage('url("https://cdn.example/hero.jpg")')).toBe(false);
    expect(H.isPhotographicBackgroundImage('url("https://cdn.example/hero.jpg")')).toBe(true);
    expect(H.isPhotographicBackgroundImage('linear-gradient(#111, #333)')).toBe(false);
    expect(H.isGradientBackgroundImage('none')).toBe(false);
  });

  test('shouldClearLayoutGradient on large layout nodes, never url()', () => {
    expect(H.shouldClearLayoutGradient({
      tag: 'DIV',
      width: 320,
      height: 180,
      vh: 800,
      vw: 400,
      backgroundImage: 'linear-gradient(#fff, #eee)',
    })).toBe(true);
    expect(H.shouldClearLayoutGradient({
      tag: 'APP-MAIN',
      width: 400,
      height: 500,
      vh: 800,
      vw: 400,
      backgroundImage: 'linear-gradient(#111, #222)',
    })).toBe(true);
    expect(H.shouldClearLayoutGradient({
      tag: 'DIV',
      width: 320,
      height: 180,
      vh: 800,
      vw: 400,
      backgroundImage: 'url("https://cdn.example/hero.jpg")',
    })).toBe(false);
    expect(H.isCustomLayoutElement({
      tag: 'APP-MAIN', width: 400, height: 500, vh: 800, vw: 400,
    })).toBe(true);
    expect(H.isCustomElementTag('APP-MAIN')).toBe(true);
    expect(H.isCustomElementTag('DIV')).toBe(false);
  });

  test('never clears html or body gradients', () => {
    const rootGrad = {
      width: 400,
      height: 800,
      vh: 800,
      vw: 400,
      backgroundImage: 'linear-gradient(135deg, #000000 0%, #000000 52%, #ffffff 52%, #ffffff 100%)',
    };
    expect(H.shouldClearLayoutGradient({ ...rootGrad, tag: 'HTML' })).toBe(false);
    expect(H.shouldClearLayoutGradient({ ...rootGrad, tag: 'BODY' })).toBe(false);
    expect(H.shouldClearShellBackground({ ...rootGrad, tag: 'HTML', opaqueFill: true })).toBe(false);
    expect(H.shouldClearShellBackground({ ...rootGrad, tag: 'BODY', opaqueFill: true })).toBe(false);
  });

  test('does not clear AI Overview collapse-fade overlays', () => {
    const fade = {
      tag: 'DIV',
      width: 358,
      height: 120,
      vh: 844,
      vw: 390,
      backgroundImage: 'linear-gradient(transparent, rgb(34, 36, 42))',
      opaqueFill: false,
    };
    expect(H.shouldClearLayoutGradient(fade)).toBe(true);
    expect(H.shouldClearLayoutGradient({ ...fade, collapseFade: true })).toBe(false);
    expect(H.shouldClearShellBackground(fade)).toBe(true);
    expect(H.shouldClearShellBackground({ ...fade, collapseFade: true })).toBe(false);
  });
});

describe('SPA shell helpers', () => {
  test('known root ids and large area qualify', () => {
    expect(H.isSpaShellId('app')).toBe(true);
    expect(H.isSpaShellId('app-mount')).toBe(true);
    expect(H.isSpaShellId('__next')).toBe(true);
    expect(H.isSpaShellId('content')).toBe(false);
    expect(H.isLargeLayoutShell({
      id: 'app', width: 10, height: 10, vh: 800, vw: 400,
    })).toBe(true);
    expect(H.isLargeLayoutShell({
      id: '', width: 400, height: 500, vh: 800, vw: 400,
    })).toBe(true);
    expect(H.isLargeLayoutShell({
      id: '', width: 100, height: 40, vh: 800, vw: 400,
    })).toBe(false);
  });

  test('shouldClearShellBackground: gradient and opaque fill; not photos or overlays', () => {
    expect(H.shouldClearShellBackground({
      id: 'app',
      width: 400,
      height: 800,
      vh: 800,
      vw: 400,
      backgroundImage: 'linear-gradient(#313338, #1e1f22)',
      opaqueFill: false,
    })).toBe(true);
    expect(H.shouldClearShellBackground({
      id: 'app',
      width: 400,
      height: 800,
      vh: 800,
      vw: 400,
      backgroundImage: 'none',
      opaqueFill: true,
    })).toBe(true);
    expect(H.shouldClearShellBackground({
      id: 'app',
      width: 400,
      height: 800,
      vh: 800,
      vw: 400,
      backgroundImage: 'url("https://cdn.discordapp.com/bg.png")',
      opaqueFill: true,
    })).toBe(false);
    expect(H.shouldClearShellBackground({
      id: 'app',
      width: 400,
      height: 800,
      vh: 800,
      vw: 400,
      backgroundImage: 'linear-gradient(#000, #111)',
      overlayRoot: true,
    })).toBe(false);
  });
});

describe('isOverlayChrome / isInsideFloatingBanner (jsdom)', () => {
  test('detects dialog roles and descendants', () => {
    document.body.innerHTML = `
      <div role="dialog" id="dlg"><div class="inner" id="inner">Hi</div></div>
      <div role="alertdialog" id="alert">Alert</div>
      <div id="plain">Plain</div>
    `;
    expect(H.isOverlayRoot(document.getElementById('dlg'))).toBe(true);
    expect(H.isOverlayRoot(document.getElementById('inner'))).toBe(false);
    expect(H.isOverlayChrome(document.getElementById('dlg'))).toBe(true);
    expect(H.isOverlayChrome(document.getElementById('inner'))).toBe(true);
    expect(H.isOverlayChrome(document.getElementById('alert'))).toBe(true);
    expect(H.isOverlayChrome(document.getElementById('plain'))).toBe(false);
  });

  test('treats menu and listbox as overlay roots', () => {
    document.body.innerHTML = `
      <div role="menu" id="menu"><button id="mi">Item</button></div>
      <div role="listbox" id="lb"><div role="option" id="opt">One</div></div>
    `;
    expect(H.isOverlayRoot(document.getElementById('menu'))).toBe(true);
    expect(H.isOverlayRoot(document.getElementById('lb'))).toBe(true);
    expect(H.isOverlayRoot(document.getElementById('opt'))).toBe(false);
    expect(H.isOverlayChrome(document.getElementById('mi'))).toBe(true);
    expect(H.isOverlayChrome(document.getElementById('opt'))).toBe(true);
  });

  test('detects non-fullscreen fixed banner roots and ancestors', () => {
    document.body.innerHTML = `
      <div id="banner" style="position:fixed; z-index:100; bottom:0; left:0; right:0; height:80px;">
        <div id="card" style="background:white;">Signed out</div>
      </div>
    `;
    const banner = document.getElementById('banner');
    banner.getBoundingClientRect = () => ({
      width: 400, height: 80, top: 720, left: 0, bottom: 800, right: 400,
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });

    expect(H.isFloatingBannerRoot(banner)).toBe(true);
    expect(H.isFloatingBannerRoot(document.getElementById('card'))).toBe(false);
    expect(H.isInsideFloatingBanner(document.getElementById('card'))).toBe(true);
    expect(H.isInsideFloatingBanner(banner)).toBe(false);
  });

  test('treats native dialog and popover as overlay roots', () => {
    document.body.innerHTML = `
      <dialog id="dlg"><button>OK</button></dialog>
      <div id="tip" popover><button>Close</button></div>
      <div id="plain">Plain</div>
    `;
    expect(H.isOverlayRoot(document.getElementById('dlg'))).toBe(true);
    expect(H.isOverlayRoot(document.getElementById('tip'))).toBe(true);
    expect(H.isOverlayRoot(document.getElementById('plain'))).toBe(false);
    expect(H.isOverlayChrome(document.getElementById('dlg').querySelector('button'))).toBe(true);
  });
});

describe('effectiveBackground (jsdom)', () => {
  test('walks to the first opaque ancestor, else theme hex', () => {
    document.body.innerHTML = `
      <div id="card" style="background-color: rgb(232, 232, 232);">
        <span id="label" style="background-color: transparent;">Zestimate</span>
      </div>
    `;
    const label = document.getElementById('label');
    const card = document.getElementById('card');
    const fromCard = H.effectiveBackground(label, getComputedStyle, '#112233');
    expect(fromCard).toEqual(H.parseCssRgb(getComputedStyle(card).backgroundColor)
      || H.parseCssRgb('rgb(232, 232, 232)'));
    expect(fromCard.r).toBeGreaterThan(200);

    document.body.innerHTML = `<span id="glass" style="background-color: transparent;">Hi</span>`;
    const fallback = H.effectiveBackground(
      document.getElementById('glass'),
      getComputedStyle,
      '#102030'
    );
    expect(fallback).toEqual({ r: 16, g: 32, b: 48, a: 1 });
  });
});

describe('isLikelyModalCard / findInnerModalCard (jsdom)', () => {
  test('finds the inner card under a full-viewport scrim', () => {
    document.body.innerHTML = `
      <div id="scrim" style="position:fixed; z-index:50; inset:0;">
        <div id="sheet" style="position:fixed; z-index:51;">
          Get the full AI Mode experience with the Google app
          <button>Continue</button>
        </div>
      </div>
    `;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
    const scrim = document.getElementById('scrim');
    const sheet = document.getElementById('sheet');
    scrim.getBoundingClientRect = () => ({
      width: 400, height: 800, top: 0, left: 0, bottom: 800, right: 400,
    });
    sheet.getBoundingClientRect = () => ({
      width: 320, height: 240, top: 200, left: 40, bottom: 440, right: 360,
    });

    expect(H.isLikelyModalCard(scrim)).toBe(false);
    expect(H.isLikelyModalCard(sheet)).toBe(true);
    expect(H.findInnerModalCard(scrim)).toBe(sheet);
  });
});

describe('isLikelyNavDrawer / isLikelyNavMenu never override ARIA dialogs (jsdom)', () => {
  // Regression: a CMP preference center (OneTrust et al.) is role="dialog"
  // + aria-modal, full-viewport, position:fixed, and commonly contains many
  // links (privacy policy, vendor list, cookie settings) — everything
  // isLikelyNavDrawer looks for. reopaqueOverlays already correctly makes a
  // covering-sheet dialog transparent; isLikelyNavDrawer must not re-claim
  // it and repaint it into a curtain.
  test('a full-viewport role="dialog" consent center is never a nav drawer', () => {
    document.body.innerHTML = `
      <div id="pc-sdk" role="dialog" aria-modal="true" style="position:fixed; inset:0;">
        <nav>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms</a>
          <a href="/cookies">Cookie Settings</a>
          <a href="/vendors/1">Vendor A</a>
          <a href="/vendors/2">Vendor B</a>
          <a href="/vendors/3">Vendor C</a>
        </nav>
        <button>Accept All</button>
      </div>
    `;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
    const dialog = document.getElementById('pc-sdk');
    dialog.getBoundingClientRect = () => ({
      width: 400, height: 800, top: 0, left: 0, bottom: 800, right: 400,
    });

    expect(H.isLikelyNavDrawer(dialog)).toBe(false);
    expect(H.isLikelyNavMenu(dialog)).toBe(false);
  });

  test('the same shape without dialog semantics IS a nav drawer', () => {
    document.body.innerHTML = `
      <nav id="hamburger" style="position:fixed; inset:0;">
        <a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>
        <a href="/d">D</a><a href="/e">E</a>
      </nav>
    `;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
    const nav = document.getElementById('hamburger');
    nav.getBoundingClientRect = () => ({
      width: 400, height: 800, top: 0, left: 0, bottom: 800, right: 400,
    });

    expect(H.isLikelyNavDrawer(nav)).toBe(true);
    expect(H.isLikelyNavMenu(nav)).toBe(true);
  });
});

describe('classifyNavDrawerState / isNavDrawerOpenTransition (jsdom)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
  });

  test('a drawer collapsed via display:none, then revealed, is a genuine open transition', () => {
    document.body.innerHTML = `
      <nav id="drawer" style="display:none; position:fixed; inset:0;">
        <a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>
        <a href="/d">D</a><a href="/e">E</a>
      </nav>
    `;
    const nav = document.getElementById('drawer');
    nav.getBoundingClientRect = () => ({
      width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0,
    });

    const collapsedState = H.classifyNavDrawerState(nav);
    expect(collapsedState).toBe('collapsed');

    nav.style.display = 'block';
    nav.getBoundingClientRect = () => ({
      width: 400, height: 800, top: 0, left: 0, bottom: 800, right: 400,
    });
    const expandedState = H.classifyNavDrawerState(nav);
    expect(expandedState).toBe('expanded');

    expect(H.isNavDrawerOpenTransition(collapsedState, expandedState)).toBe(true);
  });

  test('regression: wtatennis.com-style ambient nav (relative -> sticky) is never a genuine open transition', () => {
    // Reproduces the exact historical failure: an always-visible <nav> that
    // the site's own scroll-driven class toggles from position:relative to
    // position:sticky, with no size/visibility change at all. It must
    // classify as 'ambiguous' both before and after, and the ambiguous ->
    // expanded step must never register as an open transition.
    document.body.innerHTML = `
      <nav id="main-nav" class="main-navigation" style="position:relative; top:0; left:0;">
        <a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>
        <a href="/d">D</a><a href="/e">E</a>
      </nav>
    `;
    const nav = document.getElementById('main-nav');
    nav.getBoundingClientRect = () => ({
      width: 400, height: 60, top: 0, left: 0, bottom: 60, right: 400,
    });

    const beforeState = H.classifyNavDrawerState(nav);
    expect(beforeState).toBe('ambiguous');

    nav.classList.add('scroll-lock');
    nav.style.position = 'sticky';
    // Size/visibility unchanged — only position flips, exactly as the
    // site's own scroll-lock class does.
    const afterState = H.classifyNavDrawerState(nav);
    expect(afterState).toBe('expanded');

    expect(H.isNavDrawerOpenTransition(beforeState, afterState)).toBe(false);
  });
});

describe('classifyNavMenuPanelState (jsdom)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 });
  });

  test('regression: a Bootstrap-style collapse-in-place menu (UC Davis OASIS shape) is a genuine open transition', () => {
    // No position:fixed/sticky anywhere — the menu simply toggles
    // display:none -> block in normal document flow, which is exactly what
    // makes it invisible to classifyNavDrawerState (requires a position) but
    // is exactly what this position-agnostic path exists to catch.
    document.body.innerHTML = `
      <ul id="menu" class="navbar-collapse" style="display:none;">
        <li><a href="/schedule-builder">Schedule Builder</a></li>
        <li><a href="/my-schedule">My Schedule</a></li>
        <li><a href="/my-records">My Records</a></li>
        <li><a href="/my-messages">My Messages</a></li>
        <li><a href="/sign-out">Sign Out</a></li>
      </ul>
    `;
    const menu = document.getElementById('menu');
    menu.getBoundingClientRect = () => ({
      width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0,
    });

    const collapsedState = H.classifyNavMenuPanelState(menu);
    expect(collapsedState).toBe('collapsed');

    menu.style.display = 'block';
    menu.getBoundingClientRect = () => ({
      width: 400, height: 320, top: 60, left: 0, bottom: 380, right: 400,
    });
    const expandedState = H.classifyNavMenuPanelState(menu);
    expect(expandedState).toBe('expanded');

    expect(H.isNavDrawerOpenTransition(collapsedState, expandedState)).toBe(true);
  });

  test('an ordinary always-visible <nav> with no collapsed history is never treated as freshly opened', () => {
    // First sighting: no prior history recorded yet, so even though this
    // already qualifies as 'expanded' on the very first read, there is
    // nothing here for a caller to treat as a transition — the WeakMap in
    // content.js only ever records a baseline on first sight and never
    // paints from that alone (verified at the content.js integration level,
    // not by this pure function, but the state value returned here is what
    // makes that safe: it has no way to distinguish "always was open" from
    // "just opened" on a single read).
    document.body.innerHTML = `
      <nav id="sidebar" style="position:static;">
        <a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>
      </nav>
    `;
    const nav = document.getElementById('sidebar');
    nav.getBoundingClientRect = () => ({
      width: 300, height: 400, top: 0, left: 0, bottom: 400, right: 300,
    });
    expect(H.classifyNavMenuPanelState(nav)).toBe('expanded');
    // isNavDrawerOpenTransition(undefined, 'expanded') is exercised directly
    // in the isNavDrawerOpenTransition describe block above.
  });
});

describe('shouldSkipBrightElement modal card', () => {
  test('skips painted modal-card roots', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'DIV', width: 320, height: 220, modalCard: true,
    })).toBe(true);
  });
});

describe('parseCssRgb space-separated', () => {
  test('parses modern rgb() syntax', () => {
    expect(H.parseCssRgb('rgb(255 255 255)')).toEqual({
      r: 255, g: 255, b: 255, a: 1,
    });
    expect(H.parseCssRgb('rgb(10 20 30 / 0.5)')).toEqual({
      r: 10, g: 20, b: 30, a: 0.5,
    });
  });
});

describe('light-theme / stacked-label helpers', () => {
  test('isThemeBackgroundLight matches Sepia and skips dark fills', () => {
    expect(H.isThemeBackgroundLight('#F1EADF')).toBe(true);
    expect(H.isThemeBackgroundLight('#F2F2F7')).toBe(true);
    expect(H.isThemeBackgroundLight('#000000')).toBe(false);
    expect(H.isThemeBackgroundLight('#1C1C1E')).toBe(false);
  });

  test('isStackedDuplicateLabel detects sibling copies of the same caption', () => {
    const parent = document.createElement('div');
    const a = document.createElement('span');
    a.textContent = 'Visit';
    const b = document.createElement('span');
    b.textContent = 'Visit';
    const other = document.createElement('span');
    other.textContent = 'Save';
    parent.appendChild(a);
    parent.appendChild(b);
    parent.appendChild(other);
    document.body.appendChild(parent);
    expect(H.isStackedDuplicateLabel(a)).toBe(true);
    expect(H.isStackedDuplicateLabel(b)).toBe(true);
    expect(H.isStackedDuplicateLabel(other)).toBe(false);
    parent.remove();
  });

  test('painted aria-hidden host stats are not stacked duplicate labels', () => {
    const card = document.createElement('div');
    const srOnly = document.createElement('span');
    srOnly.textContent = '466 reviews';
    const visual = document.createElement('div');
    visual.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    num.textContent = '466';
    const label = document.createElement('span');
    label.textContent = 'Reviews';
    visual.appendChild(num);
    visual.appendChild(label);
    card.appendChild(srOnly);
    card.appendChild(visual);
    document.body.appendChild(card);
    expect(H.isStackedDuplicateLabel(visual)).toBe(false);
    expect(H.isStackedDuplicateLabel(num)).toBe(false);
    expect(H.isStackedDuplicateLabel(label)).toBe(false);
    card.remove();
  });

  test('painted aria-hidden icon wrappers are not stacked duplicate labels', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Share');
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.appendChild(svg);
    button.appendChild(wrap);
    document.body.appendChild(button);
    expect(H.isStackedDuplicateLabel(wrap)).toBe(false);
    button.remove();
  });

  test('isUnpaintedForContrast skips hidden and zero-size, not visible aria-hidden', () => {
    expect(H.isUnpaintedForContrast({
      visibility: 'visible',
      opacity: '1',
      display: 'block',
      width: 46,
      height: 16,
    })).toBe(false);
    expect(H.isUnpaintedForContrast({
      visibility: 'hidden',
      opacity: '1',
      display: 'block',
      width: 46,
      height: 16,
    })).toBe(true);
    expect(H.isUnpaintedForContrast({
      visibility: 'visible',
      opacity: '0',
      display: 'block',
      width: 46,
      height: 16,
    })).toBe(true);
    expect(H.isUnpaintedForContrast({
      visibility: 'visible',
      opacity: '1',
      display: 'none',
      width: 46,
      height: 16,
    })).toBe(true);
    expect(H.isUnpaintedForContrast({
      visibility: 'visible',
      opacity: '1',
      display: 'block',
      width: 0,
      height: 16,
    })).toBe(true);
  });

  test('Airbnb-dark body gray on a dark theme background needs a readable rewrite', () => {
    const bodyGray = H.parseCssRgb('rgb(34, 34, 34)');
    const maroon = H.parseHexColor('#300005');
    expect(H.hasPoorContrast(bodyGray, maroon, 3.0)).toBe(true);
    expect(H.pickReadableAgainstSurface(maroon, '#F5D0D8', 3.0).toLowerCase())
      .toBe('#f5d0d8');
  });
});

describe('isAdNetworkHost', () => {
  test('matches GPT / safeframe and common ad networks', () => {
    expect(H.isAdNetworkHost(
      'dd601337fa00fdfc2c2f9bc6fab8b286.safeframe.googlesyndication.com'
    )).toBe(true);
    expect(H.isAdNetworkHost('googlesyndication.com')).toBe(true);
    expect(H.isAdNetworkHost('securepubads.g.doubleclick.net')).toBe(true);
    expect(H.isAdNetworkHost('aax.amazon-adsystem.com')).toBe(true);
    expect(H.isAdNetworkHost('ib.adnxs.com')).toBe(true);
  });

  test('leaves normal sites alone', () => {
    expect(H.isAdNetworkHost('fox5sandiego.com')).toBe(false);
    expect(H.isAdNetworkHost('www.google.com')).toBe(false);
    expect(H.isAdNetworkHost('wikipedia.org')).toBe(false);
    expect(H.isAdNetworkHost('')).toBe(false);
  });

  test('matches newly-added exchange / creative-CDN suffixes', () => {
    expect(H.isAdNetworkHost('secure.indexexchange.com')).toBe(true);
    expect(H.isAdNetworkHost('www8.smartadserver.com')).toBe(true);
    expect(H.isAdNetworkHost('track.adform.net')).toBe(true);
    expect(H.isAdNetworkHost('a.adroll.com')).toBe(true);
    expect(H.isAdNetworkHost('sonobi.com')).toBe(true);
    expect(H.isAdNetworkHost('gumgum.com')).toBe(true);
  });
});

describe('isAmpPrivacyFrameHost', () => {
  test('matches amp-privacy consent portals', () => {
    expect(H.isAmpPrivacyFrameHost('amp-privacy.fox5sandiego.com')).toBe(true);
    expect(H.isAmpPrivacyFrameHost('amp-privacy.example.com')).toBe(true);
  });

  test('leaves the AMP article host and normal sites alone', () => {
    expect(H.isAmpPrivacyFrameHost('fox5sandiego.com')).toBe(false);
    expect(H.isAmpPrivacyFrameHost('www.fox5sandiego.com')).toBe(false);
    expect(H.isAmpPrivacyFrameHost('example.com')).toBe(false);
  });
});

describe('isAmpOverlayChromeInfo', () => {
  test('flags AMP runtime tags and consent overlay classes', () => {
    expect(H.isAmpOverlayChromeInfo({ tag: 'AMP-CONSENT' })).toBe(true);
    expect(H.isAmpOverlayChromeInfo({ tag: 'AMP-STICKY-AD' })).toBe(true);
    expect(H.isAmpOverlayChromeInfo({ tag: 'DIV', className: 'popupOverlay' })).toBe(true);
    expect(H.isAmpOverlayChromeInfo({ tag: 'HEADER', className: 'amp-wp-header' })).toBe(false);
  });
});

describe('hasAdNetworkIframeAmong', () => {
  test('true when any hostname in the list is a known ad network', () => {
    expect(H.hasAdNetworkIframeAmong([
      'example.com',
      'securepubads.g.doubleclick.net',
    ])).toBe(true);
  });

  test('false for an empty list or all-unrelated hostnames', () => {
    expect(H.hasAdNetworkIframeAmong([])).toBe(false);
    expect(H.hasAdNetworkIframeAmong(null)).toBe(false);
    expect(H.hasAdNetworkIframeAmong(['example.com', 'fox5sandiego.com'])).toBe(false);
  });
});

describe('isAdSafeFrameContext', () => {
  test('true when the IAB SafeFrame API or GPT inDapIF flag is present', () => {
    expect(H.isAdSafeFrameContext({ $sf: {} })).toBe(true);
    expect(H.isAdSafeFrameContext({ inDapIF: true })).toBe(true);
  });

  test('false for a normal page window', () => {
    expect(H.isAdSafeFrameContext({})).toBe(false);
    expect(H.isAdSafeFrameContext({ inDapIF: false })).toBe(false);
  });

  test('falls back to the global window when no argument is passed', () => {
    expect(H.isAdSafeFrameContext(null)).toBe(false);
    expect(H.isAdSafeFrameContext()).toBe(false);
  });
});

describe('isLikelyAdSurfaceInfo', () => {
  test('matches GPT / ACM / AdSense / Advertisement wrappers', () => {
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'ASIDE',
      className: 'ad-unit ad-unit--leaderboard ad-unit--billboard',
    })).toBe(true);
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'ASIDE',
      className: 'ad-unit ad-unit--adhesion',
    })).toBe(true);
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'DIV',
      id: 'google_ads_iframe_/5678/nx.kswb/home_1__container__',
    })).toBe(true);
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'DIV',
      id: 'acm-ad-tag-billboard1-billboard1',
      className: 'htl-size-320x50',
    })).toBe(true);
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'IFRAME',
      ariaLabel: 'Advertisement',
    })).toBe(true);
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'INS',
      className: 'adsbygoogle',
    })).toBe(true);
  });

  test('rejects site chrome and false-positive *ad* words', () => {
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'HEADER',
      id: 'masthead',
      className: 'site-header',
    })).toBe(false);
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'SPAN',
      className: 'live-card__badge',
    })).toBe(false);
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'DIV',
      className: 'reading-progress',
    })).toBe(false);
    expect(H.isLikelyAdSurfaceInfo({
      tag: 'BUTTON',
      className: 'load-more',
    })).toBe(false);
  });
});

describe('buildAdSurfaceCssNotSelector', () => {
  test('excludes CSS-safe ad tokens as class or id, and aria variants', () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="ad-unit"><span id="inner1">x</span></div>
        <div id="google_ads_iframe_123"><span id="inner2">x</span></div>
        <div class="acm-ad-tag-billboard"></div>
        <ins class="adsbygoogle"></ins>
        <div class="gpt-ad-slot"></div>
        <div class="dfp-ad-box"></div>
        <div class="ad-slot-leaderboard"></div>
        <div class="adslot-bottom"></div>
        <div class="ad-container"></div>
        <div class="adhesion-unit"></div>
        <div aria-label="Advertisement"></div>
        <div aria-label="Sponsored content"></div>
        <div aria-roledescription="advertisement"></div>
        <p class="normal-copy">not an ad</p>
      </div>`;

    const sel = H.buildAdSurfaceCssNotSelector();
    // Unwrap the ":not(:is(...))" to a positive ":is(...)" so .matches()
    // can assert which elements the exclusion is built to catch.
    const positiveSel = sel.replace(/^:not\((.*)\)$/, '$1');

    // Only the CSS-safe subset (AD_SURFACE_CSS_SAFE_TOKENS) is excluded at
    // the stylesheet level — ad-slot/adslot/ad-container/adhesion are
    // deliberately NOT here (see next test).
    const adEls = document.querySelectorAll(
      '.ad-unit, [id^="google_ads_iframe_123"], .acm-ad-tag-billboard, ins.adsbygoogle,' +
      ' .gpt-ad-slot, .dfp-ad-box, [aria-label="Advertisement"],' +
      ' [aria-label="Sponsored content"], [aria-roledescription="advertisement"]'
    );
    expect(adEls.length).toBe(9);
    adEls.forEach((el) => expect(el.matches(positiveSel)).toBe(true));

    expect(document.querySelector('.normal-copy').matches(positiveSel)).toBe(false);

    // Descendants of an ad wrapper are caught too (the "* " fragments).
    expect(document.getElementById('inner1').matches(positiveSel)).toBe(true);
    expect(document.getElementById('inner2').matches(positiveSel)).toBe(true);
  });

  test('collision-prone generic tokens are NOT excluded at the CSS level', () => {
    document.body.innerHTML = `
      <div class="ad-slot-leaderboard"></div>
      <div class="adslot-bottom"></div>
      <div class="ad-container"></div>
      <div class="adhesion-unit"></div>
    `;
    const sel = H.buildAdSurfaceCssNotSelector();
    const positiveSel = sel.replace(/^:not\((.*)\)$/, '$1');
    ['.ad-slot-leaderboard', '.adslot-bottom', '.ad-container', '.adhesion-unit'].forEach((cssSel) => {
      expect(document.querySelector(cssSel).matches(positiveSel)).toBe(false);
    });
  });

  test('regression: a fox5sandiego.com-style covering-sheet curtain carrying a ' +
    'collision-prone ad token is NOT exempted from the universal transparency pass', () => {
    document.body.innerHTML = `
      <div id="curtain" class="adhesion-cookie-consent"
           style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;"></div>
    `;
    const sel = H.buildAdSurfaceCssNotSelector();
    const positiveSel = sel.replace(/^:not\((.*)\)$/, '$1');
    const curtain = document.getElementById('curtain');
    // Must NOT match the positive ad-surface selector — i.e. must NOT be
    // exempted from getFullStyleSheet's universal
    // `background-color: transparent` rule — even though its class
    // contains the collision-prone "adhesion" token.
    expect(curtain.matches(positiveSel)).toBe(false);
    // Sanity: the JS-only broad matcher still flags it as an ad surface
    // for the additive corrective passes — safe to skip those, unrelated
    // to the curtain bug.
    expect(H.isLikelyAdSurfaceInfo({ tag: 'DIV', className: 'adhesion-cookie-consent' })).toBe(true);
  });

  test('AD_SURFACE_CSS_SAFE_TOKENS is a subset of AD_SURFACE_ID_CLASS_TOKENS', () => {
    H.AD_SURFACE_CSS_SAFE_TOKENS.forEach((token) => {
      expect(H.AD_SURFACE_ID_CLASS_TOKENS).toContain(token);
    });
  });

  test('collision-prone generic tokens are excluded from the CSS-safe subset', () => {
    ['ad-slot', 'adslot', 'ad-container', 'adhesion'].forEach((token) => {
      expect(H.AD_SURFACE_CSS_SAFE_TOKENS).not.toContain(token);
    });
  });

  test('AD_SURFACE_ID_CLASS_TOKENS stays in sync with isLikelyAdSurfaceInfo', () => {
    H.AD_SURFACE_ID_CLASS_TOKENS.forEach((token) => {
      expect(H.isLikelyAdSurfaceInfo({ tag: 'DIV', className: token })).toBe(true);
    });
  });
});
