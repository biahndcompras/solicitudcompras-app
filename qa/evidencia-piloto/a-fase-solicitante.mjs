import { drive } from './drive.mjs';

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };

  // limpiar borradores previos
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  // ---------- A1 · Home / identidad ----------
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const h1 = await page.locator('h2').first().innerText();
  log('A1-copy', h1 === 'Nueva solicitud de cotización' ? `OK copy="${h1}"` : `FAIL copy="${h1}"`);
  await page.getByPlaceholder('ejemplo@bia.com').fill('mj.e2e@biabrands.co');
  await page.getByPlaceholder('Juan Pérez').fill('Solicitante E2E');
  await page.getByPlaceholder('Marketing').fill('Trade Marketing');
  await shot('A1-identidad');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForURL(/\/solicitud\/nueva/, { timeout: 15000 });

  // ---------- A2 · Captura ----------
  await page.locator('#titulo').waitFor({ timeout: 15000 });
  await page.locator('#titulo').fill('Lapiceros branding Vía — activación canal tradicional');
  await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
  await page.locator('label').filter({ hasText: 'Bien físico' }).click();
  await page.locator('input[type=date]').fill('2026-10-05');
  await page.locator('textarea').first().fill('500 lapiceros metálicos con logo Vía para entrega en canal tradicional. Colores corporativos azul y blanco.');
  await shot('A2-captura');
  log('A2-captura', 'OK campos llenos (título/categoría=mercadeo/producto/fecha/descripción)');

  // ---------- A3 · Clasificación IA ----------
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 20000 });
  await page.getByText(/Sugerencia IA|No se pudo|confianza/i).first().waitFor({ timeout: 60000 });
  const textoClasif = await page.locator('main').innerText();
  const conf = textoClasif.match(/(\d{1,3})\s*%/);
  const tipo = /RFQ/.test(textoClasif) ? 'RFQ' : /RFP/.test(textoClasif) ? 'RFP' : 'RFI';
  log('A2-clasificacion-ia', `OK tipo=${tipo} confianza=${conf ? conf[1] + '%' : 'n/d'}`);
  await shot('A3-clasificacion');
  const radioRFQ = page.locator('label').filter({ hasText: 'Solicitud de Cotización' });
  if (await radioRFQ.count()) await radioRFQ.first().click();
  await page.getByRole('button', { name: /Confirmar clasificación/ }).click();

  // ---------- A4 · Assessment ----------
  await page.getByText(/El asistente necesita estos detalles|Detalles para cotizar/i).first().waitFor({ timeout: 60000 });
  const btnDoc = page.getByRole('button', { name: /Generar documento/ });
  await btnDoc.waitFor({ timeout: 30000 });
  // B2/RN-03: branding on por defecto sin logo -> bloqueado
  const bloqueadoB2 = await btnDoc.isDisabled();
  log('B2-bloqueo-sin-logo', bloqueadoB2 ? 'OK "Generar documento" bloqueado sin logo (RN-03)' : 'FAIL botón habilitado sin logo');
  // logo (botón mock: setea "logo_oficial.svg")
  const btnLogo = page.getByRole('button', { name: /Subir arte o logo oficial/ });
  if (await btnLogo.count()) {
    await btnLogo.click();
    log('B2-subida-logo', 'HALLAZGO: la "subida" de logo es mock (setea "logo_oficial.svg" hardcodeado, sin archivo real)');
    await page.waitForTimeout(300);
    const habilitado = !(await btnDoc.isDisabled());
    log('B2-desbloqueo-con-logo', habilitado ? 'OK se desbloquea con logo' : 'FAIL sigue bloqueado');
  }
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Generar documento/.test(x.textContent || ''));
    return b && !b.disabled;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const preguntas = page.locator('p.font-semibold.text-slate-900');
  const nPreg = await preguntas.count();
  const muestras = [];
  for (let i = 0; i < Math.min(nPreg, 4); i++) muestras.push((await preguntas.nth(i).innerText()).replace(/\s+/g, ' ').slice(0, 85));
  log('A3-assessment', `bloques_pregunta=${nPreg} muestras=[${muestras.join(' | ')}]`);
  const sugiero = await page.locator('span', { hasText: 'Sugerido:' }).count();
  log('A3-sugerencias-chips', sugiero > 0 ? `OK ${sugiero} preguntas con chips "Sugerido:"` : 'WARN sin chips');
  await shot('A4-assessment');
  const chip = page.locator('div.flex.flex-wrap button').first();
  if (await chip.count()) {
    const t = (await chip.innerText()).trim();
    await chip.click();
    log('A3-chip-click', `OK chip "${t.slice(0, 40)}" seleccionado`);
  } else log('A3-chip-click', 'WARN no había chips clicables');
  const nosChecks = page.locator('input[type=checkbox]');
  for (let i = 0; i < await nosChecks.count(); i++) {
    const cb = nosChecks.nth(i);
    if (!(await cb.isChecked())) await cb.check().catch(() => {});
  }
  await shot('A4-assessment-completo');
  await btnDoc.click();

  // ---------- A5 · Documento + comprador ----------
  await page.getByText('Tu solicitud está lista').waitFor({ timeout: 30000 });
  const refDoc = (await page.locator('main').innerText()).match(/RFQ-\d{4}-\d+/)?.[0] ?? 'n/d';
  log('A4-ref-resumen', refDoc === 'RFQ-2026-014' ? `HALLAZGO ref hardcodeada "${refDoc}"` : `ref="${refDoc}"`);
  await shot('A5-resumen-documento');
  const coords = await page.locator('button').filter({ hasText: /Melara|Bonilla|Ramírez|Ramirez|Torres|Berrios|Berríos|Coordinador BIA/ }).count();
  log('A5-listado-compradores', coords > 0 ? `OK ${coords} compradores reales` : 'FAIL listado vacío');
  const coord = page.locator('button').filter({ hasText: 'Carlos Melara' });
  if (await coord.count()) {
    await coord.first().click();
    const ok = /Irá asignada a/.test(await page.locator('main').innerText());
    log('A5-seleccion', ok ? 'OK "Irá asignada a Carlos Melara"' : 'FAIL sin confirmación');
  } else log('A5-seleccion', 'FAIL Carlos Melara ausente');
  await shot('A5-comprador');

  // ---------- A6 · Envío ----------
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await page.getByText('Tu solicitud fue enviada').waitFor({ timeout: 45000 });
  const body = await page.locator('main').innerText();
  log('A6-envio', 'OK "Tu solicitud fue enviada"');
  log('A6-ref-confirmacion', body.match(/RFQ-\d{4}-\d+/)?.[0] ?? 'no visible en la confirmación (hallazgo menor)');
  await shot('A6-confirmada');
  const docUrl = await page.locator('a', { hasText: 'Ver PDF' }).first().getAttribute('href');
  if (docUrl) {
    const resp = await page.request.get(new URL(docUrl, BASE).href);
    log('A6-pdf', resp.ok() ? `OK PDF (${resp.headers()['content-type']})` : `FAIL HTTP ${resp.status()}`);
  }

  // ---------- A7 · Mis solicitudes ----------
  await page.goto(`${BASE}/mis-solicitudes?email=${encodeURIComponent('mj.e2e@biabrands.co')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const mis = await page.locator('main').innerText();
  log('A7-semaforo', /Atención|días de margen|Sin fecha límite|semáforo/i.test(mis) ? 'OK indicadores de atención presentes' : 'FAIL sin indicadores');
  log('A7-tracker', /Etapa|etapa/.test(mis) ? 'OK tracker de etapas presente' : 'WARN tracker no detectado');
  log('A7-vista', mis.replace(/\n+/g, ' | ').slice(0, 600));
  await shot('A7-mis-solicitudes');

  console.log('\n===== FASE A COMPLETA =====');
});
