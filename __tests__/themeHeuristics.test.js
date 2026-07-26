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
});
