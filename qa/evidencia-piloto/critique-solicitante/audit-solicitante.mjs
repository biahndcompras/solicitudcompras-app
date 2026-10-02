// AUDITORÍA UX — Flujo SOLICITANTES (BIA Compras). Solo lectura + capturas. No escribe en app/**.
// Escrituras limitadas a qa/evidencia-piloto/critique-solicitante/
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3001";
const OUT = new URL(".", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const EMAIL = "mj.e2e@biabrands.co";
const NOMBRE = "Solicitante E2E";
const AREA = "Trade Marketing";
const TITULO = "Pelotas de fútbol tamaño 5 marca BIA para torneo juvenil";
const DESCRIPCION =
  "Necesitamos 200 pelotas de fútbol tamaño 5official con los colores de la marca, para torneo juvenil al aire libre en Tegucigalpa.";

const TOK_PENDIENTE = "2472-0EA8-9318"; // SOL-2026-0006, ENVIADA_A_SOLICITANTE
const TOK_CERRADA = "3C60-B122-AADE"; // RFQ-2026-0007, CERRADA_CON_DECISION
const ID_DETALLE = "ec31204d-2006-40b1-aef3-e91e343c320e"; // RFQ-2026-0009

const metricas = {};
const consola = [];
const pasosFallidos = [];
const textos = {};

const CHROME =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

// ---------- MÉTRICAS DOM (inyectadas; serializables) ----------
const METRICS_FN = () => {
  const vis = (e) => {
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
  const T = (n) => [...document.querySelectorAll(n)];

  // ¿El texto de un elemento está TOTALMENTE visible dentro del viewport sin scroll?
  const clipped = (e) => {
    const r = e.getBoundingClientRect();
    return r.top < 0 || r.bottom > window.innerHeight + 1;
  };

  const ctas = T("button, a[href]")
    .filter(vis)
    .map((e) => {
      const r = e.getBoundingClientRect();
      return {
        t: e.textContent.trim().replace(/\s+/g, " ").slice(0, 40) || `[aria-label=${e.getAttribute("aria-label")}]`,
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        fueraDeViewport: r.top < 0 || r.bottom > window.innerHeight + 1,
        areaInferior: r.top > window.innerHeight - 120,
      };
    });

  // Contenedores con overflow-hidden cuyo contenido interno se sale (contenido recortado)
  const recortes = T("div,section,aside,main,ul")
    .filter((e) => {
      const cs = getComputedStyle(e);
      return (
        (cs.overflow === "hidden" || cs.overflowY === "hidden") &&
        e.scrollHeight > e.clientHeight + 4
      );
    })
    .map((e) => ({
      sel: e.tagName + "." + (e.className || "").toString().slice(0, 70),
      scrollH: e.scrollHeight,
      clientH: e.clientHeight,
      overflowPx: e.scrollHeight - e.clientHeight,
    }));

  const scrollables = T("div,section,main,body")
    .filter((e) => {
      const cs = getComputedStyle(e);
      return (
        (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
        e.scrollHeight > e.clientHeight + 4
      );
    })
    .map((e) => ({
      sel: e.tagName + "." + (e.className || "").toString().slice(0, 70),
      scrollH: e.scrollHeight,
      clientH: e.clientHeight,
      overflowPx: e.scrollHeight - e.clientHeight,
    }));

  // occupying proportion of the progress header (aside)
  const aside = document.querySelector("aside");
  const asideBox = aside
    ? (() => {
        const r = aside.getBoundingClientRect();
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          pctAltoViewport: Math.round((r.height / window.innerHeight) * 100),
          flexDirection: getComputedStyle(aside).flexDirection,
          overflowHidden: getComputedStyle(aside).overflow,
          scrollH: aside.scrollHeight,
          clientH: aside.clientHeight,
        };
      })()
    : null;

  // Pseudo-element línea conectora del rail (::before del ul del progreso)
  const railUl = aside ? aside.querySelector("ul") : null;
  const rail = railUl
    ? (() => {
        const cs = getComputedStyle(railUl, "::before");
        return {
          existe: cs.content !== "none",
          content: cs.content,
          width: cs.width,
          height: cs.height,
          marginLeft: cs.marginLeft,
          background: cs.backgroundColor,
        };
      })()
    : null;

  return {
    url: location.pathname + location.search,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    titulo: document.title,
    h1: T("h1").map((e) => e.textContent.trim().slice(0, 70)),
    h2: T("h2").map((e) => e.textContent.trim().slice(0, 70)),
    h3: T("h3").map((e) => e.textContent.trim().slice(0, 70)),
    counts: {
      buttons: T("button").length,
      inputs: T("input,select,textarea").length,
      imgs: T("img").length,
      labels: T("label").length,
      ariaLive: T("[aria-live]").length,
      roleStatus: T("[role=status]").length,
      roleAlert: T("[role=alert]").length,
      main: T("main").length,
      h1Total: T("h1").length,
    },
    imgsSinAlt: T("img:not([alt])").map((e) => (e.src || e.alt || "").slice(-40)),
    botonesSinNombreAccesible: T("button")
      .filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label") && !b.getAttribute("title"))
      .map((b) => b.outerHTML.slice(0, 100)),
    inputsVisibles: T("input,select,textarea")
      .filter(vis)
      .map((i) => ({
        tag: i.tagName,
        type: i.type,
        name: i.name,
        id: i.id,
        ph: (i.placeholder || "").slice(0, 30),
        conLabel: labelFor(i),
        srOnly: i.classList.contains("sr-only"),
        h: Math.round(i.getBoundingClientRect().height),
        w: Math.round(i.getBoundingClientRect().width),
        fontSize: getComputedStyle(i).fontSize,
      })),
    targetsPequenos: T("button,a[href],[role=button]")
      .filter((e) => vis(e) && e.getBoundingClientRect().height < 32)
      .map((e) => ({ t: e.textContent.trim().replace(/\s+/g, " ").slice(0, 30), h: Math.round(e.getBoundingClientRect().height) })),
    textosMenores12px: T("*")
      .filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12)
      .map((e) => ({ t: e.textContent.trim().slice(0, 34), fs: getComputedStyle(e).fontSize }))
      .slice(0, 18),
    overflowXDoc: document.documentElement.scrollWidth > window.innerWidth + 2,
    scrollWidthDoc: document.documentElement.scrollWidth,
    aside: asideBox,
    rail,
    recortesOverflowHidden: recortes,
    contenedoresScrollables: scrollables,
    ctas,
    ctasPrimarias: ctas.filter((c) => /continuar|generar documento|enviar solicitud|confirmar|elegir|ver mis|guardar borrador/i.test(c.t)),
    elementosCortadosPorViewport: T("button,input,select,textarea,h1,h2,label")
      .filter((e) => vis(e) && clipped(e))
      .map((e) => ({ tag: e.tagName, t: (e.textContent || e.placeholder || "").trim().slice(0, 30), top: Math.round(e.getBoundingClientRect().top), bottom: Math.round(e.getBoundingClientRect().bottom) })),
    rolesIncorrectos: T("[role]")
      .filter((e) => !["status", "alert", "dialog"].includes(e.getAttribute("role")))
      .map((e) => ({ tag: e.tagName, role: e.getAttribute("role") })),
    ariaCurrent: T("[aria-current]").map((e) => e.getAttribute("aria-current")),
  };
};

async function metric(page, key) {
  try {
    metricas[key] = await page.evaluate(METRICS_FN);
  } catch (e) {
    pasosFallidos.push({ paso: `metricas:${key}`, motivo: String(e).slice(0, 200) });
  }
}

async function texto(page, key) {
  try {
    textos[key] = (await page.evaluate(() => document.body.innerText)).replace(/\n{3,}/g, "\n\n");
  } catch (e) {
    pasosFallidos.push({ paso: `texto:${key}`, motivo: String(e).slice(0, 160) });
  }
}

async function shot(page, name, full = true) {
  try {
    await page.screenshot({ path: OUT + name + ".png", fullPage: full });
  } catch (e) {
    pasosFallidos.push({ paso: `shot:${name}`, motivo: String(e).slice(0, 160) });
  }
}

function hook(page, tag) {
  page.on("console", (m) => {
    const t = m.type();
    if (t === "error" || t === "warning")
      consola.push({ tag, tipo: t, texto: m.text().slice(0, 300) });
  });
  page.on("pageerror", (e) => consola.push({ tag, tipo: "pageerror", texto: String(e).slice(0, 300) }));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (u.startsWith(BASE)) consola.push({ tag, tipo: "requestfailed", texto: `${r.failure()?.errorText} ${u.replace(BASE, "")}` });
  });
}

// ---------- FLUJO DEL WIZARD ----------
async function llenarHome(page) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  const t = page.locator('input[type="text"]');
  await t.nth(0).fill(NOMBRE);
  await t.nth(1).fill(AREA);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/solicitud/nueva**", { timeout: 20000 });
  await page.waitForTimeout(1200);
}

async function llenarPaso2(page) {
  await page.fill("#titulo", TITULO);
  // Tipo de necesidad = primera opción no vacía
  await page.selectOption("select", { index: 1 });
  // Producto (default ya es producto)
  const f = new Date();
  f.setDate(f.getDate() + 25);
  await page.fill('input[type="date"]', f.toISOString().slice(0, 10));
  await page.fill("textarea", DESCRIPCION);
  await page.waitForTimeout(300);
}

async function recorrerWizard(page, prefijo, viewportLabel) {
  // PASO 1 (/)
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await metric(page, `${prefijo}-01-home`);
  await texto(page, `${prefijo}-01-home`);
  await shot(page, `${prefijo}-01-home`);

  await llenarHome(page);
  // PASO 2 — ¿Qué necesitás?
  await page.waitForTimeout(800);
  await metric(page, `${prefijo}-02-captura`);
  await texto(page, `${prefijo}-02-captura`);
  await shot(page, `${prefijo}-02-captura`);

  // Estado inicial: botón Continuar deshabilitado
  metricas[`${prefijo}-02b-continuar-deshabilitado`] = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /continuar/i.test(x.textContent));
    return { existe: !!b, disabled: b ? b.disabled : null, texto: b ? b.textContent.trim() : null };
  });

  await llenarPaso2(page);
  metricas[`${prefijo}-02c-CTA`] = (await page.evaluate(METRICS_FN)).ctasPrimarias;

  // Click Continuar → dispara clasificarIA + paso 3
  await page.click('button:has-text("Continuar")');
  // esperar a que la IA/classif termine
  await page.waitForTimeout(1500);
  await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 40000 });
  // esperar fin del estado "Clasificando…"
  await page.waitForTimeout(6000);
  // PASO 3 — Clasificación
  await metric(page, `${prefijo}-03-clasificacion`);
  await texto(page, `${prefijo}-03-clasificacion`);
  await shot(page, `${prefijo}-03-clasificacion`);

  // Sidebar: ¿qué pasos muestra?
  metricas[`${prefijo}-03b-sidebar-rail`] = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (!aside) return null;
    const items = [...aside.querySelectorAll("li")].map((li) => ({
      txt: li.textContent.trim(),
      alto: Math.round(li.getBoundingClientRect().height),
      top: Math.round(li.getBoundingClientRect().top),
    }));
    return { titulo: aside.querySelector("h3")?.textContent.trim(), items, estadoActual: aside.innerText.split("\n").slice(-6) };
  });

  // Click Confirmar clasificación → dispara evaluarAssessment + paso 4
  await page.click('button:has-text("Confirmar clasificación")');
  await page.waitForSelector('text=/Detalles para cotizar/', { timeout: 60000 });
  // loader de assessment: capturar si aparece
  try {
    await page.waitForSelector('text=/Preparando preguntas del asistente/', { timeout: 3000 });
    await metric(page, `${prefijo}-04a-loader-assessment`);
    await shot(page, `${prefijo}-04a-loader-assessment`);
  } catch {
    metricas[`${prefijo}-04a-loader-assessment`] = { noAparacio: true };
  }
  // esperar fin de evaluación (el loader desaparece)
  await page.waitForFunction(() => !document.body.innerText.includes("Preparando preguntas del asistente"), null, { timeout: 180000 }).catch(() => pasosFallidos.push({ paso: "espera-loader-assessment", motivo: "timeout 180s esperando fin de assessment" }));
  await page.waitForTimeout(1500);
  // PASO 4 — Detalles
  await metric(page, `${prefijo}-04-detalles`);
  await texto(page, `${prefijo}-04-detalles`);
  await shot(page, `${prefijo}-04-detalles`);

  // Cuántas preguntas generó la IA
  metricas[`${prefijo}-04b-carga-IA`] = await page.evaluate(() => ({
    preguntas: document.querySelectorAll('input[type="text"]').length,
    chipsSugerencia: document.querySelectorAll('button[title]').length,
    contextoInsuficiente: document.body.innerText.includes("Necesitamos un poco más de contexto"),
  }));

  // Si hay logo obligatorio: toggle branding OFF para poder avanzar rápido
  const toggle = page.locator('button[aria-pressed]').first();
  if (await toggle.count()) {
    const pressed = await toggle.getAttribute("aria-pressed");
    if (pressed === "true") {
      metricas[`${prefijo}-04c-bloqueo-logo`] = {
        llevaBranding: true,
        archivoLogo: "",
        botonGenerarDeshabilitado: await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((x) => /generar documento/i.test(x.textContent));
          return b ? b.disabled : null;
        }),
      };
      await toggle.click(); // apagar branding
      await page.waitForTimeout(400);
    }
  }

  await page.click('button:has-text("Generar documento")');
  await page.waitForSelector('text=/Tu solicitud está lista/', { timeout: 30000 });
  await page.waitForTimeout(2000);
  // PASO 5 — Documento / resumen
  await metric(page, `${prefijo}-05-documento`);
  await texto(page, `${prefijo}-05-documento`);
  await shot(page, `${prefijo}-05-documento`);

  metricas[`${prefijo}-05b-opciones-comprador`] = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((b) => b.className.includes("text-left rounded-xl border px-3.5"));
    return { n: btns.length, nombres: btns.map((b) => b.innerText.replace(/\n/g, " | ")) };
  });

  // PASO 6 — Confirmación (enviar de verdad: crea solicitud en DB local)
  await page.click('button:has-text("Enviar solicitud")');
  try {
    await page.waitForSelector("text=/Tu solicitud fue enviada/", { timeout: 60000 });
  } catch {
    pasosFallidos.push({ paso: "envio-solicitud", motivo: "no apareció confirmación de envío" });
    await metric(page, `${prefijo}-06-envio-fallido`);
    await texto(page, `${prefijo}-06-envio-fallido`);
    await shot(page, `${prefijo}-06-envio-fallido`);
    return;
  }
  await page.waitForTimeout(1500);
  await metric(page, `${prefijo}-06-confirmacion`);
  await texto(page, `${prefijo}-06-confirmacion`);
  await shot(page, `${prefijo}-06-confirmacion`);
  metricas[`${prefijo}-viewportLabel`] = viewportLabel;
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME });

  // ============ A. ESCRITORIO 1440x900 ============
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-HN" });
    const page = await ctx.newPage();
    hook(page, "desktop");
    await recorrerWizard(page, "D", "escritorio 1440x900");
    await ctx.close();
  }

  // ============ B. MÓVIL 390x844 ============
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      locale: "es-HN",
    });
    const page = await ctx.newPage();
    hook(page, "movil390");
    await recorrerWizard(page, "M", "movil 390x844");
    await ctx.close();
  }

  // ============ C. MÓVIL PEQUEÑO 360x740 ============
  {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: "es-HN",
    });
    const page = await ctx.newPage();
    hook(page, "movil360");

    // home + paso 2 + paso 3 + paso 4 (sin enviar)
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await metric(page, "S-01-home");
    await shot(page, "S-01-home");
    await llenarHome(page);
    await page.waitForTimeout(800);
    await metric(page, "S-02-captura");
    await texto(page, "S-02-captura");
    await shot(page, "S-02-captura");
    await llenarPaso2(page);
    await page.click('button:has-text("Continuar")');
    await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 40000 });
    await page.waitForTimeout(6000);
    await metric(page, "S-03-clasificacion");
    await shot(page, "S-03-clasificacion");
    await page.click('button:has-text("Confirmar clasificación")');
    await page.waitForSelector('text=/Detalles para cotizar/', { timeout: 60000 });
    await page.waitForFunction(() => !document.body.innerText.includes("Preparando preguntas del asistente"), null, { timeout: 180000 }).catch(() => pasosFallidos.push({ paso: "S-espera-assessment", motivo: "timeout" }));
    await page.waitForTimeout(1500);
    await metric(page, "S-04-detalles");
    await texto(page, "S-04-detalles");
    await shot(page, "S-04-detalles");

    // SIMULACIÓN DE TECLADO VIRTUAL: reducir el viewport visible a ~46% (844 - teclado)
    const altoTeclado = Math.round(740 * 0.45);
    await page.setViewportSize({ width: 360, height: altoTeclado });
    await page.waitForTimeout(600);
    await metric(page, "S-05-teclado-virtual-360");
    await shot(page, "S-05-teclado-virtual-360");
    await page.setViewportSize({ width: 360, height: 740 });
    await page.waitForTimeout(400);

    // Persistencia: recargar y ver si conserva paso + datos
    const antes = await page.evaluate(() => ({ titulo: document.querySelector("#titulo")?.value ?? null, texto: document.body.innerText.slice(0, 200) }));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await metric(page, "S-06-tras-recarga");
    await shot(page, "S-06-tras-recarga");
    metricas["S-06b-draft-restore"] = {
      antes,
      despues: await page.evaluate(() => ({
        paso: document.querySelector("aside")?.innerText.replace(/\n/g, " | "),
        h2: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim()),
        tituloEnPantalla: document.body.innerText.includes("Pelotas de fútbol"),
      })),
    };
    await ctx.close();
  }

  // ============ D. TECLADO / FOCO (escritorio) ============
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-HN" });
    const page = await ctx.newPage();
    hook(page, "teclado");
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const focoHome = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      focoHome.push(
        await page.evaluate(() => {
          const a = document.activeElement;
          if (!a || a === document.body) return { tag: "body" };
          const cs = getComputedStyle(a);
          const r = a.getBoundingClientRect();
          return {
            tag: a.tagName,
            type: a.type || null,
            texto: (a.textContent || a.placeholder || a.getAttribute("aria-label") || "").trim().slice(0, 30),
            outline: cs.outlineStyle + " " + cs.outlineWidth,
            boxShadow: cs.boxShadow === "none" ? "none" : "SOMBRA",
            h: Math.round(r.height),
            w: Math.round(r.width),
          };
        })
      );
    }
    metricas["K-01-foco-home"] = focoHome;

    await llenarHome(page);
    await page.waitForTimeout(700);
    const focoWz = [];
    for (let i = 0; i < 26; i++) {
      await page.keyboard.press("Tab");
      focoWz.push(
        await page.evaluate(() => {
          const a = document.activeElement;
          if (!a || a === document.body) return { tag: "body" };
          const cs = getComputedStyle(a);
          const r = a.getBoundingClientRect();
          return {
            tag: a.tagName,
            type: a.type || null,
            name: a.name || null,
            texto: (a.textContent || a.placeholder || a.getAttribute("aria-label") || a.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 34),
            outline: cs.outlineStyle + " " + cs.outlineWidth,
            boxShadow: cs.boxShadow === "none" ? "none" : "SOMBRA",
            ring: cs.outlineColor,
            h: Math.round(r.height),
            dentroDeViewport: r.top >= 0 && r.bottom <= window.innerHeight,
          };
        })
      );
    }
    metricas["K-02-foco-wizard-paso2"] = focoWz;
    await shot(page, "K-02-foco-wizard-paso2", false);

    // aria-live en la región que cambia tras la IA
    metricas["K-03-ariaLive-wizard"] = await page.evaluate(() => ({
      ariaLive: [...document.querySelectorAll("[aria-live]")].map((e) => ({ tag: e.tagName, v: e.getAttribute("aria-live"), txt: e.textContent.trim().slice(0, 50) })),
      roleStatus: [...document.querySelectorAll('[role="status"]')].map((e) => e.textContent.trim().slice(0, 50)),
      roleAlert: [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim().slice(0, 50)),
      headings: [...document.querySelectorAll("h1,h2,h3,h4")].map((e) => e.tagName + ":" + e.textContent.trim().slice(0, 40)),
      landmarks: [...document.querySelectorAll("header,nav,main,aside,footer")].map((e) => e.tagName + (e.getAttribute("aria-label") ? `[${e.getAttribute("aria-label")}]` : "")),
    }));

    // ---- PERSISTENCIA DE BORRADOR (escritorio) ----
    await llenarPaso2(page);
    metricas["K-04-guardar-borrador"] = { antesDeGuardar: await page.evaluate(() => ({ borradoAtVisible: document.body.innerText.includes("Guardar borrador"), texto: document.body.innerText.match(/Estado actual[\s\S]{0,60}/)?.[0] })) };
    await page.click('button:has-text("Guardar borrador")');
    await page.waitForTimeout(700);
    metricas["K-05-tras-guardar"] = await page.evaluate(() => ({
      boton: [...document.querySelectorAll("button")].find((b) => /guardado/i.test(b.textContent))?.textContent.trim(),
      aviso: document.body.innerText.includes("Borrador guardado en este navegador"),
      h1: [...document.querySelectorAll("h1")].map((e) => e.textContent.trim()),
    }));
    await shot(page, "K-05-borrador-guardado");
    // recargar
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    metricas["K-06-tras-recarga"] = await page.evaluate(() => ({
      url: location.pathname + location.search,
      h2: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim()),
      tituloValor: document.querySelector("#titulo")?.value ?? null,
      descripcionValor: document.querySelector("textarea")?.value ?? null,
      fechaValor: document.querySelector('input[type="date"]')?.value ?? null,
      areaVisible: document.body.innerText.match(/Área:.*/)?.[0] ?? null,
      emailEnHome: sessionStorage.getItem("x"),
    }));
    await metric(page, "K-06-tras-recarga");
    await shot(page, "K-06-tras-recarga");
    // ¿se ve el estado "borrador guardado" al recargar? (borradoAt es estado en memoria)
    metricas["K-07-borrador-visible-tras-recarga"] = await page.evaluate(() => ({
      muestraBorradorGuardado: document.body.innerText.includes("Borrador guardado en este navegador"),
      botonGuardarTexto: [...document.querySelectorAll("button")].find((b) => /guardar borrador|¡guardado!/i.test(b.textContent))?.textContent.trim(),
    }));
    // ir atrás
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    metricas["K-08-tras-atras"] = await page.evaluate(() => ({ url: location.pathname + location.search, h2: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim()) }));
    await ctx.close();
  }

  // ============ E. ERRORES: validación, offline, archivo grande ============
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-HN" });
    const page = await ctx.newPage();
    hook(page, "errores");

    // E1: email inválido en home
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "correo-malo");
    await page.waitForTimeout(400);
    metricas["E-01-email-invalido"] = {
      texto: await page.evaluate(() => document.body.innerText),
      submitDisabled: await page.evaluate(() => document.querySelector('button[type="submit"]')?.disabled),
      inputAriaInvalid: await page.evaluate(() => document.querySelector('input[type="email"]')?.getAttribute("aria-invalid")),
    };
    await shot(page, "E-01-email-invalido");

    // E2: email no institucional (warning)
    await page.fill('input[type="email"]', "alguien@gmail.com");
    await page.waitForTimeout(400);
    metricas["E-02-email-no-institucional"] = { texto: await page.evaluate(() => document.body.innerText) };
    await shot(page, "E-02-email-no-institucional");

    // E3: fecha corta (advertencia de plazo)
    await page.fill('input[type="email"]', EMAIL);
    const t = page.locator('input[type="text"]');
    await t.nth(0).fill(NOMBRE);
    await t.nth(1).fill(AREA);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/solicitud/nueva**");
    await page.waitForTimeout(1000);
    await page.fill("#titulo", TITULO);
    await page.selectOption("select", { index: 1 });
    const manana = new Date();
    manana.setDate(manana.getDate() + 2);
    await page.fill('input[type="date"]', manana.toISOString().slice(0, 10));
    await page.fill("textarea", DESCRIPCION);
    await page.waitForTimeout(500);
    metricas["E-03-plazo-corto"] = { texto: await page.evaluate(() => document.body.innerText.match(/Este plazo[^\n]*/)?.[0] ?? "SIN AVISO") };
    await shot(page, "E-03-plazo-corto");

    // E4: IA falla (offline) al clasificar
    await ctx.setOffline(true);
    await page.click('button:has-text("Continuar")');
    await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 40000 });
    await page.waitForTimeout(6000);
    metricas["E-04-IA-offline-clasificar"] = {
      texto: await page.evaluate(() => document.body.innerText),
      estadoBadge: await page.evaluate(() => document.body.innerText.match(/Sin sugerencia|Sugerencia IA|Clasificando…/)?.[0] ?? "NINGUNO"),
    };
    await shot(page, "E-04-IA-offline-clasificar");
    // intentar avanzar sin conexión
    await page.click('button:has-text("Confirmar clasificación")');
    await page.waitForTimeout(8000);
    metricas["E-05-IA-offline-assessment"] = {
      texto: await page.evaluate(() => document.body.innerText.slice(0, 1200)),
      hayPreguntas: await page.evaluate(() => document.querySelectorAll('input[type="text"]').length),
      h2: await page.evaluate(() => [...document.querySelectorAll("h2")].map((e) => e.textContent.trim())),
    };
    await shot(page, "E-05-IA-offline-assessment");
    await ctx.setOffline(false);

    // E6: enviar offline (error de envío)
    const tgl = page.locator('button[aria-pressed]').first();
    if (await tgl.count()) {
      if ((await tgl.getAttribute("aria-pressed")) === "true") await tgl.click();
    }
    await page.waitForTimeout(300);
    await page.click('button:has-text("Generar documento")');
    await page.waitForSelector('text=/Tu solicitud está lista/', { timeout: 30000 });
    await page.waitForTimeout(2500);
    await ctx.setOffline(true);
    await page.click('button:has-text("Enviar solicitud")');
    await page.waitForTimeout(6000);
    metricas["E-06-envio-offline"] = {
      alerta: await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent.trim() ?? "SIN ALERTA"),
      texto: await page.evaluate(() => document.body.innerText.slice(-800)),
    };
    await shot(page, "E-06-envio-offline");
    await ctx.setOffline(false);

    // E7: archivo demasiado grande / ilegible (subir un .pdf roto y un .exe)
    await page.goBack();
    await page.waitForTimeout(500);
    await page.goForward().catch(() => {});
    await page.waitForTimeout(500);
    // navegar de nuevo por URL no conserva estado; probamos en el flujo de paso 4 usando goto
    await page.goto(BASE + "/solicitud/nueva?nuevo=1&email=" + encodeURIComponent(EMAIL) + "&nombre=x&area=y", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    //豆瓣: en paso 2 no hay file input. Vamos a forzar estado de branding y ver.
    metricas["E-07-accept-archivo"] = await page.evaluate(() => {
      const f = document.querySelector('input[type="file"]');
      return { hayFileInput: !!f, accept: f?.getAttribute("accept") ?? null };
    });

    await ctx.close();
  }

  // ============ F. MIS SOLICITUDES + DETALLE (móvil y escritorio) ============
  {
    for (const [pfx, vp, mob] of [
      ["MD", { width: 1440, height: 900 }, false],
      ["MM", { width: 390, height: 844 }, true],
    ]) {
      const ctx = await browser.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 3 : 1, locale: "es-HN" });
      const page = await ctx.newPage();
      hook(page, pfx);
      // sin query: estado inicial
      await page.goto(BASE + "/mis-solicitudes", { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await metric(page, `${pfx}-01-sin-email`);
      await texto(page, `${pfx}-01-sin-email`);
      await shot(page, `${pfx}-01-sin-email`);

      await page.goto(BASE + "/mis-solicitudes?email=" + encodeURIComponent(EMAIL), { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      await metric(page, `${pfx}-02-lista`);
      await texto(page, `${pfx}-02-lista`);
      await shot(page, `${pfx}-02-lista`);

      await page.goto(BASE + "/mis-solicitudes/" + ID_DETALLE + "?email=" + encodeURIComponent(EMAIL), { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await metric(page, `${pfx}-03-detalle`);
      await texto(page, `${pfx}-03-detalle`);
      await shot(page, `${pfx}-03-detalle`);

      // detalle de una solicitud con comparativa (para ver Cotizaciones + tracker)
      await page.goto(BASE + "/mis-solicitudes/d50dd0ba-3636-4458-99ff-866e6f43914c?email=" + encodeURIComponent(EMAIL), { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await metric(page, `${pfx}-04-detalle-comparativa`);
      await texto(page, `${pfx}-04-detalle-comparativa`);
      await shot(page, `${pfx}-04-detalle-comparativa`);

      // email incorrecto (¿fuga de datos?)
      await page.goto(BASE + "/mis-solicitudes?email=inventado@noexiste.com", { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await metric(page, `${pfx}-05-email-inexistente`);
      await texto(page, `${pfx}-05-email-inexistente`);
      await shot(page, `${pfx}-05-email-inexistente`);

      // acceso a detalle SIN email (¿bypass?)
      const r = await page.goto(BASE + "/mis-solicitudes/" + ID_DETALLE, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      metricas[`${pfx}-06-detalle-sin-email`] = {
        status: r?.status(),
        texto: await page.evaluate(() => document.body.innerText.slice(0, 600)),
      };
      await shot(page, `${pfx}-06-detalle-sin-email`);

      await ctx.close();
    }
  }

  // ============ G. COMPARATIVA PÚBLICA (decisión) ============
  {
    for (const [pfx, vp, mob] of [
      ["PD", { width: 1440, height: 900 }, false],
      ["PM", { width: 390, height: 844 }, true],
      ["PS", { width: 360, height: 740 }, true],
    ]) {
      const ctx = await browser.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 3 : 1, locale: "es-HN" });
      const page = await ctx.newPage();
      hook(page, pfx);
      await page.goto(`${BASE}/comparativa/${TOK_PENDIENTE}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await metric(page, `${pfx}-01-comparativa`);
      await texto(page, `${pfx}-01-comparativa`);
      await shot(page, `${pfx}-01-comparativa`, true);

      // abrir modal de confirmación (sin confirmar)
      const elegir = page.locator('button:has-text("Elegir esta opción")').first();
      if (await elegir.count()) {
        await elegir.click();
        await page.waitForTimeout(700);
        await metric(page, `${pfx}-02-modal-confirmar`);
        await texto(page, `${pfx}-02-modal-confirmar`);
        await shot(page, `${pfx}-02-modal-confirmar`, false);
        // teclado: ¿el modal atrapa el foco?
        metricas[`${pfx}-03-modal-foco`] = await page.evaluate(() => ({
          focoActual: document.activeElement?.textContent?.trim().slice(0, 24),
          roleDialog: document.querySelector('[role="dialog"]') ? true : false,
          ariaModal: document.querySelector('[aria-modal="true"]') ? true : false,
          ariaLabel: document.querySelector('[aria-labelledby]')?.getAttribute("aria-labelledby") ?? null,
          fondoTieneOnClick: !!document.querySelector(".fixed.inset-0 > div"),
        }));
        await page.click('button:has-text("Cancelar")');
        await page.waitForTimeout(500);
        // teclado en la página principal
        const foco = [];
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press("Tab");
          foco.push(await page.evaluate(() => ({ tag: document.activeElement?.tagName, t: (document.activeElement?.textContent || document.activeElement?.getAttribute("aria-label") || "").trim().slice(0, 28), dentro: document.activeElement ? (() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; })() : null })));
        }
        metricas[`${pfx}-04-foco-tab`] = foco;
      } else {
        pasosFallidos.push({ paso: `${pfx}-boton-elegir`, motivo: "no se encontró 'Elegir esta opción'" });
      }

      // comparativa ya decidida
      await page.goto(`${BASE}/comparativa/${TOK_CERRADA}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await metric(page, `${pfx}-05-comparativa-decidida`);
      await texto(page, `${pfx}-05-comparativa-decidida`);
      await shot(page, `${pfx}-05-comparativa-decidida`, true);

      // token inválido
      const r = await page.goto(`${BASE}/comparativa/XXXX-XXXX-XXXX`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      metricas[`${pfx}-06-token-invalido`] = { status: r?.status(), texto: await page.evaluate(() => document.body.innerText.slice(0, 500)) };
      await shot(page, `${pfx}-06-token-invalido`);

      await ctx.close();
    }
  }

  await browser.close();

  writeFileSync(OUT + "metricas.json", JSON.stringify(metricas, null, 2));
  writeFileSync(OUT + "consola.json", JSON.stringify(consola, null, 2));
  writeFileSync(OUT + "pasos-fallidos.json", JSON.stringify(pasosFallidos, null, 2));
  writeFileSync(OUT + "textos.txt", Object.entries(textos).map(([k, v]) => "\n\n========== " + k + " ==========\n" + v).join("\n"));
  console.log("DONE. metricas=" + Object.keys(metricas).length + " consola=" + consola.length + " fallos=" + pasosFallidos.length);
}
main().catch((e) => {
  console.error("FATAL", e);
  writeFileSync(OUT + "metricas.json", JSON.stringify(metricas, null, 2));
  writeFileSync(OUT + "consola.json", JSON.stringify(consola, null, 2));
  writeFileSync(OUT + "pasos-fallidos.json", JSON.stringify(pasosFallidos, null, 2));
  writeFileSync(OUT + "textos.txt", Object.entries(textos).map(([k, v]) => "\n\n========== " + k + " ==========\n" + v).join("\n"));
  process.exit(1);
});
