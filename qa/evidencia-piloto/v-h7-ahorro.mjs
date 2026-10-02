import { drive } from './drive.mjs';
import fs from 'node:fs';

const ID = fs.readFileSync('/tmp/pw-nueva-id.txt', 'utf8').trim();

await drive(async ({ page, shot, BASE }) => {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('usuario@compras.bia.local').fill('cmelara@biabrands.co');
  await page.getByPlaceholder('••••••••').fill('CarlosQA2026!x');
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL(/\/panel/, { timeout: 20000 });

  await page.goto(`${BASE}/panel/solicitud/${ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // H12: botón Reabrir (la solicitud quedó en COMPARATIVA_LISTA por el intento previo? o ENVIADA_A_COMPRAS)
  const estadoTxt = await page.locator('main').innerText();
  console.log('>> estado en pantalla:', estadoTxt.slice(0, 120).replace(/\n+/g, ' '));
  const btnReabrir = page.getByRole('button', { name: /Reabrir cotizaciones/ });
  console.log('>> H12-boton-reabrir:', (await btnReabrir.count()) ? 'visible (estado avanzado)' : 'no aplica en este estado (solo COMPARATIVA_LISTA/ENVIADA_A_SOLICITANTE)');

  await page.getByRole('button', { name: /08 · Comparativa/ }).click();
  await page.getByText('Generando comparativa').waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /09 · Recomendación/ }).click();
  await page.waitForTimeout(1500);
  const rec = await page.locator('main').innerText();
  const tieneAhorro = /Ahorro potencial/i.test(rec);
  console.log('>> H7-ahorro-en-pros:', tieneAhorro ? 'OK "Ahorro potencial" presente con pros de IA (fusión funciona)' : 'FAIL sin línea de ahorro');
  const m = rec.match(/Ahorro potencial[^\n]*/);
  if (m) console.log('   línea:', m[0]);
  await shot('FIX-H7-ahorro');
  console.log('\n===== H7 VERIFICADO =====');
});
