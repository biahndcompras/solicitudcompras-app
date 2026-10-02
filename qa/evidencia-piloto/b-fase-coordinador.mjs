import { drive } from './drive.mjs';

const QA = { email: 'cmelara@biabrands.co', pass: 'CarlosQA2026!x' };
const PDF = '/Users/ecalderonl/Intelia/compras-1/qa/docs-prueba/cotizacion-merchandise.pdf';

await drive(async ({ page, shot, BASE }) => {
  const R = {};
  const log = (k, v) => { R[k] = v; console.log(`>> ${k}: ${v}`); };

  // ---------- B0 · Login coordinador (Carlos Melara) — tolerante a sesión activa ----------
  await page.goto(`${BASE}/login/coordinador`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  if (await page.getByPlaceholder('usuario@compras.bia.local').count()) {
    await page.getByPlaceholder('usuario@compras.bia.local').fill(QA.email);
    await page.getByPlaceholder('••••••••').fill(QA.pass);
    await page.getByRole('button', { name: /Entrar al panel/i }).click();
  }
  await page.waitForURL(/\/panel/, { timeout: 20000 });
  log('B0-login', 'OK login Carlos Melara → /panel');
  await page.waitForTimeout(1200);

  // buscar la solicitud RFQ-2026-0007
  await page.getByPlaceholder('Buscar por referencia, título o solicitante...').fill('RFQ-2026-0007');
  await page.waitForTimeout(800);
  const panelTxt = await page.locator('main').innerText();
  log('B1-panel', /RFQ-2026-0007/.test(panelTxt) ? 'OK RFQ-2026-0007 visible en el panel' : 'FAIL no aparece en el panel');
  log('B1-indicadores', /Atención|días|gestión|hora|h\b/.test(panelTxt) ? 'OK indicadores de atención/gestión' : 'WARN sin indicadores');
  await shot('B1-panel');
  await page.locator('span[role=link]', { hasText: 'Abrir' }).first().click();
  await page.waitForURL(/\/panel\/solicitud\//, { timeout: 15000 });
  await page.waitForTimeout(1000);
  log('B1-detalle-url', page.url().replace(BASE, ''));
  await shot('B1-detalle');

  // ---------- B2 · Cotización manual ----------
  await page.getByRole('button', { name: /07 · Cotizaciones/ }).click();
  await page.getByRole('button', { name: /Agregar cotización manual/ }).click();
  await page.getByPlaceholder('Ej. Imprenta CostaPrint S. de R.L.').fill('Proveedora Norte S.A.');
  const labels = page.locator('label');
  // moneda HNL por defecto; llenar neto/ISV/total/plazo por su label
  const setCampo = async (lab, val) => {
    const box = labels.filter({ hasText: lab }).first();
    await box.locator('input').fill(val);
  };
  await setCampo('Valor neto', '50000');
  await setCampo('ISV', '7500');
  await setCampo('Total', '57500');
  await setCampo('Plazo de entrega', '15 días');
  await page.getByRole('button', { name: /Guardar cotización/ }).click();
  await page.getByText('Proveedora Norte S.A.').first().waitFor({ timeout: 15000 });
  log('B2-manual-1', 'OK cotización manual "Proveedora Norte S.A." (HNL 57,500 / 15 días)');

  await page.getByRole('button', { name: /Agregar cotización manual/ }).click();
  await page.getByPlaceholder('Ej. Imprenta CostaPrint S. de R.L.').fill('Imprenta CostaPrint S. de R.L.');
  await setCampo('Valor neto', '42000');
  await setCampo('ISV', '0');
  await setCampo('Total', '42000');
  await setCampo('Plazo de entrega', '10 días');
  await page.getByRole('button', { name: /Guardar cotización/ }).click();
  await page.getByText('Imprenta CostaPrint').first().waitFor({ timeout: 15000 });
  log('B2-manual-2', 'OK cotización manual "Imprenta CostaPrint" (HNL 42,000 / 10 días, sin ISV)');
  await shot('B2-cotizaciones');

  // ---------- B3 · Adjuntar PDF + extracción IA ----------
  const fileInputs = page.locator('input[type=file]');
  await fileInputs.nth(1).setInputFiles(PDF);
  log('B3-upload', 'PDF enviado a la cotización CostaPrint, esperando extracción IA…');
  await page.getByText('Con archivo').first().waitFor({ timeout: 90000 });
  log('B3-extraccion', 'OK "Con archivo" — extracción IA terminada');
  const pdfLink = page.locator('a', { hasText: 'PDF' }).first();
  const href = await pdfLink.getAttribute('href');
  const resp = await page.request.get(new URL(href, BASE).href);
  log('B3-descarga', resp.ok() ? `OK PDF original descargable (${resp.headers()['content-type']})` : `FAIL HTTP ${resp.status()}`);
  await shot('B3-pdf-adjunto');

  // ---------- B4 · Comparativa (se genera sola al entrar a la tab) ----------
  await page.getByRole('button', { name: /08 · Comparativa/ }).click();
  const cargando = page.getByText('Generando comparativa');
  if (await cargando.count()) log('B4-generacion', 'en curso ("Generando comparativa…") — esperando IA');
  await cargando.waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(800);
  const comp = await page.locator('main').innerText();
  log('B4-tabla', /valor neto|Valor neto|Proveedor/i.test(comp) && !/Generando comparativa/.test(comp) ? 'OK tabla comparativa generada' : 'FAIL sin tabla');
  log('B4-rn06-isv', /no especifica/i.test(comp) ? 'OK RN-06 "⚠ no especifica" visible' : 'WARN sin marca RN-06');
  log('B4-excel', await page.locator('a,button').filter({ hasText: /excel/i }).count() ? 'OK export Excel presente' : 'WARN sin export Excel');
  await shot('B4-comparativa');

  // ---------- B5+B6+B7 · Recomendación y envío ----------
  await page.getByRole('button', { name: /09 · Recomendación/ }).click();
  await page.waitForTimeout(1500);
  const rec = await page.locator('main').innerText();
  log('B5-ahorro', /Ahorro potencial/i.test(rec) ? 'OK "Ahorro potencial" en pros (2.1/3.2)' : 'WARN sin línea de ahorro');
  const btnEnviar = page.getByRole('button', { name: /Enviar comparativa al solicitante/ });
  const bloqueado = await btnEnviar.isDisabled();
  log('B6-rrn01', bloqueado ? 'OK envío BLOQUEADO sin recomendación (RRN-01)' : 'FAIL envío habilitado sin recomendación');
  await page.getByPlaceholder(/Escribí tu criterio/).fill('Recomiendo la oferta de Imprenta CostaPrint: menor total (HNL 42,000) y mejor plazo (10 días). Confirmar con Proveedora Norte si puede igualar el precio antes de descartarla.');
  await page.waitForTimeout(400);
  const habilitado = !(await btnEnviar.isDisabled());
  log('B6-desbloqueo', habilitado ? 'OK se habilita con recomendación humana' : 'FAIL sigue bloqueado');
  await shot('B6-recomendacion');
  await btnEnviar.click();
  await page.getByText(/Comparativa enviada|ENVIADA_A_SOLICITANTE/i).first().waitFor({ timeout: 30000 });
  const fin = await page.locator('main').innerText();
  log('B7-envio', 'OK "Comparativa enviada"');
  log('B7-correo3', /Correo 3/.test(fin) ? 'OK correo 3 disparado con enlace' : 'WARN sin confirmación de correo 3');
  const token = fin.match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0];
  log('B7-token', token ? `OK token público ${token}` : 'WARN token no visible');
  if (token) {
    const fs = await import('node:fs');
    fs.writeFileSync('/tmp/pw-token.txt', token);
  }
  await shot('B7-enviada');

  console.log('\n===== FASE B COMPLETA =====');
});
