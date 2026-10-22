// Render the same five views (+ semantic strip) of the prototype for one colour option.
// usage: NODE_PATH=<node_modules> node views.js <siteDir> <outDir>
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const [,, site, out] = process.argv; fs.mkdirSync(out, { recursive: true });
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const b = await chromium.launch(exe);
  const url = f => 'file://' + path.join(site, f);
  const shot = async (w, h, f, name, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const p = await ctx.newPage(); await p.goto(url(f)); await p.waitForTimeout(250);
    if (opts.selector) await p.locator(opts.selector).first().screenshot({ path: path.join(out, name) });
    else await p.screenshot({ path: path.join(out, name), clip: opts.clip, fullPage: !!opts.clip });
    await ctx.close();
  };
  await shot(1440, 980, 'index.html', '1-desktop-hero.png');
  await shot(375, 812, 'index.html', '2-mobile-hero.png', { clip: { x: 0, y: 0, width: 375, height: 1640 } });
  await shot(1440, 900, 'soirees.html', '3-events.png', { clip: { x: 0, y: 0, width: 1440, height: 1500 } });
  await shot(1440, 900, 'index.html', '4-learning.png', { selector: 'section[aria-labelledby="dev"]' });
  await shot(1080, 1350, 'poster.html', '5-poster.png');
  await shot(1440, 900, 'index.html', '6-semantics.png', { selector: 'section[aria-labelledby="etat"]' });
  await b.close();
})();
