// ATAQUE 8 — Login intermitente: "Continuar" a veces no navega.
// Hipótesis: si el submit nativo gana la carrera contra el handler de React (form sin
// `action`), el navegador hace GET a `/?email=...` y la navegación a /solicitud/nueva no
// ocurre: el solicitante pierde lo escrito y no pasa nada.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const EXEC =
  process.env.CHROME_PATH ||
  '/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ executablePath: EXEC, headless: true });

for (let i = 1; i <= 8; i++) {
  const vp = [
    { width: 320, height: 568 },
    { width: 430, height: 932 },
    { width: 1440, height: 900 },
  ][i % 3];
  const ctx = await browser.newContext({ viewport: vp, locale: 'es-HN' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push('pageerror: ' + String(e).slice(0, 120)));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push('console: ' + m.text().slice(0, 120));
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  // Escribimos de inmediato, sin esperar a la hidratación (el caso real de una persona
  // rápida, o de un dispositivo lento).
  const t0 = Date.now();
  await page.getByPlaceholder('ejemplo@bia.com').fill('mj.e2e@biabrands.co');
  await page.getByPlaceholder('Juan Pérez').fill('Solicitante E2E');
  await page.getByPlaceholder('Marketing').fill('Trade Marketing');

  const cta = page.getByRole('button', { name: 'Continuar' });
  // Esperamos a que React registre lo escrito (el botón se habilita).
  let habilitado = false;
  for (let k = 0; k < 20; k++) {
    habilitado = await cta.evaluate((b) => !b.disabled);
    if (habilitado) break;
    await page.waitForTimeout(250);
  }
  const msHastaHabilitado = Date.now() - t0;
  await cta.click();
  let url = '(sin navegación)';
  try {
    await page.waitForURL(/\/solicitud\/nueva/, { timeout: 8000 });
    url = page.url();
  } catch {
    url = 'FALLO → ' + page.url();
  }
  const cookie = await ctx
    .cookies()
    .then((cs) => cs.find((c) => c.name === 'bia_session')?.value ?? '(sin cookie)');
  console.log(
    `#${i} vp=${vp.width}x${vp.height} ms=${msHastaHabilitado} nav=${url.replace(BASE, '')} cookie=${String(cookie).slice(0, 60)} errores=${JSON.stringify(errores.slice(0, 2))}`
  );
  await ctx.close();
}
await browser.close();
