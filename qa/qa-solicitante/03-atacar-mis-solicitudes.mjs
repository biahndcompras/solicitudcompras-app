// ATAQUE 3 — /mis-solicitudes y /mis-solicitudes/[id] en móvil + contenido extremo.
import { withPage, log, dumpFinal, BASE, detectarDesbordes, detectarA11y } from './harness.mjs';

const VPS = [
  [320, 568],
  [360, 740],
  [390, 844],
  [430, 932],
];

const EMAIL = 'mj.e2e@biabrands.co';

await withPage(async ({ page, shot }) => {
  for (const [w, h] of VPS) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/mis-solicitudes?email=${encodeURIComponent(EMAIL)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const m = await page.evaluate(() => {
      const card = document.querySelector('a[href^="/mis-solicitudes/"]');
      if (!card) return { sinTarjetas: true, texto: document.body.innerText.slice(0, 200) };
      const cb = card.getBoundingClientRect();
      const h3 = card.querySelector('h3');
      const hb = h3?.getBoundingClientRect();
      const badges = [...card.querySelectorAll('span')].filter((s) => /Enviada a Compras|Esperando decisión|Cerrada|Cancelada/.test(s.innerText));
      const overflow = badges.map((b) => {
        const r = b.getBoundingClientRect();
        return { txt: b.innerText.trim(), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
      });
      const btns = [...card.querySelectorAll('a,span,div')].filter((e) => /Ver detalle/.test(e.innerText) && e.children.length === 0);
      return {
        card: { w: Math.round(cb.width), h: Math.round(cb.height), left: Math.round(cb.left), right: Math.round(cb.right) },
        titulo: { w: hb ? Math.round(hb.width) : null, textoLen: (h3?.innerText || '').length, lineas: hb ? Math.round(hb.height / 22) : null },
        overflowBadges: overflow,
        // ¿el tracker's último label cabe?
        trackerLabels: [...card.querySelectorAll('span[title]')].map((s) => {
          const r = s.getBoundingClientRect();
          return { t: s.getAttribute('title'), fs: getComputedStyle(s.parentElement).fontSize, w: Math.round(r.width) };
        }),
      };
    });
    const d = await detectarDesbordes(page);
    const a11y = await detectarA11y(page);
    log(`A3-lista-${w}x${h}`, { ...m, scrollH: d.scrollHorizontal, culpables: d.culpables.slice(0, 4), targets: a11y.targetsPequenos.slice(0, 5), texto11: a11y.textoMenor11px.slice(0, 5) });
    await shot(`A3-lista-${w}x${h}`);
  }

  // detalle
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/mis-solicitudes?email=${encodeURIComponent(EMAIL)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const href = await page.locator('a[href^="/mis-solicitudes/"]').first().getAttribute('href');
  await page.goto(BASE + href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const det = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText ?? null,
    hayCTA: /comparativa|decidir|decisión/i.test(document.body.innerText),
    texto: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
  }));
  const d2 = await detectarDesbordes(page);
  log('A3-detalle-390', { ...det, scrollH: d2.scrollHorizontal, culpables: d2.culpables.slice(0, 4) });
  await shot('A3-detalle-390');
});

dumpFinal();
