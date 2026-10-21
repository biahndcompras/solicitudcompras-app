// Higiene de la base de desarrollo (4.10.13).
//
// Problema medido (2026-10-15): la suite de integración escribía en la base local y **nunca
// limpiaba** (`lib/db/postgres-repo.test.ts` no tenía `afterAll`). Quedaron 1.300+ filas de
// prueba, de las cuales **263 con `informacion_pendiente = true`**. Esas filas no son solo
// desorden: el cron de recordatorios y el botón de alertas **las tratan como solicitudes
// reales** y habrían mandado correos por ellas, además de ensuciar los KPIs del administrador.
//
// Cómo se acota el borrado (y por qué es seguro):
//  - El dominio de pruebas es **`@bia.hn`**. El dominio real del cliente es **`@biabrands.co`**
//    (D1 y D8 de `docs/product/propuesta-decisiones-piloto.md`), y las cuentas de staff son
//    `@biafoods.co`.
//  - Verificado contra la base: los 7 usuarios reales son `@biafoods.co` / `@biabrands.co`;
//    **no existe ningún usuario `@bia.hn`**. Ningún test que escribe en la base usa
//    `@biabrands.co` (esos correos solo aparecen como fixtures en tests con todo mockeado).
//  - Si algún día el cliente empezara a usar `@bia.hn`, ESTE ARCHIVO HAY QUE CAMBIARLO: hoy
//    borraría datos reales.
//
// Se registra como `globalSetup`, así corre UNA vez por suite (no por archivo, que sería 58
// veces). `setup()` barre los residuos acumulados y el `teardown` borra los de esta corrida.
import type { TestProject } from "vitest/node";
import { urlDeTests } from "@/lib/db/test-url";

const PATRON = "%@bia.hn";

async function limpiar(client: import("pg").Client) {
  const solicitudesDePrueba = "SELECT id FROM solicitud WHERE solicitante_email LIKE $1";
  const comparativasDePrueba = `SELECT id FROM comparativa WHERE solicitud_id IN (${solicitudesDePrueba})`;

  // El orden importa: la base usa FK NO ACTION, así que hay que borrar de hoja a raíz.
  // `decision` y `link_publico` cuelgan de `comparativa`; `comparativa` cuelga de `cotizacion`;
  // y esas tres cuelgan de `solicitud`. (`respuesta_campo`, `adjunto` y `alerta_inactividad`
  // son CASCADE y caen con la solicitud.)
  for (const [tabla, fk] of [
    ["decision", "comparativa_id"],
    ["link_publico", "comparativa_id"],
  ] as const) {
    await client.query(`DELETE FROM ${tabla} WHERE ${fk} IN (${comparativasDePrueba})`, [PATRON]);
  }
  await client.query(`DELETE FROM comparativa WHERE solicitud_id IN (${solicitudesDePrueba})`, [PATRON]);
  await client.query(`DELETE FROM cotizacion WHERE solicitud_id IN (${solicitudesDePrueba})`, [PATRON]);
  for (const tabla of ["evento_trazabilidad", "documento_generado", "correo_enviado"]) {
    await client.query(`DELETE FROM ${tabla} WHERE solicitud_id IN (${solicitudesDePrueba})`, [PATRON]);
  }
  await client.query("DELETE FROM solicitud WHERE solicitante_email LIKE $1", [PATRON]);

  // Usuarios de prueba (@bia.hn). Pueden estar referenciados desde `configuracion`,
  // `plantilla` o `cotizacion`; si pasa, se avisa en vez de abortar toda la limpieza.
  try {
    await client.query("DELETE FROM usuario WHERE email LIKE $1", [PATRON]);
  } catch (e) {
    console.warn(`[higiene] no se pudieron borrar usuarios de prueba: ${(e as Error).message}`);
  }
}

export async function setup(_project: TestProject) {
  // Nunca contra la base del piloto: solo TEST_DATABASE_URL o una local.
  const DATABASE_URL = urlDeTests() ?? "";
  // Sin base configurada no hay nada que limpiar (los tests de integración se omiten solos).
  if (!DATABASE_URL) return;

  const { Client } = await import("pg");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Barrido inicial: elimina lo que hayan dejado corridas anteriores.
  const previos = await client.query(
    "SELECT count(*)::int AS n FROM solicitud WHERE solicitante_email LIKE $1",
    [PATRON]
  );
  await limpiar(client);
  if (previos.rows[0]?.n) {
    console.log(`[higiene] barridos ${previos.rows[0].n} solicitudes de prueba previas (@bia.hn)`);
  }

  return async () => {
    await limpiar(client);
    await client.end();
  };
}
