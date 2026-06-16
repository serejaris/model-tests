import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.URL || "http://127.0.0.1:4173/";
const chromePath =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const checks = [];
const record = (name, pass, detail = "") => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");

record("local three import", html.includes("./node_modules/three/build/three.module.js"));
record("enemy creation exists", html.includes("function createEnemy()"));
record("raycast shooting exists", html.includes("raycaster.intersectObjects(enemies, true)"));
record("hp damage exists", html.includes("state.health -= 9"));
record("victory path exists", html.includes("state.score >= 3000"));
record(
  "no external media assets",
  !/(https?:\/\/.*\.(png|jpg|jpeg|webp|gif|glb|gltf|mp3|wav))/i.test(html)
);

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--use-angle=swiftshader",
    "--use-gl=angle",
    "--enable-unsafe-swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-gpu-sandbox",
    "--no-first-run",
    "--mute-audio"
  ]
});

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (msg) => {
  if (
    msg.type() === "error" &&
    !msg.text().includes("favicon.ico") &&
    !msg.text().includes("Failed to load resource")
  ) {
    errors.push(`console: ${msg.text()}`);
  }
});
page.on("requestfailed", (request) => {
  if (!request.url().endsWith("/favicon.ico")) {
    errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ""}`);
  }
});

await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(700);

record("page title", (await page.title()) === "Neon Range");
record("no runtime errors on load", errors.length === 0, errors.join(" | "));

const renderStats = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
  return { hasCanvas: Boolean(canvas), hasGl: Boolean(gl) };
});

record("canvas exists", renderStats.hasCanvas);
record("webgl context exists", renderStats.hasGl);
const startScreenshot = await page.screenshot({ type: "png" });
record("page screenshot is non-empty", startScreenshot.length > 10000, `bytes=${startScreenshot.length}`);

await page.click("#startButton");
await page.waitForTimeout(300);
record(
  "start hides overlay",
  await page.evaluate(() => document.querySelector("#overlay").classList.contains("hidden"))
);

await page.mouse.down();
await page.waitForTimeout(60);
record(
  "firing visual state",
  await page.evaluate(() => document.querySelector("#weapon").classList.contains("firing"))
);
await page.mouse.up();

await browser.close();

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`Smoke failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`Smoke passed: ${checks.length}/${checks.length}`);
