import { drive } from './drive.mjs';

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  // ---- F2: caso "pelota de fútbol" ----
  await page.goto(`${BASE}/solicitud/nueva?nuevo=1&email=${encodeURIComponent('edgar.calderon@intelia.com')}&nombre=Edgar%20Calderon&area=Intelia`, { waitUntil: 'networkidle' });
  await page.locator('#titulo').waitFor({ timeout: 15000 });
  await page.locator('#titulo').fill('Pelota de fútbol');
  await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
  await page.locator('label').filter({ hasText: 'Bien físico' }).click();
  await page.locator('input[type=date]').fill('2026-11-15');
  await page.locator('textarea').first().fill('pelota de futbol para una actividad de marketing');
  await shot('F2-entrada');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 20000 });
  await page.getByText(/Sugerencia IA|No se pudo|confianza/i).first().waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /Confirmar clasificación/ }).click();
  await page.getByText('Detalles para cotizar').waitFor({ timeout: 30000 });
  // esperar a que termine el assessment (preguntas o panel de contexto)
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    return /Necesitamos un poco más de contexto|El asistente necesita estos detalles|Pendiente/.test(t) || /Preparando preguntas/.test(t);
  }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const cuerpo = await page.locator('main').innerText();
  const hayContexto = /Necesitamos un poco más de contexto/.test(cuerpo);
  log('F2-contexto-insuficiente', hayContexto ? 'OK panel «Necesitamos más contexto» visible' : 'INFO la IA se aventuró a preguntar (sin panel)');
  const preguntas = [...cuerpo.matchAll(/[¿?][^\n]{10,160}/g)].map((m) => m[0].trim()).slice(0, 6);
  log('F2-preguntas', `≈${preguntas.length}: ${preguntas.join(' | ').slice(0, 400)}`);
  const chips = await page.locator('div.flex.flex-wrap button').evaluateAll((els) => els.map((e) => ({ t: e.textContent?.trim() ?? '', cls: e.className, title: e.getAttribute('title') ?? '' })));
  log('F2-chips', JSON.stringify(chips.slice(0, 8)));
  const genericos = chips.filter((c) => /pvc|poliuretano|goma\b/i.test(c.t)).map((c) => c.t);
  log('F2-sin-genericos', genericos.length === 0 ? 'OK sin materiales genéricos tipo PVC/poliuretano/goma' : `FAIL genéricos: ${genericos.join(', ')}`);
  const largas = chips.filter((c) => c.t.length > 40);
  log('F2-chips-truncados', largas.every((c) => c.cls.includes('truncate') && c.title) ? 'OK chips largas con truncate+title' : `WARN revisar: ${JSON.stringify(largas.slice(0, 2))}`);
  await shot('F2-paso4');

  // Si pidió contexto, probar el reintento con más descripción
  if (hayContexto) {
    await page.getByPlaceholder(/pelota de fútbol tamaño 5/i).fill('Pelota de fútbol tamaño 5, cuero sintético, para torneo juvenil al aire libre.');
    await page.getByRole('button', { name: /Reintentar con más detalle/ }).click();
    await page.waitForTimeout(8000);
    const despues = await page.locator('main').innerText();
    log('F2-reintento', /Necesitamos un poco más de contexto/.test(despues) ? 'WARN aún pide contexto' : 'OK tras ampliar la descripción, hay preguntas');
    await shot('F2-reintento');
  }

  // ---- F3: botón con margen inferior + resumen completo + logo ----
  const btn = page.getByRole('button', { name: /Generar documento/ });
  const pb = await btn.evaluate((el) => getComputedStyle(el.parentElement).paddingBottom);
  log('F3-padding-boton', `pb=${pb} (esperado ≥16px)`);
  // logo real
  await page.locator('input[type=file]').first().setInputFiles('/Users/ecalderonl/Intelia/compras-1/qa/docs-prueba/cotizacion-sombrillas.pdf').catch(() => log('F3-logo', 'WARN sin input de logo (branding off)'));
  await page.waitForTimeout(400);
  const conLogo = await page.locator('main').innerText();
  log('F3-logo-real', conLogo.includes('cotizacion-sombrillas.pdf') ? 'OK nombre real en dropzone' : /logo_oficial\.svg/.test(conLogo) ? 'FAIL sigue el mock logo_oficial.svg' : 'WARN no se detectó logo');

  // responder todo rápido (No lo sé) y avanzar
  const checks = page.locator('input[type=checkbox]');
  for (let i = 0; i < await checks.count(); i++) {
    const cb = checks.nth(i);
    if (!(await cb.isChecked())) await cb.check().catch(() => {});
  }
  await btn.click();
  await page.getByText('Tu solicitud está lista').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  const doc = await page.locator('main').innerText();
  log('F3-doc-titulo', /Pelota de fútbol/.test(doc) ? 'OK título visible' : 'FAIL título ausente');
  log('F3-doc-descripcion', /pelota de futbol para una actividad/i.test(doc) ? 'OK descripción visible' : 'FAIL descripción ausente');
  log('F3-doc-detalles', /Detalles de la solicitud/.test(doc) ? 'OK sección de detalles presente' : 'FAIL sin sección de detalles');
  log('F3-doc-logo', /cotizacion-sombrillas\.pdf|\.pdf/.test(doc) ? 'OK logo listado en detalles' : 'WARN logo no listado');
  log('F4-selector', /Coordinador BIA/i.test(doc) ? 'FAIL «Coordinador BIA» sigue en el selector' : 'OK sin «Coordinador BIA»');
  log('F4-cuatro', ['Bryan Bonilla', 'Carlos Melara', 'Lester', 'Maria Jose'].every((n) => doc.includes(n)) ? 'OK los 4 compradores reales' : `WARN ver: ${doc.match(/Bryan[\s\S]{0,200}/)?.[0] ?? ''}`);
  await shot('F3-documento');

  // ---- F5: mis solicitudes → página nueva con tracker + volver ----
  await page.goto(`${BASE}/mis-solicitudes?email=${encodeURIComponent('edgar.calderon@intelia.com')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const lista = await page.locator('main').innerText();
  log('F5-cards-tracker', /En cotización|Creada|Comparativa/.test(lista) ? 'OK tracker compacto en cards' : 'FAIL sin tracker en cards');
  await shot('F5-cards');
  await page.locator('a[href^="/mis-solicitudes/"]').first().click();
  await page.waitForURL(/\/mis-solicitudes\/[0-9a-f-]{8}/, { timeout: 15000 });
  await page.waitForTimeout(800);
  log('F5-url-detalle', `OK página propia ${new URL(page.url()).pathname}`);
  const det = await page.locator('main').innerText();
  log('F5-volver', await page.getByRole('link', { name: /Volver/ }).count() ? 'OK botón Volver' : 'FAIL sin Volver');
  log('F5-detalle', /Solicitante/.test(det) && /Progreso/.test(det) ? 'OK detalle con campos + tracker' : 'FAIL detalle incompleto');
  log('F5-sin-modal', !det.includes('Cerrar') ? 'OK sin modal flotante' : 'WARN quedó algún modal');
  await shot('F5-detalle');

  console.log('\n===== VERIFICACIÓN F1–F5 COMPLETA =====');
});
