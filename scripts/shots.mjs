/** Screenshots every route at desktop and tablet widths, and times first paint. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const OUT = process.env.OUT ?? 'shots';
const ROUTES = [
  ['overview', '/'],
  ['branches', '/branches'],
  ['branch-b3', '/branches/B3'],
  ['rep-sr16', '/reps/SR16'],
  ['actions', '/actions'],
  ['pipeline', '/pipeline'],
];
const VIEWPORTS = [
  ['desktop', 1440, 900, 'light'],
  ['tablet', 834, 1112, 'light'],
  ['dark', 1440, 900, 'dark'],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

for (const [vpName, width, height, colorScheme] of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme,
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${vpName} ${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${vpName} ${page.url()} :: ${e.message}`));

  for (const [name, route] of ROUTES) {
    const started = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    // Wait for real content, not the hydration skeleton.
    await page.waitForSelector('h1', { timeout: 10_000 });
    const painted = Date.now() - started;
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${OUT}/${name}-${vpName}.png`,
      fullPage: vpName !== 'tablet',
    });
    console.log(`${name.padEnd(12)} ${vpName.padEnd(8)} content in ${painted}ms`);
  }
  await context.close();
}

await browser.close();

if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of [...new Set(errors)].slice(0, 20)) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('\nNo console errors.');
}
