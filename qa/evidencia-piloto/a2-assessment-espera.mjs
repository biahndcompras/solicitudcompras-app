import { drive } from './drive.mjs';

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  // camino rápido hasta paso 4
  await page.goto(`${BASE}/solicitud/nueva?nuevo=1&email=${encodeURIComponent('mj.e2e@biabrands.co')}&nombre=Solicitante%20E2E&area=Trade%20Marketing`, { waitUntil: 'networkidle' });
  await page.locator('#titulo').waitFor({ timeout: 15000 });
  await page.locator('#titulo').fill('Sombrillas brandeadas — activación playa');
  await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
  await page.locator('label').filter({ hasText: 'Bien físico' }).click();
  await page.locator('input[type=date]').fill('2026-10-15');
  await page.locator('textarea').first().fill('20 sombrillas de playa brandeadas con logo de marca para activación en playa. Tela impermeable, estructura de madera.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 20000 });
  await page.getByText(/Sugerencia IA|No se pudo|confianza/i).first().waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /Confirmar clasificación/ }).click();
  await page.getByText('Detalles para cotizar').waitFor({ timeout: 30000 });

  // esperar preguntas/campos con paciencia (assessment IA 8-15s+)
  const t0 = Date.now();
  let n = 0;
  try {
    await page.waitForFunction(() => {
      const ps = [...document.querySelectorAll('p')].filter((p) => /font-semibold/.test(p.className) && (p.textContent || '').trim().length > 15);
      return ps.length >= 3;
    }, null, { timeout: 60000 });
    n = await page.locator('p.font-semibold').count();
  } catch { n = 0; }
  const ms = Date.now() - t0;
  log('A3-assessment-espera', n > 0 ? `OK ${n} bloques tras ${ms}ms` : `FAIL sin preguntas tras ${ms}ms`);

  const preguntas = page.locator('p.font-semibold');
  const muestras = [];
  for (let i = 0; i < Math.min(await preguntas.count(), 5); i++) {
    muestras.push((await preguntas.nth(i).innerText()).replace(/\s+/g, ' ').slice(0, 85));
  }
  log('A3-muestras', `[${muestras.join(' | ')}]`);
  const sugiero = await page.locator('span', { hasText: 'Sugerido:' }).count();
  log('A3-chips', sugiero > 0 ? `OK ${sugiero} preguntas con chips` : 'WARN sin chips');
  const plantilla = await page.locator('span', { hasText: /Información comercial/ }).count();
  log('A3-plantilla', plantilla > 0 ? 'OK sección "Información comercial" presente' : 'INFO sin campos de plantilla para mercadeo+RFQ');
  const chip = page.locator('div.flex.flex-wrap button').first();
  if (await chip.count()) {
    await chip.click();
    log('A3-chip-click', `OK "${(await chip.innerText()).trim().slice(0, 40)}"`);
  }
  await shot('A4b-assessment-con-preguntas');

  // cancelar (no enviar): limpiar borrador
  await page.getByRole('button', { name: /Cancelar y descartar/ }).click();
  await page.waitForTimeout(500);

  // tracker en detalle de mis solicitudes
  await page.goto(`${BASE}/mis-solicitudes?email=${encodeURIComponent('mj.e2e@biabrands.co')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByText('Ver detalle').first().click();
  await page.waitForTimeout(1500);
  const det = await page.locator('main').innerText();
  log('A7-tracker-detalle', /Etapa|etapa|Creación|Cotización|Comparativa|Decisión|✓|→/.test(det) ? 'OK tracker/etapas visible en detalle' : 'FAIL sin tracker en detalle');
  log('A7-detalle-cuerpo', det.replace(/\n+/g, ' | ').slice(0, 700));
  await shot('A7b-detalle-tracker');

  console.log('\n===== A-EXTRA COMPLETA =====');
});
