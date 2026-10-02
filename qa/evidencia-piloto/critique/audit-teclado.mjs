import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EXE =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const run = async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  await p.goto(`${BASE}/login/coordinador`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', "cmelara@biabrands.co");
  await p.fill('input[type="password"]', "carloscomprador");
  await p.click('button[type="submit"]');
  await p.waitForURL("**/panel**", { timeout: 25000 });
  await p.waitForTimeout(3000);

  // ¿Las filas/tabla son alcanzables por teclado?
  const tabbables = await p.evaluate(() => {
    const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return [...document.querySelectorAll(sel)].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map((e) => ({
      tag: e.tagName,
      t: (e.textContent || e.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 40),
      role: e.getAttribute("role") || "",
      onclick: !!e.onclick,
    }));
  });
  console.log("=== ELEMENTOS ALCANZABLES POR TECLADO EN /panel ===");
  console.log("total:", tabbables.length);
  const filas = tabbables.filter((t) => /Abrir|panel\/solicitud/.test(t.t));
  console.log("entradas que llevan al detalle:", filas.length);
  tabbables.forEach((t) => console.log(" ", t.tag, t.role || "-", JSON.stringify(t.t)));

  // las filas <tr> son clicables pero no focusables
  const trInfo = await p.evaluate(() => {
    const trs = [...document.querySelectorAll("tbody tr")];
    return {
      total: trs.length,
      conOnClick: trs.filter((t) => t.onclick).length,
      focusables: trs.filter((t) => t.tabIndex >= 0 || t.getAttribute("tabindex") !== null).length,
      roleEnTr: trs.map((t) => t.getAttribute("role")),
      spanRoleLink: [...document.querySelectorAll('span[role="link"]')].map((s) => ({
        t: s.textContent.trim().slice(0, 20),
        tabIndex: s.tabIndex,
        foco: s.tabIndex >= 0,
      })),
    };
  });
  console.log("\n=== FILAS DE TABLA ===");
  console.log(JSON.stringify(trInfo, null, 1));

  // en la barra de acciones del detalle, cuántas paradas hay y cuáles
  const d = await ctx.newPage();
  await d.goto(`${BASE}/panel/solicitud/d50dd0ba-3636-4458-99ff-866e6f43914c`, { waitUntil: "networkidle" });
  await d.waitForTimeout(3500);
  const acciones = await d.evaluate(() => {
    const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return [...document.querySelectorAll(sel)]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((e) => {
        const cs = getComputedStyle(e);
        return {
          tag: e.tagName,
          t: (e.textContent || e.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 42),
          h: Math.round(e.getBoundingClientRect().height),
          minH: cs.minHeight,
        };
      });
  });
  console.log("\n=== PARADAS TECLADO EN DETALLE (RFQ-0008) ===");
  console.log("total:", acciones.length);
  acciones.forEach((a) => console.log(" ", a.tag, a.h + "px", JSON.stringify(a.t)));

  // ¿la barra de acciones cabe? mide el ancho de la fila superior
  const wrap = await d.evaluate(() => {
    const barras = [...document.querySelectorAll("div.flex.items-center.justify-between")];
    return barras.slice(0, 2).map((x) => ({
      w: Math.round(x.getBoundingClientRect().width),
      scrollW: x.scrollWidth,
      desborda: x.scrollWidth > x.clientWidth + 2,
      hijos: x.children.length,
    }));
  });
  console.log("\n=== BARRA SUPERIOR DEL DETALLE ===");
  console.log(JSON.stringify(wrap, null, 1));

  await b.close();
};
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
