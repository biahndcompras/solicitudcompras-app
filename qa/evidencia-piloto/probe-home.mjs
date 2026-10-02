import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const EV = '/Users/ecalderonl/Intelia/compras-1/qa/evidencia-piloto';

const browser = await chromium.launch({ headless: false, slowMo: 120 });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(20000);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${EV}/A0-home.png`, fullPage: true });
console.log('=== URL:', page.url());
console.log('=== BODY TEXT ===');
console.log((await page.locator('body').innerText()).slice(0, 2500));
console.log('=== BUTTONS ===');
for (const b of await page.locator('button, a[role=button], a').all()) {
  const t = (await b.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
  if (t) console.log('-', t.slice(0, 80));
}
await browser.close();
