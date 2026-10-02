// ATAQUE 11 (nuevo) — Bugs que NO estaban en la lista previa,特有的 del código ya arreglado:
//  A11.1 el propio borrador se descarta si el correo difiere en mayúsculas
//  A11.2 un borrador hostil con paso:1 muestra "Tu solicitud fue enviada" (mentira)
//  A11.3 localStorage que lanza (cuota/privado) → la UI sigue diciendo "Borrador activo"
//  A11.4 dos preguntas del assessment con el mismo prefijo de 40 chars → ids duplicados
//  A11.5 "Empezar de cero" borra la identidad que venía en la URL
import { withPage, log, dumpFinal, BASE, entrarComoSolicitante, llenarPaso2 } from './harness.mjs';

const WIZ = (extra = '') =>
  `${BASE}/solicitud/nueva?nuevo=1&email=mj.e2e%40biabrands.co&nombre=Solicitante%20E2E&area=Trade%20Marketing${extra}`;

const sobre = (estado, guardadoEn = Date.now()) => JSON.stringify({ v: 2, guardadoEn, estado });

await withPage(async ({ page, shot }) => {
  /* ---------- A11.1 correo con distinta capitalización ---------- */
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((v) => localStorage.setItem('bia_borrador', v), sobre({
    email: 'MJ.E2E@BIABRANDS.CO', titulo: 'BORRADOR DE MAYUSCULAS', descripcion: 'texto propio', area: 'Trade Marketing', nombre: 'Solicitante E2E',
  }));
  await page.goto(WIZ(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const modal = page.getByRole('button', { name: /Retomar el borrador/i });
  const pidioRetomar = (await modal.count()) > 0;
  if (pidioRetomar) await modal.click();
  await page.waitForTimeout(600);
  const a11 = await page.evaluate(() => ({
    tituloEnPantalla: document.querySelector('#titulo')?.value ?? null,
    pidioRetomar: true,
    // ¿el borrador sigue en localStorage o fue sobrescrito por el estado vacío?
    guardado: (() => {
      try { return JSON.parse(localStorage.getItem('bia_borrador') || 'null')?.estado?.titulo ?? null; } catch { return 'ilegible'; }
    })(),
  }));
  log('A11.1-email-mayusculas', { ...a11, pidioRetomar, tituloEsperado: 'BORRADOR DE MAYUSCULAS' });
  await shot('A11.1-mayusculas');

  /* ---------- A11.2 borrador hostil con paso:1 ---------- */
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((v) => localStorage.setItem('bia_borrador', v), sobre({
    paso: 1, maxAlcanzado: 1, email: 'mj.e2e@biabrands.co', titulo: 'Hostil paso 1', area: 'Trade Marketing', nombre: 'Solicitante E2E',
  }));
  await page.goto(WIZ(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const retomar = page.getByRole('button', { name: /Retomar el borrador/i });
  if (await retomar.count()) await retomar.click();
  await page.waitForTimeout(800);
  const a12 = await page.evaluate(() => ({
    cuerpo: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
    diceEnviada: /Tu solicitud fue enviada/.test(document.body.innerText),
    muestraCaptura: /¿Qué necesitás\?/.test(document.body.innerText),
    h1: document.querySelector('h1')?.innerText ?? null,
  }));
  log('A11.2-paso-1', a12);
  await shot('A11.2-paso1');

  /* ---------- A11.4 ids duplicados en CampoRespuesta ---------- */
  await entrarComoSolicitante(page);
  await llenarPaso2(page, { unico: 'DUP-IDS' });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 40000 });
  await page.waitForTimeout(500);
  // Dos preguntas con el mismo prefijo de 40 caracteres → mismo id派生.
  const PREFIJO = 'Cuántas unidades de este producto alimento';
  await page.route('**/api/ia/assessment', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        preguntas: [
          { campoKey: 'p1', pregunta: `${PREFIJO} exactamente necesita el equipo?`, ejemplo: 'Ej.: 500' },
          { campoKey: 'p2', pregunta: `${PREFIJO} exactement?`, ejemplo: 'Ej.: 500' },
        ],
        camposPlantilla: [],
        contexto_insuficiente: false,
        preguntas_contexto: [],
      }),
    })
  );
  await page.getByRole('button', { name: /Confirmar clasificación/i }).click();
  await page.getByText('Detalles para cotizar').waitFor({ timeout: 40000 });
  await page.waitForTimeout(1200);
  const a14 = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('main section input[type=text]')];
    const ids = inputs.map((i) => i.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    // ¿a dónde lleva el label del segundo?
    const labels = [...document.querySelectorAll('main section label[for]')];
    const apuntaAlPrimero = labels.some((l) => dup.length > 0 && l.htmlFor === dup[0]);
    return { ids, duplicados: [...new Set(dup)], apuntaAlPrimero, totalLabels: labels.length };
  });
  log('A11.4-ids-duplicados', a14);
  await shot('A11.4-dup-ids');
  await page.unroute('**/api/ia/assessment');

  /* ---------- A11.5 "Empezar de cero" borra la identidad de la URL ---------- */
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((v) => localStorage.setItem('bia_borrador', v), sobre({
    email: 'mj.e2e@biabrands.co', titulo: 'Borrador previo', area: 'Trade Marketing', nombre: 'Solicitante E2E', paso: 2,
  }));
  await page.evaluate(() => document.cookie = 'bia_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/');
  await page.goto(WIZ(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const r = page.getByRole('button', { name: /Retomar el borrador/i });
  if (await r.count()) await r.click();
  await page.waitForTimeout(500);
  const empezar = page.getByRole('button', { name: /Empezar de cero/i });
  if (await empezar.count()) await empezar.click();
  await page.waitForTimeout(900);
  const a15 = await page.evaluate(() => ({
    pideIdentidad: /Nos faltan tus datos/.test(document.body.innerText),
    inputNombre: !!document.querySelector('#nombre-identidad'),
    inputArea: !!document.querySelector('#area-identidad'),
    nota: 'la identidad venía en la URL (?email=/?nombre=/?area=) y en la cookie; al descartar se pierde',
  }));
  log('A11.5-empezar-de-cero', a15);
  await shot('A11.5-empezar-de-cero');
});

/* ---------- A11.3 localStorage que lanza (contexto propio: el parche no puede
   contaminar los demás ataques) ---------- */
await withPage(async ({ page, shot }) => {
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'bia_borrador') { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      return orig.call(this, k, v);
    };
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/solicitud/nueva?nuevo=1&email=mj.e2e%40biabrands.co&nombre=Solicitante%20E2E&area=Trade%20Marketing`, { waitUntil: 'domcontentloaded' });
  await page.locator('#titulo').waitFor({ timeout: 20000 });
  await page.locator('#titulo').fill('ESCRIBI SIN ALMACEN');
  await page.waitForTimeout(1500);
  log('A11.3-localStorage-lanza', await page.evaluate(() => {
    const rail = document.querySelector('aside')?.innerText.replace(/\s+/g, ' ') ?? '';
    return {
      diceBorradorActivo: /Borrador activo/.test(rail),
      diceSinGuardar: /Sin guardar/.test(rail),
      avisaNoDeja: /no nos deja guardar/.test(rail),
      diceGuardadoEn: /Guardado en este navegador a las/.test(rail),
    };
  }));
  await shot('A11.3-sin-storage');
});

dumpFinal();
