// ATAQUE 5b — IA basura + doble clic + red cortada.
// NOTA DE MÉTODO: en este entorno, registrar cualquier page.route ANTES de rellenar la home
// hace que el fill no llegue al DOM (valor queda ""). Por eso el login se hace SIEMPRE
// primero y las rutas se registran después.
import { withPage, log, dumpFinal, entrarComoSolicitante, llenarPaso2 } from './harness.mjs';

const CLASIF_OK = { tipo: 'RFQ', subtipo: 'producto', confianza: 0.9, razonamiento_breve: 'Busca precio' };

async function irA(page, paso) {
  if (paso >= 2) {
    await page.locator('#titulo').waitFor();
    await llenarPaso2(page);
  }
  if (paso >= 3) {
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
  }
  if (paso >= 4) {
    await page.getByRole('button', { name: /Confirmar clasificación/i }).click();
    await page.getByText('Detalles para cotizar').waitFor({ timeout: 40000 });
    await page.waitForTimeout(2500);
  }
  if (paso >= 5) {
    // El branding por defecto bloquea el CTA (RN-03): lo apagamos para aislar otros fallos.
    const sw = page.locator('button[aria-pressed]').first();
    if ((await sw.getAttribute('aria-pressed')) === 'true') {
      await sw.click();
      await page.waitForTimeout(400);
    }
    await page.getByRole('button', { name: /Generar documento/i }).click();
    await page.getByText('Tu solicitud está lista').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
  }
}

const CASOS_IA = {
  '500-error': { status: 500, body: { error: 'boom' } },
  '400-validacion': { status: 400, body: { error: 'Entrada inválida' } },
  'preguntas-vacias': { status: 200, body: { preguntas: [], camposPlantilla: [], sin_preguntas_pendientes: true } },
  'sin-campo-preguntas': { status: 200, body: { camposPlantilla: [], sin_preguntas_pendientes: true } },
  'campos-null': { status: 200, body: { preguntas: null, camposPlantilla: null, preguntas_contexto: null } },
  'pregunta-sin-campoKey': { status: 200, body: { preguntas: [{ pregunta: 'Cantidad' }], camposPlantilla: [], sin_preguntas_pendientes: false } },
  'texto-en-otro-idioma': {
    status: 200,
    body: { preguntas: [{ campoKey: 'cantidad', pregunta: 'What is the required quantity?', ejemplo_respuesta: '500' }], camposPlantilla: [], sin_preguntas_pendientes: false },
  },
  'no-json': { status: 200, body: '<<<no es json>>>', contentType: 'text/plain' },
};

await withPage(async ({ page, ctx, shot, consola }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const [nombre, cfg] of Object.entries(CASOS_IA)) {
    try {
      await page.unroute('**/api/ia/assessment').catch(() => {});
      await page.unroute('**/api/ia/clasificar').catch(() => {});
      await entrarComoSolicitante(page);
      await page.route('**/api/ia/clasificar', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CLASIF_OK) })
      );
      await page.route('**/api/ia/assessment', (route) =>
        route.fulfill({
          status: cfg.status,
          contentType: cfg.contentType || 'application/json',
          body: typeof cfg.body === 'string' ? cfg.body : JSON.stringify(cfg.body),
        })
      );
      consola.length = 0;
      await irA(page, 4);
      const obs = await page.evaluate(() => {
        const t = document.body.innerText;
        const cta = [...document.querySelectorAll('main section button')].find((b) => /Generar documento/.test(b.innerText));
        return {
          pantallaRota: /couldn.t load|Application error/i.test(t),
          mensajeDeError: /no pudimos|no se pudo|Reintent|conexión|asistente/i.test(t),
          hayReintento: !!document.querySelector('[data-reintentar-ia]'),
          preguntasVisibles: (t.match(/Pendiente|Listo/g) || []).length,
          ctaDeshabilitadoPorBranding: cta?.disabled ?? null,
          texto: t.replace(/\s+/g, ' ').slice(180, 460),
        };
      });
      log(`A5.2-ia-${nombre}`, { ...obs, erroresConsola: consola.filter((c) => c.startsWith('error') || c.startsWith('pageerror')).slice(0, 2) });
      if (['500-error', 'no-json', 'sin-campo-preguntas', 'pregunta-sin-campoKey'].includes(nombre)) {
        await shot(`A5.2-ia-${nombre}`);
      }
    } catch (e) {
      log(`A5.2-ia-${nombre}`, { EXCEPCION: String(e).slice(0, 140) });
    }
  }
  await page.unroute('**/api/ia/assessment').catch(() => {});
  await page.unroute('**/api/ia/clasificar').catch(() => {});

  /* ---- A5.3 doble clic en Enviar ---- */
  let postCount = 0;
  await entrarComoSolicitante(page);
  await page.route('**/api/ia/clasificar', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CLASIF_OK) })
  );
  await page.route('**/api/ia/assessment', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preguntas: [], camposPlantilla: [], sin_preguntas_pendentes: true }) })
  );
  await page.route('**/api/solicitudes', async (route) => {
    if (route.request().method() === 'POST') postCount++;
    await route.continue();
  });
  await irA(page, 5);
  await page.getByRole('button', { name: /Enviar solicitud/i }).click({ clickCount: 3, delay: 5 });
  await page.waitForTimeout(8000);
  log('A5.3-doble-clic', { postCount, exito: /Tu solicitud fue enviada/.test(await page.evaluate(() => document.body.innerText)) });
  await shot('A5.3-tras-envio');
  await page.unroute('**/api/solicitudes').catch(() => {});
  await page.unroute('**/api/ia/assessment').catch(() => {});
  await page.unroute('**/api/ia/clasificar').catch(() => {});

  /* ---- A5.4 red cortada justo antes de Enviar ---- */
  await entrarComoSolicitante(page);
  await page.route('**/api/ia/clasificar', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CLASIF_OK) })
  );
  await page.route('**/api/ia/assessment', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preguntas: [], camposPlantilla: [], sin_preguntas_pendentes: true }) })
  );
  await irA(page, 5);
  await ctx.setOffline(true);
  await page.getByRole('button', { name: /Enviar solicitud/i }).click();
  await page.waitForTimeout(3000);
  const offline = await page.evaluate(() => {
    const alert = document.querySelector('[role=alert]')?.innerText ?? null;
    const cta = [...document.querySelectorAll('main section button')].find((b) => /Reintentar|Enviar solicitud/.test(b.innerText));
    return {
      alert,
      enEspanol: alert ? !/Failed to fetch|NetworkError|Load failed|TypeError/i.test(alert) : null,
      ctaDice: cta?.innerText.trim() ?? null,
      hayBorradorSeguro: /quedó guardada como borrador/.test(document.body.innerText),
    };
  });
  log('A5.4-offline-envio', offline);
  await shot('A5.4-offline-envio');
  await ctx.setOffline(false);
  const r = page.getByRole('button', { name: /Reintentar envío/i });
  if (await r.count()) {
    await r.first().click();
    await page.waitForTimeout(9000);
    log('A5.4-reintento', { exito: /Tu solicitud fue enviada/.test(await page.evaluate(() => document.body.innerText)) });
  } else {
    log('A5.4-reintento', { exito: false, motivo: 'no existe botón de reintento' });
  }
  await shot('A5.4-tras-reintento');
});

dumpFinal();
