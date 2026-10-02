// MEDICIÓN POST-FIX (mismo protocolo que 00-baseline-layout.mjs) — para el antes/después.
// Incluye el proxy de teclado virtual (390x333) y la barra compacta del rail.
import { withPage, log, dumpFinal, entrarComoSolicitante, llenarPaso2, medirWizard, detectarDesbordes } from './harness.mjs';

const VIEWPORTS = [
  ['320x568', { width: 320, height: 568 }],
  ['360x740', { width: 360, height: 740 }],
  ['390x844', { width: 390, height: 844 }],
  ['430x932', { width: 430, height: 932 }],
  ['390x333-teclado', { width: 390, height: 333 }],
  ['768x1024', { width: 768, height: 1024 }],
  ['1024x768', { width: 1024, height: 768 }],
  ['1920x1080', { width: 1920, height: 1080 }],
];

for (const [nombre, vp] of VIEWPORTS) {
  await withPage(
    async ({ page, shot }) => {
      await entrarComoSolicitante(page);
      await llenarPaso2(page, { unico: 'MEDICION' });
      await page.waitForTimeout(1200);
      const m = await medirWizard(page);
      const d = await detectarDesbordes(page);
      const rail = await page.evaluate(() => {
        const a = document.querySelector('aside');
        const r = a?.getBoundingClientRect();
        const barras = [...(a?.querySelectorAll('div') ?? [])].filter((x) => {
          const rr = x.getBoundingClientRect();
          return rr.height > 0 && x.className.includes('md:hidden');
        });
        return {
          asideVisible: r ? Math.round(r.width) + 'x' + Math.round(r.height) : null,
          lineasRail: barras.length,
          pctViewport: r ? Math.round((r.height / window.innerHeight) * 100) : null,
        };
      });
      log(`MED-${nombre}`, {
        aside: m.aside,
        section: m.section,
        sectionScrollH: m.sectionScrollH,
        mainOverflow: m.mainOverflow,
        cta: m.cta,
        rail,
        scrollHorizontal: m.scrollHorizontal,
        culpablesReales: d.culpables.filter((c) => !/fixed (top|bottom)-|animate-fluid-blob/.test(c.cls)).length,
      });
      await shot(`MED-${nombre}`);
    },
    { viewport: vp }
  );
}

dumpFinal();
