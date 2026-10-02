// ATAQUE 12b (re-medición correcta) — A12.1 a 390px de verdad y A12.5 sin bucle de clicks.
import { withPage, log, dumpFinal, BASE, entrarComoSolicitante } from './harness.mjs';

/* ---------- A12.1 mobile real: ¿se ve por qué el CTA está deshabilitado? ---------- */
await withPage(
  async ({ page, shot }) => {
    await entrarComoSolicitante(page);
    await page.locator('#titulo').fill('');
    await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
    await page.locator('input[type=date]').fill('2026-11-05');
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const sec = document.querySelector('main > section');
      const b = [...document.querySelectorAll('main section button')].find((x) => /Continuar/.test(x.innerText));
      const candidatos = [...document.querySelectorAll('main section span')]
        .filter((s) => /Falta/.test(s.innerText))
        .map((s) => {
          const r = s.getBoundingClientRect();
          const cs = getComputedStyle(s);
          return { texto: s.innerText.trim(), w: Math.round(r.width), h: Math.round(r.height), display: cs.display };
        });
      return {
        vw: window.innerWidth,
        ctaDeshabilitado: b?.disabled,
        visibleEnDOM: /Falta:/.test(sec?.innerText ?? ''),
       渲染Visible: candidatos.filter((c) => c.display !== 'none' && c.w > 0),
        todos: candidatos,
      };
    });
    log('A12.1-390-cta-deshabilitado', m);
    await shot('A12.1-390-cta-deshabilitado');
  },
  { viewport: { width: 390, height: 844 } }
);

/* ---------- A12.5 error crudo del servidor, un caso por página ---------- */
const ERRORES = {
  boom: { status: 500, body: { error: 'boom' } },
  openrouter: { status: 500, body: { error: 'OPENROUTER_API_KEY no configurada' } },
  stack: { status: 500, body: { error: 'Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect' } },
  html: { status: 502, body: { error: '<html><head><title>502 Bad Gateway</title></head></html>' } },
  fraseNegocio: { status: 400, body: { error: 'La categoría seleccionada no existe en el catálogo.' } },
  sinCuerpo: { status: 500, body: null },
};
for (const [nombre, mock] of Object.entries(ERRORES)) {
  await withPage(async ({ page, shot }) => {
    // El route se registra DESPUÉS del login: si no, el fill no llega al DOM.
    await page.route('**/api/ia/assessment', (route) =>
      route.fulfill({
        status: mock.status,
        contentType: 'application/json',
        body: mock.body === null ? '<html>gateway</html>' : JSON.stringify(mock.body),
      })
    );
    await entrarComoSolicitante(page);
    await page.locator('#titulo').fill('A12.5 ' + nombre);
    await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
    await page.locator('input[type=date]').fill('2026-11-05');
    await page.locator('textarea').first().fill('Necesitamos 500 sombrillas con logo de la marca.');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 40000 });
    await page.getByRole('button', { name: /Confirmar clasificación/i }).click();
    await page.getByText('Detalles para cotizar').waitFor({ timeout: 40000 });
    await page.waitForTimeout(1500);
    const vis = await page.evaluate(() => {
      const sec = document.querySelector('main > section');
      const texto = sec?.innerText ?? '';
      const alerta = [...document.querySelectorAll('[role=alert]')].map((a) => a.innerText.replace(/\s+/g, ' '));
      return {
        alerta: alerta[0]?.slice(0, 200) ?? null,
        hayBotonReintentar: !![...document.querySelectorAll('main section button')].find((x) => /Reintentar/.test(x.innerText)),
        filtraInfra: /boom|OPENROUTER|ECONNREFUSED|Bad Gateway|<html>|gateway|afterConnect/i.test(texto),
        loaderAtascado: !![...document.querySelectorAll('main section div')].find((d) => /Preparando preguntas/.test(d.innerText) && d.className.includes('absolute')),
        pantallaRota: /couldn.t load|Application error/i.test(document.body.innerText),
      };
    });
    log(`A12.5-error-${nombre}`, vis);
    await shot(`A12.5-error-${nombre}`);
  });
}

dumpFinal();
