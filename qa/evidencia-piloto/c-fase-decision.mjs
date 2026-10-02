import { drive } from './drive.mjs';

const TOKEN = '3C60-B122-AADE';

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };

  // ---------- C1 · Vista pública sin login ----------
  await page.goto(`${BASE}/comparativa/${TOKEN}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const v = await page.locator('main').innerText();
  log('C1-publica', /sin iniciar sesión/i.test(v) ? 'OK "Enlace público · sin iniciar sesión"' : 'WARN sin badge público');
  log('C1-opciones', (await page.getByRole('button', { name: /Elegir esta opción/ }).count()) === 2 ? 'OK 2 opciones con botón "Elegir esta opción"' : 'FAIL opciones incompletas');
  log('C1-recomendacion', /Recomendación de Compras/i.test(v) ? 'OK recomendación humana visible' : 'FAIL sin recomendación');
  log('C1-proscontras', /Pros|Contras/i.test(v) ? 'OK pros/contras visibles' : 'FAIL sin pros/contras');
  log('C2-monedas', /HNL\s?[\d.,]+/.test(v) && !/Lempiras convertido|equivalente en/i.test(v) ? 'OK importes en moneda original (RN-03)' : 'WARN revisar monedas');
  log('C1-cuerpo', v.replace(/\n+/g, ' | ').slice(0, 500));
  await shot('C1-vista-publica');

  // ---------- C3 · Decisión ----------
  await page.getByRole('button', { name: /Elegir esta opción/ }).nth(1).click();
  await page.getByText(/Confirmar selección/i).waitFor({ timeout: 10000 });
  await shot('C2-confirmar');
  await page.getByRole('button', { name: /^Confirmar$/ }).click();
  await page.getByText(/decisión fue registrada/i).waitFor({ timeout: 20000 });
  log('C3-decision', 'OK "Tu decisión fue registrada. Compras recibirá la notificación"');
  await shot('C3-decision-registrada');

  // ---------- C4 · Doble decisión bloqueada ----------
  await page.waitForTimeout(500);
  const bots = await page.getByRole('button', { name: /Elegir esta opción|Ninguna me sirve/ }).all();
  let deshabilitados = 0;
  for (const b of bots) if (await b.isDisabled().catch(() => false)) deshabilitados++;
  const elegida = await page.getByRole('button', { name: /Opción elegida/ }).count();
  log('C4-doble-decision', elegida === 1 && deshabilitados === bots.length ? `OK elegida marcada y ${deshabilitados} botones bloqueados` : `WARN elegida=${elegida} deshabilitados=${deshabilitados}/${bots.length}`);

  console.log('\n===== FASE C COMPLETA =====');
});
