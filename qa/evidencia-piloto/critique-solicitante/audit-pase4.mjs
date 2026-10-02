// PASE 4 — surgically nail: (1) CTA recortado vs. solo-below-fold, (2) doble envío, (3) mapa sidebar↔paso.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const BASE = "http://localhost:3001";
const OUT = new URL(".", import.meta.url).pathname;
const CHROME = "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const EMAIL = "mj.e2e@biabrands.co";
const r = {};
const fill2 = async (p) => {
  await p.fill("#titulo", "Verificación final de alcance del CTA");
  await p.selectOption("select", { index: 1 });
  const f = new Date(); f.setDate(f.getDate() + 20);
  await p.fill('input[type="date"]', f.toISOString().slice(0, 10));
  await p.fill("textarea", "Comprobando si el CTA primario es alcanzable.");
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME });
  for (const [w, h, tag] of [[360, 740, "360x740"], [390, 844, "390x844"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE + "/solicitud/nueva?nuevo=1&email=" + encodeURIComponent(EMAIL) + "&nombre=Solicitante%20E2E&area=Trade%20Marketing", { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await fill2(page);
    await page.waitForTimeout(400);
    // SIN scroll: ¿el CTA primary es visible en el viewport?
    r[`P4-${tag}-sin-scroll`] = await page.evaluate(() => {
      const main = document.querySelector("main");
      const sec = document.querySelector("section");
      const btn = [...document.querySelectorAll("button")].find((b) => /continuar/i.test(b.textContent));
      const mb = main.getBoundingClientRect(), sb = sec.getBoundingClientRect(), bb = btn.getBoundingClientRect();
      const clippedPorMain = bb.bottom > mb.bottom + 0.5;
      return {
        mainTop: Math.round(mb.top), mainBottom: Math.round(mb.bottom),
        sectionTop: Math.round(sb.top), sectionBottom: Math.round(sb.bottom), sectionH: Math.round(sb.height),
        ctaTop: Math.round(bb.top), ctaBottom: Math.round(bb.bottom),
        ctaDentroDelViewport: bb.top >= 0 && bb.bottom <= window.innerHeight,
        ctaRecortadoPorElContenedor: clippedPorMain,
        pxDelCtaCortados: clippedPorMain ? Math.round(bb.bottom - mb.bottom) : 0,
        sectionScrollTop: sec.scrollTop, sectionMaxScroll: sec.scrollHeight - sec.clientHeight,
        documentScrollY: window.scrollY,
        pageScrollable: document.documentElement.scrollHeight > window.innerHeight,
      };
    });
    // CON scroll hasta el fondo del section: ¿el CTA queda 100% visible?
    r[`P4-${tag}-con-scroll`] = await page.evaluate(() => {
      const sec = document.querySelector("section");
      sec.scrollTop = sec.scrollHeight;
      return new Promise((res) => setTimeout(() => {
        const main = document.querySelector("main");
        const bb = [...document.querySelectorAll("button")].find((b) => /continuar/i.test(b.textContent)).getBoundingClientRect();
        const mb = main.getBoundingClientRect();
        const e = document.elementFromPoint(bb.x + bb.width / 2, Math.min(bb.bottom - 3, window.innerHeight - 3));
        res({
          ctaTop: Math.round(bb.top), ctaBottom: Math.round(bb.bottom),
          viewportBottom: window.innerHeight,
          mainBottom: Math.round(mb.bottom),
          cta100pctVisible: bb.top >= 0 && bb.bottom <= mb.bottom && bb.bottom <= window.innerHeight,
          hitTest: e?.closest("button")?.innerText?.trim().slice(0, 26) ?? e?.tagName,
        });
      }, 500));
    });
    await page.screenshot({ path: `${OUT}P4-${tag}-con-scroll.png` });
    // avanzar ahora sí
    await page.locator('button:has-text("Continuar")').click();
    await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 45000 }).catch(() => r[`P4-${tag}-avanzó`] = false);
    await page.waitForTimeout(7000);
    // ¿el CTA de paso 3 (Confirmar clasificación) queda recortado tras el scroll natural?
    r[`P4-${tag}-paso3-cta`] = await page.evaluate(() => {
      const main = document.querySelector("main"), sec = document.querySelector("section");
      const btn = [...document.querySelectorAll("button")].find((b) => /confirmar clasificación/i.test(b.textContent));
      const mb = main.getBoundingClientRect(), sb = sec.getBoundingClientRect(), bb = btn.getBoundingClientRect();
      return {
        sinScroll: { ctaTop: Math.round(bb.top), ctaBottom: Math.round(bb.bottom), mainBottom: Math.round(mb.bottom), visible: bb.bottom <= mb.bottom && bb.top >= sb.top, recortadoPx: Math.round(Math.max(0, bb.bottom - mb.bottom)) },
        alturaTarjetaIA: (() => { const d = [...document.querySelectorAll("div")].find((x) => x.className.includes("bg-gradient-to-br from-white to-sky-50/50")); if (!d) return null; const rr = d.getBoundingClientRect(); return { clientH: d.clientHeight, scrollH: d.scrollHeight, pctVisible: Math.round((d.clientHeight / d.scrollHeight) * 100), altoRender: Math.round(rr.height) }; })(),
        mapaSidebar: (() => { const a = document.querySelector("aside"); return { activo: [...a.querySelectorAll("li")].map((li) => li.textContent.trim() + (li.querySelector(".font-semibold.text-sky-600") ? " [ACTIVO]" : "")), chip: a.innerText.match(/ESTADO ACTUAL[\s\S]{0,40}/i)?.[0]?.replace(/\n/g, " | ") }; })(),
      };
    });
    await page.screenshot({ path: `${OUT}P4-${tag}-paso3-cta-sin-scroll.png` });
    await ctx.close();
  }

  // --- doble envío ---
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const posts = [];
    page.on("request", (rq) => { if (rq.url().includes("/api/solicitudes") && rq.method() === "POST") posts.push(Date.now()); });
    await page.goto(BASE + "/solicitud/nueva?nuevo=1&email=" + encodeURIComponent(EMAIL) + "&nombre=Solicitante%20E2E&area=Trade%20Marketing", { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await fill2(page);
    await page.locator('button:has-text("Continuar")').click();
    await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 45000 });
    await page.waitForTimeout(7000);
    await page.locator('button:has-text("Confirmar clasificación")').click();
    await page.waitForSelector('text=/Detalles para cotizar/', { timeout: 60000 });
    await page.waitForFunction(() => !document.body.innerText.includes("Preparando preguntas del asistente"), null, { timeout: 180000 }).catch(() => {});
    const tgl = page.locator('button[aria-pressed]').first();
    if ((await tgl.count()) && (await tgl.getAttribute("aria-pressed")) === "true") await tgl.click();
    await page.locator('button:has-text("Generar documento")').click();
    await page.waitForSelector('text=/Tu solicitud está lista/', { timeout: 30000 });
    await page.waitForTimeout(2500);
    // 4 disparos con evaluate (evita el bloqueo de disabled de Playwright)
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /enviar solicitud/i.test(x.textContent)); b?.click(); });
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(7000);
    r["P4-doble-envio"] = {
      postsACrearSolicitud: posts.length,
      msEntrePosts: posts.length > 1 ? posts.slice(1).map((t, i) => t - posts[i]) : [],
      pantallaFinal: await page.evaluate(() => document.body.innerText.match(/Tu solicitud fue enviada[\s\S]{0,180}|Referencia:[\s\S]{0,40}/)?.[0]?.replace(/\n/g, " | ")),
    };
    await ctx.close();
  }
  await browser.close();
  writeFileSync(OUT + "metricas-pase4.json", JSON.stringify(r, null, 2));
  console.log("PASE4 DONE");
}
main().catch((e) => { console.error(String(e).slice(0, 300)); writeFileSync(OUT + "metricas-pase4.json", JSON.stringify(r, null, 2)); });
