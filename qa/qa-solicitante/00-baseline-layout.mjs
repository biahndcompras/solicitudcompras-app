// LÍNEA BASE: mide el layout del wizard en todos los viewports objetivo.
import { withPage, medirWizard, detectarDesbordes, log, R, dumpFinal, BASE, entrarComoSolicitante, llenarPaso2 } from './harness.mjs';

const VIEWPORTS = [
  [320, 568],
  [360, 740],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1920, 1080],
];

await withPage(
  async ({ page, shot }) => {
    for (const [w, h] of VIEWPORTS) {
      await page.setViewportSize({ width: w, height: h });
      await entrarComoSolicitante(page);
      await llenarPaso2(page);
      await page.waitForTimeout(400);
      const m = await medirWizard(page);
      const d = await detectarDesbordes(page);
      log(`vp-${w}x${h}`, { ...m, desborde: d.scrollHorizontal, culpables: d.culpables.length });
      await shot(`BASE-wizard-paso2-${w}x${h}`, false);
    }
    // 333px de alto (proxy teclado virtual)
    await page.setViewportSize({ width: 390, height: 333 });
    await page.waitForTimeout(300);
    const mTeclado = await medirWizard(page);
    log('vp-390x333-teclado', mTeclado);
    await shot('BASE-wizard-paso2-390x333-teclado', false);
  },
  { viewport: { width: 1440, height: 900 } }
);

dumpFinal();
