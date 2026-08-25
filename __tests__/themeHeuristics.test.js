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

  test('rejects tall headers beyond TOP_CHROME_MAX_VH (0.32)', () => {
    // ~45% of 800px — too tall for app-bar chrome
    expect(H.isTopChromeBarInfo({
      ...bar, height: 360,
    })).toBe(false);
    // Still within 0.32 * 800 = 256
    expect(H.isTopChromeBarInfo({
      ...bar, height: 240,
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
