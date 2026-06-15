// smoke.mjs — проверка артефакта 01-model-showcase (claude-opus-4)
// Поднимает локальный сервер, открывает страницу в headless Chrome,
// снимает скриншоты, проверяет наличие SVG/интерактива, отсутствие
// ошибок в консоли и overflow на мобильной ширине.
//
// Запуск:  node smoke.mjs
// puppeteer-core резолвится из node_modules в корне репозитория.

import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'src');
const SHOTS = join(__dirname, 'screenshots');
const PORT = 4101;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png'
};

const server = createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  try {
    const data = await readFile(join(SRC, url));
    res.writeHead(200, { 'Content-Type': MIME[extname(url)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end(String(e)); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb']
});

const page = await browser.newPage();
// reduced-motion → CSS отключает smooth-scroll, скроллы становятся мгновенными
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
// детерминированный скролл для скриншотов (гасим smooth-scroll наверняка)
await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });

// выравнивает заголовок секции под sticky-шапкой — предсказуемый кадр
const scrollToSection = (sel, offset = 70) =>
  page.evaluate((s, o) => {
    const el = document.querySelector(s);
    const y = el.getBoundingClientRect().top + window.scrollY - o;
    window.scrollTo(0, y);
  }, sel, offset);

// 1. hero
await page.screenshot({ path: join(SHOTS, '01-hero.png') });

// 2. effort playground — выкрутить на max и снять header + виджет
await page.$eval('#effSlider', (el) => {
  el.value = '4';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await scrollToSection('#effort');
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: join(SHOTS, '02-effort-playground.png') });

// 3. code tabs — переключить на TypeScript
await page.$$eval('.tab', (tabs) => { const ts = tabs.find((t) => t.dataset.panel === 'ts'); if (ts) ts.click(); });
await scrollToSection('#code');
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: join(SHOTS, '03-code-tabs.png') });

// 4. comparison table
await scrollToSection('#family');
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: join(SHOTS, '04-comparison.png') });

// 5. light theme + scroll top
await page.$eval('#themeBtn', (el) => el.click());
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: join(SHOTS, '05-light-theme.png') });

// assertions
const svgCount = await page.$$eval('svg', (els) => els.length);
const interactiveCount = await page.$$eval('button, details, [role="tab"], input[type="range"]', (els) => els.length);

// mobile overflow check at 360x640
await page.$eval('#themeBtn', (el) => el.click()); // back to dark
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2 });
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: join(SHOTS, '06-mobile.png') });
const overflow = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  win: window.innerWidth,
  has: document.documentElement.scrollWidth > window.innerWidth + 1
}));

await browser.close();
server.close();

const pass = svgCount >= 1 && interactiveCount >= 1 && consoleErrors.length === 0 && !overflow.has;
const report = {
  svgCount,
  interactiveCount,
  consoleErrors,
  mobileOverflow: overflow,
  screenshots: ['01-hero', '02-effort-playground', '03-code-tabs', '04-comparison', '05-light-theme', '06-mobile'],
  result: pass ? 'PASS' : 'FAIL'
};
console.log(JSON.stringify(report, null, 2));
process.exit(pass ? 0 : 1);
