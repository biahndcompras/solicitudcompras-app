import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const EV = '/Users/ecalderonl/Intelia/compras-1/qa/evidencia-piloto';
export const PROFILE = process.env.PROFILE_DIR || '/tmp/pw-bia-profile';

export async function drive(fn, { slowMo = 120 } = {}) {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    slowMo,
    viewport: { width: 1440, height: 900 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(25000);
  const shot = async (name) => page.screenshot({ path: `${EV}/${name}.png`, fullPage: true }).then(() => console.log(`[shot] ${name}.png`));
  const dump = async (label, sel = 'body') => {
    const t = (await page.locator(sel).first().innerText().catch(() => '')).trim();
    console.log(`=== ${label} ===\n${t.slice(0, 3000)}`);
  };
  const controls = async () => {
    console.log('=== CONTROLES ===');
    for (const el of await page.locator('button, a, input, select, textarea, [role=button]').all()) {
      const tag = await el.evaluate((e) => e.tagName.toLowerCase());
      const txt = (await el.innerText().catch(() => '') || await el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ');
      const name = await el.getAttribute('name') || await el.getAttribute('id') || '';
      const type = await el.getAttribute('type') || '';
      const disabled = await el.isDisabled().catch(() => false);
      if (txt || name) console.log(`- <${tag}${type ? ' ' + type : ''}${name ? ' name=' + name : ''}>${disabled ? ' [DISABLED]' : ''} ${txt.slice(0, 70)}`);
    }
  };
  try { await fn({ page, ctx, shot, dump, controls, BASE }); }
  finally { await ctx.close(); }
}
