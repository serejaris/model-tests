// smoke.mjs — headless проверка index.html
// 1. поднимает http-сервер в этой папке
// 2. открывает index.html в headless Chromium
// 3. проверяет: 1+ <svg>, 1+ интерактивный элемент, нет ошибок в консоли
// 4. снимает скриншоты: hero, scroll-mid, активный tab, тёмная тема
// 5. выходит с кодом 0 если всё OK, 1 если провалилось

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = 4123;
const URL = `http://127.0.0.1:${PORT}/index.html`;
const SHOTS = path.join(ROOT, 'screenshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let p = path.join(ROOT, url === '/' ? '/index.html' : url);
      p = path.normalize(p);
      if (!p.startsWith(ROOT)) { res.statusCode = 403; return res.end('forbidden'); }
      fs.stat(p, (err, st) => {
        if (err || !st.isFile()) { res.statusCode = 404; return res.end('not found'); }
        const type = MIME[path.extname(p)] || 'application/octet-stream';
        res.setHeader('content-type', type);
        res.setHeader('cache-control', 'no-store');
        fs.createReadStream(p).pipe(res);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const c of candidates) { try { fs.accessSync(c, fs.constants.X_OK); return c; } catch (_) {} }
  // playwright cache
  const home = process.env.HOME || '';
  const pw = path.join(home, 'Library/Caches/ms-playwright');
  if (fs.existsSync(pw)) {
    const entries = fs.readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const e of entries) {
      const candidate = path.join(pw, e, 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium');
      try { fs.accessSync(candidate, fs.constants.X_OK); return candidate; } catch (_) {}
    }
  }
  return null;
}

const results = { checks: [], errors: [], screenshots: [] };
function check(name, ok, detail = '') {
  results.checks.push({ name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
}

async function run() {
  const server = await startServer();
  console.log(`[smoke] server up on ${URL}`);

  const exe = findChrome();
  if (!exe) {
    console.error('[smoke] FATAL: не нашёл Chrome/Chromium ни в Applications, ни в playwright cache');
    process.exit(1);
  }
  console.log(`[smoke] using browser: ${exe}`);

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  console.log('[smoke] browser launched');

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto(URL, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 200)); // дать шрифтам/стилям устаканиться

  // screenshot: hero
  await page.screenshot({ path: path.join(SHOTS, '01-hero.png'), fullPage: false });
  results.screenshots.push('01-hero.png');

  // check 1: есть <svg>
  const svgCount = await page.evaluate(() => document.querySelectorAll('svg').length);
  check('есть inline <svg>', svgCount >= 1, `найдено ${svgCount}`);

  // check 2: есть интерактивный элемент
  const interactiveCount = await page.evaluate(() => {
    const sel = 'button, details, [role="tab"], input, select, textarea, a[href]';
    return document.querySelectorAll(sel).length;
  });
  check('есть интерактивные элементы', interactiveCount >= 3, `найдено ${interactiveCount}`);

  // check 3: размер < 200 КБ
  const html = fs.readFileSync(path.join(ROOT, 'index.html'));
  const kb = (html.length / 1024).toFixed(1);
  check('index.html < 200 КБ', html.length < 200 * 1024, `${kb} КБ`);

  // check 4: mobile-friendly — открываем 360×640 и смотрим, нет ли горизонтального скролла
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 200));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('нет горизонтального скролла на 360×640', overflow <= 1, `overflow=${overflow}px`);
  await page.screenshot({ path: path.join(SHOTS, '04-mobile.png'), fullPage: false });
  results.screenshots.push('04-mobile.png');

  // check 5: tabs работают — кликаем на вторую вкладку, активная меняется
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 200));
  await page.click('[data-tab="struct"]');
  await new Promise(r => setTimeout(r, 200));
  const structActive = await page.evaluate(() => {
    const h = document.querySelector('[data-tab="struct"]');
    const p = document.querySelector('[data-pane="struct"]');
    return h.classList.contains('active') && p.classList.contains('active');
  });
  check('вкладки переключаются', structActive);
  await page.screenshot({ path: path.join(SHOTS, '03-tab-active.png'), fullPage: false });
  results.screenshots.push('03-tab-active.png');

  // check 6: playground Run показывает блок ответа
  await page.click('[data-playground="struct"] .run');
  await new Promise(r => setTimeout(r, 200));
  const outShown = await page.evaluate(() => {
    const o = document.querySelector('[data-playground="struct"] .out');
    return o && o.classList.contains('show');
  });
  check('playground Run показывает ответ', outShown);

  // check 7: scroll-down screenshot
  await page.evaluate(() => window.scrollTo(0, 800));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(SHOTS, '02-scroll.png'), fullPage: false });
  results.screenshots.push('02-scroll.png');

  // check 8: переключатель темы работает
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 100));
  const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('#themeToggle');
  await new Promise(r => setTimeout(r, 200));
  const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check('переключатель темы работает', themeBefore !== themeAfter, `${themeBefore} → ${themeAfter}`);
  await page.screenshot({ path: path.join(SHOTS, '05-dark.png'), fullPage: false });
  results.screenshots.push('05-dark.png');

  // check 9: нет ошибок в консоли
  check('нет ошибок в консоли', consoleErrors.length === 0, consoleErrors.length ? consoleErrors.join(' | ') : 'clean');

  // полный скриншот
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: path.join(SHOTS, '00-full.png'), fullPage: true });
  results.screenshots.push('00-full.png');

  await browser.close();
  server.close();

  const passed = results.checks.filter(c => c.ok).length;
  const total = results.checks.length;
  console.log(`\n[smoke] ${passed}/${total} checks passed`);
  if (passed === total) {
    console.log('[smoke] OK');
    process.exit(0);
  } else {
    console.log('[smoke] FAIL');
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('[smoke] uncaught:', e);
  process.exit(1);
});
