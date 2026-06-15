import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4101;

const chromePaths = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/google-chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
};

const chromePath = process.env.CHROME_BIN || chromePaths[process.platform];

async function startServer() {
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const file = req.url === '/' ? '/src/index.html' : req.url;
      const data = await readFile(join(__dirname, file));
      const ct = file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain';
      res.writeHead(200, { 'Content-Type': ct });
      res.end(data);
    } catch (err) {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise((resolve) => server.listen(PORT, resolve));
  return server;
}

async function runSmoke() {
  console.log('Starting smoke test for kimi-k2-code/01-model-showcase…');

  const server = await startServer();
  const errors = [];

  let browser;
  try {
    if (!chromePath) {
      throw new Error('Chrome executable not found. Set CHROME_BIN env variable.');
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        // Browsers auto-request /favicon.ico; our static server returns 404. Not a real error.
        if (text.includes('favicon.ico')) {
          console.log('Ignored favicon 404');
          return;
        }
        errors.push(text);
        console.error('Console error:', text);
      }
    });

    page.on('pageerror', (err) => {
      errors.push(err.message);
      console.error('Page error:', err.message);
    });

    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

    // DOM checks
    const svgCount = await page.evaluate(() => document.querySelectorAll('svg').length);
    const interactiveCount = await page.evaluate(
      () => document.querySelectorAll('button, details, [role="tab"]').length
    );

    console.log(`SVG elements found: ${svgCount}`);
    console.log(`Interactive elements found: ${interactiveCount}`);

    if (svgCount < 1) throw new Error('No SVG diagram found');
    if (interactiveCount < 1) throw new Error('No interactive elements found');

    // Screenshot: hero
    await page.screenshot({ path: join(__dirname, 'screenshots', '01-hero.png') });

    // Scroll and screenshot
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55));
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: join(__dirname, 'screenshots', '02-features.png') });

    // Interact with playground
    await page.evaluate(() => {
      const output = document.getElementById('pgOutput');
      if (output) output.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.evaluate(() => {
      const btn = document.getElementById('pgRun');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 2200));
    await page.screenshot({ path: join(__dirname, 'screenshots', '03-playground.png') });

    // Mobile viewport check
    await page.setViewport({ width: 360, height: 640 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`Mobile overflow detected: ${hasOverflow}`);
    if (hasOverflow) throw new Error('Horizontal overflow on mobile viewport');

    if (errors.length > 0) {
      throw new Error(`Smoke failed with ${errors.length} console/page errors`);
    }

    console.log('Smoke test passed.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runSmoke().catch((err) => {
  console.error('Smoke failed:', err.message);
  process.exit(1);
});
