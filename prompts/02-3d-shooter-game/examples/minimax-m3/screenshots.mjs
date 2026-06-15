// Capture screenshots of the running game for the test README and the GitHub issue.
// Writes PNGs into ./screenshots/ next to this script.
//
// Usage:
//   npx vite preview --host 0.0.0.0 --port 4173 &
//   node screenshots.mjs
//
// We reuse the same headless Chrome flags as smoke.mjs so the canvas renders
// in software (no GPU).

import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'screenshots');
await mkdir(OUT, { recursive: true });

const url = process.env.URL || 'http://localhost:4173/';

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

async function shot(name) {
  const file = join(OUT, name);
  await page.screenshot({ path: file, type: 'png' });
  console.log('  saved', file);
}

console.log('navigate', url);
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 600));

// 01-start: the title overlay
console.log('01-start');
await shot('01-start.png');

// Click PLAY
await page.click('#start-btn');
await new Promise(r => setTimeout(r, 400));

// 02-gameplay: look around a bit to show the arena
console.log('02-gameplay');
for (let i = 0; i < 20; i++) {
  await page.mouse.move(640 + Math.sin(i / 2) * 30, 400 + Math.cos(i / 2) * 20);
  await new Promise(r => setTimeout(r, 16));
}
await new Promise(r => setTimeout(r, 200));
await shot('02-gameplay.png');

// 03-firing: hold LMB to demonstrate muzzle flash + tracer
console.log('03-firing');
await page.mouse.down();
await new Promise(r => setTimeout(r, 90));
await shot('03-firing.png');
await new Promise(r => setTimeout(r, 200));
await page.mouse.up();

// 04-victory: teleport all bots close, kill them via the dev hook
console.log('04-victory');
await page.evaluate(() => {
  const g = window.__game;
  g.bots.forEach(b => { b.position.set(g.player.position.x - 2, 0, g.player.position.z - 3); b.hp = 30; b.alive = true; b.deathProgress = 0; });
});
await new Promise(r => setTimeout(r, 60));
await page.evaluate(() => {
  const g = window.__game;
  g.bots.forEach(b => b.takeDamage(999, g.player.position));
});
await new Promise(r => setTimeout(r, 800)); // let death anim + overlay show
await shot('04-victory.png');

await browser.close();
console.log('done');
