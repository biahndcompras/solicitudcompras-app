import { drive } from './drive.mjs';
import fs from 'node:fs';

const ID = fs.readFileSync('/tmp/pw-nueva-id.txt', 'utf8').trim();
const PDF = '/Users/ecalderonl/Intelia/compras-1/qa/docs-prueba/cotizacion-sombrillas.pdf';

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };
  page.on('dialog', (d) => d.accept());

  // ---- H12: Editar datos + fecha (H5/H4) como Carlos Melara ----
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('usuario@compras.bia.local').fill('cmelara@biabrands.co');
  await page.getByPlaceholder('••••••••').fill('CarlosQA2026!x');
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL(/\/panel/, { timeout: 20000 });

  await page.goto(`${BASE}/panel/solicitud/${ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const btnEditar = page.getByRole('button', { name: /^Editar datos$/ });
  log('H12-boton-editar', (await btnEditar.count()) ? 'OK botón "Editar datos" visible' : 'FAIL sin botón');
  await btnEditar.click();
  const inputFecha = page.locator('input[type=date]').first();
  const valFecha = await inputFecha.inputValue();
  log('H12-fecha-input', valFecha === '2026-10-20' ? `OK input date="${valFecha}" (parse robusto)` : `FAIL input date="${valFecha}"`);
  await inputFecha.fill('2026-10-25');
  await page.getByRole('button', { name: /Guardar cambios/ }).click();
  await page.waitForTimeout(2000);
  const cuerpo = await page.locator('main').innerText();
  log('H5-fecha-legible', /25.*oct.*2026|oct.*25.*2026|25 oct/i.test(cuerpo) ? 'OK fecha legible tras guardar (sin "Mon Oct 05…")' : `WARN revisar: ${cuerpo.match(/Fecha requerida.{0,40}/)?.[0]}`);
  await shot('FIX-fecha-editada');

  // ---- H2: logo real vía wizard ----
  await page.context().clearCookies();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/solicitud/nueva?nuevo=1&email=${encodeURIComponent('mj.e2e@biabrands.co')}&nombre=Solicitante%20E2E&area=Trade%20Marketing`, { waitUntil: 'networkidle' });
  await page.locator('#titulo').waitFor({ timeout: 15000 });
  await page.locator('#titulo').fill('Gorra tejida con logo — prueba fixes');
  await page.locator('select').first().selectOption({ label: 'Mercadeo y publicidad' });
  await page.locator('label').filter({ hasText: 'Bien físico' }).click();
  await page.locator('input[type=date]').fill('2026-11-01');
  await page.locator('textarea').first().fill('100 gorras tejidas con logo de marca.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Clasificación de tu solicitud').waitFor({ timeout: 20000 });
  await page.getByText(/Sugerencia IA|No se pudo|confianza/i).first().waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /Confirmar clasificación/ }).click();
  await page.getByText('Detalles para cotizar').waitFor({ timeout: 30000 });

  // H3: si el assessment sigue cargando, el botón debe estar bloqueado con aviso
  const btnDoc = page.getByRole('button', { name: /Generar documento/ });
  await btnDoc.waitFor();
  const cargandoTxt = await page.locator('main').innerText();
  log('H3-aviso-carga', /Preparando preguntas del asistente/.test(cargandoTxt) ? 'OK aviso de carga visible mientras evalúa' : 'INFO sin aviso (assessment ya resuelto o terminó)');

  // H2: subida real de logo
  const fileLogo = page.locator('input[type=file]').first();
  await fileLogo.setInputFiles(PDF);
  await page.waitForTimeout(400);
  const trasLogo = await page.locator('main').innerText();
  log('H2-nombre-real', trasLogo.includes('cotizacion-sombrillas.pdf') ? 'OK nombre real del archivo en el dropzone (no "logo_oficial.svg")' : `FAIL: ${trasLogo.match(/logo.{0,40}/i)?.[0]}`);
  await shot('FIX-logo-real');

  // completar preguntas con "No lo sé" y enviar
  await page.waitForTimeout(4000);
  const nosChecks = page.locator('input[type=checkbox]');
  for (let i = 0; i < await nosChecks.count(); i++) {
    const cb = nosChecks.nth(i);
    if (!(await cb.isChecked())) await cb.check().catch(() => {});
  }
  await btnDoc.click();
  await page.getByText('Tu solicitud está lista').waitFor({ timeout: 30000 });
  const refProv = (await page.locator('main').innerText()).match(/[A-Z]+-\d{4}-[X\d]+/)?.[0];
  log('H1-ref-provisional', refProv && !refProv.includes('014') ? `OK ref provisional "${refProv}" (sin hardcode RFQ-2026-014)` : `WARN ref="${refProv}"`);
  await shot('FIX-resumen');
  const coord = page.locator('button').filter({ hasText: 'Carlos Melara' });
  if (await coord.count()) await coord.first().click();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await page.getByText('Tu solicitud fue enviada').waitFor({ timeout: 45000 });
  const conf = await page.locator('main').innerText();
  const refReal = conf.match(/Referencia:\s*([A-Z]+-\d{4}-\d+)/)?.[1];
  log('H1-ref-real', refReal ? `OK "Referencia: ${refReal}" en la confirmación` : 'FAIL sin referencia real en confirmación');
  await shot('FIX-confirmada');

  console.log('\n===== FIXES VERIFICADOS =====');
});
