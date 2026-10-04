// Tests de integración del adaptador Postgres contra la base local.
// Requiere DATABASE_URL (PostgreSQL migrado 001–006). Si no está, los tests se omiten.
import { describe, it, expect, beforeAll } from "vitest";
import { PostgresRepositorio } from "./postgres-repo";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb("PostgresRepositorio", () => {
  let repo: PostgresRepositorio;

  beforeAll(() => {
    repo = new PostgresRepositorio();
  });

  it("crea una solicitud en BORRADOR", async () => {
    const s = await repo.crearSolicitud(
      {
        titulo: "Prueba repo",
        solicitanteEmail: "repo.test@bia.hn",
        solicitanteNombre: "Repo Test",
        estado: "BORRADOR",
      },
      { areaSolicitante: "Trade Marketing", descripcion: "test", categoria: "administrativa" }
    );
    expect(s.estado).toBe("BORRADOR");
    expect(s.titulo).toBe("Prueba repo");
    expect(s.fechaCreacion).toBeTruthy();
  });

  it("transiciona a ENVIADA_A_COMPRAS y escribe evento en la misma transacción", async () => {
    const s = await repo.crearSolicitud(
      {
        titulo: "Prueba transición",
        solicitanteEmail: "repo2@bia.hn",
        solicitanteNombre: "Repo Test",
        estado: "BORRADOR",
      },
      { descripcion: "test" }
    );
    const res = await repo.transicionarEstado({
      solicitudId: s.id,
      hacia: "ENVIADA_A_COMPRAS",
      actorTipo: "solicitante",
      actorIdentificador: "repo2@bia.hn",
    });
    expect(res.solicitud.estado).toBe("ENVIADA_A_COMPRAS");
    expect(res.solicitud.fechaEnvio).toBeTruthy();
    expect(res.eventoId).toBeTruthy();
  });

  it("lista por email sin montos", async () => {
    const list = await repo.listarPorEmail("repo2@bia.hn");
    expect(Array.isArray(list)).toBe(true);
    if (list.length) {
      const s = list[0];
      expect(s.titulo).toBe("Prueba transición");
      // no debe exponer campos de cotización/monto
      expect((s as unknown as Record<string, unknown>)["valorTotal"]).toBeUndefined();
    }
  });

  it("guarda y relee config", async () => {
    const tasa = await repo.leerConfig("tasa_isv");
    expect(tasa).not.toBeNull();
  });

  it("lista campos de la plantilla RFQ servicio y RFQ obra y RFP", async () => {
    const rfqServ = await repo.listarCamposDePlantilla("RFQ", "servicio");
    const rfqObra = await repo.listarCamposDePlantilla("RFQ", "mixto");
    const rfp = await repo.listarCamposDePlantilla("RFP", "mixto");
    expect(rfqServ.length).toBeGreaterThan(0);
    const claves = rfqServ.map((c) => c.campoKey);
    expect(claves).toContain("precio_maximo");
    expect(claves).toContain("credito_dias");
    expect(rfqObra.length).toBeGreaterThan(0);
    expect(rfp.length).toBeGreaterThan(0);
  });
});
/**
 * "Ninguna me sirve" NO debe cerrar la solicitud: la devuelve a Compras. Dos cosas se
 * verifican aquí contra la base real, porque las dos se pueden romper sin que nadie lo note:
 *  1. El estado final es EN_COTIZACION, no un terminal.
 *  2. `fecha_cierre` queda en NULL. Antes el UPDATE la ponía siempre; una solicitud reabierta
 *     con fecha de cierre es incoherente y el semáforo de "sin decisión" la cuenta como cerrada.
 */
describeDb("registrarDecisionYCerrar · 'ninguna me sirve' no cierra", () => {
  async function solicitudEnEsperaDeDecision(repo: PostgresRepositorio, email: string) {
    const s = await repo.crearSolicitud(
      { titulo: "Ninguna me sirve", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );
    await repo.transicionarEstado({ solicitudId: s.id, hacia: "ENVIADA_A_COMPRAS", actorTipo: "solicitante", actorIdentificador: email });
    const comparativa = await repo.guardarComparativa(s.id, {
      id: "",
      solicitudId: s.id,
      fechaGeneracion: new Date().toISOString(),
      prosContras: {},
      discrepanciasDetectadas: [],
    });
    await repo.transicionarEstado({ solicitudId: s.id, hacia: "COMPARATIVA_LISTA", actorTipo: "coordinador" });
    await repo.transicionarEstado({ solicitudId: s.id, hacia: "ENVIADA_A_SOLICITANTE", actorTipo: "coordinador", nota: "Recomiendo la A." });
    return { id: s.id, comparativaId: comparativa.id };
  }

  it("con 'ninguna opción' vuelve a EN_COTIZACION y fecha_cierre queda NULL", async () => {
    const repo = new PostgresRepositorio();
    const email = `no.cierra.${Date.now()}@bia.hn`;
    const { id, comparativaId } = await solicitudEnEsperaDeDecision(repo, email);

    await repo.registrarDecisionYCerrar({
      comparativaId,
      solicitudId: id,
      decididoPorEmail: email,
      ningunaOpcion: true,
      comentario: "Ninguna cumple el plazo",
    });

    const tras = await repo.obtenerSolicitud(id);
    expect(tras?.estado).toBe("EN_COTIZACION");
    expect(tras?.fechaCierre ?? null).toBeNull();
  }, 30000);

  it("eligiendo una opción sí cierra y sí fecha_cierre", async () => {
    const repo = new PostgresRepositorio();
    const email = `si.cierra.${Date.now()}@bia.hn`;
    const { id, comparativaId } = await solicitudEnEsperaDeDecision(repo, email);

    await repo.registrarDecisionYCerrar({
      comparativaId,
      solicitudId: id,
      decididoPorEmail: email,
      ningunaOpcion: false,
    });

    const tras = await repo.obtenerSolicitud(id);
    expect(tras?.estado).toBe("CERRADA_CON_DECISION");
    expect(tras?.fechaCierre).toBeTruthy();
  }, 30000);
});
