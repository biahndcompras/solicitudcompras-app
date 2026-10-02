import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EXE =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const run = async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.getByPlaceholder("ejemplo@bia.com").fill("verificador.qa@bia.hn");
  await p.getByPlaceholder("Juan Pérez").fill("Verificador QA");
  await p.getByPlaceholder("Marketing").fill("Trade Marketing");
  await p.getByRole("button", { name: /continuar/i }).first().click();
  await p.waitForTimeout(2500);
  console.log("url:", p.url());

  // Rellenar la descripción con un valor único
  const RARO = "ZAFIRO-UNICO-778899";
  const ta = p.locator("textarea").first();
  if (await ta.count()) {
    await ta.fill(RARO);
  } else {
    await p.getByPlaceholder(/describ|detalle|qué necesitás/i).first().fill(RARO);
  }
  await p.waitForTimeout(2500);
  const antes = await p.evaluate(() => {
    const t = document.querySelector("textarea");
    return { valor: t ? t.value.slice(0, 60) : null, ls: Object.fromEntries(Object.entries(localStorage).map(([k, v]) => [k, String(v).slice(0, 120)])), cookies: document.cookie };
  });
  console.log("antes  de recargar:", JSON.stringify(antes));

  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  const despues = await p.evaluate(() => {
    const t = document.querySelector("textarea");
    return { valor: t ? t.value.slice(0, 60) : null, h2: document.querySelector("h2")?.textContent.trim().slice(0, 40), ls: Object.fromEntries(Object.entries(localStorage).map(([k, v]) => [k, String(v).slice(0, 120)])) };
  });
  console.log("despues de recargar:", JSON.stringify(despues));
  console.log("VEREDICTO persistencia:", despues.valor === RARO ? "RESTAURA" : "NO RESTAURA (dato perdido)");

  // Boton "guardar borrador" presente? que dice el aviso de autoguardado?
  const info = await p.evaluate(() => {
    const t = document.body.innerText;
    return {
      hayBorrador: /borrador/i.test(t),
      fraseBorrador: (t.match(/[^\n]*[Bb]orrador[^\n]*/g) || []).slice(0, 4),
      pasosRail: [...document.querySelectorAll("aside li")].map((li) => li.textContent.trim().replace(/\s+/g, " ").slice(0, 40)),
    };
  });
  console.log("autoguardado:", JSON.stringify(info));

  await b.close();
};
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
