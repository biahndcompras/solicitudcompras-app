import { drive } from './drive.mjs';

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };

  await page.goto(`${BASE}/panel`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('Buscar por referencia, título o solicitante...').fill('RFQ-2026-0007');
  await page.waitForTimeout(800);
  await page.locator('span[role=link]', { hasText: 'Abrir' }).first().click();
  await page.waitForURL(/\/panel\/solicitud\//, { timeout: 15000 });
  await page.waitForTimeout(800);

  // ---------- B4 · Comparativa ----------
  await page.getByRole('button', { name: /08 · Comparativa/ }).click();
  const cargando = page.getByText('Generando comparativa');
  if (await cargando.count()) log('B4-generacion', 'en curso — esperando IA');
  await cargando.waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});
  await page.getByText('Valor neto').first().waitFor({ timeout: 20000 }).catch(() => {});
  const comp = await page.locator('main').innerText();
  log('B4-tabla', /Valor neto/i.test(comp) ? 'OK tabla comparativa generada' : 'FAIL sin tabla');
  log('B4-rn06-isv', /no especifica/i.test(comp) ? 'OK RN-06 "⚠ no especifica" visible' : 'WARN sin marca RN-06');
  log('B4-excel', await page.locator('a').filter({ hasText: /Descargar Excel/i }).count() ? 'OK export Excel presente' : 'WARN sin export Excel');
  log('B4-cuerpo', comp.replace(/\n+/g, ' | ').slice(0, 500));
  await shot('B4-comparativa');

  // ---------- B5+B6+B7 · Recomendación y envío ----------
  await page.getByRole('button', { name: /09 · Recomendación/ }).click();
  await page.waitForTimeout(1500);
  const rec = await page.locator('main').innerText();
  log('B5-ahorro', /Ahorro potencial/i.test(rec) ? 'OK "Ahorro potencial" en pros (2.1/3.2)' : 'WARN sin línea de ahorro');
  log('B5-proscontras', /Pros|Contras/i.test(rec) ? 'OK pros/contras por proveedor' : 'FAIL sin pros/contras');
  const btnEnviar = page.getByRole('button', { name: /Enviar comparativa al solicitante/ });
  const bloqueado = await btnEnviar.isDisabled();
  log('B6-rrn01', bloqueado ? 'OK envío BLOQUEADO sin recomendación (RRN-01)' : 'FAIL envío habilitado sin recomendación');
  await page.getByPlaceholder(/Escribí tu criterio/).fill('Recomiendo la oferta de Imprenta CostaPrint: menor total (HNL 42,000) y mejor plazo (10 días). Confirmar con Proveedora Norte si puede igualar el precio antes de descartarla.');
  await page.waitForTimeout(400);
  const habilitado = !(await btnEnviar.isDisabled());
  log('B6-desbloqueo', habilitado ? 'OK se habilita con recomendación humana' : 'FAIL sigue bloqueado');
  await shot('B6-recomendacion');
  await btnEnviar.click();
  await page.getByText(/Comparativa enviada/i).first().waitFor({ timeout: 30000 });
  const fin = await page.locator('main').innerText();
  log('B7-envio', 'OK "Comparativa enviada"');
  log('B7-correo3', /Correo 3/.test(fin) ? 'OK correo 3 disparado con enlace' : 'WARN sin confirmación de correo 3');
  const token = fin.match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0];
  log('B7-token', token ? `OK token público ${token}` : 'WARN token no visible');
  const fs = await import('node:fs');
  if (token) fs.writeFileSync('/tmp/pw-token.txt', token);
  await shot('B7-enviada');

  console.log('\n===== B4–B7 COMPLETA =====');
});
