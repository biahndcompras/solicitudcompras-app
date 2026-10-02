import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EXE =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

// Verificacion independiente de los P0 del flujo solicitante, reportados por el auditor.
const run = async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(String(e).slice(0, 160)));

  // ---- P0-1: dead-end por falta de campo "area"
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.getByPlaceholder("ejemplo@bia.com").fill("verificador.qa@bia.hn");
  await p.getByPlaceholder("Juan Pérez").fill("Verificador QA");
  // NO relleno area a proposito: el auditor afirma que el boton queda disabled para siempre
  const areaExiste = await p.locator('input[name*="area" i], input[id*="area" i], input[placeholder*="departamento" i], input[placeholder*="area" i]').count();
  const areaTexto = await p.evaluate(() => document.body.innerText.match(/[ÁA]rea[^\n]{0,40}/g));
  const btn = p.getByRole("button", { name: /continuar/i }).first();
  const disabled = await btn.isDisabled();
  console.log("P0-1  campo-area-en-formulario:", areaExiste, "| disabled(Continuar):", disabled);
  console.log("P0-1  texto-que-menciona-area:", JSON.stringify(areaTexto));

  // ---- P0-2: espacio real del formulario en movil
  const m = await p.evaluate(() => {
    const main = document.querySelector("main");
    const aside = document.querySelector("aside");
    const section = document.querySelector("main section") || document.querySelector("main > div:nth-child(2)");
    const box = (e) => (e ? { w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) } : null);
    return {
      main: box(main),
      aside: box(aside),
      section: box(section),
      mainClientH: main ? main.clientHeight : null,
      sectionClientH: section ? section.clientHeight : null,
      sectionScrollH: section ? section.scrollHeight : null,
      overflowHidden: main ? getComputedStyle(main).overflow : null,
      alturaVentana: window.innerHeight,
    };
  });
  console.log("P0-2  main/aside/section:", JSON.stringify(m));
  const pct = m.sectionClientH ? Math.round((m.sectionClientH / m.alturaVentana) * 100) : null;
  console.log("P0-2  % del viewport para el formulario:", pct + "%");
  console.log("P0-2  contenido vs ventana:", m.sectionClientH, "/", m.sectionScrollH);

  // CTA primario accesible?
  const cta = await p.evaluate(() => {
    const bs = [...document.querySelectorAll("button,a")].filter((e) => /continuar|siguiente|guardar/i.test(e.textContent));
    return bs.map((e) => {
      const r = e.getBoundingClientRect();
      return { t: e.textContent.trim().slice(0, 24), top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.top >= 0 && r.bottom <= window.innerHeight,Disabled: e.disabled };
    });
  });
  console.log("P0-2  CTA:", JSON.stringify(cta));

  await p.screenshot({ path: "qa/evidencia-piloto/critique-solicitante/VERIF-01-wizard-movil.png", fullPage: true });

  // escritorio para contraste
  const d = await ctx.newPage();
  await d.setViewportSize({ width: 1440, height: 900 });
  await d.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const desk = await d.evaluate(() => {
    const main = document.querySelector("main");
    const aside = document.querySelector("aside");
    return {
      mainH: main ? main.clientHeight : null,
      asideW: aside ? Math.round(aside.getBoundingClientRect().width) : null,
      asideH: aside ? Math.round(aside.getBoundingClientRect().height) : null,
    };
  });
  console.log("P0-2  escritorio:", JSON.stringify(desk));

  // ---- P0-3: autoguardado no restaura
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.getByPlaceholder("ejemplo@bia.com").fill("verificador.qa@bia.hn");
  await p.getByPlaceholder("Juan Pérez").fill("Verificador QA");
  await p.getByRole("button", { name: /continuar/i }).first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(1200);
  const tituloAntes = await p.evaluate(() => {
    const i = document.querySelector('input[placeholder*="titulo" i], input[placeholder*="título" i]');
    if (i) { i.value = "TITULO UNICO XYZ-98765"; i.dispatchEvent(new Event("input", { bubbles: true })); }
    return i ? i.value : "(sin campo titulo)";
  });
  await p.waitForTimeout(900);
  const ls = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const tituloDespues = await p.evaluate(() => {
    const i = document.querySelector('input[placeholder*="titulo" i], input[placeholder*="título" i]');
    return i ? i.value : "(sin campo titulo)";
  });
  console.log("P0-3  titulo-antes:", JSON.stringify(tituloAntes));
  console.log("P0-3  titulo-tras-recargar:", JSON.stringify(tituloDespues));
  console.log("P0-3  localStorage:", JSON.stringify(ls).slice(0, 300));

  console.log("ERRORES pageerror:", errores.length ? JSON.stringify(errores) : "ninguno");
  await b.close();
};
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
