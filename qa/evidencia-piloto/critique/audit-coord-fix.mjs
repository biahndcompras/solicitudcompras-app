// Recorrido de verificación (post-fix) del flujo del coordinador.
// Mide lo que la auditoría encontró: acceso por teclado a las filas, alcanzabilidad de la
// barra de acciones en 390px, copy de estado terminal, estado vacío de búsqueda, tamaño
// mínimo de texto y targets, y que RFQ-0010/0008 sigan funcionando.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3001";
const OUT = new URL(".", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const ID_VACIA = "a6e7aa8a-00f9-4e5c-a09f-ab2632a4a691";
const ID_COMPARATIVA = "d50dd0ba-3636-4458-99ff-866e6f43914c";
const ID_CERRADA = "57ad1bbb-928c-446c-8c01-eb1ac3dde27b";

const m = {};
const fallos = [];
const consola = [];
const EXE =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const MEDIDAS = () => {
  const b = (e) => {
    const r = e.getBoundingClientRect();
    return r.height > 0 && r.width > 0;
  };
  return {
    url: location.pathname,
    filas: document.querySelectorAll("tbody tr").length,
    // P0-1: enlaces reales al detalle, alcanzables y activables por teclado.
    enlacesDetalle: [...document.querySelectorAll('tbody a[href^="/panel/solicitud/"]')].map((a) => ({
      href: a.getAttribute("href"),
      t: a.textContent.trim().replace(/\s+/g, " "),
      tabIndex: a.tabIndex,
    })),
    filasConOnClick: [...document.querySelectorAll("tbody tr")].filter((t) => t.onclick).length,
    roleLinkFalso: document.querySelectorAll('tbody [role="link"]').length,
    pasos: [...document.querySelectorAll('button[aria-pressed]')]
      .map((x) => ({ t: x.textContent.trim().replace(/\s+/g, " "), pressed: x.getAttribute("aria-pressed"), disabled: x.disabled }))
      .filter((x) => /Cotizaciones|Comparativa|Recomendación/.test(x.t)),
    posicion: document.body.innerText.match(/Paso \d de 3/g),
    // P2-9: piso de 12px (thead 10px es convención de tabla) y targets >= 32px.
    textosMenores12px: [...document.querySelectorAll("*")]
      .filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12)
      .map((e) => ({ t: e.textContent.trim().slice(0, 40), fs: getComputedStyle(e).fontSize, tag: e.tagName }))
      .slice(0, 20),
    targetsPequenos: [...document.querySelectorAll("button,a[href]")]
      .filter((e) => b(e) && e.getBoundingClientRect().height < 32)
      .map((e) => ({ t: e.textContent.trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height) })),
    // ¿Está el control dentro del viewport horizontal y sin recorte del ancestro?
    recorte: [...document.querySelectorAll("button,a[href]")]
      .filter((e) => b(e))
      .map((e) => {
        const r = e.getBoundingClientRect();
        let padre = e.parentElement;
        let cortado = false;
        while (padre) {
          const cs = getComputedStyle(padre);
          if (cs.overflow === "hidden" || cs.overflowX === "hidden") {
            const pr = padre.getBoundingClientRect();
            if (r.right > pr.right + 1 || r.left < pr.left - 1) cortado = true;
          }
          padre = padre.parentElement;
        }
        return { t: e.textContent.trim().slice(0, 30),right: Math.round(r.right), cortado };
      })
      .filter((x) => x.cortado),
  };
};

async function medir(page, k) {
  try {
    m[k] = await page.evaluate(MEDIDAS);
  } catch (e) {
    fallos.push(`medir ${k}: ${e.message}`);
  }
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consola.push({ type: "pageerror", text: String(e).slice(0, 200) }));
  page.on("console", (c) => {
    if (c.type() === "error") consola.push({ type: "error", text: c.text().slice(0, 200) });
  });
  page.on("dialog", async (d) => {
    fallos.push(`DIALOG NATIVO (window.confirm): ${d.message().slice(0, 80)}`);
    await d.dismiss();
  });

  await page.goto(`${BASE}/login/coordinador`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "cmelara@biabrands.co");
  await page.fill('input[type="password"]', "carloscomprador");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/panel**", { timeout: 25000 });
  await page.waitForTimeout(2500);

  // ── 1. PANEL: 4 filas (P1-3) y enlaces reales (P0-1)
  await medir(page, "panel-1440");
  const filas = await page.locator("tbody tr").count();
  m["panel"] = { filas, referenciaInventada: await page.locator("text=/^SOL-/").count() };
  await page.screenshot({ path: `${OUT}fix-01-panel-1440.png`, fullPage: true });

  // ── 2. Teclado: tabular hasta el primer enlace "Abrir" y activarlo con Enter (P0-1)
  await page.keyboard.press("Tab"); // salto al cuerpo
  let paradas = 0;
  let llevo = null;
  for (let i = 0; i < 40; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        t: (el.textContent || el.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 40),
        href: el.getAttribute ? el.getAttribute("href") : null,
        visible: r.width > 0 && r.height > 0,
      };
    });
    paradas++;
    if (info?.href?.startsWith("/panel/solicitud/")) { llevo = info; break; }
    await page.keyboard.press("Tab");
  }
  m["teclado"] = { paradasHastaDetalle: paradas, enlace: llevo };
  if (!llevo) fallos.push("P0-1: el enlace al detalle no se alcanzó con el teclado");
  await page.screenshot({ path: `${OUT}fix-02-panel-foco-abrir.png` });
  await page.keyboard.press("Enter");
  await page.waitForURL("**/panel/solicitud/**", { timeout: 15000 }).catch((e) => fallos.push(`Enter no navegó: ${e.message}`));
  await page.waitForTimeout(2500);
  m["teclado"]["urlTrasEnter"] = page.url();

  // ── 3. RFQ-0008 en desktop: pasos, reabrir (modal in-app)
  await page.goto(`${BASE}/panel/solicitud/${ID_COMPARATIVA}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await medir(page, "detalle-0008-1440");
  await page.screenshot({ path: `${OUT}fix-03-detalle-0008-1440.png`, fullPage: true });

  await page.getByRole("button", { name: "Reabrir cotizaciones" }).click();
  await page.waitForTimeout(600);
  const dialogoReabrir = await page.locator('[role="dialog"]').innerText().catch(() => "(sin modal)");
  m["modal-reabrir"] = dialogoReabrir;
  await page.screenshot({ path: `${OUT}fix-04-modal-reabrir.png` });
  await page.getByRole("button", { name: "Volver" }).click();
  await page.waitForTimeout(300);

  // ── 4. Cancelar: modal in-app con la consecuencia (P3-11)
  await page.getByRole("button", { name: "Cancelar solicitud" }).click();
  await page.waitForTimeout(600);
  m["modal-cancelar"] = await page.locator('[role="dialog"]').innerText().catch(() => "(sin modal)");
  await page.screenshot({ path: `${OUT}fix-05-modal-cancelar.png` });
  await page.getByRole("button", { name: "Volver" }).click();

  // ── 5. RFQ-0007 terminal: sin imperativos (P1-4)
  await page.goto(`${BASE}/panel/solicitud/${ID_CERRADA}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const texto0007 = await page.evaluate(() => document.body.innerText);
  const imperativos = texto0007.match(/Cargá|Agregá|Adjuntá|Verificá|Generar comparativa|MÍNIMO 2|Mínimo 2|antes de generar|antes de comparar|Requiere aclaración|Guardá|Cargá la|editing/gi);
  m["rfq0007"] = { imperativos: imperativos ?? [] };
  await medir(page, "detalle-0007-1440");
  await page.screenshot({ path: `${OUT}fix-06-rfq0007-terminal.png`, fullPage: true });

  // ── 6. RFQ-0010: el paso 08 sigue bloqueado y se explica
  await page.goto(`${BASE}/panel/solicitud/${ID_VACIA}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const paso8 = page.getByRole("button", { name: /08/ });
  m["rfq0010"] = { paso08Deshabilitado: await paso8.isDisabled() };
  await medir(page, "detalle-0010-1440");
  await page.screenshot({ path: `${OUT}fix-07-rfq0010-paso07.png`, fullPage: true });

  // ── 7. Búsqueda sin resultados (P2-6) y bandeja completa (P1-3)
  await page.goto(`${BASE}/panel`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const search = page.locator('input[placeholder*="Buscar"]');
  await search.fill("zzzz");
  await page.waitForTimeout(700);
  m["busqueda-vacia"] = (await page.locator("main").innerText()).split("\n").filter((l) => l.trim()).slice(-8);
  await page.screenshot({ path: `${OUT}fix-08-busqueda-sin-resultados.png` });
  await search.fill("");
  await page.waitForTimeout(700);
  m["bandeja-sin-busqueda"] = {
    filas: await page.locator("tbody tr").count(),
    contador: await page.locator("text=/\\d+ resultados?/").first().innerText(),
    borradoresPipeTest: await page.locator("text=Pipe Test").count(),
  };
  await page.screenshot({ path: `${OUT}fix-09-bandeja-4-filas.png`, fullPage: true });

  // ── 8. MÓVIL 390px (P0-2)
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(`${BASE}/panel/solicitud/${ID_COMPARATIVA}`, { waitUntil: "networkidle" });
  await mob.waitForTimeout(3000);
  await medir(mob, "detalle-0008-390");
  const tabsVisibles = await mob.evaluate(() => {
    const fuera = [];
    for (const b of document.querySelectorAll("button")) {
      const t = b.textContent.trim();
      if (!/Cotizaciones|Comparativa|Recomendación/.test(t)) continue;
      const r = b.getBoundingClientRect();
      fuera.push({ t, w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.right <= window.innerWidth + 1 });
    }
    return fuera;
  });
  const movil = {};
  movil.pasosVisibles = tabsVisibles;
  m.movil = movil;
  await mob.screenshot({ path: `${OUT}fix-10-movil-detalle-390.png`, fullPage: true });

  // kebab "Más" → las tres acciones, y "Cancelar solicitud" alcanzable
  const mas = mob.getByRole("button", { name: /Más/ });
  const hayMas = (await mas.count()) > 0;
  movil.kebab = hayMas;
  if (hayMas) {
    await mas.click();
    await mob.waitForTimeout(400);
    movil.accionesEnMenu = await mob.evaluate(() =>
      [...document.querySelectorAll("button")]
        .map((b) => b.textContent.trim())
        .filter((t) => /Cancelar solicitud|Editar datos|Reabrir cotizaciones/.test(t))
    );
    const cancelar = mob.getByRole("button", { name: "Cancelar solicitud" }).last();
    const caja = await cancelar.boundingBox();
    movil.cancelarSolicitud = caja
      ? {
          x: Math.round(caja.x),
          y: Math.round(caja.y),
          w: Math.round(caja.width),
          h: Math.round(caja.height),
          dentroDelViewport: caja.x >= 0 && caja.x + caja.width <= 390,
        }
      : null;
    await mob.screenshot({ path: `${OUT}fix-11-movil-kebab-mas.png` });
    // abrir el modal de cancelar desde móvil
    await cancelar.click();
    await mob.waitForTimeout(600);
    movil.modalCancelarAbierto = (await mob.locator('[role="dialog"]').count()) > 0;
    await mob.screenshot({ path: `${OUT}fix-12-movil-modal-cancelar.png` });
  }

  await mob.goto(`${BASE}/panel`, { waitUntil: "networkidle" });
  await mob.waitForTimeout(2000);
  await medir(mob, "panel-390");
  await mob.screenshot({ path: `${OUT}fix-13-movil-panel-390.png`, fullPage: true });

  writeFileSync(`${OUT}fix-metricas.json`, JSON.stringify(m, null, 2));
  writeFileSync(`${OUT}fix-consola.json`, JSON.stringify(consola, null, 2));
  console.log(JSON.stringify(m, null, 1));
  console.log("FALLOS", JSON.stringify(fallos, null, 1));
  console.log("CONSOLA", JSON.stringify(consola.slice(0, 8)));
  await browser.close();
};

run().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
