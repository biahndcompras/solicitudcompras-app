// ATAQUE 7 — Contenido extremo en el resumen (paso 5) y 12 proveedores en la comparativa,
// más un nombre de solicitante larguísimo y un email largo.
import { withPage, log, dumpFinal, BASE, entrarComoSolicitante, llenarPaso2, detectarDesbordes, detectarA11y } from './harness.mjs';

const TITULO_200 = 'Sombrillas brandeadas con logo de la marca para la campaña de verano 2026 en todas las sedes de Honduras y el Caribe '.repeat(2).slice(0, 200);
const DESCR_5000 = 'Necesitamos 500 sombrillas con el logo de la marca para la activación de playa en el Caribe. '.repeat(100).slice(0, 5000);
const NOMBRE_LARGO = 'María Fernanda de los Ángeles_experimentación Q.A.verylongname+coordinación-compras-bia-honduras S.A. de C.V. ';

const URL_WIZARD = `${BASE}/solicitud/nueva?nuevo=1&email=${encodeURIComponent('qa.nombre.largo@biabrands.co.hn')}&nombre=${encodeURIComponent(NOMBRE_LARGO)}&area=${encodeURIComponent('Trade Marketing & Retail / wholesale & e-commerce')}`;

await withPage(async ({ page, shot }) => {
  // 1) Wizard con contenido extremo hasta el resumen
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_WIZARD, { waitUntil: 'domcontentloaded' });
  await page.locator('#titulo').waitFor();
  await page.locator('#titulo').fill(TITULO_200);
  await page.locator('#descripcion').fill(DESCR_5000);
  await page.locator('#tipo-necesidad').selectOption({ index: 1 });
  await page.locator('#fecha-requerida').fill('2026-12-01');
  await page.locator('label').filter({ hasText: 'Bien físico' }).click();
  await page.waitForTimeout(800);
  const enPaso2 = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    tituloEnInput: (document.querySelector('#titulo')?.value ?? '').length,
    descEnInput: (document.querySelector('#descripcion')?.value ?? '').length,
  }));
  log('A7-paso2-extremo', enPaso2);
  await shot('A7-paso2-extremo', false);

  // hasta el resumen con la IA interceptada (para no esperar minutos)
  await page.route('**/api/ia/clasificar', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tipo: 'RFQ', subtipo: 'producto', confianza: 0.9, razonamiento_breve: 'ok' }) }));
  await page.route('**/api/ia/assessment', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preguntas: [{ campoKey: 'cant', pregunta: 'Cantidad exacta de sombrillas', ejemplo_respuesta: '500', sugerencias: ['500', '1000', '5000'] }], camposPlantilla: [], sin_preguntas_pendentes: false }) }));
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Confirmar clasificación/i }).click();
  await page.getByText('Detalles para cotizar').waitFor({ timeout: 40000 });
  await page.waitForTimeout(1500);
  // RN-03: con branding activo y sin archivo, "Generar documento" está deshabilitado
  // (y con razón). Este ataque va al resumen, así que se apaga el branding.
  await page.getByRole('button', { name: '¿Lleva marca o branding?' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Generar documento/i }).click();
  await page.getByText('Tu solicitud está lista').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  for (const [w, h] of [[390, 844], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    const d = await detectarDesbordes(page);
    const a = await detectarA11y(page);
    const res = await page.evaluate(() => {
      const t = document.body.innerText;
      const cta = [...document.querySelectorAll('main section button')].find((b) => /Enviar solicitud|Reintentar/.test(b.innerText));
      const r = cta?.getBoundingClientRect();
      return {
        tituloCompleto: /Caribe/.test(t),
        descCortaPresente: t.includes('activación de playa'),
        ctaVisible: r ? r.bottom <= window.innerHeight + 0.5 : null,
        nombreLargoVisible: /experimentación/.test(t),
        tarjetaAncho: Math.round(document.querySelector('main .max-w-md')?.getBoundingClientRect().width ?? 0),
      };
    });
    log(`A7-resumen-${w}x${h}`, { ...res, scrollH: d.scrollHorizontal, culpables: d.culpables.filter((c) => !/blur-\[80px\]|animate-fluid-blob/.test(c.cls)).length, targetsPequenos: a.targetsPequenos.length });
    await shot(`A7-resumen-${w}x${h}`);
  }

  // 2) Comparativa con 12 proveedores (extremo de layout)
  await page.goto(`${BASE}/comparativa/QA-MANY-PROVIDERS`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1800);
  const muchos = await page.evaluate(() => {
    const tarjetas = [...document.querySelectorAll('main .grid > div')];
    return {
      tarjetas: tarjetas.length,
      scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      tiposMoneda: [...new Set(tarjetas.map((t) => (t.innerText.match(/TOTAL\s*(\S+)/) || [])[1]).filter(Boolean))],
    };
  });
  log('A7-12-proveedores', muchos);
  await shot('A7-12-proveedores');
});

dumpFinal();
