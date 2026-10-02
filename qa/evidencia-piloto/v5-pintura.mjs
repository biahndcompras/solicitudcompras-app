import { drive } from './drive.mjs';

await drive(async ({ page, shot, BASE }) => {
  const log = (k, v) => console.log(`>> ${k}: ${v}`);
  page.on('dialog', (d) => d.accept());

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  // Caso REAL del usuario: pintura de aceite para fachada
  await page.goto(`${BASE}/solicitud/nueva?nuevo=1&email=${encodeURIComponent('edgar.calderon@intelia.com')}&nombre=Edgar%20Calderon&area=Intelia`, { waitUntil: 'networkidle' });
  await page.locator('#titulo').waitFor({ timeout: 15000 });
  await page.locator('#titulo').fill('Pintura de aceite para fachada de almacen');
  await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
  await page.locator('label').filter({ hasText: 'Bien físico' }).click();
  await page.locator('input[type=date]').fill('2026-11-30');
  await page.locator('textarea').first().fill('Pintura de aceite para pintar la fachada del almacén que tenga protección contra agua y humedades.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de la solicitud', { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.getByText(/Sugerencia IA|No se pudo|confianza/i).first().waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /Confirmar clasificación/ }).click();

  // capturar el LOADER centrado en pleno vuelo (máx ~2s tras el click)
  await page.waitForTimeout(900);
  await shot('P5-loader-centrado');

  // esperar a que termine el assessment
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    return (/Necesitamos un poco más de contexto|El asistente necesita estos detalles|Información comercial/.test(t))
      && !/Preparando preguntas del asistente/.test(t);
  }, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const cuerpo = await page.locator('main').innerText();
  const preguntas = [...cuerpo.matchAll(/¿[^\n]{10,180}/g)].map((m) => m[0].trim()).slice(0, 10);
  log('P4-preguntas', preguntas.join(' || ').slice(0, 800) || '(ninguna)');
  const chips = await page.locator('div.flex.flex-wrap button').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
  log('P4-chips', JSON.stringify(chips.slice(0, 15)));
  log('P4-sin-labels-crudos', ['Dimensiones', 'Materiales', 'Cantidad', 'Color y acabado', 'Calidad', 'Archivo del logo', 'Alcance del servicio'].every((l) => !preguntas.includes(l)) ? 'OK sin labels crudos' : 'FAIL labels crudos presentes');
  log('P4-sin-archivo-logo', cuerpo.includes('Archivo del logo') ? 'FAIL aparece «Archivo del logo»' : 'OK sin «Archivo del logo»');
  log('P4-contexto-pintura', /fachada|pintura|gal[oó]n|acabado|esmalte|manos|m²|antimoho|aceite/i.test(preguntas.join(' ')) ? 'OK preguntas del rubro de pintura' : 'WARN sin contexto de pintura');
  log('P4-con-sugerencias', chips.length > 0 ? `OK ${chips.length} chips` : 'WARN sin chips');
  await shot('P4-pintura-assessment');

  console.log('\n===== VERIFICACIÓN PINTURA COMPLETA =====');
});
