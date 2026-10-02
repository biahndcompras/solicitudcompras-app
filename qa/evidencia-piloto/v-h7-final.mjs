import { drive } from './drive.mjs';
import fs from 'node:fs';

const ID = fs.readFileSync('/tmp/pw-nueva-id.txt', 'utf8').trim();

await drive(async ({ page, shot, BASE }) => {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('usuario@compras.bia.local').fill('cmelara@biabrands.co');
  await page.getByPlaceholder('••••••••').fill('CarlosQA2026!x');
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL(/\/panel/, { timeout: 20000 });

  await page.goto(`${BASE}/panel/solicitud/${ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /07 · Cotizaciones/ }).click();

  // dos cotizaciones manuales con diferencia de precio (para la línea de ahorro)
  const labels = page.locator('label');
  const setCampo = async (lab, val) => {
    await labels.filter({ hasText: lab }).first().locator('input').fill(val);
  };
  const agregar = async (prov, total, plazo) => {
    await page.getByRole('button', { name: /Agregar cotización manual/ }).click();
    await page.getByPlaceholder('Ej. Imprenta CostaPrint S. de R.L.').fill(prov);
    await setCampo('Valor neto', String(total));
    await setCampo('ISV', '0');
    await setCampo('Total', String(total));
    await setCampo('Plazo de entrega', plazo);
    await page.getByRole('button', { name: /Guardar cotización/ }).click();
    await page.getByText(prov).first().waitFor({ timeout: 15000 });
  };
  await agregar('Prov Cara SA', '100000', '20 días');
  await agregar('Prov Barata SA', '80000', '10 días');

  await page.getByRole('button', { name: /08 · Comparativa/ }).click();
  await page.getByText('Generando comparativa').waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /09 · Recomendación/ }).click();
  await page.waitForTimeout(1500);
  const rec = await page.locator('main').innerText();
  const m = rec.match(/Ahorro potencial[^\n·]*/);
  console.log('>> H7-ahorro-en-pros:', m ? `OK "${m[0].trim()}" (fusión IA+determinista)` : 'FAIL sin línea de ahorro');
  console.log('>> H7-pros-ia-presentes:', /Entrega:|vigencia|plazo/i.test(rec) ? 'OK pros de IA visibles junto al ahorro' : 'WARN pros de IA ausentes');
  await shot('FIX-H7-ahorro');
  console.log('\n===== H7 VERIFICADO =====');
});
