// ATAQUE 4 — /comparativa/[token]: token inexistente, revocado, expirado, vigente.
// También: ¿la UI dice si el enlace expira? ¿hay conversión orientativa de moneda?
import { withPage, log, dumpFinal, BASE, detectarDesbordes } from './harness.mjs';

const CASOS = [
  ['inexistente', 'NO-EXISTE-0000-0000'],
  ['revocado', 'QA-REVOCADO-TEST'],
  ['expirado', 'QA-EXPIRADO-TEST'],
  ['vigente-con-fecha', 'QA-VIGENTE-TEST'],
  ['vigente-sin-fecha', 'QA-SIN-VENCER-TEST'],
];

await withPage(async ({ page, shot }) => {
  for (const [nombre, token] of CASOS) {
    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto(`${BASE}/comparativa/${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    const info = await page.evaluate(() => ({
      texto: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
      hayEmojiCandado: /🔒/.test(document.body.innerText),
      diceExpira: /expira|vence|vigencia|disponible hasta/i.test(document.body.innerText),
      h1: document.querySelector('h1')?.innerText ?? null,
    }));
    const d = await detectarDesbordes(page);
    log(`A4-${nombre}`, { status: res?.status(), ...info, scrollH: d.scrollHorizontal, culpables: d.culpables.length });
    await shot(`A4-${nombre}`);
  }

  // Vista vigente: monedas y formato de miles
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/comparativa/QA-VIGENTE-TEST`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const monedas = await page.evaluate(() => {
    const textos = [...document.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && /\d/.test(e.textContent || ''))
      .map((e) => e.textContent.trim())
      .filter((t) => t.length < 40);
    return {
      montos: [...new Set(textos)].slice(0, 20),
      hayEquivalente: /≈|equivale|USD|HNL/i.test(document.body.innerText),
      haySeparadorMiles: /\d{1,3},\d{3}/.test(document.body.innerText),
    };
  });
  log('A4-monedas', monedas);

  // Modal de confirmación: ¿role=dialog / aria-modal / trampa de foco?
  const btn = page.getByRole('button', { name: /Elegir esta opción/i }).first();
  await btn.click();
  await page.waitForTimeout(600);
  const modal = await page.evaluate(() => {
    const dlg = document.querySelector('[role=dialog]');
    return {
      roleDialog: !!dlg,
      ariaModal: dlg?.getAttribute('aria-modal') ?? null,
      focoDentro: dlg ? dlg.contains(document.activeElement) : false,
      activo: document.activeElement?.tagName + ':' + (document.activeElement?.innerText || '').slice(0, 20),
      textoModal: document.querySelector('.step-enter')?.innerText?.replace(/\s+/g, ' ').slice(0, 120) ?? null,
    };
  });
  log('A4-modal-accesibilidad', modal);
  await shot('A4-modal');

  // ¿El fondo sigue siendo tabulable? (trampa de foco)
  await page.keyboard.press('Tab');
  const tab1 = await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.innerText || '').slice(0, 30));
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const tabN = await page.evaluate(() => {
    const dentroDialogo = document.querySelector('[role=dialog]')?.contains(document.activeElement);
    return { dentroDialogo, activo: document.activeElement?.tagName + ':' + (document.activeElement?.innerText || '').slice(0, 30) };
  });
  log('A4-trampa-foco', { tab1, ...tabN });
});

dumpFinal();
