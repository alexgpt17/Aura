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
  test('skips syntax-highlighted code blocks (pre/code) — background + token colors are a co-designed pair', () => {
    // Confirmed on dev.to: Rouge output uses bare single/double-letter token
    // classes (c1/k/nf/s2/...) that no generic selector could target, so
    // clearing just the (often near-white) background strips the half of
    // that pair token colors were tuned against.
    expect(H.shouldSkipBrightElement({ tag: 'PRE', width: 400, height: 200 })).toBe(true);
    expect(H.shouldSkipBrightElement({ tag: 'CODE', width: 400, height: 200 })).toBe(true);
  });

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

  test('a small icon-only button (mic/send-style composer control) is no longer skipped', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'BUTTON', width: 40, height: 40, textLength: 0,
      visibility: 'visible', opacity: '1', mask: 'none',
    })).toBe(false);
  });

  test('a text-labeled button ("Sign in with Google") stays skipped — the core regression guard', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'BUTTON', width: 200, height: 40, textLength: 17,
      visibility: 'visible', opacity: '1', mask: 'none',
    })).toBe(true);
  });

  test('a small icon-only button whose own className contains "icon" is still not skipped', () => {
    // Regression guard: the pre-existing className-icon-hint gate would
    // otherwise immediately re-skip the exact element the BUTTON carve-out
    // above just let through.
    expect(H.shouldSkipBrightElement({
      tag: 'BUTTON', width: 40, height: 40, textLength: 0, className: 'mic-icon-button',
      visibility: 'visible', opacity: '1', mask: 'none',
    })).toBe(false);
  });

  test('a small icon-only button that is also an overlay/modal-card root is still skipped', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'BUTTON', width: 40, height: 40, textLength: 0, overlayRoot: true,
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'BUTTON', width: 40, height: 40, textLength: 0, modalCard: true,
    })).toBe(true);
  });

  test('an identically-shaped INPUT/SELECT stays skipped — the carve-out is BUTTON-only', () => {
    expect(H.shouldSkipBrightElement({
      tag: 'INPUT', width: 40, height: 40, textLength: 0,
      visibility: 'visible', opacity: '1', mask: 'none',
    })).toBe(true);
    expect(H.shouldSkipBrightElement({
      tag: 'SELECT', width: 40, height: 40, textLength: 0,
      visibility: 'visible', opacity: '1', mask: 'none',
    })).toBe(true);
  });
});

describe('isLikelySmallIconOnlyButtonInfo', () => {
  test('icon-sized, textless button qualifies', () => {
    expect(H.isLikelySmallIconOnlyButtonInfo({ width: 40, height: 40, textLength: 0 })).toBe(true);
  });

  test('same shape with a visible label does not qualify', () => {
    expect(H.isLikelySmallIconOnlyButtonInfo({ width: 40, height: 40, textLength: 12 })).toBe(false);
  });

  test('too small does not qualify', () => {
    expect(H.isLikelySmallIconOnlyButtonInfo({ width: 10, height: 10, textLength: 0 })).toBe(false);
  });

  test('bad aspect ratio does not qualify', () => {
    expect(H.isLikelySmallIconOnlyButtonInfo({ width: 100, height: 30, textLength: 0 })).toBe(false);
  });

  test('undefined/missing info does not qualify', () => {
    expect(H.isLikelySmallIconOnlyButtonInfo(undefined)).toBe(false);
    expect(H.isLikelySmallIconOnlyButtonInfo({})).toBe(false);
  });
});

describe('isLikelyInlineHighlightSpanInfo', () => {
  test('true positive: mid-tone wash inline in prose (the reported bug shape)', () => {
    // isLightContentSurface would miss this — it only fires on near-white
    // fills, and this background is a mid-tone dark wash, not white.
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: { r: 50, g: 48, b: 45, a: 0.4 },
      ownTextLength: 20,
      parentHasSiblingText: true,
    })).toBe(true);
  });

  test('non-SPAN tag never qualifies', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'DIV',
      backgroundColor: { r: 50, g: 48, b: 45, a: 0.4 },
      ownTextLength: 20,
      parentHasSiblingText: true,
    })).toBe(false);
  });

  test('inside pre/code is excluded (protects syntax-highlighted tokens)', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: { r: 50, g: 48, b: 45, a: 0.4 },
      ownTextLength: 20,
      parentHasSiblingText: true,
      inCodeOrPre: true,
    })).toBe(false);
  });

  test('inside a button/role=button control is excluded (chrome, not prose)', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: { r: 50, g: 48, b: 45, a: 0.4 },
      ownTextLength: 20,
      parentHasSiblingText: true,
      inButtonControl: true,
    })).toBe(false);
  });

  test('icon className hint is excluded', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: { r: 50, g: 48, b: 45, a: 0.4 },
      ownTextLength: 20,
      parentHasSiblingText: true,
      hasIconClassHint: true,
    })).toBe(false);
  });

  test('alpha below the floor is excluded (effectively transparent)', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: { r: 10, g: 10, b: 10, a: 0.05 },
      ownTextLength: 20,
      parentHasSiblingText: true,
    })).toBe(false);
  });

  test('a vivid/high-chroma background is left alone (assumed intentional color-coding)', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: { r: 220, g: 20, b: 20, a: 0.9 },
      ownTextLength: 20,
      parentHasSiblingText: true,
    })).toBe(false);
  });

  test('too-short own text (icon-only/near-empty span) is excluded', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: { r: 50, g: 48, b: 45, a: 0.4 },
      ownTextLength: 1,
      parentHasSiblingText: true,
    })).toBe(false);
  });

  test('no sibling text — span is the sole content of its container (a chip/badge, not prose)', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: { r: 50, g: 48, b: 45, a: 0.4 },
      ownTextLength: 20,
      parentHasSiblingText: false,
    })).toBe(false);
  });

  test('null background is excluded', () => {
    expect(H.isLikelyInlineHighlightSpanInfo({
      tag: 'SPAN',
      backgroundColor: null,
      ownTextLength: 20,
      parentHasSiblingText: true,
    })).toBe(false);
  });
});

describe('classifyMutationBatchInfo', () => {
  test('missing/undefined info falls back to full', () => {
    expect(H.classifyMutationBatchInfo(undefined)).toBe('full');
    expect(H.classifyMutationBatchInfo({})).toBe('full');
  });

  test('a small, localized batch (typing/streaming) is scoped', () => {
    expect(H.classifyMutationBatchInfo({ recordCount: 5, addedNodeCount: 5, removedNodeCount: 0 })).toBe('scoped');
  });

  test('more than the record-count threshold falls back to full', () => {
    expect(H.classifyMutationBatchInfo({ recordCount: 41, addedNodeCount: 5, removedNodeCount: 0 })).toBe('full');
  });

  test('within the record-count threshold but over the node-count threshold falls back to full', () => {
    expect(H.classifyMutationBatchInfo({ recordCount: 10, addedNodeCount: 40, removedNodeCount: 21 })).toBe('full');
  });
});

describe('findCommonMutationAncestor (jsdom)', () => {
  function buildTree() {
    const root = document.createElement('div');
    const parent = document.createElement('div');
    const childA = document.createElement('span');
    const childB = document.createElement('span');
    parent.appendChild(childA);
    parent.appendChild(childB);
    root.appendChild(parent);
    document.body.appendChild(root);
    return { root, parent, childA, childB };
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('targets sharing the same direct parent return that parent', () => {
    const { parent, childA, childB } = buildTree();
    expect(H.findCommonMutationAncestor([childA, childB], parent)).toBe(parent);
  });

  test('a single, repeated target returns that element', () => {
    const { parent, childA } = buildTree();
    expect(H.findCommonMutationAncestor([childA, childA], parent)).toBe(childA);
  });

  test('a target that IS the root returns the root', () => {
    const { root, childA } = buildTree();
    expect(H.findCommonMutationAncestor([root, childA], root)).toBe(root);
  });

  test('empty targets array falls back to root', () => {
    const { root } = buildTree();
    expect(H.findCommonMutationAncestor([], root)).toBe(root);
  });

  test('a disconnected node does not throw and falls back to root', () => {
    const { root } = buildTree();
    const orphan = document.createElement('span');
    expect(() => H.findCommonMutationAncestor([orphan], root)).not.toThrow();
    expect(H.findCommonMutationAncestor([orphan], root)).toBe(root);
  });

  test('scattered targets across unrelated branches fall back to root', () => {
    const root = document.createElement('div');
    const branchA = document.createElement('div');
    const branchB = document.createElement('div');
    const leafA = document.createElement('span');
    const leafB = document.createElement('span');
    branchA.appendChild(leafA);
    branchB.appendChild(leafB);
    root.appendChild(branchA);
    root.appendChild(branchB);
    document.body.appendChild(root);
    expect(H.findCommonMutationAncestor([leafA, leafB], root)).toBe(root);
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
  test('skips sticky table header tags — governed by the dedicated :is(thead) CSS rule instead', () => {
    // Confirmed on coingecko's markets table: position:sticky <thead>/<th>/
    // <td>. Letting the generic chrome-bar heuristic also paint these risks
    // an inline --aura-bg JS write overriding the purpose-built elevated
    // shade that rule gives sticky headers.
    ['THEAD', 'TR', 'TH'].forEach((tag) => {
      expect(H.shouldSkipStickyElement({
        position: 'sticky', tag, mask: 'none', visibility: 'visible', opacity: '1',
        width: 400, height: 40, vh: 800, vw: 400,
      })).toBe(true);
    });
  });

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

  test('modest z-index (1000-1999) no longer trips the overlay-tier gate — real chrome commonly uses this range', () => {
    // Confirmed real false positives at the old z>=1000 threshold:
    // bbc.com's live-match tab bar (role="tablist", z-index:1003) and
    // workspace.google.com's shadow-DOM "Sign in / Get Gmail" bottom action
    // bar (z-index:1016, no ARIA role at all — an ordinary bottom bar).
    // Neither is a notification/CMP tier; both are raised to 2000, below
    // which ordinary framework-convention chrome (Bootstrap's own scale
    // tops out ~1090) now paints normally regardless of ARIA role.
    expect(H.shouldSkipStickyElement({
      position: 'sticky', mask: 'none', visibility: 'visible', opacity: '1',
      width: 390, height: 45, top: 0, left: 0, vh: 664, vw: 390,
      zIndex: '1003', hasTablistRole: true,
    })).toBe(false);
    expect(H.shouldSkipStickyElement({
      position: 'fixed', mask: 'none', visibility: 'visible', opacity: '1',
      width: 390, height: 62, top: 616, left: 0, vh: 678, vw: 390,
      zIndex: '1016', hasTablistRole: false,
    })).toBe(false);
  });

  test('a role="tablist" sticky sub-nav is exempted even at a z-index well past the raised 2000 threshold', () => {
    expect(H.shouldSkipStickyElement({
      position: 'sticky', mask: 'none', visibility: 'visible', opacity: '1',
      width: 390, height: 45, top: 0, left: 0, vh: 664, vw: 390,
      zIndex: '5000', hasTablistRole: true,
    })).toBe(false);
    // Without the tablist signal, this extreme z-index still (correctly)
    // skips — confirms the gate still catches real notification tiers.
    expect(H.shouldSkipStickyElement({
      position: 'sticky', mask: 'none', visibility: 'visible', opacity: '1',
      width: 390, height: 45, top: 0, left: 0, vh: 664, vw: 390,
      zIndex: '5000', hasTablistRole: false,
    })).toBe(true);
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

  test('a wide/short sticky wrapper whose children barely cover it (github.com .BackToTop shape) is skipped', () => {
    // position:sticky, display:flex, justify-content:flex-end hosting one
    // small 36px button in a 390px-wide box with no background of its own.
    expect(H.shouldSkipStickyElement({
      position: 'sticky',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 36,
      top: 612,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '98',
      childCoverageFrac: 36 / 390,
    })).toBe(true);
  });

  test('a genuine wide chrome bar whose content spans most of its width still paints', () => {
    expect(H.shouldSkipStickyElement({
      position: 'sticky',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 64,
      top: 0,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '7',
      childCoverageFrac: 0.85,
    })).toBe(false);
  });

  test('childCoverageFrac is ignored (gate never applies) when null, or the element is narrow', () => {
    expect(H.shouldSkipStickyElement({
      position: 'sticky', width: 390, height: 64, vh: 844, vw: 390, zIndex: '7',
      childCoverageFrac: null,
    })).toBe(false);
    // Under the 150px width floor — a small badge, already handled by
    // other gates; this new one must not additionally affect it.
    expect(H.shouldSkipStickyElement({
      position: 'fixed', width: 60, height: 24, vh: 844, vw: 390, zIndex: '7',
      childCoverageFrac: 0.1,
    })).toBe(false);
  });

  test('a sticky bottom bar whose buttons already have their own opaque background is skipped (sky.coflnet.com shape)', () => {
    // Notify / copy / scroll-to-top buttons filling most of the bar's
    // width, each with its own authored fill — the wrapper itself has
    // no background and shouldn't be painted just because the buttons
    // cover most of its width.
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 56,
      top: 788,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '10',
      childCoverageFrac: 0.9,
      childOpaqueCoverageFrac: 0.9,
    })).toBe(true);
  });

  test('moderate opaque coverage (padded/spaced-out buttons) is enough to skip — threshold is 0.35, not 0.5', () => {
    // Same coflnet-style bar, but with generous padding/gaps around compact
    // buttons so they only cover ~40% of the bar's width. The buttons being
    // self-opaque is a strong enough signal on its own; requiring them to
    // also dominate the width would miss bars with roomy layout.
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 56,
      top: 788,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '10',
      childCoverageFrac: 0.4,
      childOpaqueCoverageFrac: 0.4,
    })).toBe(true);
    // But not so low that it's basically nothing — below 0.35 still paints.
    expect(H.shouldSkipStickyElement({
      position: 'fixed',
      width: 390,
      height: 56,
      vh: 844,
      vw: 390,
      zIndex: '10',
      childOpaqueCoverageFrac: 0.2,
    })).toBe(false);
  });

  test('a genuine chrome bar whose children have no authored background still paints, even with high width coverage', () => {
    // Plain text nav links spanning most of the bar's width but with no
    // background of their own — the bar still needs painting for legibility.
    expect(H.shouldSkipStickyElement({
      position: 'sticky',
      mask: 'none',
      visibility: 'visible',
      opacity: '1',
      width: 390,
      height: 56,
      top: 0,
      left: 0,
      vh: 844,
      vw: 390,
      zIndex: '7',
      childCoverageFrac: 0.85,
      childOpaqueCoverageFrac: 0,
    })).toBe(false);
  });

  test('childOpaqueCoverageFrac is ignored (gate never applies) when null, or the element is narrow', () => {
    expect(H.shouldSkipStickyElement({
      position: 'sticky', width: 390, height: 56, vh: 844, vw: 390, zIndex: '7',
      childCoverageFrac: 0.9,
      childOpaqueCoverageFrac: null,
    })).toBe(false);
    // Under the 150px width floor — a small badge, already handled by
    // other gates; this new one must not additionally affect it.
    expect(H.shouldSkipStickyElement({
      position: 'fixed', width: 60, height: 24, vh: 844, vw: 390, zIndex: '7',
      childOpaqueCoverageFrac: 1,
    })).toBe(false);
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

describe('isLikelyFloatingIconControlInfo', () => {
  const chip = {
    visibility: 'visible',
    opacity: '1',
    position: 'absolute',
    width: 36,
    height: 36,
    textLength: 0,
    isActionable: true,
  };

  test('matches a small icon-only control positioned over media', () => {
    expect(H.isLikelyFloatingIconControlInfo(chip)).toBe(true);
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, position: 'fixed' })).toBe(true);
    // Slightly rectangular (a rounded "..." pill) is still fine.
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, width: 44, height: 32 })).toBe(true);
  });

  test('rejects an ordinary icon button left in normal document flow', () => {
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, position: 'static' })).toBe(false);
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, position: 'relative' })).toBe(false);
  });

  test('rejects non-icon shapes and sizes', () => {
    // Too small (a notification dot, not an actionable control).
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, width: 10, height: 10 })).toBe(false);
    // Too large (not an icon-sized control).
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, width: 120, height: 120 })).toBe(false);
    // Too elongated to be an icon chip (a wide pill/button).
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, width: 140, height: 32 })).toBe(false);
    // Real text content, not an icon-only glyph (e.g. "Track price").
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, textLength: 24 })).toBe(false);
  });

  test('requires the element to be actionable', () => {
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, isActionable: false })).toBe(false);
  });

  test('rejects hidden elements', () => {
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, visibility: 'hidden' })).toBe(false);
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, opacity: '0' })).toBe(false);
  });

  test('rejects an icon control docked inside a text-entry composer shell, even if fixed/absolute', () => {
    // A mic/send-style icon docked inside a chat/search input pill sits on
    // an already-themed, predictable background — unlike a photo/video/map,
    // it never needs a legibility scrim, and painting one only adds a stray
    // dark pill artifact (the reported Google AI-chat composer bug).
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, inTextInputShell: true })).toBe(false);
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, position: 'fixed', inTextInputShell: true })).toBe(false);
  });

  test('a matching control outside any text-entry shell is unaffected by the new field', () => {
    expect(H.isLikelyFloatingIconControlInfo({ ...chip, inTextInputShell: false })).toBe(true);
    expect(H.isLikelyFloatingIconControlInfo(chip)).toBe(true);
  });
});

describe('isLikelyFloatingIconControl (jsdom) — text-input-shell exclusion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('a mic/send icon button docked next to a composer textarea is excluded', () => {
    document.body.innerHTML = `
      <div id="composer">
        <textarea id="ask" placeholder="Ask anything"></textarea>
        <button id="mic" style="position:absolute;" aria-label="Use microphone"></button>
      </div>
    `;
    const mic = document.getElementById('mic');
    mic.getBoundingClientRect = () => ({ width: 40, height: 40, top: 0, left: 0, right: 40, bottom: 40 });
    expect(H.isLikelyFloatingIconControl(mic, getComputedStyle, { vh: 800, vw: 400 })).toBe(false);
  });

  test('an icon control positioned over media with no nearby text field is unaffected', () => {
    document.body.innerHTML = `
      <div id="photoCard">
        <img src="x.jpg">
        <button id="close" style="position:absolute;" aria-label="Close"></button>
      </div>
    `;
    const closeBtn = document.getElementById('close');
    closeBtn.getBoundingClientRect = () => ({ width: 40, height: 40, top: 0, left: 0, right: 40, bottom: 40 });
    expect(H.isLikelyFloatingIconControl(closeBtn, getComputedStyle, { vh: 800, vw: 400 })).toBe(true);
  });
});

describe('elementHasSearchField placeholder fallback', () => {
  test('matches a plain text input with Search/Find placeholder wording', () => {
    document.body.innerHTML = '<div id="bar1"><input type="text" placeholder="Find a place"></div>' +
      '<div id="bar2"><input type="text" placeholder="Search maps"></div>' +
      '<div id="bar3"><input type="text" placeholder="Enter your name"></div>';
    expect(H.elementHasSearchField(document.getElementById('bar1'))).toBe(true);
    expect(H.elementHasSearchField(document.getElementById('bar2'))).toBe(true);
    expect(H.elementHasSearchField(document.getElementById('bar3'))).toBe(false);
    document.body.innerHTML = '';
  });

  test('matches role="searchbox"', () => {
    document.body.innerHTML = '<div id="bar4"><div role="searchbox"></div></div>';
    expect(H.elementHasSearchField(document.getElementById('bar4'))).toBe(true);
    document.body.innerHTML = '';
  });
});

describe('isLikelyAuthoredSurfaceInfo', () => {
  const compact = {
    visibility: 'visible', opacity: '1', width: 90, height: 36, top: 200, left: 20, vh: 800, vw: 400,
  };

  test('accepts a compact authored surface well below the modal-card size floor', () => {
    expect(H.isLikelyAuthoredSurfaceInfo(compact)).toBe(true);
  });

  test('accepts a wide, short pill shape isLikelyModalCard would reject on height alone', () => {
    // width 180 >= MODAL_MIN_WIDTH (160) but height 48 < MODAL_MIN_HEIGHT (80) —
    // demonstrates why this predicate exists independent of isLikelyModalCard.
    // (Kept under this predicate's own 50vw ceiling — 200 here — unlike the
    // covering-sheet-adjacent case below, which deliberately exceeds it.)
    expect(H.isLikelyAuthoredSurfaceInfo({ ...compact, width: 180, height: 48 })).toBe(true);
  });

  test('rejects when invisible', () => {
    expect(H.isLikelyAuthoredSurfaceInfo({ ...compact, visibility: 'hidden' })).toBe(false);
    expect(H.isLikelyAuthoredSurfaceInfo({ ...compact, opacity: '0' })).toBe(false);
  });

  test('rejects a degenerate near-zero-size surface', () => {
    expect(H.isLikelyAuthoredSurfaceInfo({ ...compact, width: 2, height: 2 })).toBe(false);
  });

  test('rejects a full-viewport-sized surface', () => {
    expect(H.isLikelyAuthoredSurfaceInfo({ ...compact, width: 380, height: 780 })).toBe(false);
  });

  test('rejects a covering-sheet-sized surface', () => {
    expect(H.isLikelyAuthoredSurfaceInfo({ ...compact, width: 320, height: 400 })).toBe(false);
  });

  test('rejects a wide-but-short promo card under the covering-sheet floor but over this predicate\'s own ceiling', () => {
    // ~90% vw x 35% vh: fails isCoveringSheetRect's 45% vh floor, but should
    // still be rejected by AUTHORED_SURFACE_MAX_WIDTH_FRAC/HEIGHT_FRAC —
    // otherwise a hero/promo card that should stay themed would get restored
    // on the authored-!important signal alone.
    expect(H.isLikelyAuthoredSurfaceInfo({ ...compact, width: 360, height: 280 })).toBe(false);
  });

  test('rejects an element with a repeated-class sibling (card-grid batch shape)', () => {
    expect(H.isLikelyAuthoredSurfaceInfo({ ...compact, hasSiblingWithSameClass: true })).toBe(false);
  });
});

describe('isLikelyAuthoredSurface (live DOM)', () => {
  test('excludes anything inside an ARIA overlay/dialog', () => {
    document.body.innerHTML = '<div role="dialog"><div id="chip"></div></div>';
    const chip = document.getElementById('chip');
    jest.spyOn(chip, 'getBoundingClientRect').mockReturnValue({ width: 90, height: 36, top: 200, left: 20 });
    expect(H.isLikelyAuthoredSurface(chip, () => ({ visibility: 'visible', opacity: '1' }), { vh: 800, vw: 400 })).toBe(false);
    document.body.innerHTML = '';
  });

  test('detects a repeated-class sibling via the live DOM', () => {
    document.body.innerHTML = '<div><div class="card" id="a"></div><div class="card" id="b"></div></div>';
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    jest.spyOn(a, 'getBoundingClientRect').mockReturnValue({ width: 90, height: 36, top: 200, left: 20 });
    jest.spyOn(b, 'getBoundingClientRect').mockReturnValue({ width: 90, height: 36, top: 200, left: 120 });
    const style = () => ({ visibility: 'visible', opacity: '1' });
    expect(H.isLikelyAuthoredSurface(a, style, { vh: 800, vw: 400 })).toBe(false);
    expect(H.isLikelyAuthoredSurface(b, style, { vh: 800, vw: 400 })).toBe(false);
    document.body.innerHTML = '';
  });

  test('accepts a lone compact surface with no matching sibling', () => {
    document.body.innerHTML = '<div><div class="signin-btn" id="c"></div></div>';
    const c = document.getElementById('c');
    jest.spyOn(c, 'getBoundingClientRect').mockReturnValue({ width: 70, height: 36, top: 10, left: 300 });
    expect(H.isLikelyAuthoredSurface(c, () => ({ visibility: 'visible', opacity: '1' }), { vh: 800, vw: 400 })).toBe(true);
    document.body.innerHTML = '';
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

  test('isLoaderBackgroundImageUrl flags loader/spinner assets, not unrelated images', () => {
    // UC Davis OASIS shape: a static loading-spinner GIF set as an
    // element's background-image, normally hidden behind an opaque
    // covering background-color our own transparency rule strips.
    expect(H.isLoaderBackgroundImageUrl(
      'url(/resources-core/ls/images/loader.circle.meduim.gif)'
    )).toBe(true);
    expect(H.isLoaderBackgroundImageUrl('url("https://cdn.example/spinner.svg")')).toBe(true);
    expect(H.isLoaderBackgroundImageUrl("url('/assets/throbber.png')")).toBe(true);
    // Case-insensitive, and matches regardless of quoting style.
    expect(H.isLoaderBackgroundImageUrl('url(/img/LOADER-dark.png)')).toBe(true);
    // Unrelated photos/hero images must not be swept up.
    expect(H.isLoaderBackgroundImageUrl('url("https://cdn.example/hero.jpg")')).toBe(false);
    // Deliberately narrow: bare "spin"/"load" substrings inside unrelated
    // words must not false-positive (e.g. a "download" or "spindle" asset).
    expect(H.isLoaderBackgroundImageUrl('url(/img/download-icon.png)')).toBe(false);
    expect(H.isLoaderBackgroundImageUrl('url(/img/spindle.png)')).toBe(false);
    expect(H.isLoaderBackgroundImageUrl('none')).toBe(false);
    expect(H.isLoaderBackgroundImageUrl('linear-gradient(#111, #333)')).toBe(false);
    expect(H.isLoaderBackgroundImageUrl('')).toBe(false);
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

  test('an optional cache returns identical results and short-circuits repeat lookups', () => {
    document.body.innerHTML = `
      <div id="card" style="background-color: rgb(232, 232, 232);">
        <span id="labelA" style="background-color: transparent;">A</span>
        <span id="labelB" style="background-color: transparent;">B</span>
      </div>
    `;
    const labelA = document.getElementById('labelA');
    const labelB = document.getElementById('labelB');

    const uncached = H.effectiveBackground(labelA, getComputedStyle, '#112233');

    const cache = new WeakMap();
    let calls = 0;
    const countingGetStyle = (el) => { calls++; return getComputedStyle(el); };

    const cachedA = H.effectiveBackground(labelA, countingGetStyle, '#112233', cache);
    expect(cachedA).toEqual(uncached);
    const callsAfterFirst = calls;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // labelB shares the same resolved ancestor (card) — a second lookup
    // through a sibling should hit the cache before ever reaching `card`
    // again, so it can't cost as many getStyle calls as the first lookup did.
    const cachedB = H.effectiveBackground(labelB, countingGetStyle, '#112233', cache);
    expect(cachedB).toEqual(uncached);
    expect(calls - callsAfterFirst).toBeLessThan(callsAfterFirst);

    // A direct repeat lookup for the same element is served entirely from
    // cache — zero additional getStyle calls.
    const callsBeforeRepeat = calls;
    const cachedARepeat = H.effectiveBackground(labelA, countingGetStyle, '#112233', cache);
    expect(cachedARepeat).toEqual(uncached);
    expect(calls).toBe(callsBeforeRepeat);
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

  test('finds an in-flow (non-fixed) inner card under a non-ARIA covering scrim (Google scorecard shape)', () => {
    // A custom bottom-sheet widget with no role="dialog"/aria-modal at all —
    // the scrim is a plain position:fixed div, and the card inside it is an
    // ordinary in-flow (position:static) block, not itself position:fixed.
    // findInnerModalCard/isModalCardShape must not require ARIA or a fixed
    // inner card ("any in-flow position is fine" for the inner card).
    document.body.innerHTML = `
      <div id="scrim" style="position:fixed; inset:0;">
        <div id="card" style="position:static;">
          Round of 16 - Arthur Ashe Stadium - Live
          <button>Close</button>
        </div>
      </div>
    `;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const scrim = document.getElementById('scrim');
    const card = document.getElementById('card');
    scrim.getBoundingClientRect = () => ({
      width: 390, height: 844, top: 0, left: 0, bottom: 844, right: 390,
    });
    card.getBoundingClientRect = () => ({
      width: 350, height: 320, top: 250, left: 20, bottom: 570, right: 370,
    });

    expect(scrim.getAttribute('role')).toBeNull();
    expect(card.getAttribute('role')).toBeNull();
    expect(H.findInnerModalCard(scrim)).toBe(card);
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

describe('isChatWidgetHost', () => {
  test('matches known chat/support-widget vendors', () => {
    expect(H.isChatWidgetHost('widget.intercom.io')).toBe(true);
    expect(H.isChatWidgetHost('js.intercomcdn.com')).toBe(true);
    expect(H.isChatWidgetHost('static.zdassets.com')).toBe(true);
    expect(H.isChatWidgetHost('js.driftt.com')).toBe(true);
    expect(H.isChatWidgetHost('client.crisp.chat')).toBe(true);
    expect(H.isChatWidgetHost('embed.tawk.to')).toBe(true);
    expect(H.isChatWidgetHost('js-na1.hs-scripts.com')).toBe(true);
  });

  test('leaves normal sites alone', () => {
    expect(H.isChatWidgetHost('fox5sandiego.com')).toBe(false);
    expect(H.isChatWidgetHost('wikipedia.org')).toBe(false);
    expect(H.isChatWidgetHost('')).toBe(false);
  });
});

describe('classifyNativeDarkModeInfo', () => {
  test('GitHub Primer: data-color-mode with dark-theme companion, not yet dark', () => {
    expect(H.classifyNativeDarkModeInfo({
      hasDataColorMode: true, dataColorMode: 'light', hasDarkThemeCompanion: true,
    })).toEqual({ attr: 'data-color-mode', value: 'dark' });
  });

  test('data-color-mode with an ambiguous (non light/dark) value and no companion is not trusted (avoid a false match)', () => {
    // An unrelated attribute that coincidentally shares this name but holds
    // some other value (not the clean light/dark enum) still needs the
    // Primer companion attributes to be trusted.
    expect(H.classifyNativeDarkModeInfo({
      hasDataColorMode: true, dataColorMode: 'auto', hasDarkThemeCompanion: false,
    })).toBeNull();
  });

  test('data-color-mode alone (no Primer companion) is trusted when its value is a clean light/dark enum', () => {
    // Confirmed on joshwcomeau.com: <html data-color-mode="light"> with no
    // data-dark-theme/data-light-theme companion attributes at all — the
    // companion-only check missed this real site's convention entirely.
    expect(H.classifyNativeDarkModeInfo({
      hasDataColorMode: true, dataColorMode: 'light', hasDarkThemeCompanion: false,
    })).toEqual({ attr: 'data-color-mode', value: 'dark' });
    expect(H.classifyNativeDarkModeInfo({
      hasDataColorMode: true, dataColorMode: 'dark', hasDarkThemeCompanion: false,
    })).toEqual({ alreadyDark: true });
  });

  test('already dark returns { alreadyDark: true } — nothing to flip, but the caller must still defer', () => {
    // Distinct from "unrecognized" (plain null) — both used to collapse to
    // null, which made the caller give up and apply Aura's own theme on top
    // of an already-correctly-dark site.
    expect(H.classifyNativeDarkModeInfo({
      hasDataColorMode: true, dataColorMode: 'dark', hasDarkThemeCompanion: true,
    })).toEqual({ alreadyDark: true });
    expect(H.classifyNativeDarkModeInfo({ hasDataBsTheme: true, dataBsTheme: 'dark' }))
      .toEqual({ alreadyDark: true });
    expect(H.classifyNativeDarkModeInfo({ hasDataTheme: true, dataTheme: 'dark' }))
      .toEqual({ alreadyDark: true });
  });

  test('a recognized body-level dark class (e.g. twitch.tv body.dark-theme) returns alreadyDark', () => {
    expect(H.classifyNativeDarkModeInfo({ hasBodyDarkClass: true }))
      .toEqual({ alreadyDark: true });
    expect(H.classifyNativeDarkModeInfo({ hasBodyDarkClass: false })).toBeNull();
  });

  test('a pure CSS prefers-color-scheme dark theme with no DOM signal at all returns alreadyDark', () => {
    // Confirmed live on overreacted.io: no class/data-attribute of any kind,
    // real dark background (rgb(40,44,53)) rendered purely by the site's own
    // @media (prefers-color-scheme: dark) rule matching the OS setting.
    expect(H.classifyNativeDarkModeInfo({ hasPrefersColorSchemeDarkCss: true }))
      .toEqual({ alreadyDark: true });
    expect(H.classifyNativeDarkModeInfo({ hasPrefersColorSchemeDarkCss: false })).toBeNull();
  });

  test('Bootstrap 5.3+ data-bs-theme', () => {
    expect(H.classifyNativeDarkModeInfo({ hasDataBsTheme: true, dataBsTheme: 'light' }))
      .toEqual({ attr: 'data-bs-theme', value: 'dark' });
  });

  test('generic data-theme convention (Docusaurus/VitePress/Daisy UI)', () => {
    expect(H.classifyNativeDarkModeInfo({ hasDataTheme: true, dataTheme: 'light' }))
      .toEqual({ attr: 'data-theme', value: 'dark' });
  });

  test('Tailwind class="dark" only with corroborating evidence, and not if already applied', () => {
    expect(H.classifyNativeDarkModeInfo({ hasDarkClassEvidence: true, hasDarkClassAlready: false }))
      .toEqual({ attr: 'class', value: 'dark' });
    expect(H.classifyNativeDarkModeInfo({ hasDarkClassEvidence: true, hasDarkClassAlready: true }))
      .toEqual({ alreadyDark: true });
  });

  test('no known convention, or no info at all, returns null (fail safe)', () => {
    expect(H.classifyNativeDarkModeInfo({})).toBeNull();
    expect(H.classifyNativeDarkModeInfo(null)).toBeNull();
  });
});

describe('logo-contrast candidate gating', () => {
  test('isLikelyLogoCandidateInfo: small header/nav image qualifies', () => {
    expect(H.isLikelyLogoCandidateInfo({ width: 100, height: 32, inHeaderOrNav: true })).toBe(true);
    expect(H.isLikelyLogoCandidateInfo({ width: 40, height: 40, hasLogoClassHint: true })).toBe(true);
    expect(H.isLikelyLogoCandidateInfo({ width: 60, height: 24, isHomeLinkImage: true })).toBe(true);
  });

  test('isLikelyLogoCandidateInfo: rejects large images (likely a photo/hero) regardless of position', () => {
    expect(H.isLikelyLogoCandidateInfo({ width: 900, height: 600, inHeaderOrNav: true })).toBe(false);
  });

  test('isLikelyLogoCandidateInfo: rejects small images with no logo/position signal', () => {
    expect(H.isLikelyLogoCandidateInfo({ width: 100, height: 32 })).toBe(false);
  });

  test('isLikelyLogoCandidateInfo: rejects tiny (icon-sized) images and missing info', () => {
    expect(H.isLikelyLogoCandidateInfo({ width: 8, height: 8, inHeaderOrNav: true })).toBe(false);
    expect(H.isLikelyLogoCandidateInfo(null)).toBe(false);
  });

  test('isNearMonochromeColorStats: flat-fill logo qualifies, photo-like spread does not', () => {
    expect(H.isNearMonochromeColorStats({ rSpread: 5, gSpread: 3, bSpread: 2 })).toBe(true);
    expect(H.isNearMonochromeColorStats({ rSpread: 200, gSpread: 180, bSpread: 220 })).toBe(false);
    // A single channel with wide spread is enough to reject — no partial credit.
    expect(H.isNearMonochromeColorStats({ rSpread: 5, gSpread: 5, bSpread: 150 })).toBe(false);
  });
});
