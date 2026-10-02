import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EXE =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const run = async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();

  // Inventario real de controles en "/" (paso 1)
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const inv = await p.evaluate(() => {
    const lab = (e) => {
      const l = e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`);
      return (l ? l.textContent.trim() : e.closest("label")?.textContent.trim() || "").slice(0, 40);
    };
    return {
      inputs: [...document.querySelectorAll("input,select,textarea")].map((e) => ({
        tag: e.tagName, type: e.type, name: e.name, ph: e.placeholder, label: lab(e), required: e.required,
      })),
      buttons: [...document.querySelectorAll("button")].map((e) => ({ t: e.textContent.trim().slice(0, 30), disabled: e.disabled })),
    };
  });
  console.log("=== CAMPOS EN / (paso 1) ===");
  inv.inputs.forEach((i) => console.log(" ", i.tag, i.type, "| label:", JSON.stringify(i.label), "| ph:", JSON.stringify(i.ph)));
  console.log("  botones:", JSON.stringify(inv.buttons));

  // Rellenar TODO lo rellenable y ver si Continuar se habilita
  const set = async (ph, val) => {
    const el = p.getByPlaceholder(ph).first();
    if (await el.count()) { await el.fill(val); return true; }
    return false;
  };
  const ok = [];
  ok.push(["email", await set("ejemplo@bia.com", "verificador.qa@bia.hn")]);
  ok.push(["nombre", await set("Juan Pérez", "Verificador QA")]);
  ok.push(["area/Marketing", await set("Marketing", "Trade Marketing")]);
  console.log("  rellenados:", JSON.stringify(ok));
  await p.waitForTimeout(600);
  const btn = p.getByRole("button", { name: /continuar/i }).first();
  console.log("  Continuar disabled tras rellenar todo:", await btn.isDisabled());

  // ¿hay algún select de categoría/área en el paso 1?
  console.log("  selects:", await p.locator("select").count());

  // ---- Ahora sí: entrar al wizard y medir P0-2 de verdad
  await btn.click({ force: true });
  await p.waitForTimeout(2500);
  console.log("\n=== WIZARD /solicitud/nueva a 390x844 ===");
  console.log("  url:", p.url());
  const m = await p.evaluate(() => {
    const main = document.querySelector("main");
    const aside = document.querySelector("aside");
    const sec = document.querySelector("main section") || main?.children[1];
    const box = (e) => (e ? { w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) } : null);
    const cands = [...(main?.children || [])].map((e) => ({
      tag: e.tagName, ...box(e),
      clientH: e.clientHeight, scrollH: e.scrollHeight, overflowY: getComputedStyle(e).overflowY,
    }));
    return {
      aside: box(aside),
      viewport: window.innerHeight,
      mainOverflow: main ? getComputedStyle(main).overflow : null,
      mainH: main ? main.clientHeight : null,
      hijosMain: cands,
      primerH2: (() => { const h = document.querySelector("h2"); const r = h?.getBoundingClientRect(); return h ? { t: h.textContent.trim().slice(0,40), top: Math.round(r.top) } : null; })(),
    };
  });
  console.log("  aside:", JSON.stringify(m.aside), " viewport:", m.viewport, " main overflow:", m.mainOverflow);
  m.hijosMain.forEach((c, i) => console.log(`   hijo[${i}] ${c.tag} ${c.w}x${c.h} client=${c.clientH} scroll=${c.scrollH} overflowY=${c.overflowY}`));
  console.log("  primer h2:", JSON.stringify(m.primerH2));
  if (m.aside) console.log("  % de viewport que ocupa el aside:", Math.round((m.aside.h / m.viewport) * 100) + "%");

  await p.screenshot({ path: "qa/evidencia-piloto/critique-solicitante/VERIF-02-wizard-390.png", fullPage: true });

  // escritorio, contraste
  const d = await ctx.newPage();
  await d.setViewportSize({ width: 1440, height: 900 });
  await d.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await d.getByPlaceholder("ejemplo@bia.com").fill("verificador.qa@bia.hn");
  await d.getByPlaceholder("Juan Pérez").fill("Verificador QA");
  await d.getByPlaceholder("Marketing").fill("Trade Marketing");
  await d.getByRole("button", { name: /continuar/i }).first().click({ force: true });
  await d.waitForTimeout(2500);
  const dk = await d.evaluate(() => {
    const aside = document.querySelector("aside");
    const main = document.querySelector("main");
    return { aside: aside ? { w: Math.round(aside.getBoundingClientRect().width), h: Math.round(aside.getBoundingClientRect().height) } : null, mainH: main?.clientHeight, vh: window.innerHeight };
  });
  console.log("\n=== ESCRITORIO 1440x900 ===");
  console.log("  aside:", JSON.stringify(dk.aside), " mainH:", dk.mainH, " vh:", dk.vh);
  await d.screenshot({ path: "qa/evidencia-piloto/critique-solicitante/VERIF-03-wizard-1440.png", fullPage: true });

  await b.close();
};
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
