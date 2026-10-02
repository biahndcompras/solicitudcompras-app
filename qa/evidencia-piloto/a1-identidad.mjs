import { drive } from './drive.mjs';

await drive(async ({ page, shot, dump, controls, BASE }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByLabel(/correo/i).first().fill('mj.e2e@biabrands.co');
  await page.getByLabel(/nombre/i).first().fill('Solicitante E2E');
  await page.getByLabel(/área|area|departamento/i).first().fill('Trade Marketing');
  await shot('A1-identidad');
  await page.getByRole('button', { name: /continuar/i }).click();
  await page.waitForLoadState('networkidle');
  await dump('PASO DESCRIPCION');
  await controls();
  await shot('A2-plantilla-descripcion');
});
