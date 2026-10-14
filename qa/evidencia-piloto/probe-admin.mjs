import { drive } from './drive.mjs';

await drive(async ({ page, BASE }) => {
  await page.goto(`${BASE}/login/admin`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  console.log('URL:', page.url());
  const hay = await page.getByPlaceholder('usuario@compras.bia.local').count();
  console.log('form visible:', hay);
  if (hay) {
    await page.getByPlaceholder('usuario@compras.bia.local').fill('admin@biafoods.co');
    await page.getByPlaceholder('••••••••').fill('AdminBIA2026!');
    await page.getByRole('button', { name: /Entrar/i }).click();
    await page.waitForTimeout(3500);
  }
  console.log('URL tras login:', page.url());
  console.log('BODY:', (await page.locator('body').innerText()).slice(0, 1200));
});
