// Harness compartido para la QA adversarial del flujo solicitante.
// Perfil limpio siempre (nunca persistente). Chromium 1223 (mobaje documentado).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

export const BASE = process.env.BASE_URL || 'http://localhost:3001';
export const EXEC =
  process.env.CHROME_PATH ||
  '/Users/ecalderonl/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
export const OUT = new URL('./out/', import.meta.url).pathname;

const F = (n) => `${OUT}${n}.png`;
mkdirSync(OUT, { recursive: true });

export const R = {};
export const log = (k, v) => {
  R[k] = v;
  console.log(`>> ${k} :: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
};

export async function withPage(fn, { viewport = { width: 1440, height: 900 }, offline = false } = {}) {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true });
  const ctx = await browser.newContext({ viewport, locale: 'es-HN' });
  if (offline) await ctx.setOffline(true);
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  const shot = (n, full = true) => page.screenshot({ path: F(n), fullPage: full }).then(() => console.log(`   [shot] ${n}`));
  const consola = [];
  page.on('console', (m) => consola.push(`${m.type()}: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => consola.push(`pageerror: ${String(e).slice(0, 200)}`));
  try {
    return await fn({ page, ctx, shot, consola, BASE, browser });
  } finally {
    await ctx.close();
    await browser.close();
  }
}

// Login del solicitante: home -> /solicitud/nueva?nuevo=1
// Nota de método: rellenar antes de la hidratación de React deja el input en el DOM pero
// sin estado; por eso esperamos a que el CTA se habilite (es la prueba de que el estado
// de React registró lo escrito) en vez de hacer click a ciegas.
export async function entrarComoSolicitante(page, { email = 'mj.e2e@biabrands.co' } = {}) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  const ctaHabilitado = () =>
    page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Continuar/.test(x.innerText));
      return !!b && !b.disabled;
    });
  // Bucle: si la escritura cayó antes de la hidratación de React, el estado no registra
  // el input (el DOM lo muestra pero React no lo sabe). Reintentamos hasta que el CTA se
  // habilite, que es la prueba observable de que el estado de React tomó los valores.
  for (let intento = 0; intento < 24; intento++) {
    await page.getByPlaceholder('ejemplo@bia.com').fill(email);
    await page.getByPlaceholder('Juan Pérez').fill('Solicitante E2E');
    await page.getByPlaceholder('Marketing').fill('Trade Marketing');
    await page.waitForTimeout(500);
    if (await ctaHabilitado()) break;
  }
  if (!(await ctaHabilitado())) {
    throw new Error('El CTA de la home nunca se habilitó: la hidratación de React no responde');
  }
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForURL(/\/solicitud\/nueva/, { timeout: 20000 });
}

// Rellena el paso 2 (captura) con datos válidos.
export async function llenarPaso2(page, { unico = '' } = {}) {
  await page.locator('#titulo').waitFor();
  await page.locator('#titulo').fill(unico ? `Sombrillas brandeadas ${unico}` : 'Sombrillas brandeadas — activación playa');
  await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
  await page.locator('label').filter({ hasText: 'Bien físico' }).click();
  await page.locator('input[type=date]').fill('2026-11-05');
  await page
    .locator('textarea')
    .first()
    .fill(
      unico
        ? `${unico} Necesitamos 500 sombrillas con logo de la marca para la activación de playa. Colores corporativos azul y blanco, con(time 1000)`
        : 'Necesitamos 500 sombrillas con logo de la marca para la activación de playa. Colores corporativos azul y blanco.'
    );
}

// Métricas de layout del wizard.
export async function medirWizard(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const aside = document.querySelector('aside');
    const section = document.querySelector('main > section');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        w: Math.round(b.width),
        h: Math.round(b.height),
        top: Math.round(b.top),
        left: Math.round(b.left),
        bottom: Math.round(b.bottom),
        right: Math.round(b.right),
      };
    };
    // CTA primario: último button del section con texto
    const btns = section ? [...section.querySelectorAll('button')] : [];
    const cta = btns.find((b) => /Continuar|Siguiente|Generar documento|Confirmar clasificación|Enviar solicitud/i.test(b.innerText));
    const cb = cta?.getBoundingClientRect();
    const formInner = section?.firstElementChild;
    const h2 = section?.querySelector('h2');
    return {
      vw,
      vh,
      main: r(main),
      aside: r(aside),
      section: r(section),
      sectionScrollH: section?.scrollHeight ?? null,
      sectionClientH: section?.clientHeight ?? null,
      mainOverflow: main ? getComputedStyle(main).overflow : null,
      mainH: main ? Math.round(main.getBoundingClientRect().height) : null,
      cta: cta
        ? {
            texto: cta.innerText.trim().slice(0, 40),
            disabled: cta.disabled,
            w: Math.round(cb.width),
            h: Math.round(cb.height),
            top: Math.round(cb.top),
            bottom: Math.round(cb.bottom),
            visibleEnViewport: cb.bottom <= vh + 0.5 && cb.top >= -0.5,
          }
        : null,
      h2Top: h2 ? Math.round(h2.getBoundingClientRect().top) : null,
      formInnerH: formInner ? Math.round(formInner.getBoundingClientRect().height) : null,
      docScrollW: document.documentElement.scrollWidth,
      docClientW: document.documentElement.clientWidth,
      scrollHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

// Detecta desbordes horizontales y elementos que se salen de su contenedor.
export async function detectarDesbordes(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      if (b.right > vw + 1 || b.left < -1) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 90),
          text: (el.textContent || '').trim().slice(0, 50),
          left: Math.round(b.left),
          right: Math.round(b.right),
        });
      }
    }
    return {
      scrollHorizontal: document.documentElement.scrollWidth > vw + 1,
      scrollW: document.documentElement.scrollWidth,
      clientW: vw,
      culpables: out.slice(0, 14),
    };
  });
}

// Targets tocables < 44px y textos < 12px.
export async function detectarA11y(page) {
  return page.evaluate(() => {
    const small = [];
    const targets = [];
    for (const el of document.querySelectorAll('button, a, input, select, textarea, [role=button], label')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      const texto = (el.innerText || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim();
      const tag = el.tagName.toLowerCase();
      if (!['a', 'button', '[role=button]'].includes(tag) && tag !== 'input') continue;
      if (b.height < 44 || b.width < 44) {
        targets.push({ tag, texto: texto.slice(0, 40), w: Math.round(b.width), h: Math.round(b.height) });
      }
    }
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length > 0) continue;
      const t = (el.textContent || '').trim();
      if (!t) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11) small.push({ text: t.slice(0, 40), fs, tag: el.tagName.toLowerCase() });
    }
    return { targetsPequenos: targets.slice(0, 20), textoMenor11px: small.slice(0, 20) };
  });
}

export function dumpFinal() {
  console.log('\n================ RESUMEN ================');
  console.log(JSON.stringify(R, null, 2));
}
