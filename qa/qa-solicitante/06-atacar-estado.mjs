// ATAQUE 6 — Estado hostil: localStorage corrupto/enorme, dos pestañas, recarga en cada paso,
// avanzar-atrás, y contenido extremo.
import { withPage, log, dumpFinal, BASE, entrarComoSolicitante, llenarPaso2, detectarDesbordes } from './harness.mjs';

const CORRUPTOS = {
  'json-invalido': '{{{no es json',
  'array-vacio': '[]',
  'null': 'null',
  'string': '"hola"',
  'schema-distinto': JSON.stringify({ version: 'v0-antiguo', campos: { a: 1 } }),
  'sobre-v999': JSON.stringify({ v: 999, guardadoEn: 'no-es-fecha', estado: { paso: 4, titulo: 'del futuro' } }),
  'paso-99': JSON.stringify({ v: 2, guardadoEn: Date.now(), estado: { paso: 99, email: 'mj.e2e@biabrands.co', titulo: 'T', descripcion: 'D', area: 'X' } }),
  'paso-0': JSON.stringify({ v: 2, guardadoEn: Date.now(), estado: { paso: 0, titulo: 'T', area: 'X', email: 'mj.e2e@biabrands.co' } }),
  'campos-faltantes': JSON.stringify({ v: 2, guardadoEn: Date.now(), estado: { paso: 2 } }),
  'tipos-erroneos': JSON.stringify({
    v: 2, guardadoEn: Date.now(),
    estado: { paso: 'tres', titulo: 42, descripcion: { a: 1 }, llevaBranding: 'sí', assessmentRespuestas: 'no', assessmentPreguntas: 7, clasificacion: 'ZZZ', fechaRequerida: 'no-es-fecha', confianzaClasificacion: 99, solicitudId: 'no-uuid', coordinadorId: 5 },
  }),
  'preguntas-basura': JSON.stringify({ v: 2, guardadoEn: Date.now(), estado: { paso: 4, email: 'mj.e2e@biabrands.co', titulo: 'T', assessmentPreguntas: [null, 5, { pregunta: '' }, { campoKey: '', pregunta: 'Cantidad?' }] } }),
  'gigante-1mb': JSON.stringify({ v: 2, guardadoEn: Date.now(), estado: { paso: 2, email: 'mj.e2e@biabrands.co', titulo: 'T', area: 'X', descripcion: 'X'.repeat(1000000) } }),
  'texto-100k': JSON.stringify({ v: 2, guardadoEn: Date.now(), estado: { paso: 2, email: 'mj.e2e@biabrands.co', titulo: 'T'.repeat(50000), area: 'X' } }),
  'email-distinto': JSON.stringify({ v: 2, guardadoEn: Date.now(), estado: { paso: 4, email: 'victima@otra.com', titulo: 'Datos de otra persona', descripcion: 'secreto', area: 'Finanzas' } }),
  'envio-completado': JSON.stringify({ v: 2, guardadoEn: Date.now(), estado: { paso: 6, email: 'mj.e2e@biabrands.co', titulo: 'Ya enviada', solicitudId: 'aaaaaaaa-0000-4000-8000-000000000001' } }),
};

const URL_WIZARD = `${BASE}/solicitud/nueva?nuevo=1&email=mj.e2e@biabrands.co&nombre=Solicitante%20E2E&area=Trade%20Marketing`;

await withPage(async ({ page, ctx, shot, consola }) => {
  /* ---- A6.1 localStorage hostil: no debe romper nada ni filtrar datos de otro correo ---- */
  for (const [nombre, valor] of Object.entries(CORRUPTOS)) {
    const errores = [];
    const onErr = (e) => errores.push(String(e).slice(0, 100));
    page.on('pageerror', onErr);
    consola.length = 0;
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate((v) => localStorage.setItem('bia_borrador', v), valor);
    await page.goto(URL_WIZARD, { waitUntil: 'domcontentloaded' });
    let vivo = false;
    let estado = null;
    try {
      const retomar = page.getByRole('button', { name: /Retomar el borrador/i });
      if (await retomar.count()) await retomar.click();
      await page.waitForSelector('#titulo, h1', { timeout: 15000 });
      vivo = true;
      await page.waitForTimeout(500);
      estado = await page.evaluate(() => ({
        titulo: (document.querySelector('#titulo')?.value ?? '').slice(0, 40),
        tituloEnPaso4: /Detalles para cotizar/.test(document.body.innerText),
        preguntasBasuraVisibles: (document.body.innerText.match(/Cantidad\?/g) || []).length,
        descLen: document.querySelector('#descripcion')?.value?.length ?? -1,
        tituloLen: document.querySelector('#titulo')?.value?.length ?? -1,
        pantallaRota: /couldn.t load|Application error/i.test(document.body.innerText),
        hayPaso: /Detalles para cotizar|Clasificación de tu solicitud|¿Qué necesitás\?|Tu solicitud (está lista|fue enviada)/.test(document.body.innerText),
        fugaOtroCorreo: /victima@otra.com|Datos de otra persona/.test(document.body.innerText),
      }));
    } catch {
      estado = { timeout: true };
    }
    page.off('pageerror', onErr);
    log(`A6.1-ls-${nombre}`, { vivo, ...estado, erroresPagina: errores, erroresConsola: consola.filter((c) => c.startsWith('error') || c.startsWith('pageerror')).slice(0, 2) });
  }
  await shot('A6.1-ls-final');

  /* ---- A6.2 dos pestañas editando el mismo borrador ---- */
  await entrarComoSolicitante(page);
  await llenarPaso2(page, { unico: 'PESTAÑA-A' });
  await page.waitForTimeout(1000);
  const pestana2 = await ctx.newPage();
  await pestana2.goto(URL_WIZARD, { waitUntil: 'domcontentloaded' });
  await pestana2.waitForTimeout(1200);
  const retomar2 = pestana2.getByRole('button', { name: /Retomar el borrador/i });
  if (await retomar2.count()) await retomar2.click();
  await pestana2.waitForTimeout(400);
  await pestana2.locator('#titulo').fill('PESTAÑA-B');
  await pestana2.waitForTimeout(1000);
  const enA = await page.evaluate(() => document.querySelector('#titulo')?.value ?? null);
  const enB = await pestana2.evaluate(() => document.querySelector('#titulo')?.value ?? null);
  const guardado = await pestana2.evaluate(() => JSON.parse(localStorage.getItem('bia_borrador') || '{}')?.estado?.titulo ?? null);
  // recarga la pestaña A: ¿qué gana?
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const retomarA = page.getByRole('button', { name: /Retomar el borrador/i });
  if (await retomarA.count()) await retomarA.click();
  await page.waitForTimeout(400);
  const trasRecargaA = await page.evaluate(() => document.querySelector('#titulo')?.value ?? null);
  log('A6.2-dos-pestanas', { enA_vivo: enA, enB_vivo: enB, guardadoPorB: guardado, trasRecargaA, nota: 'la última escritura gana; no hay merge (documentado)' });
  await pestana2.close();

  /* ---- A6.3 recarga en CADA paso + avanzar-atrás ---- */
  await entrarComoSolicitante(page);
  await llenarPaso2(page, { unico: 'RECARGA' });
  await page.waitForTimeout(800);
  const porPaso = [];
  for (const [nombre, avance] of [
    ['paso2', async () => {}],
    ['paso3', async () => { await page.getByRole('button', { name: 'Continuar' }).click(); await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 30000 }); }],
    ['paso4', async () => { await page.getByRole('button', { name: /Confirmar clasificación/i }).click(); await page.getByText('Detalles para cotizar').waitFor({ timeout: 40000 }); }],
  ]) {
    await avance();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const retomar = page.getByRole('button', { name: /Retomar el borrador/i });
    if (await retomar.count()) await retomar.click();
    await page.waitForTimeout(600);
    porPaso.push({
      nombre,
      pasoGuardado: await page.evaluate(() => JSON.parse(localStorage.getItem('bia_borrador') || '{}')?.estado?.paso ?? null),
      enPantalla: await page.evaluate(() => ({
        p2: /¿Qué necesitás\?/.test(document.body.innerText),
        p3: /Clasificación de tu solicitud/.test(document.body.innerText),
        p4: /Detalles para cotizar/.test(document.body.innerText),
        conservaTitulo: (document.querySelector('#titulo')?.value ?? '').includes('RECARGA'),
      })),
    });
    await shot(`A6.3-${nombre}`);
  }
  // atrás del wizard
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.waitForTimeout(500);
  const trasAtras1 = await page.evaluate(() => /Clasificación de tu solicitud/.test(document.body.innerText));
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.waitForTimeout(500);
  const trasAtras2 = await page.evaluate(() => ({ enPaso2: /¿Qué necesitás\?/.test(document.body.innerText), tituloIntacto: (document.querySelector('#titulo')?.value ?? '').includes('RECARGA') }));
  log('A6.3-recarga-por-paso', porPaso);
  log('A6.3-atras', { trasAtras1_aClasificacion: trasAtras1, trasAtras2: trasAtras2 });

  /* ---- A6.4 contenido extremo ---- */
  await page.goto(URL_WIZARD, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const retomar = page.getByRole('button', { name: /Retomar el borrador/i });
  if (await retomar.count()) await retomar.click();
  await page.waitForTimeout(300);
  const TITULO_200 = 'Sombrillas brandeadas con logo de la marca para la campaña de verano 2026 en todas las sedes de Honduras y el Caribe '.repeat(2).slice(0, 200);
  const DESCR_5000 = 'Necesitamos 500 sombrillas con logo de la marca para la activación de playa. '.repeat(100).slice(0, 5000);
  await page.locator('#titulo').fill(TITULO_200);
  await page.locator('#descripcion').fill(DESCR_5000);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  const extremo = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      tituloVisibleCompleto: /Honduras y el Caribe/.test(t),
      ctaVisible: (() => {
        const b = [...document.querySelectorAll('main section button')].find((x) => /Confirmar clasificación/.test(x.innerText));
        const r = b?.getBoundingClientRect();
        return r ? r.bottom <= window.innerHeight + 0.5 : null;
      })(),
      descEnResumen: /Necesitamos 500 sombrillas/.test(t),
    };
  });
  const dExtremo = await detectarDesbordes(page);
  log('A6.4-contenido-extremo', { ...extremo, culpables: dExtremo.culpables.filter((c) => !/animate-fluid-blob|blur-\[80px\]/.test(c.cls)) });
  await shot('A6.4-extremo');
});

dumpFinal();
