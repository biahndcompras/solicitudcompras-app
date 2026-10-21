// Plantilla de origen de la solicitud (RF-55, 4.4.1) contra la base local.
//
// El esquema ya tenía `solicitud.plantilla_id` y `plantilla.version`, pero la referencia
// NUNCA se escribía: 0 de 1053 solicitudes la tenían. Como no se registraba, la solicitud
// no podía "conservar su versión de origen" (lo que pide RF-55). Lo que se fija aquí:
//   1. `obtenerPlantillaPara` resuelve la plantilla activa de (tipo, subtipo, categoría).
//   2. Ese id SE PERSISTE al crear la solicitud.
//   3. Y SE LEE de vuelta (el mapper debe exponerlo, no basta con guardarlo).
//   4. Si no hay plantilla para la combinación, queda NULL y la solicitud es válida igual.
//
// Requiere DATABASE_URL. Si no está, se omite.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgresRepositorio } from "./postgres-repo";
import { urlDeTests } from "@/lib/db/test-url";

const DATABASE_URL = urlDeTests() ?? "";
const describeDb = DATABASE_URL ? describe : describe.skip;

const EMAIL = "plantilla-origen-test@bia.hn";

describeDb("plantilla de origen de la solicitud (4.4.1)", () => {
  let repo: PostgresRepositorio;
  const creadas: string[] = [];

  beforeAll(async () => {
    repo = new PostgresRepositorio();
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
  });

  async function limpiar() {
    const { Client } = await import("pg");
    const c = new Client({ connectionString: DATABASE_URL });
    await c.connect();
    // `crearSolicitud` inserta el evento `creacion` en la misma transacción, y
    // `evento_trazabilidad.solicitud_id` es NO ACTION: hay que borrar los hijos antes que
    // el padre. (respuesta_campo, adjunto y alerta_inactividad sí son CASCADE.)
    await c.query(
      "DELETE FROM evento_trazabilidad WHERE solicitud_id IN (SELECT id FROM solicitud WHERE solicitante_email = $1)",
      [EMAIL]
    );
    await c.query("DELETE FROM solicitud WHERE solicitante_email = $1", [EMAIL]);
    await c.end();
  }

  it("resuelve la plantilla activa que corresponde al tipo y subtipo", async () => {
    const plantilla = await repo.obtenerPlantillaPara("RFQ", "servicio");
    expect(plantilla).not.toBeNull();
    expect(plantilla!.id).toBeTruthy();
    // La versión existe en la tabla `plantilla`; es lo que hace que guardar el id
    // equivalga a guardar la versión de origen.
    expect(typeof plantilla!.version).toBe("number");
    expect(plantilla!.version).toBeGreaterThanOrEqual(1);
  });

  it("guarda la plantilla de origen al crear la solicitud y la devuelve al leerla", async () => {
    const plantilla = await repo.obtenerPlantillaPara("RFQ", "servicio");
    const solicitud = await repo.crearSolicitud(
      {
        titulo: "Prueba de plantilla de origen",
        solicitanteEmail: EMAIL,
        solicitanteNombre: "Prueba",
        estado: "BORRADOR",
      },
      { tipo: "RFQ", subtipo: "servicio", plantillaId: plantilla?.id }
    );
    creadas.push(solicitud.id);

    expect(solicitud.plantillaId).toBe(plantilla!.id);

    // Releer desde la base: el valor no puede perderse en el mapper.
    const releida = await repo.obtenerSolicitud(solicitud.id);
    expect(releida?.plantillaId).toBe(plantilla!.id);
  });

  it("deja la plantilla en NULL si no hay ninguna para la combinación (la solicitud es válida igual)", async () => {
    const plantilla = await repo.obtenerPlantillaPara("RFI", "producto");
    expect(plantilla).toBeNull();

    const solicitud = await repo.crearSolicitud(
      {
        titulo: "Prueba sin plantilla",
        solicitanteEmail: EMAIL,
        solicitanteNombre: "Prueba",
        estado: "BORRADOR",
      },
      { tipo: "RFI", subtipo: "producto", plantillaId: plantilla?.id }
    );
    creadas.push(solicitud.id);

    expect(solicitud.plantillaId).toBeUndefined();
  });
});
