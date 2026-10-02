// ATAQUE 10 — Recursos que fallan (404/500) en las pantallas del solicitante.
// Un 404 silencioso = un asset roto que nadie ve en el código.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const EXEC =
  process.env.CHROME_PATH ||
  '/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const rutas = [
  '/',
  '/solicitud/nueva?nuevo=1&email=mj.e2e%40biabrands.co&nombre=Solicitante%20E2E&area=Trade%20Marketing',
  '/mis-solicitudes?email=mj.e2e@biabrands.co',
  '/comparativa/demo-2026',
  '/guias/manual-solicitante',
];
for (const r of rutas) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-HN' });
  const page = await ctx.newPage();
  const fallos = [];
  page.on('response', (resp) => {
    if (resp.status() >= 400) fallos.push(`${resp.status()} ${resp.url().replace(BASE, '')}`);
  });
  page.on('pageerror', (e) => fallos.push('pageerror ' + String(e).slice(0, 120)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') fallos.push(`${m.type()}: ${m.text().slice(0, 160)}`);
  });
  await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 40000 }).catch((e) => fallos.push('goto:' + e.message.slice(0, 80)));
  await page.waitForTimeout(1500);
  console.log(`\n### ${r}`);
  console.log(fallos.length ? fallos.map((f) => '   - ' + f).join('\n') : '   (sin fallos)');
  await ctx.close();
}
await browser.close();
