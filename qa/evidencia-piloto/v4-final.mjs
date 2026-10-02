import { drive } from './drive.mjs';

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  // Wizard: pelota de fútbol (caso del usuario)
  await page.goto(`${BASE}/solicitud/nueva?nuevo=1&email=${encodeURIComponent('edgar.calderon@intelia.com')}&nombre=Edgar%20Calderon&area=Intelia`, { waitUntil: 'networkidle' });
  await page.locator('#titulo').waitFor({ timeout: 15000 });
  await page.locator('#titulo').fill('Pelota de fútbol');
  await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
  await page.locator('label').filter({ hasText: 'Bien físico' }).click();
  await page.locator('input[type=date]').fill('2026-11-15');
  await page.locator('textarea').first().fill('pelota de futbol para una actividad de marketing');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de la solicitud', { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.getByText(/Sugerencia IA|No se pudo|confianza/i).first().waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /Confirmar clasificación/ }).click();
  await page.getByText('Detalles para cotizar').waitFor({ timeout: 30000 });

  // esperar el assessment REAL (hasta 60s: puede ir al fallback doble)
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    return /Necesitamos un poco más de contexto|El asistente necesita estos detalles|Información comercial/.test(t) && !/Preparando preguntas del asistente/.test(t);
  }, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const cuerpo = await page.locator('main').innerText();
  const hayContexto = /Necesitamos un poco más de contexto/.test(cuerpo);
  log('F2-contexto', hayContexto ? 'OK panel «más contexto»' : 'INFO sin panel');
  const preguntas = [...cuerpo.matchAll(/[¿?][^\n]{10,160}/g)].map((m) => m[0].trim()).slice(0, 6);
  log('F2-preguntas', preguntas.join(' | ').slice(0, 500) || '(ninguna)');
  const chips = await page.locator('div.flex.flex-wrap button').evaluateAll((els) => els.map((e) => ({ t: (e.textContent ?? '').trim(), cls: e.className, title: e.getAttribute('title') ?? '' })));
  log('F2-chips', JSON.stringify(chips.slice(0, 8)));
  log('F2-sin-genericos', chips.some((c) => /pvc|poliuretano/i.test(c.t)) ? 'FAIL genéricos presentes' : 'OK sin genéricos');
  log('F2-chips-truncados', chips.filter((c) => c.t.length > 40).every((c) => c.cls.includes('truncate') && c.title) ? 'OK truncado+title en chips largas' : 'INFO sin chips largas o sin truncar');
  await shot('F2-final');

  // si pidió contexto: ampliar y reintentar
  if (hayContexto) {
    await page.getByRole('textbox').last().fill('Pelota de fútbol tamaño 5, cuero sintético, para torneo juvenil al aire libre.');
    await page.getByRole('button', { name: /Reintentar con más detalle/ }).click();
    await page.waitForFunction(() => !/Necesitamos un poco más de contexto/.test(document.body.innerText), null, { timeout: 90000 }).catch(() => {});
    const tras = await page.locator('main').innerText();
    log('F2-reintento', /El asistente necesita estos detalles/.test(tras) ? 'OK tras ampliar: preguntas reales' : 'WARN sin preguntas tras reintento');
    const ch2 = await page.locator('div.flex.flex-wrap button').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
    log('F2-chips-reintento', JSON.stringify(ch2.slice(0, 8)));
    await shot('F2-reintento');
  }

  // logo + documento completo
  await page.locator('input[type=file]').first().setInputFiles('/Users/ecalderonl/Intelia/compras-1/qa/docs-prueba/cotizacion-sombrillas.pdf');
  await page.waitForTimeout(400);
  const checks = page.locator('input[type=checkbox]');
  for (let i = 0; i < await checks.count(); i++) {
    const cb = checks.nth(i);
    if (!(await cb.isChecked())) await cb.check().catch(() => {});
  }
  const btn = page.getByRole('button', { name: /Generar documento/ });
  await btn.click();
  await page.getByText('Tu solicitud está lista').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  const doc = await page.locator('main').innerText();
  log('F3-doc-titulo', /Pelota de fútbol/.test(doc) ? 'OK' : 'FAIL');
  log('F3-doc-campos', /Solicitante/.test(doc) && /Edgar Calderon/.test(doc) && /Mercadeo y publicidad/.test(doc) ? 'OK campos completos visibles (Solicitante/Área/Tipo)' : 'FAIL campos ausentes');
  log('F3-doc-detalles', /Detalles de la solicitud/.test(doc) ? 'OK sección Detalles (logo+respuestas)' : 'FAIL sin sección Detalles');
  log('F3-doc-logo', /cotizacion-sombrillas\.pdf/.test(doc) ? 'OK logo listado' : 'WARN sin logo listado');
  await shot('F3-final');

  // enviar y verificar mis solicitudes con tracker
  await page.getByRole('button', { name: /Enviar solicitud/ }).click();
  await page.getByText('Tu solicitud fue enviada').waitFor({ timeout: 45000 });
  await page.goto(`${BASE}/mis-solicitudes?email=${encodeURIComponent('edgar.calderon@intelia.com')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const lista = await page.locator('main').innerText();
  log('F5-cards', /Pelota de fútbol/.test(lista) ? 'OK card de la solicitud creada' : 'FAIL lista sin la solicitud');
  log('F5-tracker-cards', /Creada/.test(lista) && /En cotización/.test(lista) ? 'OK tracker compacto en cards' : 'FAIL sin tracker');
  await shot('F5-cards-final');
  await page.locator('a[href^="/mis-solicitudes/"]').first().click();
  await page.waitForURL(/\/mis-solicitudes\/[0-9a-f-]{8}/, { timeout: 15000 });
  await page.waitForTimeout(600);
  const det = await page.locator('main').innerText();
  log('F5-detalle', /Pelota de fútbol/.test(det) && /Progreso/.test(det) && /Volver/.test(det) ? 'OK página detalle completa con Volver' : `FAIL detalle: ${det.slice(0, 150)}`);
  log('F5-logo-link', /Descargar/.test(det) ? 'OK link de descarga de logo' : 'WARN sin link de logo');
  await shot('F5-detalle-final');

  console.log('\n===== VERIFICACIÓN FINAL COMPLETA =====');
});
