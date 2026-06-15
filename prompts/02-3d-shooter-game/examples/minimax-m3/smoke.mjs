// Comprehensive smoke test:
// - Page loads without errors
// - Auto-fire (queue) works: hold LMB, ammo drops 3+ times
// - Tracers / decals / sparks are spawned on shoot
// - Teleport a bot in front of the player, hit it, see painKick > 0
// - Damage bot to death, see deathProgress animate
// - No runtime errors

import puppeteer from 'puppeteer-core';

const url = process.env.URL || 'http://localhost:4174/';

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
page.on('error', e => errors.push('error: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' -> ' + r.failure()?.errorText));

console.log('navigate', url);
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 600));

const title = await page.title();
console.log('title:', title);

// Start the game
await page.click('#start-btn');
await new Promise(r => setTimeout(r, 300));

// ============================================================
// TEST 1: full-auto queue
// ============================================================
const ammoBefore = await page.evaluate(() => +document.getElementById('ammo-val').textContent);

// Hold LMB for 0.5s
await page.mouse.move(640, 400);
await page.mouse.down();
// small camera wiggle (in-game) so the raycast actually fires into the room
for (let i = 0; i < 10; i++) {
  await page.mouse.move(640 + (i % 2 ? 2 : -2), 400);
  await new Promise(r => setTimeout(r, 50));
}
await new Promise(r => setTimeout(r, 100));
await page.mouse.up();

await new Promise(r => setTimeout(r, 200));
const ammoAfter = await page.evaluate(() => +document.getElementById('ammo-val').textContent);
const shotsFired = ammoBefore - ammoAfter;
console.log(`TEST 1 (queue): ammo ${ammoBefore} -> ${ammoAfter} (${shotsFired} shots in ~0.6s)`);
const test1Pass = shotsFired >= 3;
console.log('  ->', test1Pass ? 'PASS' : 'FAIL');

// ============================================================
// TEST 2: effects spawned (tracer + decal + sparks during fire)
// ============================================================
// Fresh mag, aim at a wall, hold LMB, sample effect counts DURING the burst.
await page.evaluate(() => { window.__game.ammo = 30; });
// Aim at the back wall. Player spawn is (-26, 0, 26), wall is at z = -30.
// Yaw = 0 = facing -Z. We don't move the mouse, so the camera looks straight.
await page.mouse.move(640, 400);
await page.mouse.down();
await new Promise(r => setTimeout(r, 30));
const midBurst = await page.evaluate(() => {
  const g = window.__game;
  return { tracers: g.effects.tracers.length, decals: g.effects.decals.length, sparks: g.effects.sparks.length, ammo: g.ammo };
});
await new Promise(r => setTimeout(r, 200));
await page.mouse.up();
console.log('TEST 2 (effects mid-burst):', midBurst);
const test2Pass = midBurst && (midBurst.tracers + midBurst.decals + midBurst.sparks) > 0;
console.log('  ->', test2Pass ? 'PASS' : 'FAIL');

// ============================================================
// TEST 3: hit a bot, see painKick > 0
// ============================================================
// Teleport a bot 4m in front of the player. Player faces -Z by default (yaw=0).
// Don't _restart() — keep ammo, position, lock intact.
await page.evaluate(() => {
  const g = window.__game;
  g.bots[0].position.set(g.player.position.x, 0, g.player.position.z - 4);
  g.bots[0].hp = 60;
  g.bots[0].alive = true;
  g.bots[0].state = 'PATROL';
  g.bots[0].painKick = 0;
  g.ammo = g.magSize;
  g.fireTimer = 0;
  g.player.pitch = 0;
  g.player.yaw = 0;
});
// Sanity: confirm the bot is in front of the player along -Z
const tgt = await page.evaluate(() => {
  const g = window.__game;
  return {
    px: g.player.position.x, pz: g.player.position.z,
    bx: g.bots[0].position.x, bz: g.bots[0].position.z,
    dist: Math.hypot(g.player.position.x - g.bots[0].position.x,
                      g.player.position.z - g.bots[0].position.z)
  };
});
console.log('  bot in front of player:', tgt);
await new Promise(r => setTimeout(r, 60));
// Hold LMB ~0.3s → at least 2 shots, one should hit
await page.mouse.down();
await new Promise(r => setTimeout(r, 300));
await page.mouse.up();
await new Promise(r => setTimeout(r, 60));

const botState = await page.evaluate(() => {
  const g = window.__game;
  const b = g.bots[0];
  return {
    hp: b.hp, alive: b.alive, painKick: b.painKick,
    hitFromDir: { x: b.hitFromDir.x, z: b.hitFromDir.z },
    deathProgress: b.deathProgress,
    ammo: g.ammo
  };
});
console.log('TEST 3 (bot pain):', botState);
const test3Pass = botState && (botState.painKick > 0 || !botState.alive || botState.hp < 60);
console.log('  ->', test3Pass ? 'PASS' : 'FAIL');

// ============================================================
// TEST 4: death animation runs
// ============================================================
await page.evaluate(() => {
  const g = window.__game;
  g.bots[0].takeDamage(60, g.player.position);
});
// Wait a few frames
for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 50));
const deathState = await page.evaluate(() => {
  const b = window.__game.bots[0];
  return { alive: b.alive, deathProgress: b.deathProgress, bodyRotX: b.body.rotation.x };
});
console.log('TEST 4 (death anim):', deathState);
const test4Pass = deathState && !deathState.alive && deathState.deathProgress > 0 && deathState.deathProgress <= 1;
console.log('  ->', test4Pass ? 'PASS' : 'FAIL');

// Wait for death anim to finish
await new Promise(r => setTimeout(r, 600));
const finalDeath = await page.evaluate(() => {
  const b = window.__game.bots[0];
  return { deathProgress: b.deathProgress, bodyRotX: b.body.rotation.x };
});
console.log('  after 0.6s:', finalDeath, '->', finalDeath.deathProgress >= 0.99 ? 'PASS' : 'FAIL');

// ============================================================
// TEST 5: kill counter decreases after killing all bots
// ============================================================
await page.evaluate(() => {
  const g = window.__game;
  g.bots.forEach(b => { b.takeDamage(999, g.player.position); });
});
await new Promise(r => setTimeout(r, 200));
const endState = await page.evaluate(() => {
  const g = window.__game;
  return {
    ended: g.ended,
    alive: g.bots.map(b => b.alive),
    overlay: !document.getElementById('overlay').classList.contains('hidden')
  };
});
console.log('TEST 5 (all dead):', endState);
const test5Pass = endState.ended === 'win';
console.log('  ->', test5Pass ? 'PASS' : 'FAIL');

// ============================================================
// Summary
// ============================================================
console.log('\n===== SUMMARY =====');
const results = [
  ['1. full-auto queue',       test1Pass],
  ['2. effects spawned',       test2Pass],
  ['3. bot pain reaction',     test3Pass],
  ['4. death animation',       test4Pass && finalDeath.deathProgress >= 0.99],
  ['5. all dead -> victory',   test5Pass]
];
let allPass = true;
for (const [name, pass] of results) {
  console.log(`  ${pass ? 'OK  ' : 'FAIL'}  ${name}`);
  if (!pass) allPass = false;
}
if (consoleErrors.length) {
  console.log('\nconsole.error messages:');
  for (const m of consoleErrors) console.log('  ', m);
}
if (errors.length) {
  console.log('\nuncaught errors:');
  for (const e of errors) console.log('  ', e);
}

await browser.close();
process.exit(allPass && errors.length === 0 ? 0 : 1);
