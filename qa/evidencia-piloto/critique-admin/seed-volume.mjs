#!/usr/bin/env node
// Seed de volumen para la auditoría del dashboard admin.
// TODAS las filas que crea llevan el prefijo ZZLOAD- en numero_referencia,
// así el cleanup es quirúrgico y NUNCA toca datos preexistentes.
//
//   node seed-volume.mjs <n>        crea n solicitudes marcadas
//   node seed-volume.mjs --clean    borra SOLO las marcadas
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const env = readFileSync(path.resolve(__dirname, "../../../.env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* sin env */ }

const MARCA = "ZZLOAD-";
const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();

const arg = process.argv[2];

if (arg === "--clean") {
  const r = await pg.query(
    `DELETE FROM solicitud WHERE numero_referencia LIKE $1
       OR solicitante_email LIKE $2
       OR titulo LIKE $3`,
    [`${MARCA}%`, `%${MARCA}%`, `%${MARCA}%`]
  );
  console.log(`cleanup: ${r.rowCount} filas marcadas eliminadas`);
  await pg.end();
  process.exit(0);
}

const n = Number(arg);
const offset = Number(process.argv[3] || 0);
if (!Number.isFinite(n) || n <= 0) {
  console.error("uso: seed-volume.mjs <n> [offset] | --clean");
  process.exit(1);
}

const coords = (await pg.query(`SELECT id FROM usuario WHERE rol='coordinador' LIMIT 4`)).rows.map((r) => r.id);
const estados = ["ENVIADA_A_COMPRAS", "EN_COTIZACION", "COMPARATIVA_LISTA", "ENVIADA_A_SOLICITANTE", "CERRADA_CON_DECISION", "BORRADOR"];
const tipos = ["RFQ", "RFI", "RFP", null];

// Lote_multiples: genera (i, Multiple(n)) en SQL para no traer todo por el cable.
const filas = [];
for (let k = 0; k < n; k++) {
  const i = k + offset;
  const estado = estados[i % estados.length];
  const tipo = tipos[i % tipos.length];
  const cerrada = estado.startsWith("CERRADA");
  const edadDias = (i % 90) + 1;
  const margenDias = (i % 45) + 1;
  filas.push(
    `('${MARCA}${i}', ${tipo ? `'${tipo}'` : "NULL"}, '${estado}',
      'Carga masiva QA ${MARCA} ${i}',
      'prueba de volumen ${i}',
      'qa+${MARCA}@biafoods.co',
      'QA Carga ${MARCA}',
      'Operaciones',
      ${coords.length ? `'${coords[i % coords.length]}'` : "NULL"},
      now() - '${edadDias} days'::interval,
      now() - '${edadDias} days'::interval,
      ${cerrada ? `now() - '${(i % 20) + 1} hours'::interval` : "NULL"},
      now() + '${margenDias} days'::interval)`
  );
}

// Lotes de 500 para no reventar el límite de parámetros ($1 fecha_requerida).
const CHUNK = 500;
for (let i = 0; i < filas.length; i += CHUNK) {
  const lote = filas.slice(i, i + CHUNK);
  await pg.query(
    `INSERT INTO solicitud
      (numero_referencia, tipo, estado, titulo, descripcion, solicitante_email,
       solicitante_nombre, area_solicitante, coordinador_id, fecha_creacion,
       fecha_envio, fecha_cierre, fecha_requerida)
     VALUES ${lote.join(",")}`,
    []
  );
}

const total = await pg.query(`SELECT count(*)::int c FROM solicitud`);
const marcadas = await pg.query(`SELECT count(*)::int c FROM solicitud WHERE numero_referencia LIKE $1`, [`${MARCA}%`]);
console.log(`seed: ${n} creadas · total solicitud=${total.rows[0].c} · marcadas=${marcadas.rows[0].c}`);
await pg.end();
