import { drive } from './drive.mjs';

await drive(async ({ page, shot, dump, BASE }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  console.log('=== INPUTS ===');
  console.log(await page.locator('input, select, textarea').evaluateAll((els) =>
    els.map((e) => {
      const outer = e.parentElement?.parentElement?.outerHTML?.slice(0, 400) || e.outerHTML.slice(0, 400);
      return `TAG=${e.tagName} type=${e.type} name=${e.name} id=${e.id} placeholder=${e.placeholder}\n  ctx: ${outer.replace(/\s+/g, ' ')}\n`;
    }).join('\n')
  ));
  await dump('FORMS');
  console.log(await page.locator('form').evaluateAll((els) => els.map((e) => e.outerHTML.slice(0, 2000).replace(/\s+/g, ' ')).join('\n---\n') || '(sin form)'));
});
