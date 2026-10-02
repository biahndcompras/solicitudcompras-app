import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3001";
const OUT = new URL(".", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const ID_VACIA = "a6e7aa8a-00f9-4e5c-a09f-ab2632a4a691";
const ID_COMPARATIVA = "d50dd0ba-3636-4458-99ff-866e6f43914c";
const ID_CERRADA = "57ad1bbb-928c-446c-8c01-eb1ac3dde27b";

const metricas = {};
const consola = [];
const textos = {};
const pasosFallidos = [];
const foco = [];

const METRICS_FN = () => {
  const b = (e) => {
    const r = e.getBoundingClientRect();
    return r.height > 0 && r.width > 0;
  };
  const labelFor = (i) =>
    !!(
      i.getAttribute("aria-label") ||
      i.getAttribute("title") ||
      i.getAttribute("placeholder") ||
      (i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`)) ||
      i.closest("label")
    );
  return {
    title: document.title,
    url: location.pathname,
    h1: [...document.querySelectorAll("h1,h2")].map((e) => e.textContent.trim().slice(0, 60)),
    buttons: document.querySelectorAll("button").length,
    inputs: document.querySelectorAll("input,select,textarea").length,
    imgsSinAlt: [...document.querySelectorAll("img:not([alt])")].map((e) => e.src.slice(-40)),
    botonesSinNombre: [...document.querySelectorAll("button")]
      .filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label") && !b.getAttribute("title"))
      .map((b) => b.outerHTML.slice(0, 90)),
    inputsSinLabel: [...document.querySelectorAll("input,select,textarea")]
      .filter((i) => b(i) && !labelFor(i))
      .map((i) => ({ tag: i.tagName, type: i.type, ph: i.placeholder, cls: (i.className || "").slice(0, 60) })),
    targetsPequenos: [...document.querySelectorAll("button,a[href]")]
      .filter((e) => b(e) && e.getBoundingClientRect().height < 32)
      .map((e) => ({ t: e.textContent.trim().slice(0, 28), h: Math.round(e.getBoundingClientRect().height) })),
    textosMenores12px: [...document.querySelectorAll("*")]
      .filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12)
      .map((e) => ({ t: e.textContent.trim().slice(0, 34), fs: getComputedStyle(e).fontSize }))
      .slice(0, 14),
    tablas: document.querySelectorAll("table").length,
    filasTabla: document.querySelectorAll("tbody tr").length,
    disabledButtons: [...document.querySelectorAll("button:disabled")].map((b) => b.textContent.trim().slice(0, 40)),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
  };
};

async function metric(page, key) {
  try {
    metricas[key] = await page.evaluate(METRICS_FN);
  } catch (e) {
    pasosFallidos.push(`metricas:${key} -> ${e.message}`);
  }
}
async function texto(page, key) {
  try {
    textos[key] = await page.evaluate(() => document.body.innerText);
  } catch (e) {
    pasosFallidos.push(`texto:${key} -> ${e.message}`);
  }
}
async function shot(page, name) {
  try {
    await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
  } catch (e) {
    pasosFallidos.push(`shot:${name} -> ${e.message}`);
  }
}

const run = async () => {
  const browser = await chromium.launch({
    executablePath:
      "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      consola.push({ type: m.type(), text: m.text().slice(0, 220) });
  });
  page.on("pageerror", (e) => consola.push({ type: "pageerror", text: String(e).slice(0, 220) }));
  page.on("dialog", async (d) => {
    pasosFallidos.push(`dialog:${d.type()} -> "${d.message().slice(0, 120)}" (NO aceptado)`);
    await d.dismiss();
  });

  // 1. LOGIN
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: "networkidle" });
  await metric(page, "login");
  await texto(page, "login");
  await shot(page, "audit-01-login");

  // teclado: 12 tabs desde el login
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    foco.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          type: el.type || "",
          t: (el.textContent || el.placeholder || el.ariaLabel || "").trim().slice(0, 30),
          outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
          ring: cs.boxShadow !== "none",
          visible: r.width > 0 && r.height > 0,
        };
      })
    );
  }

  await page.fill('input[type="email"]', "cmelara@biabrands.co");
  await page.fill('input[type="password"]', "carloscomprador");
  await shot(page, "audit-02-login-relleno");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/panel**", { timeout: 25000 }).catch((e) => pasosFallidos.push(`login->panel: ${e.message}`));
  await page.waitForTimeout(2500);

  // 2. PANEL
  await metric(page, "panel");
  await texto(page, "panel");
  await shot(page, "audit-03-panel");

  // filtros
  for (const f of ["Cerradas", "Esperando cotizaciones", "Esperando decisión", "Activas"]) {
    await page.getByRole("button", { name: f, exact: true }).first().click().catch((e) => pasosFallidos.push(`filtro ${f}: ${e.message}`));
    await page.waitForTimeout(450);
    await metric(page, `panel-filtro-${f.replace(/\s/g, "-").toLowerCase()}`);
  }
  await page.getByRole("button", { name: "Cerradas", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, "audit-04-panel-cerradas");

  // buscar inexistente
  await page.getByRole("button", { name: "Todos", exact: true }).first().click().catch(() => {});
  const search = page.locator('input[placeholder*="Buscar"]');
  await search.fill("zzzz");
  await page.waitForTimeout(600);
  await metric(page, "panel-busqueda-vacia");
  await texto(page, "panel-busqueda-vacia");
  await shot(page, "audit-05-panel-busqueda-vacia");
  await search.fill("");
  await page.waitForTimeout(400);

  // 3. DETALLE SIN COTIZACIONES (RFQ-0010)
  await page.goto(`${BASE}/panel/solicitud/${ID_VACIA}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await metric(page, "detalle-0010-paso7");
  await texto(page, "detalle-0010-paso7");
  await shot(page, "audit-06-detalle-0010-paso7-vacio");

  // intentar tab 08 (debería estar disabled)
  const tab8 = page.getByRole("button", { name: /08/ });
  const tab8Disabled = await tab8.isDisabled().catch(() => null);
  metricas["tab08-disabled-en-0010"] = { disabled: tab8Disabled };
  await tab8.click({ timeout: 2000 }).then(
    () => pasosFallidos.push("tab08 en solicitud sin comparativa: clickable (se esperaba disabled)"),
    () => metricas["tab08-disabled-en-0010"] = { disabled: true, click: "rechazado" }
  );
  await page.waitForTimeout(300);
  await shot(page, "audit-07-detalle-0010-tab08-bloqueado");

  // formulario de cotización manual
  const manual = page.getByRole("button", { name: /Agregar cotización|Agregar|Cargar|manual/i }).first();
  if (await manual.count()) {
    await manual.click().catch((e) => pasosFallidos.push(`abrir manual: ${e.message}`));
    await page.waitForTimeout(1200);
    await metric(page, "detalle-0010-form-manual");
    await texto(page, "detalle-0010-form-manual");
    await shot(page, "audit-08-detalle-0010-form-manual");
  } else {
    pasosFallidos.push("no se encontró botón de cotización manual");
  }

  // Editar datos
  await page.getByRole("button", { name: "Editar datos" }).first().click().catch((e) => pasosFallidos.push(`editar datos: ${e.message}`));
  await page.waitForTimeout(800);
  await metric(page, "detalle-0010-editar-datos");
  await shot(page, "audit-09-detalle-0010-editar-datos");
  await page.getByRole("button", { name: "Cerrar edición" }).first().click().catch(() => {});

  // Cancelar solicitud -> modal in-app (ya no hay window.confirm, P3-11)
  await page.getByRole("button", { name: /Cancelar solicitud/ }).first().click().catch((e) => pasosFallidos.push(`cancelar: ${e.message}`));
  await page.waitForTimeout(800);
  await shot(page, "audit-10-detalle-0010-confirm-cancelar");
  metricas["modal-cancelar"] = { abierto: await page.locator('[role="dialog"]').count() > 0 };
  // Se cierra el modal para no dejar el overlay bloqueando el resto del recorrido.
  await page.getByRole("button", { name: "Volver" }).first().click().catch((e) => pasosFallidos.push(`cerrar modal cancelar: ${e.message}`));
  await page.waitForTimeout(400);

  // 4. DETALLE CON COMPARATIVA (RFQ-0008)
  await page.goto(`${BASE}/panel/solicitud/${ID_COMPARATIVA}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await metric(page, "detalle-0008-paso7");
  await texto(page, "detalle-0008-paso7");
  await shot(page, "audit-11-detalle-0008-paso7");

  // Reabrir cotizaciones -> modal in-app
  const reabrir = page.getByRole("button", { name: /Reabrir cotizaciones/ }).first();
  if (await reabrir.count()) {
    await reabrir.click().catch((e) => pasosFallidos.push(`reabrir: ${e.message}`));
    await page.waitForTimeout(900);
    await shot(page, "audit-12-detalle-0008-confirm-reabrir");
    metricas["modal-reabrir"] = { abierto: await page.locator('[role="dialog"]').count() > 0 };
    await page.getByRole("button", { name: "Volver" }).first().click().catch((e) => pasosFallidos.push(`cerrar modal reabrir: ${e.message}`));
    await page.waitForTimeout(400);
  } else {
    metricas["reabrir"] = { presente: false };
  }

  // tab 08
  await page.getByRole("button", { name: /08/ }).click().catch((e) => pasosFallidos.push(`tab08: ${e.message}`));
  await page.waitForTimeout(6000);
  await metric(page, "detalle-0008-paso8-comparativa");
  await texto(page, "detalle-0008-paso8-comparativa");
  await shot(page, "audit-13-detalle-0008-paso8-comparativa");

  // tab 09
  await page.getByRole("button", { name: /09/ }).click().catch((e) => pasosFallidos.push(`tab09: ${e.message}`));
  await page.waitForTimeout(2500);
  await metric(page, "detalle-0008-paso9-recomendacion");
  await texto(page, "detalle-0008-paso9-recomendacion");
  await shot(page, "audit-14-detalle-0008-paso9-recomendacion");

  // estado bloqueado del envío
  const enviar = page.getByRole("button", { name: /Enviar comparativa/ });
  metricas["enviar-bloqueado"] = { disabled: await enviar.isDisabled().catch(() => null) };

  // 5. DETALLE CERRADO (RFQ-0007)
  await page.goto(`${BASE}/panel/solicitud/${ID_CERRADA}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await metric(page, "detalle-0007-cerrada");
  await texto(page, "detalle-0007-cerrada");
  await shot(page, "audit-15-detalle-0007-cerrada");

  // 6. MOVIL
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(`${BASE}/panel`, { waitUntil: "networkidle" });
  await m.waitForTimeout(2500);
  try {
    metricas["movil-panel"] = await m.evaluate(METRICS_FN);
    await m.screenshot({ path: `${OUT}audit-16-movil-panel.png`, fullPage: true });
  } catch (e) {
    pasosFallidos.push(`movil: ${e.message}`);
  }
  await m.goto(`${BASE}/panel/solicitud/${ID_COMPARATIVA}`, { waitUntil: "networkidle" });
  await m.waitForTimeout(3000);
  try {
    metricas["movil-detalle"] = await m.evaluate(METRICS_FN);
    await m.screenshot({ path: `${OUT}audit-17-movil-detalle.png`, fullPage: true });
  } catch (e) {
    pasosFallidos.push(`movil detalle: ${e.message}`);
  }

  writeFileSync(`${OUT}audit-metricas.json`, JSON.stringify(metricas, null, 2));
  writeFileSync(`${OUT}audit-textos.txt`, Object.entries(textos).map(([k, v]) => `\n\n===== ${k} =====\n${v}`).join(""));
  writeFileSync(`${OUT}audit-consola.json`, JSON.stringify(consola, null, 2));
  writeFileSync(`${OUT}audit-foco.json`, JSON.stringify(foco, null, 2));
  writeFileSync(`${OUT}audit-notas.json`, JSON.stringify({ pasosFallidos }, null, 2));

  console.log("META_KEYS", Object.keys(metricas).join(","));
  console.log("CONSOLA", consola.length, JSON.stringify(consola.slice(0, 12)));
  console.log("NOTAS", JSON.stringify(pasosFallidos, null, 1));
  await browser.close();
};

run().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
