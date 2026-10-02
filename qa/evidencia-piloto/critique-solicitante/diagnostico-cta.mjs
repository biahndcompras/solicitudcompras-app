import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EXE =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const run = async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.getByPlaceholder("ejemplo@bia.com").fill("mj.e2e@biabrands.co");
  await p.getByPlaceholder("Juan Pérez").fill("Verificacion Envio");
  await p.getByPlaceholder("Marketing").fill("Trade Marketing");
  await p.getByRole("button", { name: /continuar/i }).first().click();
  await p.waitForTimeout(2500);
  await p.locator("textarea").first().fill("Necesito 500 lapiceros corporativos con logo para activacion de marca.");
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /continuar|siguiente/i }).first().click();
  await p.waitForTimeout(1000);

  // Esperar a que la IA de clasificacion resuelva (o a que el paso avance solo)
  for (let i = 0; i < 40; i++) {
    const t = await p.evaluate(() => document.body.innerText);
    if (/Clasificaci[oó]n|Confirmar clasificaci|Detalles t[eé]cnicos|Assessment|asistente/i.test(t)) break;
    await p.waitForTimeout(1500);
  }
  console.log("tras espera IA:", (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 260));

  const estado = async (etiqueta) => {
    const st = await p.evaluate(() => {
      const bs = [...document.querySelectorAll("button")].map((e) => ({ t: e.textContent.trim().replace(/\s+/g, " ").slice(0, 34), d: e.disabled, v: e.offsetParent !== null }));
      return bs.filter((x) => x.v);
    });
    console.log(`\n[${etiqueta}] botones visibles:`);
    st.forEach((x) => console.log("  ", x.d ? "OFF " : " ON ", JSON.stringify(x.t)));
    return st;
  };
  await estado("clasificacion/assessment");

  // Intentar avanzar hasta el paso de envio, esperando a la IA cada vez
  for (let i = 0; i < 6; i++) {
    const etiqueta = await p.evaluate(() => {
      const h = document.querySelector("h1,h2");
      return h ? h.textContent.trim().slice(0, 40) : "?";
    });
    const elegido = await p.evaluate(() => {
      const bs = [...document.querySelectorAll("button")].filter((e) => e.offsetParent !== null && !e.disabled);
      const b = bs.find((e) => /continuar|siguiente|confirmar|generar assessment|ver resumen|enviar a compras/i.test(e.textContent));
      if (b) { b.click(); return b.textContent.trim().replace(/\s+/g, " ").slice(0, 34); }
      return null;
    });
    console.log(`  paso "${etiqueta}" -> clic en ${elegido ? JSON.stringify(elegido) : "(nada clicable)"}`);
    if (!elegido) break;
    await p.waitForTimeout(6000);
    if (/lista|resumen/i.test(await p.evaluate(() => document.body.innerText))) break;
  }
  await p.waitForTimeout(2000);
  await estado("final");
  const txt = await p.evaluate(() => document.body.innerText);
  console.log("\npantalla final:", txt.replace(/\n+/g, " | ").slice(0, 400));
  await p.screenshot({ path: "qa/evidencia-piloto/critique-solicitante/VERIF-CTA-ENVIO.png", fullPage: true });
  await b.close();
};
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
