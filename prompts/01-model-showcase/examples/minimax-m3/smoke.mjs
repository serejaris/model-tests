// Smoke + screenshot script for the model-showcase example.
// 1) boots a tiny static server on a free port,
// 2) opens the page in headless Chromium,
// 3) takes 4 screenshots covering hero / capabilities / playground / timeline,
// 4) checks for SVG + interactive elements + console errors.

import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4101;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.json': 'application/json'
};

const server = createServer(async (req, res) => {
  const file = join(ROOT, req.url === '/' ? 'index.html' : req.url);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end(String(e));
  }
});
await new Promise(r => server.listen(PORT, r));
console.log(`server up on http://localhost:${PORT}/`);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--use-angle=swiftshader', '--use-gl=angle',
    '--enable-unsafe-swiftshader', '--enable-webgl',
    '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
    '--no-first-run', '--mute-audio',
    '--disable-features=VizDisplayCompositor'
  ],
  defaultViewport: { width: 1280, height: 800 }
});

const page = await browser.newPage();
const errors = [];
const consoleErrors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 400));

const OUT = join(__dirname, 'screenshots');
await mkdir(OUT, { recursive: true });

// 01 — hero (top of page)
await page.screenshot({ path: join(OUT, '01-hero.png') });
console.log('  01-hero.png');

// 02 — capabilities tabs (scroll to #capabilities, click 2nd tab to show diversity)
await page.evaluate(() => document.getElementById('capabilities').scrollIntoView({ behavior: 'instant', block: 'start' }));
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: join(OUT, '02-capabilities.png') });
console.log('  02-capabilities.png');

// click 3rd tab to show different content
const tabButtons = await page.$$('.tab-btn');
if (tabButtons[2]) {
  await tabButtons[2].click();
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: join(OUT, '03-tabs-alt.png') });
  console.log('  03-tabs-alt.png (long-context tab)');
}

// 03 — playground (scroll, click Run)
await page.evaluate(() => document.getElementById('playground').scrollIntoView({ behavior: 'instant', block: 'start' }));
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: join(OUT, '04-playground.png') });
console.log('  04-playground.png');

await page.click('#run-btn');
await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: join(OUT, '05-playground-ran.png') });
console.log('  05-playground-ran.png');

// 04 — timeline (scroll, hover)
await page.evaluate(() => document.getElementById('timeline').scrollIntoView({ behavior: 'instant', block: 'start' }));
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: join(OUT, '06-timeline.png') });
console.log('  06-timeline.png');

// 05 — limits section
await page.evaluate(() => document.getElementById('limits').scrollIntoView({ behavior: 'instant', block: 'start' }));
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: join(OUT, '07-limits.png') });
console.log('  07-limits.png');

// structural assertions
const svgCount = await page.$$eval('svg', els => els.length);
const interactiveCount = await page.$$eval('button, details, [role="tab"]', els => els.length);
const h1Text = await page.$eval('h1', el => el.textContent.trim());
const hasModel = /minimax/i.test(h1Text) || /модел/i.test(h1Text);
const wordCount = await page.evaluate(() => document.body.innerText.split(/\s+/).length);

console.log('\nSMOKE');
console.log('  h1 text:             ', JSON.stringify(h1Text.slice(0, 80)));
console.log('  h1 mentions model:   ', hasModel ? 'OK' : 'FAIL');
console.log('  svg elements:        ', svgCount, svgCount >= 1 ? 'OK' : 'FAIL');
console.log('  interactive elements:', interactiveCount, interactiveCount >= 1 ? 'OK' : 'FAIL');
console.log('  body word count:     ', wordCount, wordCount > 200 ? 'OK' : 'FAIL');
console.log('  pageerror:           ', errors.length);
console.log('  console.error:       ', consoleErrors.length);
if (consoleErrors.length) {
  for (const m of consoleErrors) console.log('    !', m);
}

await browser.close();
server.close();

const ok = svgCount >= 1 && interactiveCount >= 1 && hasModel && errors.length === 0 && consoleErrors.length === 0;
process.exit(ok ? 0 : 1);
