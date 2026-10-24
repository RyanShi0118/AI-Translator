// Renders public/icons/icon.svg into the PNG sizes required by the manifest.
// Usage: node scripts/render-icons.mjs   (requires Playwright + Chromium)
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const svg = await readFile(dir + 'icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: `${dir}icon-${size}.png`, omitBackground: true });
}
await browser.close();
