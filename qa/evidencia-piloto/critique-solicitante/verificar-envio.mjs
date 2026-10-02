import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const EXE =
  "/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const run = async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(String(e).slice(0, 140)));

  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.getByPlaceholder("ejemplo@bia.com").fill("mj.e2e@biabrands.co");
  await p.getByPlaceholder("Juan Pérez").fill("Verificacion Envio");
  await p.getByPlaceholder("Marketing").fill("Trade Marketing");
  await p.getByRole("button", { name: /continuar/i }).first().click();
  await p.waitForTimeout(2500);

  // Paso 2: descripcion
  const MARCA = "VERIFIC-ENVIO-" + Date.now();
  const ta = p.locator("textarea").first();
  await ta.fill(`Necesito 500 unidades de lapiceros corporativos con logo. ${MARCA}`);
  await p.waitForTimeout(1200);
  const btn = p.getByRole("button", { name: /continuar|siguiente/i }).first();
  console.log("paso2 CTA disabled:", await btn.isDisabled());
  await btn.click();
  await p.waitForTimeout(1500);

  //loo que haya: ir avanzando hasta el paso de envio
  for (let i = 0; i < 8; i++) {
    const t = (await p.evaluate(() => document.body.innerText)).slice(0, 200);
    if (/lista|resumen|enviar|Enviar a Compras/i.test(t)) break;
    const b2 = p.getByRole("button", { name: /continuar|siguiente|confirmar|generar/i }).first();
    if (await b2.count() && !(await b2.isDisabled())) {
      await b2.click().catch(() => {});
      await p.waitForTimeout(3500);
    } else break;
  }

  const pantalla = (await p.evaluate(() => document.body.innerText)).slice(0, 300);
  console.log("pantalla final:", JSON.stringify(pantalla.replace(/\n+/g, " | ").slice(0, 200)));

  // Enviar
  const enviar = p.getByRole("button", { name: /enviar|compras/i }).last();
  const t0 = Date.now();
  await enviar.click();
  // esperar exito o error
  let exito = false, error = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1000);
    const txt = await p.evaluate(() => document.body.innerText);
    if (/fue enviada|enviada con|gracias|recibida|referencia/i.test(txt) && !/tard[oó] demasiado/i.test(txt)) { exito = true; break; }
    if (/tard[oó] demasiado|no se pudo|error/i.test(txt)) { error = txt.match(/(tard[oó] demasiado[^|\n]*|no se pudo[^|\n]*|error[^|\n]*)/i)?.[0]; break; }
  }
  const ms = Date.now() - t0;
  console.log("RESULTADO envio:", exito ? "OK" : "FALLO", "| ms:", ms, "| error:", error);
  const ref = (await p.evaluate(() => document.body.innerText.match(/RFQ-\d{4}-\d{4,}/)?.[0])) || null;
  console.log("referencia mostrada:", ref);
  await p.screenshot({ path: "qa/evidencia-piloto/critique-solicitante/VERIF-ENVIO.png", fullPage: true });
  console.log("pageerrors:", errores.length ? JSON.stringify(errores) : "ninguno");
  await b.close();
  process.exit(exito ? 0 : 1);
};
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
