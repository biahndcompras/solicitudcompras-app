import { drive } from './drive.mjs';
import fs from 'node:fs';

const ADMIN = { email: 'admin@biafoods.co', pass: 'AdminBIA2026!' };
const ID_CERRADA = '57ad1bbb-928c-446c-8c01-eb1ac3dde27b'; // RFQ-2026-0007
const ID_ABIERTA = 'd1896137-f5e4-4fb6-acb3-f48fd6564e26'; // RFQ-2026-0005

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };
  page.on('dialog', (d) => d.accept());

  // ---------- D0 · Login admin (sesión limpia: cookies SSR + storage) ----------
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/admin`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  if (await page.getByPlaceholder('usuario@compras.bia.local').count()) {
    await page.getByPlaceholder('usuario@compras.bia.local').fill(ADMIN.email);
    await page.getByPlaceholder('••••••••').fill(ADMIN.pass);
    await page.getByRole('button', { name: /Entrar al panel|Entrar/i }).click();
  }
  await page.waitForURL(/\/admin/, { timeout: 20000 });
  await page.waitForTimeout(1500);
  log('D0-login', 'OK login admin → /admin');

  // ---------- D1 · KPIs ----------
  const dash = await page.locator('main').innerText();
  log('D1-kpis', /Procesos Activos|Tiempo Promedio|Conversión|Sin decisión/i.test(dash) ? 'OK KPIs visibles (activos/tiempo/conversión/sin decisión)' : 'FAIL sin KPIs');
  await shot('D1-dashboard');

  // ---------- D2+D5 · Timeline de la solicitud cerrada ----------
  await page.goto(`${BASE}/admin/solicitud/${ID_CERRADA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const det = await page.locator('main').innerText();
  log('D2-timeline', /Línea de tiempo/i.test(det) ? 'OK sección "Línea de tiempo (Trazabilidad)"' : 'FAIL sin timeline');
  const nEventos = await page.locator('span.font-bold.text-slate-900.text-xs').count();
  log('D2-eventos', `eventos=${nEventos}`);
  log('D2-cuerpo', det.replace(/\n+/g, ' | ').slice(0, 900));
  log('D5-cierre', /Cerrada con decisión|CERRADA_CON_DECISION|Cerrada/i.test(det) ? 'OK estado de cierre visible' : 'WARN sin estado de cierre');
  log('D5-proveedor', /Imprenta CostaPrint|elegió/i.test(det) ? 'OK proveedor elegido registrado' : 'WARN proveedor elegido no visible');
  log('D6-duracion', /Atención|de gestión|\d+ h|\d+ d/.test(det) ? 'OK indicador de duración/atención' : 'WARN sin duración visible');
  await shot('D2-timeline-cerrada');

  // ---------- D3 · Reasignar comprador (solicitud abierta) ----------
  await page.goto(`${BASE}/admin/solicitud/${ID_ABIERTA}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const sel = page.locator('select').filter({ has: page.locator('option[value=""]') }).first();
  await sel.selectOption({ label: 'Bryan Bonilla' }).catch(async () => {
    const opts = await sel.locator('option').allTextContents();
    log('D3-opciones', `opciones: ${opts.join(', ')}`);
    await sel.selectOption({ index: 1 });
  });
  await page.getByRole('button', { name: /^Reasignar$/ }).click();
  await page.waitForTimeout(2000);
  const tras = await page.locator('main').innerText();
  log('D3-reasignar', /Bryan Bonilla/.test(tras) ? 'OK comprador reasignado a Bryan Bonilla' : 'FAIL reasignación no reflejada');
  log('D3-evento-timeline', /Reasignación/i.test(tras) ? 'OK evento "Reasignación" en el timeline' : 'WARN sin evento de reasignación');
  await shot('D3-reasignada');

  // ---------- D4 · Cancelar solicitud (window.confirm auto-accept) ----------
  await page.getByRole('button', { name: /Cancelar solicitud/ }).click();
  await page.waitForTimeout(2500);
  const fin = await page.locator('main').innerText();
  log('D4-cancelada', /Cancelada|CANCELADA/i.test(fin) ? 'OK solicitud cancelada' : 'FAIL no se canceló');
  log('D4-evento', /Cancelación|Cancelada/i.test(fin) ? 'OK evento de cancelación visible' : 'WARN sin evento de cancelación');
  await shot('D4-cancelada');

  console.log('\n===== FASE D COMPLETA =====');
});
