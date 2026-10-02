// PASE 2 — verificación dirigida de hipótesis concretas. Solo lectura.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3001";
const OUT = new URL(".", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const CHROME =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const EMAIL = "mj.e2e@biabrands.co";
const TOK = "2472-0EA8-9318";
const r = {};
const fallos = [];
const consola2 = [];

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME });

  // ---- H1: DEAD-END del campo "Área" (wizard sin ?area=) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => consola2.push({ k: "H1", t: "pageerror", x: String(e).slice(0, 200) }));
    // Entrada directa SIN el parámetro area (p.ej. link compartido, marcador, o el usuario
    // que vuelve por la URL del navegador)
    await page.goto(BASE + "/solicitud/nueva?nuevo=1&email=" + encodeURIComponent(EMAIL) + "&nombre=Solicitante%20E2E", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    // llenar TODO lo que el usuario puede llenar
    await page.fill("#titulo", "Prueba de dead-end sin área");
    await page.selectOption("select", { index: 1 });
    const f = new Date(); f.setDate(f.getDate() + 20);
    await page.fill('input[type="date"]', f.toISOString().slice(0, 10));
    await page.fill("textarea", "Descripción de prueba sin área.");
    await page.waitForTimeout(600);
    r["H1-sin-area"] = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /continuar/i.test(x.textContent));
      const hayInputArea = !!document.querySelector('input[name="area"],#area');
      return {
        textoVisibleArea: document.body.innerText.match(/Área:.*/)?.[0] ?? "NO APARECE",
        hayCampoAreaEnFormulario: hayInputArea,
        botonContinuarDisabled: b?.disabled,
        pasoValido_hooks: "requiere area.trim() (hooks/useSolicitudWizard.ts:299)",
        camposQueElUsuarioPuedeLlenar: [...document.querySelectorAll("input:not([type=radio]),select,textarea")].map((i) => i.id || i.type),
      };
    });
    await page.screenshot({ path: OUT + "H1-sin-area-deadend.png", fullPage: true });

    // ---- H2: PÉRDIDA DE BORRADOR AL RECARGAR (nuevo=1 ignora localStorage) ----
    // primero: crear un borrador en paso 4
    await page.goto(BASE + "/solicitud/nueva?nuevo=1&email=" + encodeURIComponent(EMAIL) + "&nombre=Solicitante%20E2E&area=Trade%20Marketing", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.fill("#titulo", "TÍTULO ÚNICO XYZ-12345");
    await page.selectOption("select", { index: 1 });
    const f2 = new Date(); f2.setDate(f2.getDate() + 20);
    await page.fill('input[type="date"]', f2.toISOString().slice(0, 10));
    await page.fill("textarea", "DESCRIPCIÓN ÚNICA ABC-67890 para probar persistencia.");
    await page.waitForTimeout(900);
    const antes = await page.evaluate(() => ({
      ls: JSON.parse(localStorage.getItem("bia_borrador") || "null"),
      h2: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim()),
      tituloInput: document.querySelector("#titulo")?.value,
    }));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const despues = await page.evaluate(() => ({
      url: location.search,
      h2: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim()),
      tituloInput: document.querySelector("#titulo")?.value ?? "(no existe el input #titulo)",
      tituloEnPantalla: document.body.innerText.includes("TÍTULO ÚNICO XYZ-12345"),
      descEnPantalla: document.body.innerText.includes("DESCRIPCIÓN ÚNICA ABC-67890"),
      cookie: document.cookie,
      areaEnPantalla: document.body.innerText.match(/Área:.*/)?.[0],
    }));
    r["H2-draft-loss"] = {
      antes: { h2: antes.h2, tituloInput: antes.tituloInput, pasoEnLS: antes.ls?.paso, tituloEnLS: antes.ls?.titulo, areaEnLS: antes.ls?.area },
      despues,
      veredicto: despues.tituloEnPantalla ? "borrador restaurado" : "BORRADOR PERDIDO: los datos NO volvieron tras recargar",
    };
    await page.screenshot({ path: OUT + "H2-draft-loss-tras-recarga.png", fullPage: true });

    // ---- H2b: recarga SIN nuevo=1 (rescate por localStorage) ----
    await page.goto(BASE + "/solicitud/nueva?email=" + encodeURIComponent(EMAIL), { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    r["H2b-draft-sin-nuevo"] = await page.evaluate(() => ({
      h2: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim()),
      tituloEnPantalla: document.body.innerText.includes("TÍTULO ÚNICO XYZ-12345"),
    }));
    await page.screenshot({ path: OUT + "H2b-draft-sin-nuevo.png", fullPage: true });
    await ctx.close();
  }

  // ---- H3: FOCUS VISIBLE en las tarjetas Producto/Servicio (radio sr-only) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/solicitud/nueva?email=" + encodeURIComponent(EMAIL), { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    // tabular hasta el radio
    let llego = false;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const es = await page.evaluate(() => document.activeElement?.type === "radio");
      if (es) { llego = true; break; }
    }
    await page.waitForTimeout(300);
    r["H3-foco-radio-card"] = {
      llegoAlRadio: llego,
      estado: await page.evaluate(() => {
        const a = document.activeElement;
        const lab = a?.closest("label");
        const card = lab?.querySelector("div");
        const cs = card ? getComputedStyle(card) : null;
        return {
          inputRect: a ? { w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height } : null,
          cardBorderAntes: cs?.borderColor + " / ring:" + cs?.boxShadow,
          // ¿el CSS define algún estilo para :focus-visible dentro de la tarjeta?
          cardClasses: card?.className?.slice(0, 220),
          tieneFocusVisibleEnClases: /focus-visible|group-focus|has-\[:focus/.test(card?.className || ""),
        };
      }),
    };
    // captura con el foco puesto
    await page.screenshot({ path: OUT + "H3-foco-radio-producto-servicio.png" });
    // كمás tarjetas tienen estilo de foco
    r["H3b-foco-audit"] = await page.evaluate(() => {
      const enFoco = document.activeElement;
      const tarjeta = enFoco?.closest("label")?.querySelector("div");
      // simular :focus-visible leyendo los estilos del propio elemento con focus()
      return {
        tarjetaBounds: tarjeta ? { w: Math.round(tarjeta.getBoundingClientRect().width), h: Math.round(tarjeta.getBoundingClientRect().height) } : null,
        outlineEnTarjeta: tarjeta ? getComputedStyle(tarjeta).outline : null,
        note: "el input es sr-only (1x1px); cualquier indicador debe venir de la tarjeta label",
      };
    });
    await ctx.close();
  }

  // ---- H4: SUBIDA DE ARCHIVO — demasiado grande / ilegible / tipo no permitido ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") consola2.push({ k: "H4", t: "error", x: m.text().slice(0, 200) }); });
    page.on("pageerror", (e) => consola2.push({ k: "H4", t: "pageerror", x: String(e).slice(0, 200) }));
    page.on("response", async (res) => {
      if (res.url().includes("/logo")) {
        fallos.push({ k: "H4-resp", status: res.status(), url: res.url().replace(BASE, "") });
        try { fallos.push({ k: "H4-resp-body", body: (await res.text()).slice(0, 300) }); } catch {}
      }
    });
    await page.goto(BASE + "/solicitud/nueva?nuevo=1&email=" + encodeURIComponent(EMAIL) + "&nombre=x&area=y", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.fill("#titulo", "Prueba de archivo de logo");
    await page.selectOption("select", { index: 1 });
    const f3 = new Date(); f3.setDate(f3.getDate() + 20);
    await page.fill('input[type="date"]', f3.toISOString().slice(0, 10));
    await page.fill("textarea", "Prueba de carga de archivo.");
    await page.click('button:has-text("Continuar")');
    await page.waitForSelector('text=/Clasificación de tu solicitud/', { timeout: 40000 });
    await page.waitForTimeout(6000);
    await page.click('button:has-text("Confirmar clasificación")');
    await page.waitForSelector('text=/Detalles para cotizar/', { timeout: 60000 });
    await page.waitForFunction(() => !document.body.innerText.includes("Preparando preguntas del asistente"), null, { timeout: 180000 }).catch(() => fallos.push({ k: "H4", t: "timeout assessment" }));
    await page.waitForTimeout(1500);
    r["H4a-file-input"] = await page.evaluate(() => {
      const f = document.querySelector('input[type="file"]');
      return {
        hay: !!f, accept: f?.getAttribute("accept"),
        labelVisible: f?.closest("label")?.innerText?.replace(/\n/g, " | "),
        // ¿el input tiene tamaño? sr-only = 1x1 → móvil: ¿se abre el selector nativo?
        rect: f ? { w: f.getBoundingClientRect().width, h: f.getBoundingClientRect().height } : null,
        labelRect: f?.closest("label") ? (() => { const r = f.closest("label").getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
        enPantalla: f?.closest("label") ? (() => { const r = f.closest("label").getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; })() : false,
      };
    });
    // (a) archivo grande 12MB png
    const grande = Buffer.alloc(12 * 1024 * 1024, 0x41);
    try {
      await page.setInputFiles('input[type="file"]', { name: "logo-enorme-12MB.png", mimeType: "image/png", buffer: grande });
      await page.waitForTimeout(1200);
      r["H4b-archivo-12MB"] = await page.evaluate(() => ({
        nombreMostrado: document.body.innerText.match(/logo-enorme-12MB\.png/) ? "SI" : "NO",
        zonaVerde: !!document.querySelector(".border-green-300"),
        textoVisible: document.body.innerText.match(/Formatos aceptados[\s\S]{0,120}/)?.[0],
        hayMensajeDeError: /demasiado grande|excede|máximo|too large|error/i.test(document.body.innerText),
      }));
    } catch (e) { fallos.push({ k: "H4b", t: String(e).slice(0, 200) }); }
    await page.screenshot({ path: OUT + "H4b-archivo-12MB.png", fullPage: true });

    // (b) PDF ilegible / corrupto
    const roto = Buffer.from("%PDF-1.4\nesto no es un pdf real\n%%EOF");
    try {
      await page.setInputFiles('input[type="file"]', { name: "pdf-corrupto.pdf", mimeType: "application/pdf", buffer: roto });
      await page.waitForTimeout(1000);
      r["H4c-pdf-roto"] = await page.evaluate(() => ({ nombreMostrado: document.body.innerText.includes("pdf-corrupto.pdf"), hayErrorVisible: /error|inválid|ilegible|no se pudo/i.test(document.body.innerText) }));
    } catch (e) { fallos.push({ k: "H4c", t: String(e).slice(0, 200) }); }

    // (c) extensión NO en la lista accept (simula arrastrar un .heic)
    try {
      await page.setInputFiles('input[type="file"]', { name: "foto-iphone.heic", mimeType: "image/heic", buffer: Buffer.from("fakeheic") });
      await page.waitForTimeout(1000);
      r["H4d-heic"] = await page.evaluate(() => ({ aceptado: document.body.innerText.includes("foto-iphone.heic"), texto: document.body.innerText.match(/Formatos aceptados[\s\S]{0,140}/)?.[0] }));
    } catch (e) { fallos.push({ k: "H4d", t: String(e).slice(0, 200) }); }
    await page.screenshot({ path: OUT + "H4d-archivo-no-aceptado.png", fullPage: true });

    // (d) ¿se puede avanzar con un archivo de 0 bytes?
    r["H4e-advance"] = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /generar documento/i.test(x.textContent));
      return { botonExiste: !!b, disabled: b?.disabled };
    });
    await ctx.close();
  }

  // ---- H5: COMPARATIVA — trampa de foco, moneda, semántica de decisión ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => consola2.push({ k: "H5", t: "pageerror", x: String(e).slice(0, 200) }));
    await page.goto(`${BASE}/comparativa/${TOK}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    r["H5a-comparativa-estructura"] = await page.evaluate(() => {
      const tot = [...document.querySelectorAll('div')].filter((d) => d.innerText?.match(/^(HNL|USD|L|EUR|€|\$)/m) && d.children.length <= 2).map((d) => d.innerText.trim());
      const monos = [...new Set((document.body.innerText.match(/\b(HNL|USD|EUR|MXN|L)\b/g) || []))];
      const importes = [...document.querySelectorAll('div')].filter((d) => /^(HNL|USD|L)\s[\d.,]+$/.test(d.innerText?.trim() || "")).map((d) => d.innerText.trim());
      return {
        monedasPresentes: monos,
        importes: importes,
        hayAvisoSinConversion: document.body.innerText.includes("sin conversión"),
        hayEquivalente: /≈|equivale|mismo valor|normalizado/i.test(document.body.innerText),
        recomendacion: document.querySelector(".text-sm.text-slate-800.font-medium")?.innerText?.slice(0, 200),
        textoRecomendacion: document.body.innerText.match(/RECOMENDACI[ÓO]N DE COMPRAS[\s\S]{0,220}/)?.[0],
      };
    });
    // trampa de foco del modal: tabular 8 veces desde el fondo
    await page.locator('button:has-text("Elegir esta opción")').first().click();
    await page.waitForTimeout(600);
    const focoAntes = await page.evaluate(() => ({ activo: document.activeElement?.tagName + ":" + (document.activeElement?.innerText || "").trim().slice(0, 20) }));
    const trap = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      trap.push(await page.evaluate(() => {
        const a = document.activeElement;
        const enModal = !!a?.closest('[class*="max-w-md"]');
        return { tag: a?.tagName, t: (a?.innerText || a?.getAttribute?.("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 22), enModal, enFondo: !enModal && a?.tagName !== "BODY" };
      }));
    }
    r["H5b-modal-foco"] = {
      focoAlAbrir: focoAntes,
      recorrido: trap,
      hayTrampaDeFoco: trap.every((t) => t.enModal),
      hayRoleDialog: await page.evaluate(() => !!document.querySelector('[role="dialog"]')),
      hayAriaModal: await page.evaluate(() => !!document.querySelector('[aria-modal="true"]')),
      escapeCierra: await (async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(400); return await page.evaluate(() => !document.body.innerText.includes("Confirmar selección")); })(),
      fondoConOnClick: await page.evaluate(() => !!document.querySelector(".fixed.inset-0 > div[onclick], .fixed.inset-0 > div")),
    };
    await page.screenshot({ path: OUT + "H5b-modal-foco.png" });
    // el "ninguna me sirve" — ¿se puede activar sin confirmar nada más?
    r["H5c-ninguna-me-sirve"] = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /ninguna me sirve/i.test(x.textContent));
      return { existe: !!b, disabled: b?.disabled, texto: b?.innerText?.trim() };
    });
    // sin javascript: el enlace es público y sin autenticación — verificar que no exige nada
    const r2 = await page.goto(`${BASE}/comparativa/${TOK}`, { waitUntil: "networkidle" });
    r["H5d-token-usa"] = {
      status: r2.status(),
      sinCamposDeLogin: !/contrase|password|iniciar sesión|login/i.test(await page.evaluate(() => document.body.innerText)),
      vecesAccedido: await page.evaluate(() => document.body.innerText.match(/Enlace público[^\n]*/)?.[0]),
    };
    await ctx.close();
  }

  // ---- H6: /mis-solicitudes móvil — medición del aplastamiento de la tarjeta ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto(BASE + "/mis-solicitudes?email=" + encodeURIComponent(EMAIL), { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    r["H6-lista-movil-aplastamiento"] = await page.evaluate(() => {
      const card = document.querySelector('a[href^="/mis-solicitudes/"]');
      if (!card) return { noHayTarjetas: true, texto: document.body.innerText.slice(0, 300) };
      const titulo = card.querySelector("h3");
      const ref = card.querySelector('div[class*="uppercase"]');
      const badges = [...card.querySelectorAll('span')].filter((s) => /margen|Enviada|Cerrada|Compara|decisión/i.test(s.innerText));
      const cont = titulo?.parentElement;
      return {
        tarjetaW: Math.round(card.getBoundingClientRect().width),
        colTituloW: Math.round(cont?.getBoundingClientRect().width || 0),
        tituloTexto: titulo?.innerText,
        tituloW: Math.round(titulo?.getBoundingClientRect().width || 0),
        tituloH: Math.round(titulo?.getBoundingClientRect().height || 0),
        lineasTitulo: Math.round(titulo.getBoundingClientRect().height / parseFloat(getComputedStyle(titulo).lineHeight)),
        refTexto: ref?.innerText,
        refW: Math.round(ref?.getBoundingClientRect().width || 0),
        refH: Math.round(ref?.getBoundingClientRect().height || 0),
        badges: badges.map((b) => {
          const rc = b.getBoundingClientRect();
          const cardBox = card.getBoundingClientRect();
          return {
            txt: b.innerText.trim(),
            w: Math.round(rc.width),
            desbordadoDerecha: Math.round(rc.right - cardBox.right),
            seSaleDelCard: rc.right > cardBox.right + 1,
          };
        }),
        trackerLabels: [...card.querySelectorAll('span[title]')].map((s) => ({ t: s.getAttribute("title"), fs: getComputedStyle(s).fontSize, w: Math.round(s.getBoundingClientRect().width) })),
      };
    });
    await page.screenshot({ path: OUT + "H6-lista-movil-aplastada.png", fullPage: true });
    // detalle móvil
    await page.goto(BASE + "/mis-solicitudes/d50dd0ba-3636-4458-99ff-866e6f43914c?email=" + encodeURIComponent(EMAIL), { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    r["H6b-detalle-movil"] = await page.evaluate(() => {
      const tr = [...document.querySelectorAll('span[title]')].map((s) => ({ t: s.getAttribute("title"), fs: getComputedStyle(s).fontSize, w: Math.round(s.getBoundingClientRect().width) }));
      return {
        tracker: tr,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        hayDecisionCTA: /decid|elegir|comparativa\/\w+/i.test(document.body.innerText + document.documentElement.innerHTML),
        texto: document.body.innerText.replace(/\n+/g, " | ").slice(0, 700),
      };
    });
    await page.screenshot({ path: OUT + "H6b-detalle-movil.png", fullPage: true });
    await ctx.close();
  }

  await browser.close();
  writeFileSync(OUT + "metricas-pase2.json", JSON.stringify(r, null, 2));
  writeFileSync(OUT + "pase2-notas.json", JSON.stringify({ consola2, fallos }, null, 2));
  console.log("PASE2 DONE", Object.keys(r).length);
}
main().catch((e) => { console.error(e); writeFileSync(OUT + "metricas-pase2.json", JSON.stringify(r, null, 2)); writeFileSync(OUT + "pase2-notas.json", JSON.stringify({ consola2, fallos, fatal: String(e) }, null, 2)); process.exit(1); });
