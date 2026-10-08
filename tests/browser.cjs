/* External tooling only: puppeteer-core + installed Edge/Chrome. No browser download. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const output = process.env.DNDL_REPORT_DIR || path.join(root, 'reports');
const browserPath = process.env.DNDL_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = pathToFileURL(path.join(root, 'examples/index.html')).href;
const checks = [], errors = [], contrastSummary = [];
const check = (name, data = {}) => checks.push({ name, status: 'PASS', ...data });

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true,
    // File pages need this flag to read cssRules of their own file:// stylesheets.
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'], defaultViewport: { width: 1440, height: 1000 } });
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push(`Request failed: ${r.url()}`));
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
    });
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });

    // Composite translucent backgrounds over parent surfaces, including sticky Acrylic.
    const measureContrast = async () => page.evaluate(() => {
      const rgba = (value) => {
        const numbers = value.match(/[\d.]+/g).map(Number);
        return [...numbers.slice(0, 3), numbers[3] ?? 1];
      };
      const blend = (top, base) => top.slice(0, 3).map((v, i) => v * top[3] + base[i] * (1 - top[3]));
      function background(el) {
        if (!el || el === document.documentElement) return [255, 255, 255];
        const color = rgba(getComputedStyle(el).backgroundColor);
        return blend(color, background(el.parentElement));
      }
      const lum = (c) => {
        const a = c.map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return a[0] * .2126 + a[1] * .7152 + a[2] * .0722;
      };
      const failures = []; let count = 0, minimum = Infinity;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, el = node.parentElement;
        if (!node.textContent.trim() || el.closest('script, style, noscript')) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || !el.getClientRects().length) continue;
        const bg = background(el), fg = blend(rgba(style.color), bg);
        const a = lum(bg), b = lum(fg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        const size = parseFloat(style.fontSize), weight = parseInt(style.fontWeight, 10);
        const threshold = size >= 24 || (size >= 18.67 && weight >= 700) ? 3 : 4.5;
        minimum = Math.min(minimum, ratio); count++;
        if (ratio < threshold) failures.push({ text: node.textContent.trim().slice(0, 60), ratio, threshold });
      }
      return { count, minimum, failures };
    });
    let contrast = await measureContrast();
    assert.deepEqual(contrast.failures, [], 'Rendered page text contrast');
    contrastSummary.push({ state: 'desktop', ...contrast });
    check('Desktop rendered text contrast', { nodes: contrast.count });

    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 900 });
      const geometry = await page.evaluate(() => ({
        viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll('main *')].filter((e) => {
          if (!e.getClientRects().length) return false;
          const r = e.getBoundingClientRect();
          return r.left < -1 || r.right > innerWidth + 1;
        }).map((e) => e.tagName + '.' + e.className)
      }));
      assert.ok(geometry.scrollWidth <= width + 1, `Horizontal page overflow ${width}: ${JSON.stringify(geometry)}`);
      assert.deepEqual(geometry.elements, [], `Element overflow ${width}`);
      check(`No horizontal overflow at ${width}px`);
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    await page.type('#context-note', '保留我的上下文');
    await page.$eval('#origin', (e) => e.scrollIntoView({ block: 'center' }));
    const saved = await page.evaluate(() => ({ scroll: scrollY, value: document.querySelector('#context-note').value }));
    await page.click('#origin');
    await page.waitForFunction(() => document.querySelector('#detail').open && !document.querySelector('.detail-panel').getAnimations().length);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'close-detail');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.querySelector('#detail').contains(document.activeElement)), true, 'Modal focus escapes');
    }
    contrast = await measureContrast();
    assert.deepEqual(contrast.failures, [], 'Dialog rendered text contrast');
    contrastSummary.push({ state: 'mobile-dialog', ...contrast });
    await page.screenshot({ path: path.join(output, 'detail-mobile.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#detail').open);
    const restored = await page.evaluate(() => ({ scroll: scrollY, value: document.querySelector('#context-note').value, focus: document.activeElement.id }));
    assert.ok(Math.abs(restored.scroll - saved.scroll) <= 1);
    assert.equal(restored.value, saved.value);
    assert.equal(restored.focus, 'origin');
    check('Mobile dialog, Tab containment, Escape, focus and context return');

    await page.setViewport({ width: 1440, height: 1000 });
    await page.click('#origin');
    await page.waitForFunction(() => document.querySelector('#detail').open && !document.querySelector('.detail-panel').getAnimations().length);
    await page.screenshot({ path: path.join(output, 'detail-desktop.png'), fullPage: true });
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    assert.equal(await page.evaluate(() => document.querySelector('#detail').contains(document.activeElement)), true);
    await page.click('#close-detail');
    await page.waitForFunction(() => !document.querySelector('#detail').open);
    check('Desktop detail, reverse Tab containment and close control');

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.click('#origin');
    assert.equal(await page.evaluate(() => document.querySelector('#detail').open), true);
    assert.equal(await page.evaluate(() => document.querySelector('.detail-panel').getAnimations().length), 0);
    await page.click('#close-detail');
    assert.equal(await page.evaluate(() => document.querySelector('#detail').open), false);
    await page.hover('#origin');
    assert.equal(await page.$eval('#origin', (e) => getComputedStyle(e).transform), 'none');
    check('Reduced motion disables modal animation and hover displacement');

    await page.click('#origin');
    await page.click('#return-detail');
    assert.equal(await page.evaluate(() => document.querySelector('#detail').open), false);
    check('Explicit Return control closes modal');
    await page.click('#transparency');
    const fallback = await page.$eval('.site-header', (e) => ({ bg: getComputedStyle(e).backgroundColor, blur: getComputedStyle(e).backdropFilter }));
    assert.equal(fallback.bg, 'rgb(255, 255, 255)');
    assert.equal(fallback.blur, 'none');
    check('Manual transparency-off produces opaque fallback');
    await page.click('#transparency');
    assert.equal(await page.$eval('#transparency', (e) => e.getAttribute('aria-pressed')), 'false');

    // Current browser supports blur: emulate unsupported CSS through a read-only style-rule test.
    await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        if (!sheet.href?.endsWith('materials.css')) continue;
        for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
          if (sheet.cssRules[i] instanceof CSSSupportsRule) sheet.deleteRule(i);
        }
      }
    });
    assert.equal(await page.$eval('.site-header', (e) => getComputedStyle(e).backgroundColor), 'rgb(255, 255, 255)');
    check('Opaque base when blur enhancement rule is absent');

    const keyboard = await browser.newPage();
    await keyboard.goto(url, { waitUntil: 'load' });
    await keyboard.keyboard.press('Tab');
    assert.equal(await keyboard.evaluate(() => document.activeElement.classList.contains('skip')), true);
    const focus = await keyboard.evaluate(() => {
      const e = document.activeElement, s = getComputedStyle(e);
      return { outline: s.outlineStyle, width: parseFloat(s.outlineWidth), top: e.getBoundingClientRect().top };
    });
    assert.equal(focus.outline, 'solid'); assert.ok(focus.width >= 2 && focus.top >= 0);
    check('Keyboard skip link and visible focus ring');
    await keyboard.close();

    const nojs = await browser.newPage();
    await nojs.setJavaScriptEnabled(false);
    await nojs.goto(url, { waitUntil: 'load' });
    await nojs.click('#origin');
    assert.ok(nojs.url().endsWith('#continuity-notes'));
    assert.equal(await nojs.$eval('#transparency', (e) => getComputedStyle(e).display), 'none');
    check('No-JS explanation link remains usable; inactive switch stays hidden');
    await nojs.close();
    assert.deepEqual(errors, [], 'Runtime console/page/request errors');
    check('No runtime or failed-resource errors');
    const report = { status: 'PASS', browser: await browser.version(), checks, contrast: contrastSummary, errors,
      limitations: ['Not a full WCAG audit.', 'Forced-colors and OS reduced-transparency CSS included, not visually tested.', 'Blur-unsupported fallback is simulated by removing enhancement rule, not tested on legacy engine.', 'No cross-site or touch-device hardware testing.'] };
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch((error) => {
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ status: 'FAIL', checks, errors, error: error.stack }, null, 2));
  console.error(error); process.exitCode = 1;
});
