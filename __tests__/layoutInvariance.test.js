/**
 * Layout invariance (RELEASE_PLAN "Engine principles"): theming never changes
 * spacing or size. Aura may only write paint (colors, backgrounds, filters,
 * visibility). This scans every place the extension writes styles — the CSS
 * it generates and every inline style write — for properties that move or
 * resize boxes. Anything that does must be in ALLOWED with a reason.
 * The harness checks the same thing at runtime (Layout Δ, sheets on vs off).
 */
const fs = require('fs');
const path = require('path');

const RES = path.join(__dirname, '../ios/TintExtension Extension/Resources');
const read = (f) => fs.readFileSync(path.join(RES, f), 'utf8');

const GEOMETRY = new RegExp('^(?:' + [
  'padding(?:-[a-z-]+)?', 'margin(?:-[a-z-]+)?',
  '(?:min-|max-)?(?:width|height)', 'inline-size', 'block-size',
  'top', 'right', 'bottom', 'left', 'inset(?:-[a-z-]+)?',
  'border', 'border-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?',
  'border(?:-(?:top|right|bottom|left))?-(?:width|style)',
  'display', 'position', 'float', 'clear',
  'transform', 'translate', 'scale', 'rotate',
  'flex(?:-[a-z]+)?', 'grid(?:-[a-z-]+)?', 'gap', 'row-gap', 'column-gap', 'order',
  'font', 'font-size', 'font-family', 'line-height', 'letter-spacing', 'word-spacing',
  'box-sizing', 'zoom', 'aspect-ratio', 'columns', 'column-count', 'writing-mode',
].join('|') + ')$');

// [file, property, value pattern, why it can't change layout]
const ALLOWED = [
  ['content.js', 'border', /^1px solid var\(--aura-border\)/,
    'Wikipedia SITE_FIX (.infobox/.navbox/.wikitable/...): Minerva already draws a 1px border on these; only its color changes.'],
  ['splitTheme.js', 'position', /^fixed/, 'html::before split-theme paint layer: a pseudo-element, out of flow, pointer-events:none.'],
  ['splitTheme.js', 'top', /^0/, 'same html::before layer'],
  ['splitTheme.js', 'left', /^0/, 'same html::before layer'],
  ['splitTheme.js', 'width', /^100vw/, 'same html::before layer'],
  ['splitTheme.js', 'height', /^100[dl]?vh/, 'same html::before layer'],
];

const allowed = (file, prop, value) => ALLOWED.some(([f, p, v]) => f === file && p === prop && v.test(value));

// Declarations inside CSS text, with /* comments */ removed (they quote
// site CSS like "position: sticky; top: 0" as evidence).
function declarations(css) {
  const out = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of text.matchAll(/(?:^|[{;])\s*([a-z-]+)\s*:\s*([^;{}]+)/g)) {
    out.push([m[1], m[2].trim()]);
  }
  return out;
}

function cssStrings(file, src) {
  if (file === 'splitTheme.js') {
    // Built by string concatenation: 'prop:value!important;' pieces.
    return [...src.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]).join('');
  }
  // Whole-line // comments first: they quote site CSS in backticks, which
  // would pair up with real template literals.
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\/\*\*|\*(?!\s*\{))/.test(l)).join('\n');
  return [...code.matchAll(/`([^`]*)`/g)].map((m) => m[1]).join('\n');
}

const FILES = ['content.js', 'injected.js', 'splitTheme.js'];

describe('layout invariance', () => {
  test.each(FILES)('%s: generated CSS only sets paint properties', (file) => {
    const bad = declarations(cssStrings(file, read(file)))
      .filter(([prop, value]) => GEOMETRY.test(prop) && !allowed(file, prop, value))
      .map(([prop, value]) => `${prop}: ${value}`);
    expect(bad).toEqual([]);
  });

  test.each(FILES)('%s: inline style writes only set paint properties', (file) => {
    const src = read(file);
    const bad = [...src.matchAll(/setProperty\(\s*['"]([a-z-]+)['"]\s*,\s*([^,)]+)/g)]
      .filter((m) => GEOMETRY.test(m[1]) && !allowed(file, m[1], m[2].replace(/^['"]|['"]$/g, '')))
      .map((m) => m[0]);
    // Direct property assignment (el.style.width = ...) and cssText bypass
    // the setProperty scan, so they're not allowed at all.
    const direct = [...src.matchAll(/\.style\.([a-zA-Z]+)\s*=(?!=)/g)].map((m) => m[0]);
    const cssText = [...src.matchAll(/\.style\.cssText\s*=|setAttribute\(\s*['"]style['"]/g)].map((m) => m[0]);
    expect([...bad, ...direct, ...cssText]).toEqual([]);
  });

  test('the scan sees real declarations (guards against a silently empty scan)', () => {
    const props = declarations(cssStrings('content.js', read('content.js'))).map(([p]) => p);
    expect(props).toEqual(expect.arrayContaining(['background-color', 'color', 'border']));
    expect(GEOMETRY.test('padding-top')).toBe(true);
    expect(GEOMETRY.test('background-color')).toBe(false);
  });
});
