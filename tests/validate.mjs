/* Zero-dependency repository contract checks. Run with Node.js 18+. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const css = read('tokens.css');
const declarations = [...css.matchAll(/(--dn-[\w-]+)\s*:\s*([^;]+);/g)];
const tokens = Object.fromEntries(declarations.map(([, name, value]) => [name, value.trim()]));
assert.equal(declarations.length, Object.keys(tokens).length, 'Tokens must not be duplicated');
function token(name) {
  assert.ok(tokens[name], `Missing token ${name}`);
  const alias = tokens[name].match(/^var\((--dn-[\w-]+)\)$/);
  return alias ? token(alias[1]) : tokens[name];
}
const expected = {
  teal: '#59AAA5', cyan: '#70B2D1', emerald: '#72AD8C', violet: '#A18BC8',
  amber: '#D4AC65', orange: '#D78E74', steel: '#829BA9', crimson: '#C98292',
  canvas: '#F9FBFA', surface: '#FFFFFF', 'ink-primary': '#253B39',
  'ink-secondary': '#657B77', 'ink-muted': '#82938F', divider: '#E1E9E7'
};
for (const [name, value] of Object.entries(expected)) assert.equal(token(`--dn-${name}`), value, `Brand value changed: ${name}`);
assert.equal(token('--dn-radius'), '0px');
assert.equal(token('--dn-ease-in'), 'cubic-bezier(.1, .9, .2, 1)');
assert.equal(token('--dn-ease-out'), 'cubic-bezier(.7, 0, 1, .5)');
assert.equal(token('--dn-ease-snap'), 'cubic-bezier(.17, .89, .32, 1.18)');
const ms = (name) => Number.parseFloat(token(name));
for (const [name, lo, hi] of [['hover', 150, 250], ['press', 100, 180], ['expand', 250, 450], ['page', 300, 500]]) {
  assert.ok(ms(`--dn-duration-${name}`) >= lo && ms(`--dn-duration-${name}`) <= hi, `Duration outside guideline: ${name}`);
}
assert.equal(ms('--dn-stagger'), 45);
assert.ok(ms('--dn-press-scale') >= 0.96 && ms('--dn-press-scale') <= 0.985);
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const pairs = [];
for (const color of Object.keys(expected).slice(0, 8)) pairs.push(['--dn-text-on-color', `--dn-${color}`, 4.5]);
for (const background of ['--dn-canvas', '--dn-surface']) {
  for (const text of ['--dn-text-primary', '--dn-text-secondary']) pairs.push([text, background, 4.5]);
  pairs.push(['--dn-control-border', background, 3]);
}
pairs.push(['--dn-text-on-ink', '--dn-ink-primary', 4.5]);
// White Acrylic at .82 over black is its darkest possible uniform composite.
const opacity = Number.parseFloat(token('--dn-acrylic-opacity'));
assert.equal(opacity, 0.82);
const darkestAcrylic = '#' + Math.round(255 * opacity).toString(16).repeat(3);
assert.ok(contrast(token('--dn-text-primary'), darkestAcrylic) >= 4.5, 'Acrylic default text must survive darkest composite');
for (const [foreground, background, minimum] of pairs) {
  const ratio = contrast(token(foreground), token(background));
  assert.ok(ratio >= minimum, `${foreground} on ${background}: ${ratio.toFixed(2)} < ${minimum}`);
  console.log(`${foreground} / ${background}: ${ratio.toFixed(2)}:1 PASS`);
}
for (const name of ['materials.css', 'motion.css', 'examples/specimen.css']) {
  const contents = read(name);
  for (const [, reference] of contents.matchAll(/var\((--dn-[\w-]+)/g)) {
    if (reference === '--dn-enter-index') continue;
    assert.ok(tokens[reference], `Unknown token ${reference} in ${name}`);
  }
}
assert.ok(read('materials.css').includes('@supports'));
assert.match(read('materials.css'), /\.dn-acrylic\s*\{\s*background:\s*var\(--dn-surface\)/);
assert.ok(read('materials.css').includes('prefers-reduced-transparency'));
assert.ok(read('materials.css').includes('[data-dn-transparency="off"]'));
assert.ok(read('motion.css').includes('prefers-reduced-motion'));
assert.ok(read('motion.css').includes('forced-colors'));
assert.ok(read('examples/specimen.js').includes('prefers-reduced-motion'));
assert.doesNotMatch(read('examples/specimen.js'), /\b(fetch|XMLHttpRequest|setInterval|localStorage)\s*[.(]/);
assert.doesNotMatch(read('examples/specimen.css'), /#[0-9a-fA-F]{3,8}\b/, 'Specimen must reference color tokens');
const design = read('DESIGN.md');
for (let chapter = 1; chapter <= 11; chapter++) assert.ok(design.includes(`## ${chapter}. `), `Missing original chapter ${chapter}`);
for (const name of ['README.md', 'DESIGN.md', 'AGENTS.md', 'CHANGELOG.md']) {
  for (const [, href] of read(name).matchAll(/\]\(([^)]+)\)/g)) {
    if (/^[a-z]+:/.test(href) || href.startsWith('#')) continue;
    assert.ok(existsSync(resolve(root, dirname(name), href.split('#')[0])), `Broken link ${href} in ${name}`);
  }
}
const html = read('examples/index.html');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
assert.equal(ids.length, new Set(ids).size, 'Duplicate HTML IDs');
for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (href.startsWith('data:')) continue;
  if (href.startsWith('#')) assert.ok(ids.includes(href.slice(1)), `Missing anchor ${href}`);
  else assert.ok(existsSync(resolve(root, 'examples', href)), `Missing local asset ${href}`);
}
console.log(`\nPASS: ${Object.keys(tokens).length} tokens; 14 fixed primitives; ${pairs.length} contrast pairs; asset, motion, fallback and documentation contracts.`);
