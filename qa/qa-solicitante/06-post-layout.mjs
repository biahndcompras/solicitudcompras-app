// MEDICIÓN POST-FIX: mismo protocolo que 00-baseline-layout.mjs para comparar antes/después.
import { withPage, medirWizard, detectarDesbordes, log, R, dumpFinal, BASE, entrarComoSolicitante, llenarPaso2, detectarA11y } from './harness.mjs';

const VIEWPORTS = [
  [320, 568],
  [360, 740],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1920, 1080],
];

// El aside puede estar oculto (desktop-only) o ser la barra compacta (móvil): medimos el visible.
export const medirVisible = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main');
    const asides = [...document.querySelectorAll('aside')];
    const aside = asides.find((a) => a.getBoundingClientRect().height > 0) ?? asides[0] ?? null;
    const section = document.querySelector('main > section');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) };
    };
    const btns = section ? [...section.querySelectorAll('button')] : [];
    const cta = btns.find((b) => /Continuar|Confirmar clasificación|Generar documento|Enviar solicitud/i.test(b.innerText));
    const cb = cta?.getBoundingClientRect();
    // ¿Se puede llegar al CTA con scroll? medimos la posición del documento.
    const doc = document.documentElement;
    return {
      vw, vh,
      docScrollH: doc.scrollHeight,
      aside: r(aside),
      section: r(section),
      sectionScrollH: section?.scrollHeight ?? null,
      sectionClientH: section?.clientHeight ?? null,
      mainH: main ? Math.round(main.getBoundingClientRect().height) : null,
      cta: cta ? { texto: cta.innerText.trim().slice(0, 30), w: Math.round(cb.width), h: Math.round(cb.height), top: Math.round(cb.top), bottom: Math.round(cb.bottom), visible: cb.top >= 0 && cb.bottom <= vh + 0.5 } : null,
      // ¿El CTA está dentro del viewport en la posición de scroll actual?
      ctaAlcanzableConScroll: cta ? doc.scrollHeight > vh : false,
    };
  });

await withPage(async ({ page, shot }) => {
  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await entrarComoSolicitante(page);
    await llenarPaso2(page);
    await page.waitForTimeout(500);
    const m = await medirVisible(page);
    const d = await detectarDesbordes(page);
    const a11y = await detectarA11y(page);
    log(`vp-${w}x${h}`, {
      aside: m.aside, section: m.section, cta: m.cta,
      pctViewportAside: m.aside ? Math.round((m.aside.h / h) * 100) : null,
      scrollHorizontal: d.scrollHorizontal,
      targetsPequenos: a11y.targetsPequenos.length,
      texto11: a11y.textoMenor11px.length,
    });
    await shot(`POST-wizard-paso2-${w}x${h}`, false);
  }
  // teclado virtual (proxy 333px)
  await page.setViewportSize({ width: 390, height: 333 });
  await page.waitForTimeout(400);
  const m = await medirVisible(page);
  log('vp-390x333-teclado', { aside: m.aside, section: m.section, cta: m.cta });
  await shot('POST-wizard-paso2-390x333-teclado', false);
});

dumpFinal();
