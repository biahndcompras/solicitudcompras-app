// Diagnóstico del login: distinguir (a) carrera de hidratación de (b) bug de lógica.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const EXEC =
  process.env.CHROME_PATH ||
  '/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-HN' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror:' + String(e).slice(0, 200)));
page.on('console', (m) => m.type() === 'error' && errs.push('console:' + m.text().slice(0, 200)));

// CASO A: fill inmediatamente tras domcontentloaded (rápido, como el harness previo)
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.getByPlaceholder('ejemplo@bia.com').fill('a@b.com');
await page.getByPlaceholder('Juan Pérez').fill('X Y');
await page.getByPlaceholder('Marketing').fill('Z');
const leer = () =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Continuar/.test(x.innerText));
    return {
      disabled: b?.disabled,
      valores: ['ejemplo@bia.com', 'Juan Pérez', 'Marketing'].map(
        (p) => document.querySelector(`[placeholder="${p}"]`)?.value
      ),
    };
  });
console.log('A immediately:', JSON.stringify(await leer()));
for (const ms of [500, 1000, 2000, 4000]) {
  await page.waitForTimeout(ms);
  console.log(`A +${ms}ms:`, JSON.stringify(await leer()));
}
// Re-fill con el MISMO valor (como el bucle del harness previo)
for (let i = 0; i < 3; i++) {
  await page.getByPlaceholder('ejemplo@bia.com').fill('a@b.com');
  await page.getByPlaceholder('Juan Pérez').fill('X Y');
  await page.getByPlaceholder('Marketing').fill('Z');
  await page.waitForTimeout(400);
  console.log(`A refill#${i + 1}:`, JSON.stringify(await leer()));
}

// CASO B: con typing real (teclado) en vez de fill
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1500); // hidratación如下
await page.getByPlaceholder('ejemplo@bia.com').click();
await page.keyboard.type('mj.e2e@biabrands.co', { delay: 8 });
await page.getByPlaceholder('Juan Pérez').click();
await page.keyboard.type('Solicitante E2E', { delay: 8 });
await page.getByPlaceholder('Marketing').click();
await page.keyboard.type('Trade Marketing', { delay: 8 });
await page.waitForTimeout(300);
console.log('B tras teclado:', JSON.stringify(await leer()));
await page.getByRole('button', { name: 'Continuar' }).click();
try {
  await page.waitForURL(/\/solicitud\/nueva/, { timeout: 10000 });
  console.log('B nav OK →', page.url().replace(BASE, ''));
} catch {
  console.log('B nav FALLO →', page.url().replace(BASE, ''), 'inputs:', JSON.stringify(await leer()));
}
console.log('errores:', JSON.stringify(errs.slice(0, 5)));
await browser.close();
