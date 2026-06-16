import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.URL || "http://127.0.0.1:4173/";
const chromePath =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

await mkdir("screenshots", { recursive: true });

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

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(900);
await page.screenshot({ path: "screenshots/01-start.png" });

await page.click("#startButton");
await page.waitForTimeout(1200);
await page.screenshot({ path: "screenshots/02-gameplay.png" });

await page.mouse.down();
await page.waitForTimeout(70);
await page.screenshot({ path: "screenshots/03-firing.png" });
await page.mouse.up();

await page.keyboard.press("Escape");
await page.waitForTimeout(500);
await page.screenshot({ path: "screenshots/04-defeat.png" });

await browser.close();
console.log("screenshots saved");

