// ATAQUE 10b — /mis-solicitudes nunca alcanza "networkidle": ¿qué request se queda abierto?
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const EXEC =
  process.env.CHROME_PATH ||
  '/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-HN' });
const page = await ctx.newPage();
const abiertas = new Map();
page.on('request', (r) => abiertas.set(r, Date.now()));
page.on('requestfinished', (r) => abiertas.delete(r));
page.on('requestfailed', (r) => abiertas.delete(r));

const respuestas = [];
page.on('response', async (r) => {
  respuestas.push({ status: r.status(), url: r.url().replace(BASE, '') });
});

const t0 = Date.now();
await page.goto(BASE + '/mis-solicitudes?email=mj.e2e@biabrands.co', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(12000);
console.log('--- responses (' + (Date.now() - t0) + 'ms) ---');
for (const r of respuestas) console.log(`   ${r.status} ${r.url}`);
console.log('--- requests sin terminar ---');
for (const [r, ms] of abiertas) console.log(`   ${r.method()} ${r.url().replace(BASE, '')} (${Date.now() - ms}ms)`);
console.log('--- estado visible ---');
console.log('   texto:', (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
await browser.close();
