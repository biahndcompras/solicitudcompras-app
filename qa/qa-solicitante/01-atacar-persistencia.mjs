// ATAQUE 1 (POST-FIX) — Persistencia del borrador: escribir → autoguardar → recargar.
// Verifica el sobre {v, guardadoEn, estado} y que TODO el contenido sobreviva.
import { withPage, log, dumpFinal, BASE, entrarComoSolicitante, llenarPaso2 } from './harness.mjs';

const UNICO = 'ZAFIRO-UNICO-778899';

const leerBorrador = (page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('bia_borrador');
    if (!raw) return { existe: false };
    const o = JSON.parse(raw);
    const e = o.estado ?? o; // sobre nuevo o plano legado
    return {
      existe: true,
      sobre: { v: o.v ?? null, guardadoEn: o.guardadoEn ?? null },
      bytes: raw.length,
      paso: e.paso,
      titulo: e.titulo,
      tipoNecesidad: e.tipoNecesidad,
      descripcionLen: (e.descripcion || '').length,
      descripcionMuestra: (e.descripcion || '').slice(0, 30),
      fechaRequerida: e.fechaRequerida,
      area: e.area,
      nombre: e.nombre,
      llevaBranding: e.llevaBranding,
    };
  });

await withPage(async ({ page, shot }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrarComoSolicitante(page);
  await llenarPaso2(page, { unico: UNICO });
  await page.waitForTimeout(1200);
  log('A1-localStorage', await leerBorrador(page));

  // --- recargar: ¿vuelve todo? ---
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#titulo').waitFor();
  await page.waitForTimeout(700);
  const trasRecarga = await page.evaluate(() => {
    const ta = document.querySelector('#descripcion');
    const rail = document.querySelector('aside')?.innerText.replace(/\s+/g, ' ') ?? '';
    return {
      titulo: document.querySelector('#titulo')?.value ?? null,
      descripcionContieneUnico: (ta?.value ?? '').includes('ZAFIRO-UNICO-778899'),
      descripcionLen: ta?.value?.length ?? -1,
      fechaRequerida: document.querySelector('#fecha-requerida')?.value ?? null,
      tipoNecesidad: document.querySelector('#tipo-necesidad')?.value ?? null,
      rail,
      diceGuardado: /Guardado en este navegador a las \d{1,2}:\d{2}/.test(rail),
      horaEnRail: (rail.match(/a las (\d{1,2}:\d{2})/) || [])[1] ?? null,
      botonDiceGuardado: /¡Guardado!/.test(document.body.innerText),
    };
  });
  log('A1-tras-recarga', trasRecarga);
  await shot('A1-tras-recarga');

  // --- la marca de tiempo sobrevive (antes: useState, se perdía) ---
  const guardadoEnPrevio = (await leerBorrador(page)).sobre.guardadoEn;
  log('A1-guardadoEn-persistido', { guardadoEnPrevio, esNumero: typeof guardadoEnPrevio === 'number' });

  // Tras recargar con ?nuevo=1 el wizard PREGUNTA por el borrador (no lo descarta).
  const retomar = page.getByRole('button', { name: /Retomar el borrador/i });
  if (await retomar.count()) await retomar.click();
  await page.waitForTimeout(400);

  // --- recargar en un paso INTERMEDIO restaura el paso, no solo los campos ---
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const retomar2 = page.getByRole('button', { name: /Retomar el borrador/i });
  if (await retomar2.count()) await retomar2.click();
  await page.waitForTimeout(800);
  const pasoRestaurado = await page.evaluate(() => ({
    enClasificacion: /Clasificación de tu solicitud/.test(document.body.innerText),
    pasoGuardado: JSON.parse(localStorage.getItem('bia_borrador') || '{}')?.estado?.paso ?? null,
  }));
  log('A1-recarga-en-paso-3', pasoRestaurado);
  await shot('A1-recarga-paso3');

  // --- atrás del navegador a mitad del flujo ---
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const trasAtras = await page.evaluate(() => ({
    url: location.href.slice(0, 60),
    titulo: document.querySelector('#titulo')?.value ?? null,
    enClasificacion: /Clasificación de tu solicitud/.test(document.body.innerText),
  }));
  log('A1-boton-atras-navegador', trasAtras);

  // --- ?nuevo=1 con borrador existente: NO se descarta en silencio ---
  await page.goto(`${BASE}/solicitud/nueva?nuevo=1&email=mj.e2e@biabrands.co&nombre=Solicitante%20E2E&area=Trade%20Marketing`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1200);
  const conNuevo1 = await page.evaluate(() => ({
    titulo: document.querySelector('#titulo')?.value ?? null,
    modalBorrador: /Hay una solicitud a medias/.test(document.body.innerText),
    botones: [...document.querySelectorAll('[role=dialog] button')].map((b) => b.innerText.trim()),
    dialogo: !!document.querySelector('[role=dialog]'),
  }));
  log('A1-nuevo1-no-descarta-silencioso', conNuevo1);
  await shot('A1-nuevo1-modal-borrador');

  // "Empezar de cero" sí descarta (decisión explícita)
  const empezar = page.getByRole('button', { name: /Empezar de cero/i });
  if (await empezar.count()) {
    await empezar.click();
    await page.waitForTimeout(600);
    const trasDescartar = await page.evaluate(() => ({
      titulo: document.querySelector('#titulo')?.value ?? null,
      modalCerrado: !/Hay una solicitud a medias/.test(document.body.innerText),
      area: (document.body.innerText.match(/Área:\s*(.*)/) || [])[1] ?? null,
    }));
    log('A1-empezar-de-cero', trasDescartar);
  }

  // --- deep link sin query: el área se puede capturar (antes: dead-end real) ---
  await page.goto(`${BASE}/solicitud/nueva`, { waitUntil: 'domcontentloaded' });
  await page.locator('#titulo').waitFor();
  await page.waitForTimeout(700);
  const deepLinkAntes = await page.evaluate(() => {
    const cta = [...document.querySelectorAll('main section button')].find((b) => /Continuar/.test(b.innerText));
    return {
      pideIdentidad: /Nos faltan tus datos/.test(document.body.innerText),
      hayInputArea: !!document.querySelector('#area-identidad'),
      labelArea: document.querySelector('label[for=area-identidad]')?.innerText ?? null,
      ctaDeshabilitado: cta?.disabled ?? null,
      motivoEnPantalla: /Falta:.*área/.test(document.body.innerText),
    };
  });
  log('A1-deeplink-sin-query-antes', deepLinkAntes);
  await page.locator('#area-identidad').fill('Trade Marketing');
  await page.locator('#nombre-identidad').fill('Solicitante E2E');
  await page.locator('#titulo').fill('Sombrillas test deep link');
  await page.locator('#tipo-necesidad').selectOption({ index: 1 });
  await page.locator('#fecha-requerida').fill('2026-12-01');
  await page.waitForTimeout(300);
  const deepLinkDespues = await page.evaluate(() => {
    const cta = [...document.querySelectorAll('main section button')].find((b) => /Continuar/.test(b.innerText));
    return { ctaDeshabilitado: cta?.disabled ?? null, area: (document.body.innerText.match(/Área:\s*(.*)/) || [])[1] ?? null };
  });
  log('A1-deeplink-sin-query-despues', deepLinkDespues);
  await shot('A1-deeplink-resuelto');
});

dumpFinal();
