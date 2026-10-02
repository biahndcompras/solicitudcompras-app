// PASE 3 — tap-ability real, recorte físico del CTA, y、完成 Nielsen puntual.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
const BASE = "http://localhost:3001";
const OUT = new URL(".", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const CHROME = "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const EMAIL = "mj.e2e@biabrands.co";
const r = {};

const fill2 = async (page) => {
  await page.fill("#titulo", "Prueba de alcance del CTA en pantalla chica");
  await page.selectOption("select", { index: 1 });
  const f = new Date(); f.setDate(f.getDate() + 20);
  await page.fill('input[type="date"]', f.toISOString().slice(0, 10));
  await page.fill("textarea", "Verificando si el botón primario es alcanzable sin hacer scroll.");
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME });
  for (const [w, h, tag] of [[360, 740, "360x740"], [390, 844, "390x844"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto(BASE + "/solicitud/nueva?nuevo=1&email=" + encodeURIComponent(EMAIL) + "&nombre=Solicitante%20E2E&area=Trade%20Marketing", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await fill2(page);
    await page.waitForTimeout(400);

    // --- ¿el CTA es golpeable SIN scroll? ---
    const cta = page.locator('button:has-text("Continuar")');
    const box = await cta.boundingBox();
    // ¿el punto del centro del CTA es realmente el botón (hit test)?
    let hit = null;
    if (box) {
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      if (cx >= 0 && cx <= w && cy >= 0 && cy <= h) {
        const el = await page.evaluate(([x, y]) => {
          const e = document.elementFromPoint(x, y);
          return { tag: e?.tagName, txt: (e?.innerText || e?.textContent || "").trim().slice(0, 30), closestButton: e?.closest("button")?.innerText?.trim().slice(0, 30) ?? null };
        }, [cx, cy]);
        hit = el;
      }
    }
    r[`P3-${tag}-cta-sin-scroll`] = {
      viewport: { w, h },
      ctaBoundingBox: box,
      ctaVisibleEnPantalla: box ? box.y >= 0 && box.y + box.height <= h : null,
      pxDebajoDelFold: box ? Math.round(box.y - h) : null,
      hitTestDelCentro: hit,
      conclusion: box && box.y + box.height <= h ? "ALCANZABLE sin scroll" : "REQUIERE SCROLL para llegar al CTA",
    };
    // data-* del sidebar vs espacio del formulario
    r[`P3-${tag}-reparto`] = await page.evaluate(() => {
      const main = document.querySelector("main");
      const aside = document.querySelector("aside");
      const section = document.querySelector("section");
      const mh = main.getBoundingClientRect().height, ah = aside.getBoundingClientRect().height, sh = section.getBoundingClientRect().height;
      return {
        altoContenedor: Math.round(mh), altoSidebar: Math.round(ah), altoFormulario: Math.round(sh),
        pctSidebar: Math.round((ah / mh) * 100), pctFormulario: Math.round((sh / mh) * 100),
        viewportH: window.innerHeight, contenedorCabeEnPantalla: mh <= window.innerHeight,
        mainClasses: main.className.match(/h-\[90vh\][^"]*|min-h-\[\d+px\][^ ]*|max-h-\[\d+px\][^ ]*|overflow-hidden/g),
      };
    });
    // tap real (sin scroll previo)
    await page.screenshot({ path: `${OUT}P3-${tag}-antes-de-tap.png` });
    if (box && box.y + box.height <= h) {
      await cta.tap();
      await page.waitForTimeout(1500);
      r[`P3-${tag}-tap-resultado`] = { avanzo: await page.evaluate(() => !!document.querySelector("aside") && document.body.innerText.includes("Clasificación")) };
    } else {
      r[`P3-${tag}-tap-resultado`] = { avanzo: "no se intentó: el CTA está fuera del viewport" };
    }

    // --- paso 3: el CTA "Confirmar clasificación" ¿queda cortado por overflow-hidden? ---
    try {
      await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 40000 });
      await page.waitForTimeout(6000);
      const info = await page.evaluate(() => {
        const main = document.querySelector("main");
        const section = document.querySelector("section");
        const btn = [...document.querySelectorAll("button")].find((b) => /confirmar clasificación/i.test(b.textContent));
        const mb = main.getBoundingClientRect(), sb = section.getBoundingClientRect(), bb = btn.getBoundingClientRect();
        return {
          mainBottom: Math.round(mb.bottom), sectionBottom: Math.round(sb.bottom),
          ctaTop: Math.round(bb.top), ctaBottom: Math.round(bb.bottom), ctaH: Math.round(bb.height),
          ctaVisible: bb.top >= 0 && bb.bottom <= mb.bottom,
          pxDelCtaFueraDelContenedor: Math.round(bb.bottom - mb.bottom),
          ctaSeSaleDelContenedor: bb.bottom > mb.bottom + 1,
          mainOverflow: getComputedStyle(main).overflow,
          sectionScrollTop: section.scrollTop,
          tapCentro: (() => { const e = document.elementFromPoint(bb.x + bb.width/2, Math.min(bb.bottom - 4, mb.bottom - 4)); return e?.closest("button")?.innerText?.trim().slice(0,26) ?? e?.tagName; })(),
        };
      });
      r[`P3-${tag}-cta-paso3-recortado`] = info;
      await page.screenshot({ path: `${OUT}P3-${tag}-paso3-cta.png` });
    } catch (e) { r[`P3-${tag}-cta-paso3-recortado`] = { error: String(e).slice(0, 140) }; }
    await ctx.close();
  }

  // --- Nielsen puntual: ¿el estado del wizard se anuncia al cambiar de paso? ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/solicitud/nueva?email=" + encodeURIComponent(EMAIL), { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await fill2(page);
    await page.click('button:has-text("Continuar")');
    await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 40000 });
    await page.waitForTimeout(7000);
    r["P3-nielsen-anuncio"] = await page.evaluate(() => ({
      tituloCambia: document.title,
      hayH1: document.querySelectorAll("h1").length,
      ordenHeadings: [...document.querySelectorAll("h1,h2,h3,h4")].map((e) => e.tagName + ":" + e.textContent.trim().slice(0, 34)),
      liveRegions: [...document.querySelectorAll("[aria-live]")].length,
      roleStatus: [...document.querySelectorAll('[role="status"]')].length,
      documentTitleDesactualizado: /nueva solicitud/i.test(document.title),
      landmarks: [...document.querySelectorAll("header,nav,main,aside,footer")].map((e) => e.tagName + (e.getAttribute("aria-label") ? "[" + e.getAttribute("aria-label") + "]" : "(sin nombre)")),
     fieldsetCount: document.querySelectorAll("fieldset,legend").length,
      skipLink: !!document.querySelector('a[href^="#"]'),
    }));
    // ¿qué pasa si el usuario vuelve a tocar "Continuar" 3 veces rápido (doble envío)?
    await ctx.close();
  }

  // --- Nielsen: doble toque / doble envío en "Enviar solicitud" ---
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const posts = [];
    page.on("request", (rq) => { if (rq.url().endsWith("/api/solicitudes") && rq.method() === "POST") posts.push(rq.url().replace(BASE, "")); });
    await page.goto(BASE + "/solicitud/nueva?nuevo=1&email=" + encodeURIComponent(EMAIL) + "&nombre=Solicitante%20E2E&area=Trade%20Marketing", { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await fill2(page);
    await page.click('button:has-text("Continuar")');
    await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 40000 });
    await page.waitForTimeout(7000);
    await page.click('button:has-text("Confirmar clasificación")');
    await page.waitForSelector('text=/Detalles para cotizar/', { timeout: 60000 });
    await page.waitForFunction(() => !document.body.innerText.includes("Preparando preguntas del asistente"), null, { timeout: 180000 }).catch(() => {});
    const tgl = page.locator('button[aria-pressed]').first();
    if (await tgl.count() && (await tgl.getAttribute("aria-pressed")) === "true") await tgl.click();
    await page.click('button:has-text("Generar documento")');
    await page.waitForSelector('text=/Tu solicitud está lista/', { timeout: 30000 });
    await page.waitForTimeout(2500);
    const enviar = page.locator('button:has-text("Enviar solicitud")');
    // 4 toques rápidos (simula doble toque nervioso en móvil)
    for (let i = 0; i < 4; i++) { await enviar.click({ force: true, noWaitAfter: true }).catch(() => {}); await page.waitForTimeout(90); }
    await page.waitForTimeout(6000);
    r["P3-doble-envio"] = {
      postsACrearSolicitud: posts.length,
      mensajes: await page.evaluate(() => document.body.innerText.match(/Referencia:[\s\S]{0,40}/)?.[0] ?? document.body.innerText.slice(0, 200)),
      confirmo: await page.evaluate(() => document.body.innerText.includes("Tu solicitud fue enviada")),
    };
    await page.screenshot({ path: OUT + "P3-doble-envio.png", fullPage: true });
    await ctx.close();
  }

  await browser.close();
  writeFileSync(OUT + "metricas-pase3.json", JSON.stringify(r, null, 2));
  console.log("PASE3 DONE");
}
main().catch((e) => { console.error(e); writeFileSync(OUT + "metricas-pase3.json", JSON.stringify(r, null, 2)); process.exit(1); });
