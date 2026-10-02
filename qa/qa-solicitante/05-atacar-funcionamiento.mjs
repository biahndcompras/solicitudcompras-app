// ATAQUE 5 — Funcionamiento: doble clic, red cortada, IA basura, localStorage corrupto,
// dos pestañas, botón atrás del navegador, recarga en cada paso.
import { withPage, log, dumpFinal, BASE, entrarComoSolicitante, llenarPaso2 } from './harness.mjs';

const UNICO = 'A5-' + Math.random().toString(36).slice(2, 8).toUpperCase();

// --- utilidades para llegar rápido a cada paso ---
async function hastaPaso(page, paso) {
  await page.waitForTimeout(300);
  if (paso >= 2) {
    await page.locator('#titulo').waitFor();
    await llenarPaso2(page, { unico: UNICO });
  }
  if (paso >= 3) {
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1200);
  }
  if (paso >= 4) {
    await page.getByRole('button', { name: /Confirmar clasificación/i }).click();
    await page.getByText('Detalles para cotizar').waitFor({ timeout: 90000 });
    await page.waitForTimeout(3000);
  }
  if (paso >= 5) {
    await page.getByRole('button', { name: /Generar documento/i }).click();
    await page.getByText('Tu solicitud está lista').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
  }
  if (paso >= 6) {
    await page.getByRole('button', { name: /Enviar solicitud/i }).click();
    await page.getByText('Tu solicitud fue enviada').waitFor({ timeout: 60000 });
  }
}

await withPage(async ({ page, ctx, shot, consola }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ---------- A5.1 localStorage corrupto / hostil ---------- */
  const CORRUPTOS = {
    'json-invalido': '{{{no es json',
    'array-vacio': '[]',
    'null': 'null',
    'string': '"hola"',
    'schema-distinto': JSON.stringify({ version: 'v0-antiguo', campos: { a: 1 } }),
    'paso-99': JSON.stringify({ paso: 99, email: 'x@bia.com', titulo: 'T', descripcion: 'D' }),
    'campos-faltantes': JSON.stringify({ paso: 2 }),
    'tipos-erroneos': JSON.stringify({ paso: 'tres', titulo: 42, descripcion: { a: 1 }, llevaBranding: 'sí', assessmentRespuestas: 'no', assessmentPreguntas: 7 }),
    'gigante-1mb': JSON.stringify({ paso: 2, titulo: 'T', descripcion: 'X'.repeat(1000000) }),
    'email-distinto': JSON.stringify({ paso: 4, email: 'otro@bia.com', titulo: 'De otro usuario', descripcion: 'secreto' }),
  };
  for (const [nombre, valor] of Object.entries(CORRUPTOS)) {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate((v) => {
      localStorage.setItem('bia_borrador', v);
    }, valor);
    const errores = [];
    const onErr = (e) => errores.push(String(e).slice(0, 120));
    page.on('pageerror', onErr);
    await page.goto(`${BASE}/solicitud/nueva?nuevo=1&email=mj.e2e@biabrands.co&nombre=Solicitante%20E2E&area=Trade%20Marketing`, {
      waitUntil: 'domcontentloaded',
    });
    let vivo = false;
    let estado = null;
    try {
      await page.locator('#titulo').waitFor({ timeout: 8000 });
      vivo = true;
      estado = await page.evaluate(() => ({
        titulo: document.querySelector('#titulo')?.value ?? null,
        descLen: document.querySelector('textarea')?.value?.length ?? -1,
        paso: document.body.innerText.match(/Detalles para cotizar|Clasificación de tu solicitud|¿Qué necesitás\?|Tu solicitud está lista/)?.[0] ?? null,
      }));
    } catch (e) {
      estado = { timeout: true };
    }
    page.off('pageerror', onErr);
    log(`A5.1-ls-${nombre}`, { vivo, ...estado, erroresPagina: errores });
  }
  await shot('A5.1-ls-final');

  /* ---------- A5.2 IA devuelve basura ---------- */
  const CASOS_IA = {
    '500-error': { status: 500, body: { error: 'boom' } },
    'preguntas-vacias': { status: 200, body: { preguntas: [], camposPlantilla: [], sin_preguntas_pendientes: true } },
    'sin-campo-preguntas': { status: 200, body: { camposPlantilla: [], sin_preguntas_pendientes: true } },
    'campos-null': { status: 200, body: { preguntas: null, camposPlantilla: null, preguntas_contexto: null } },
    'texto-en-otro-idioma': {
      status: 200,
      body: { preguntas: [{ campoKey: 'x', pregunta: 'What is the required quantity? (¿cantidad?)', ejemplo_respuesta: '500' }], camposPlantilla: [], sin_preguntas_pendientes: false },
    },
    'no-json': { status: 200, body: '<<<no es json>>>', contentType: 'text/plain' },
    'pregunta-sin-campoKey': { status: 200, body: { preguntas: [{ pregunta: 'Cantidad' }], camposPlantilla: [], sin_preguntas_pendientes: false } },
  };
  for (const [nombre, cfg] of Object.entries(CASOS_IA)) {
    await page.unroute('**/api/ia/assessment').catch(() => {});
    await page.route('**/api/ia/assessment', async (route) => {
      await route.fulfill({
        status: cfg.status,
        contentType: cfg.contentType || 'application/json',
        body: typeof cfg.body === 'string' ? cfg.body : JSON.stringify(cfg.body),
      });
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.getByPlaceholder('ejemplo@bia.com').fill('mj.e2e@biabrands.co');
    await page.getByPlaceholder('Juan Pérez').fill('Solicitante E2E');
    await page.getByPlaceholder('Marketing').fill('Trade Marketing');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.waitForURL(/\/solicitud\/nueva/);
    await hastaPaso(page, 4);
    const obs = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        hayErrorVisible: /no pudimos|error|reintent|intentá de nuevo|conexión/i.test(t),
        ctaHabilitado: ![...document.querySelectorAll('main section button')].find((b) => /Generar documento/.test(b.innerText))?.disabled,
        textoVisible: t.replace(/\s+/g, ' ').slice(0, 200),
      };
    });
    log(`A5.2-ia-${nombre}`, obs);
    if (nombre === '500-error') await shot('A5.2-ia-500');
  }
  await page.unroute('**/api/ia/assessment').catch(() => {});

  /* ---------- A5.3 doble clic en Enviar ---------- */
  let postCount = 0;
  await page.route('**/api/solicitudes', async (route) => {
    if (route.request().method() === 'POST') postCount++;
    await route.continue();
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.getByPlaceholder('ejemplo@bia.com').fill('mj.e2e@biabrands.co');
  await page.getByPlaceholder('Juan Pérez').fill('Solicitante E2E');
  await page.getByPlaceholder('Marketing').fill('Trade Marketing');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForURL(/\/solicitud\/nueva/);
  await hastaPaso(page, 5);
  const enviar = page.getByRole('button', { name: /Enviar solicitud/i });
  await enviar.click({ clickCount: 3, delay: 5 });
  await page.waitForTimeout(6000);
  log('A5.3-doble-clic', { postCount, pantalla: (await page.evaluate(() => document.body.innerText.slice(0, 120))).replace(/\s+/g, ' ') });
  await shot('A5.3-tras-envio');
  await page.unroute('**/api/solicitudes').catch(() => {});

  /* ---------- A5.4 red cortada justo antes de Enviar ---------- */
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.getByPlaceholder('ejemplo@bia.com').fill('mj.e2e@biabrands.co');
  await page.getByPlaceholder('Juan Pérez').fill('Solicitante E2E');
  await page.getByPlaceholder('Marketing').fill('Trade Marketing');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForURL(/\/solicitud\/nueva/);
  await hastaPaso(page, 5);
  await ctx.setOffline(true);
  await page.getByRole('button', { name: /Enviar solicitud/i }).click();
  await page.waitForTimeout(2500);
  const offline = await page.evaluate(() => {
    const alert = document.querySelector('[role=alert]')?.innerText ?? null;
    return {
      alert,
      alertaEnEspañol: alert ? !/Failed to fetch|NetworkError|Load failed/i.test(alert) : null,
      hayReintento: /Reintentar/i.test(document.body.innerText),
      texto: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
    };
  });
  log('A5.4-offline-envio', offline);
  await shot('A5.4-offline-envio');
  // ¿se puede reintentar sin perder lo escrito?
  await ctx.setOffline(false);
  const reintento = page.getByRole('button', { name: /Reintentar/i });
  if (await reintento.count()) {
    await reintento.first().click();
    await page.waitForTimeout(6000);
    log('A5.4-reintento', { exito: /Tu solicitud fue enviada/.test(await page.evaluate(() => document.body.innerText)) });
  } else {
    log('A5.4-reintento', { exito: false, motivo: 'no hay botón Reintentar' });
  }
  await shot('A5.4-tras-reintento');
});

dumpFinal();
