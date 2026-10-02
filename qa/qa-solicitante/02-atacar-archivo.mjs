// ATAQUE 2 — Subida de archivo: whitelist, tamaño, .svg, aria-invalid, mensajes.
import { withPage, log, dumpFinal, BASE, entrarComoSolicitante, llenarPaso2 } from './harness.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TMP = '/tmp/qa-archivos';
mkdirSync(TMP, { recursive: true });
// PNG de 12MB (basura aleatoria + cabecera PNG)
const png12 = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('esto no es una imagen real', 'utf8'),
  Buffer.alloc(12 * 1024 * 1024, 0x41),
]);
writeFileSync(`${TMP}/grande-12mb.png`, png12);
writeFileSync(`${TMP}/corrupto.pdf`, Buffer.from('%PDF-1.4 esto es basura no un pdf real'));
writeFileSync(`${TMP}/vector.svg`, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>');
writeFileSync(`${TMP}/no-aceptado.heic`, Buffer.from('ftypheic0000'));
writeFileSync(`${TMP}/ok-pequeno.png`, png12.slice(0, 4096));

await withPage(async ({ page, shot }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrarComoSolicitante(page);
  await llenarPaso2(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /Confirmar clasificación/i }).click();
  await page.getByText('Detalles para cotizar').waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);

  const input = page.locator('main input[type=file]').first();
  const info = await input.evaluate((el) => ({ accept: el.getAttribute('accept') }));
  log('A2-accept-atributo', info);

  const label = page.locator('label').filter({ hasText: 'Subir arte o logo oficial' }).first();
  log('A2-branding-switch-encendido', await page.locator('button[aria-pressed]').first().getAttribute('aria-pressed'));

  async function subir(ruta, nombre, mime) {
    await input.setInputFiles({ name: nombre, mimeType: mime, buffer: readBuf(ruta) });
    await page.waitForTimeout(500);
    return page.evaluate(() => {
      const zona = [...document.querySelectorAll('label')].find((l) => /hasta 4 MB/.test(l.innerText));
      const input = document.querySelector('main input[type=file]');
      return {
        textoZona: (zona?.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
        textoMuestraArchivo: (zona?.innerText || '').split('\n')[0].slice(0, 80),
        ariaInvalid: input?.getAttribute('aria-invalid') ?? null,
        hayMensajeError: /no admit|excede|maximum|máximo son|parece estar/i.test(document.body.innerText),
        alertRole: document.querySelector('[role=alert]')?.innerText?.slice(0, 120) ?? null,
      };
    });
  }
  function readBuf(ruta) {
    return readFileSync(ruta);
  }

  // caso 1: PNG 12MB
  log('A2-png-12mb', await subir(`${TMP}/grande-12mb.png`, 'grande-12mb.png', 'image/png'));
  await shot('A2-png-12mb');

  // caso 2: PDF corrupto
  log('A2-pdf-corrupto', await subir(`${TMP}/corrupto.pdf`, 'corrupto.pdf', 'application/pdf'));

  // caso 3: .heic fuera del accept
  log('A2-heic-fuera-accept', await subir(`${TMP}/no-aceptado.heic`, 'no-aceptado.heic', 'image/heic'));

  // caso 4: .svg (XSS vectorial servido desde el dominio)
  log('A2-svg', await subir(`${TMP}/vector.svg`, 'vector.svg', 'image/svg+xml'));

  // caso 5: PNG válido y pequeño → debe aceptarse
  log('A2-png-ok', await subir(`${TMP}/ok-pequeno.png`, 'ok-pequeno.png', 'image/png'));
  await shot('A2-png-ok');

  // ¿Se puede avanzar con un archivo rechazado? (RN-03: branding sin logo bloquea)
  const cta = page.getByRole('button', { name: /Generar documento/i });
  log('A2-cta-con-archivo-valido', await cta.isEnabled());

  // tras subir un SVG (rechazado) el branding sigue sin archivo → CTA bloqueado
  await input.setInputFiles({ name: 'vector.svg', mimeType: 'image/svg+xml', buffer: readFileSync(`${TMP}/vector.svg`) });
  await page.waitForTimeout(500);
  log('A2-tras-svg-cta', { ctaDeshabilitado: await cta.isDisabled(), error: (await page.locator('#error-archivo').innerText().catch(() => null))?.slice(0, 80) });
});

function readBuf(p) {
  return readFileSync(p);
}
