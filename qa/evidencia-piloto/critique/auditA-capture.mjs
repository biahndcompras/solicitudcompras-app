// Evaluador A — captura de evidencia del flujo de coordinadores.
// Headless, viewport 1440x900, perfil nuevo en /tmp. No reinicia el dev server.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const BASE = "http://localhost:3001";
const OUT = "/Users/ecalderonl/Intelia/compras-1/qa/evidencia-piloto/critique";
const userDataDir = `/tmp/auditA-${randomUUID().slice(0, 8)}`;

const SOL = {
  rfq0010: "a6e7aa8a-00f9-4e5c-a09f-ab2632a4a691", // RFQ-2026-0010 ENVIADA_A_COMPRAS, 0 cotizaciones
  rfq0008: "d50dd0ba-3636-4458-99ff-866e6f43914c", // RFQ-2026-0008 COMPARATIVA_LISTA, 2 cotizaciones
  rfq0007: "57ad1bbb-928c-446c-8c01-eb1ac3dde27b", // RFQ-2026-0007 CERRADA_CON_DECISION
};

let textos = "";
const metricas = {};
const log = (m) => console.log(m);

function sec(t) {
  textos += `\n\n${"=".repeat(78)}\n### ${t}\n${"=".repeat(78)}\n`;
}
async function txt(page, etiqueta) {
  const t = await page.evaluate(() => document.body.innerText);
  sec(etiqueta);
  textos += t;
  log(`  texto: ${etiqueta} (${t.length} chars)`);
  return t;
}
async function shot(page, name) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  log(`  shot: ${name}.png`);
}

const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ["--no-sandbox"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

// Captura de diálogos nativos (window.confirm) SIN aceptar.
const dialogos = [];
page.on("dialog", async (d) => {
  dialogos.push({ tipo: d.type(), mensaje: d.message(), url: page.url(), accion: "RECHAZADO (sin aceptar)" });
  log(`  DIALOG [${d.type()}] ${d.message()}`);
  await d.dismiss();
});

const erroresConsola = [];
page.on("console", (m) => {
  if (m.type() === "error") erroresConsola.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => erroresConsola.push("PAGEERROR: " + e.message.slice(0, 300)));

// ---- Instrumentación: tamaños de target, foco visible, aria ----
const INSTRUMENTO = () => {
  const out = { targetsChicos: [], sinNombreAccesible: [], focusables: 0, rolesImplicitos: [] };
  const interactivos = document.querySelectorAll(
    'a[href], button, input, select, textarea, [role="link"], [role="button"], [tabindex]:not([tabindex="-1"])'
  );
  out.focusables = interactivos.length;
  interactivos.forEach((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 && r.height === 0) return;
    const nombre =
      el.getAttribute("aria-label") ||
      (el.getAttribute("aria-labelledby") ? "aria-labelledby" : null) ||
      (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText : null) ||
      el.closest("label")?.innerText ||
      el.innerText?.trim() ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      "";
    const tag = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(c => c.startsWith("text-") || c.startsWith("w-") || c.startsWith("p-") || c.startsWith("px-") || c.startsWith("py-") || c.startsWith("h-")).slice(0, 4).join(".") : ""}`;
    if (r.height < 24 || r.width < 24) {
      out.targetsChicos.push({ tag, texto: nombre.slice(0, 40) || "(sin texto)", w: Math.round(r.width), h: Math.round(r.height) });
    }
    if (!nombre) {
      out.sinNombreAccesible.push({ tag, texto: "(vacío)", w: Math.round(r.width), h: Math.round(r.height) });
    }
    if (el.tagName === "SPAN" && el.getAttribute("role") === "link") out.rolesImplicitos.push(tag);
  });
  // elementos con role=link que no son <a>
  out.spanRoleLink = document.querySelectorAll('span[role="link"]').length;
  out.ariaPressed = document.querySelectorAll("[aria-pressed]").length;
  out.ariaLabelCount = document.querySelectorAll("[aria-label]").length;
  out.liveRegions = document.querySelectorAll("[aria-live]").length;
  out.titulos = [...document.querySelectorAll("th")].map((t) => t.innerText.trim());
  return out;
};

// Medir contraste de texto pequeño (WCAG AA) sobre el fondo real del elemento.
const CONTRASTE = () => {
  function lum(c) {
    const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function bg(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !c.includes("rgba(0, 0, 0, 0)") && !c.startsWith("rgba(255, 255, 255, 0)")) return c;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
  }
  const malos = [];
  const vistos = new Set();
  document.querySelectorAll("p,span,td,th,label,h1,h2,h3,div,a,button,input,li").forEach((el) => {
    const t = el.innerText?.trim();
    if (!t || t.length > 60) return;
    if (el.children.length > 0 && el.tagName !== "LABEL") return;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const fw = parseInt(cs.fontWeight, 10) || 400;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const fg = cs.color;
    const L1 = lum(fg), L2 = lum(bg(el));
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const grande = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const minimo = grande ? 3 : 4.5;
    if (ratio < minimo) {
      const k = `${fs}|${fg}|${bg(el)}|${t.slice(0, 22)}`;
      if (vistos.has(k)) return;
      vistos.add(k);
      malos.push({ texto: t.slice(0, 40), fontSize: fs, fontWeight: fw, color: fg, fondo: bg(el), ratio: Math.round(ratio * 100) / 100, minimo });
    }
  });
  return malos;
};

try {
  // ============ 1. LOGIN ============
  log("\n[1] Login coordinador");
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await txt(page, "P1 · /login/coordinador (inicial)");
  await shot(page, "auditA-01-login-coordinador");
  metricas.login = await page.evaluate(INSTRUMENTO);
  metricas.loginContraste = await page.evaluate(CONTRASTE);

  // Foco visible: tabular 3 veces
  const focos = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    focos.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          type: el.getAttribute("type"),
          outline: cs.outline,
          outlineWidth: cs.outlineWidth,
          boxShadow: cs.boxShadow.slice(0, 60),
          borderColor: cs.borderColor,
        };
      })
    );
  }
  metricas.loginFoco = focos;
  log("  focos: " + JSON.stringify(focos.map((f) => `${f.tag}/${f.outlineWidth}`)));

  await page.fill('input[type="email"]', "cmelara@biabrands.co");
  await page.fill('input[type="password"]', "carloscomprador");
  await shot(page, "auditA-01b-login-relleno");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/panel", { timeout: 25000 });
  await page.waitForTimeout(2500);
  log("  → " + page.url());

  // ============ 2. PANEL ============
  log("[2] /panel");
  await txt(page, "P2 · /panel (Todos)");
  await shot(page, "auditA-02-panel-todos");
  metricas.panel = await page.evaluate(INSTRUMENTO);
  metricas.panelContraste = await page.evaluate(CONTRASTE);

  // Filtros
  for (const [label, slug] of [
    ["Activas", "activas"],
    ["Esperando cotizaciones", "esperando-cotizaciones"],
    ["Esperando decisión", "esperando-decision"],
    ["Cerradas", "cerradas"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await page.waitForTimeout(500);
    await txt(page, `P2b · /panel filtro «${label}»`);
    await shot(page, `auditA-03-panel-${slug}`);
  }
  // contador como filtro (tarjeta superior)
  await page.getByRole("button", { name: /Esperando decisión/ }).first().click();
  await page.waitForTimeout(400);
  metricas.contadorTarjetaActiva = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Esperando decisión/.test(x.innerText) && x.className.includes("ring-2"));
    return b ? b.innerText.replace(/\n/g, " | ") : "no encontrado";
  });
  // volver a Todos
  await page.getByRole("button", { name: "Todos", exact: true }).first().click();
  await page.waitForTimeout(400);

  // Buscador
  log("[3] Buscador");
  const input = page.getByPlaceholder(/Buscar por referencia/);
  metricas.buscadorSinLabel = await input.evaluate(
    (el) => !!(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || document.querySelector(`label[for="${el.id}"]`))
  );
  await input.click();
  metricas.buscadorFoco = await input.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { outline: cs.outline, boxShadow: cs.boxShadow.slice(0, 50), border: cs.borderColor };
  });
  await input.type("pelota", { delay: 30 });
  await page.waitForTimeout(500);
  await txt(page, "P2c · /panel búsqueda «pelota» (1 resultado)");
  await shot(page, "auditA-04-panel-busqueda-pelota");
  await input.fill("zzzznoexiste");
  await page.waitForTimeout(500);
  await txt(page, "P2d · /panel búsqueda sin resultados (estado vacío de búsqueda)");
  await shot(page, "auditA-04b-panel-busqueda-sin-resultados");
  await input.fill("");
  await page.waitForTimeout(400);

  // Foco visible por tabulación en el panel (6 tabs)
  const tabPanel = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    tabPanel.push(await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, txt: (el.innerText || el.getAttribute("placeholder") || "").trim().slice(0, 28), outline: cs.outlineWidth + " " + cs.outlineColor, shadow: cs.boxShadow.slice(0, 44) };
    }));
  }
  metricas.panelFoco = tabPanel;
  log("  tab-panel: " + JSON.stringify(tabPanel.map((t) => t.txt)));

  // ============ 3. SOLICITUD 0010 (estado vacío) ============
  log("[4] RFQ-2026-0010 — estado vacío");
  await page.goto(`${BASE}/panel/solicitud/${SOL.rfq0010}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  await txt(page, "P3 · RFQ-2026-0010 'Pelota de fútbol' — tab 07 Cotizaciones (0 cotizaciones)");
  await shot(page, "auditA-05-0010-cotizaciones-vacias");
  metricas.s0010 = await page.evaluate(INSTRUMENTO);
  metricas.s0010Contraste = await page.evaluate(CONTRASTE);

  // Barra de acciones: ¿qué está habilitado?
  metricas.barraAcciones0010 = await page.evaluate(() => {
    const bar = document.querySelector(".flex.items-center.justify-between");
    return bar
      ? [...bar.querySelectorAll("button,a")].map((b) => ({ txt: b.innerText.trim(), disabled: b.disabled === true, title: b.getAttribute("title") }))
      : "no encontrada";
  });
  log("  barra 0010: " + JSON.stringify(metricas.barraAcciones0010));

  // Tabs 08 y 09 bloqueados
  await page.getByRole("button", { name: /09 · Recomendación/ }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(600);
  await txt(page, "P3b · RFQ-2026-0010 — intento de tab 09 (¿deshabilitado?)");
  metricas.tabsDeshabilitados0010 = await page.evaluate(() =>
    [...document.querySelectorAll("button[disabled]")].map((b) => b.innerText.trim())
  );
  metricas.tabsConDisabledTitle = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) => /0[789] ·/.test(b.innerText)).map((b) => ({ txt: b.innerText.trim(), disabled: b.disabled, title: b.getAttribute("title"), aria: b.getAttribute("aria-disabled") }))
  );
  log("  tabs 0010: " + JSON.stringify(metricas.tabsConDisabledTitle));

  // PRUEBA DE DEAD-END: intentar enviar con 0 cotizaciones (el servidor debe 409; no muta).
  log("[4b] Enviar comparativa con 0 cotizaciones (dead-end)");
  await page.locator("textarea").first().fill("Prueba de auditoria: intento de envio sin cotizaciones.");
  await page.waitForTimeout(300);
  const cta = page.getByRole("button", { name: /Enviar comparativa/ });
  metricas.ctaSinCotizaciones = { habilitado: !(await cta.isDisabled()) };
  await cta.click();
  await page.waitForTimeout(3500);
  await txt(page, "P3b2 · RFQ-2026-0010 — ERROR visible tras intentar enviar con 0 cotizaciones");
  await shot(page, "auditA-05b-0010-deadend-envio-sin-cotizaciones");
  metricas.errorVisibleSinCotizaciones = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      muestraError: /No se pudo enviar|Transición inválida|409/.test(t),
      texto: t.match(/(No se pudo enviar[^\n]*|Transición inválida[^\n]*|error[^\n]{0,120})/i)?.[0] ?? null,
      alerta: [...document.querySelectorAll('[role="alert"],[aria-live]')].map((e) => e.innerText.slice(0, 120)),
      estadoSigue: t.match(/RFQ-2026-0010[\s\S]{0,40}/)?.[0] ?? null,
    };
  });
  log("  dead-end: " + JSON.stringify(metricas.errorVisibleSinCotizaciones));
  await page.getByRole("button", { name: /07 · Cotizaciones/ }).click();
  await page.waitForTimeout(600);
  await page.locator("textarea").first().fill("").catch(() => {});

  // Formulario de cotización manual
  log("[5] Formulario de cotización manual");
  await page.getByRole("button", { name: /Agregar cotización manual/ }).click();
  await page.waitForTimeout(500);
  await txt(page, "P3c · RFQ-2026-0010 — formulario 'Nueva cotización' abierto");
  await shot(page, "auditA-06-0010-form-manual");
  metricas.formManual = await page.evaluate(INSTRUMENTO);
  // ¿el botón Guardar está habilitado con campos vacíos?
  metricas.guardarVacio = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Guardar cotización/.test(x.innerText));
    return { disabled: b?.disabled, opacity: b ? getComputedStyle(b).opacity : null, cursor: b ? getComputedStyle(b).cursor : null };
  });
  metricas.formLabels = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input,select,textarea")];
    return inputs.map((el) => ({
      campo: el.getAttribute("type") || el.tagName,
      tieneLabelFor: el.id ? !!document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : false,
      labelImplicito: !!el.closest("label"),
      ariaLabel: el.getAttribute("aria-label"),
      req: el.required,
      min: el.getAttribute("min"),
      placeholder: el.getAttribute("placeholder"),
    }));
  });
  await page.getByRole("button", { name: "Cancelar", exact: true }).first().click();
  await page.waitForTimeout(300);

  // Editar datos
  log("[6] Editar datos");
  await page.getByRole("button", { name: "Editar datos" }).click();
  await page.waitForTimeout(500);
  await txt(page, "P3d · RFQ-2026-0010 — panel 'Editar datos para re-cotizar'");
  await shot(page, "auditA-07-0010-editar-datos");
  await page.getByRole("button", { name: "Cerrar edición" }).click();
  await page.waitForTimeout(300);

  // Cancelar solicitud (NO aceptar)
  log("[7] Cancelar solicitud — diálogo nativo, NO se acepta");
  await page.getByRole("button", { name: "Cancelar solicitud" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "auditA-07b-0010-confirm-cancelar");
  metricas.estadoTrasRechazarCancelar = await page.evaluate(() => document.body.innerText.includes("CANCELADA"));

  // Reabrir cotizaciones (no visible en 0010)
  metricas.reabrirVisible0010 = await page.evaluate(() => !!document.querySelector('button')?.innerText?.includes?.("Reabrir") || [...document.querySelectorAll("button")].some((b) => /Reabrir/.test(b.innerText)));

  // ============ 4. RFQ-2026-0008 (2 cotizaciones, COMPARATIVA_LISTA) ============
  log("[8] RFQ-2026-0008");
  await page.goto(`${BASE}/panel/solicitud/${SOL.rfq0008}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  await txt(page, "P4 · RFQ-2026-0008 — tab 07 Cotizaciones (2 cotizaciones)");
  await shot(page, "auditA-08-0008-cotizaciones");
  metricas.s0008 = await page.evaluate(INSTRUMENTO);
  metricas.s0008Contraste = await page.evaluate(CONTRASTE);
  metricas.barraAcciones0008 = await page.evaluate(() => {
    const bar = document.querySelector(".flex.items-center.justify-between");
    return bar ? [...bar.querySelectorAll("button,a")].map((b) => ({ txt: b.innerText.trim(), disabled: b.disabled === true })) : "no encontrada";
  });
  log("  barra 0008: " + JSON.stringify(metricas.barraAcciones0008));

  // Acciones por cotización (cuántas por tarjeta)
  metricas.accionesPorCotizacion = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".space-y-4 > div")].filter((d) => /Manual|PDF|Imagen/i.test(d.innerText));
    return cards.map((c) => [...c.querySelectorAll("button,a,label")].map((b) => b.innerText.trim() || b.getAttribute("aria-label") || "(icono)"));
  });
  log("  acciones/cotización: " + JSON.stringify(metricas.accionesPorCotizacion));

  // Edit inline
  const btnEditar = page.getByRole("button", { name: "Editar" }).first();
  if (await btnEditar.count()) {
    await btnEditar.click();
    await page.waitForTimeout(400);
    await txt(page, "P4b · RFQ-2026-0008 — edición inline de una cotización");
    await shot(page, "auditA-08b-0008-editar-inline");
    await page.getByRole("button", { name: "Guardar", exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(800);
  }

  // Tab 08
  log("[9] Tab 08 Comparativa");
  await page.getByRole("button", { name: /08 · Comparativa/ }).click();
  await page.waitForTimeout(4000);
  await txt(page, "P4c · RFQ-2026-0008 — tab 08 Comparativa");
  await shot(page, "auditA-09-0008-comparativa");
  metricas.comparativa = await page.evaluate(INSTRUMENTO);
  metricas.comparativaContraste = await page.evaluate(CONTRASTE);
  metricas.comparativaTabla = await page.evaluate(() => ({
    filas: [...document.querySelectorAll("tbody tr")].map((r) => [...r.querySelectorAll("td")].map((c) => c.innerText.trim())),
    th: [...document.querySelectorAll("thead th")].map((t) => t.innerText.trim()),
    anchoTabla: Math.round(document.querySelector("table")?.scrollWidth ?? 0),
    anchoContenedor: Math.round(document.querySelector("table")?.parentElement?.clientWidth ?? 0),
  }));
  metricas.hayDestacadoMejor = await page.evaluate(() => {
    const t = document.querySelector("table");
    if (!t) return null;
    const celdas = [...t.querySelectorAll("tbody tr")].map((r) => r.innerText);
    return { filas: celdas, hayResaltado: /bg-emerald|bg-sky-100|font-bold.*text-emerald/.test(t.innerHTML) };
  });

  // Tab 09
  log("[10] Tab 09 Recomendación");
  await page.getByRole("button", { name: /09 · Recomendación/ }).click();
  await page.waitForTimeout(2500);
  await txt(page, "P4d · RFQ-2026-0008 — tab 09 Recomendación (RN-01)");
  await shot(page, "auditA-10-0008-recomendacion");
  metricas.recomendacion = await page.evaluate(INSTRUMENTO);
  metricas.recomendacionContraste = await page.evaluate(CONTRASTE);
  metricas.bloqueoB3 = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Enviar comparativa/.test(x.innerText));
    return { disabled: b?.disabled, texto: b?.innerText.trim(), avisoVisible: document.body.innerText.includes("Escribí tu recomendación antes de enviar") };
  });
  metricas.sugerenciaIA = await page.evaluate(() => document.body.innerText.match(/Sugerencia del asistente \(IA\)[\s\S]{0,400}/)?.[0] ?? "AUSENTE");
  metricas.cifrasEnRecomendacion = await page.evaluate(() => {
    const t = document.body.innerText;
    return { hayAhorro: /Ahorro/i.test(t), hayTotales: /Total:/.test(t), menciones: (t.match(/Total:/g) || []).length };
  });
  log("  B3: " + JSON.stringify(metricas.bloqueoB3));

  // Escribir recomendación (sin enviar) para ver el CTA habilitado
  await page.locator("textarea").first().fill("Proveedor A cumple plazo y precio; el B es más barato pero sin garantía. Recomiendo A.");
  await page.waitForTimeout(400);
  metricas.ctaHabilitado = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Enviar comparativa/.test(x.innerText));
    return { disabled: b?.disabled, bg: b ? getComputedStyle(b).backgroundColor : null };
  });
  await shot(page, "auditA-10b-0008-recomendacion-escrita");

  // Reabrir cotizaciones (dialog sin aceptar)
  log("[11] Reabrir cotizaciones — diálogo, NO aceptar");
  const reabrir = page.getByRole("button", { name: "Reabrir cotizaciones" });
  if (await reabrir.count()) {
    await reabrir.click();
    await page.waitForTimeout(1200);
    await shot(page, "auditA-10c-0008-confirm-reabrir");
  }
  metricas.estadoTrasRechazarReabrir = await page.evaluate(() => document.body.innerText.slice(0, 400));

  // Editar datos en 0008
  await page.getByRole("button", { name: "Editar datos" }).click();
  await page.waitForTimeout(400);
  await txt(page, "P4e · RFQ-2026-0008 — 'Editar datos' (¿qué campos?)");
  await page.getByRole("button", { name: "Cerrar edición" }).click();

  // Cancelar en 0008 (no aceptar)
  log("[12] Cancelar solicitud en 0008 — diálogo, NO aceptar");
  await page.getByRole("button", { name: "Cancelar solicitud" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "auditA-10d-0008-confirm-cancelar");

  // ============ 5. RFQ-2026-0007 (terminal) ============
  log("[13] RFQ-2026-0007 — terminal");
  await page.goto(`${BASE}/panel/solicitud/${SOL.rfq0007}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4500);
  await txt(page, "P5 · RFQ-2026-0007 — estado terminal CERRADA_CON_DECISION");
  await shot(page, "auditA-11-0007-terminal");
  metricas.s0007 = await page.evaluate(INSTRUMENTO);
  metricas.s0007Contraste = await page.evaluate(CONTRASTE);
  metricas.terminal = await page.evaluate(() => {
    const bar = document.querySelector(".flex.items-center.justify-between");
    return {
      barra: bar ? [...bar.querySelectorAll("button,a")].map((b) => b.innerText.trim()) : "no encontrada",
      bandaDecision: document.body.innerText.match(/Solicitud cerrada[\s\S]{0,220}/)?.[0] ?? "AUSENTE",
      colorBanda: (() => {
        const el = [...document.querySelectorAll("div")].find((d) => /Solicitud cerrada con decisión/.test(d.innerText) && d.className.includes("emerald"));
        return el ? getComputedStyle(el).backgroundColor : null;
      })(),
      hayAcciones: document.body.innerText.includes("Reabrir cotizaciones"),
      hayEditar: document.body.innerText.includes("Editar datos"),
    };
  });
  log("  terminal: " + JSON.stringify(metricas.terminal.bandaDecision?.slice(0, 120)));

  // tabs en terminal
  metricas.tabsTerminal = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) => /0[789] ·/.test(b.innerText)).map((b) => ({ txt: b.innerText.trim(), disabled: b.disabled }))
  );
  await page.getByRole("button", { name: /08 · Comparativa/ }).click().catch(() => {});
  await page.waitForTimeout(2500);
  await txt(page, "P5b · RFQ-2026-0007 — tab 08 en estado terminal");
  await shot(page, "auditA-12-0007-terminal-comparativa");
  await page.getByRole("button", { name: /09 · Recomendación/ }).click().catch(() => {});
  await page.waitForTimeout(1500);
  await txt(page, "P5c · RFQ-2026-0007 — tab 09 en estado terminal (¿se puede reenviar?)");
  await shot(page, "auditA-13-0007-terminal-recomendacion");
  metricas.terminalRecomendacion = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Enviar comparativa/.test(x.innerText));
    return { hayBotonEnviar: !!b, disabled: b?.disabled ?? null };
  });

  // ============ Extra: 404 / fuera de alcance de rol ============
  log("[14] Ruta inexistente / rol cruzado");
  await page.goto(`${BASE}/panel/solicitud/00000000-0000-0000-0000-000000000000`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  await txt(page, "P6 · Solicitud inexistente (404)");
  await shot(page, "auditA-14-404-solicitud");

  // Volver al panel y capturar el ancho de la tabla (densidad)
  await page.goto(`${BASE}/panel`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  metricas.panelAncho = await page.evaluate(() => {
    const scroller = document.querySelector(".no-scrollbar");
    const tabla = document.querySelector("table");
    return {
      anchoScroller: Math.round(scroller?.clientWidth ?? 0),
      anchoTabla: Math.round(tabla?.scrollWidth ?? 0),
      scrollHorizontal: (tabla?.scrollWidth ?? 0) > (tabla?.parentElement?.clientWidth ?? 0),
      filas: document.querySelectorAll("tbody tr").length,
      altoFila: Math.round(document.querySelector("tbody tr")?.getBoundingClientRect().height ?? 0),
      zonaClicableFila: getComputedStyle(document.querySelector("tbody tr")).cursor,
      tablaEsLandmark: !!document.querySelector("table"),
      thScope: [...document.querySelectorAll("th")].map((t) => t.getAttribute("scope")),
    };
  });
  metricas.truncamientos = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("td,th,span,div,p").forEach((el) => {
      if (el.children.length > 0) return;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        out.push({ txt: el.innerText.trim().slice(0, 40), scroll: el.scrollWidth, client: el.clientWidth });
      }
    });
    return out.slice(0, 20);
  });
  log("  panelAncho: " + JSON.stringify(metricas.panelAncho));

  // Volver al listado para el estado final del panel
  await shot(page, "auditA-15-panel-final");
} catch (e) {
  textos += `\n\n!!! ERROR: ${e.message}\n${e.stack}\n`;
  log("ERROR: " + e.message);
  try { await shot(page, "auditA-99-error"); } catch {}
}

metricas.dialogos = dialogos;
metricas.erroresConsola = [...new Set(erroresConsola)].slice(0, 25);
metricas.userDataDir = userDataDir;

sec("MÉTRICAS AUTOMÁTICAS (JSON)");
textos += JSON.stringify(metricas, null, 1);
sec("DIÁLOGOS NATIVOS CAPTURADOS");
textos += JSON.stringify(dialogos, null, 1);
sec("ERRORES DE CONSOLA");
textos += JSON.stringify([...new Set(erroresConsola)], null, 1);

writeFileSync(`${OUT}/auditA-textos.txt`, textos);
writeFileSync(`${OUT}/auditA-metricas.json`, JSON.stringify(metricas, null, 1));
log(`\nOK → ${OUT}/auditA-textos.txt + auditA-metricas.json`);
await ctx.close();
