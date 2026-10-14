import { drive } from './drive.mjs';

const BASE = 'https://solicitudcompras-app.vercel.app';

await drive(async ({ page, shot }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };

  // E2 · login coordinador
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('usuario@compras.bia.local').fill('cmelara@biabrands.co');
  await page.getByPlaceholder('••••••••').fill('CarlosQA2026!x');
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL(/\/panel/, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const panel = await page.locator('main').innerText();
  log('E2-coordinador', `OK /panel en Vercel — ${panel.replace(/\n+/g, ' ').slice(0, 200)}`);
  await shot('E2-vercel-coordinador');

  // E3 · login admin
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/admin`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/admin`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('usuario@compras.bia.local').fill('admin@biafoods.co');
  await page.getByPlaceholder('••••••••').fill('AdminBIA2026!');
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const dash = await page.locator('main').innerText();
  log('E3-admin', `OK /admin en Vercel — KPIs: ${/Procesos Activos/.test(dash) ? 'sí' : 'revisar'}`);
  await shot('E3-vercel-admin');

  // E1 · home pública + wizard (solo pasos iniciales, sin enviar)
  await page.context().clearCookies();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const home = await page.locator('body').innerText();
  log('E1-home', /Nueva solicitud de cotización/.test(home) ? 'OK home pública carga' : 'FAIL home');
  await shot('E1-vercel-home');

  // E4 · correo (simulado) — solo nota
  log('E4-correos', 'Resend sin dominio verificado: correos se registran "fallidos" (conocido, no bloqueante para pruebas)');

  console.log('\n===== FASE E (VERCEL) COMPLETA =====');
});
