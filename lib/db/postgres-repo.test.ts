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

describeDb("preguntas al solicitante (spec 010) · el ciclo se repite", () => {
  const PREGUNTAS = [{ campoKey: "materiales", pregunta: "¿De qué material?" }];

  async function solicitudViva(email: string) {
    const repo = new PostgresRepositorio();
    const s = await repo.crearSolicitud(
      { titulo: "Preguntas", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );
    await repo.transicionarEstado({
      solicitudId: s.id,
      hacia: "ENVIADA_A_COMPRAS",
      actorTipo: "solicitante",
      actorIdentificador: email,
    });
    return { repo, id: s.id };
  }

  it("pedir información NO cambia el estado y deja la ronda abierta", async () => {
    const { repo, id } = await solicitudViva(`preguntas.${Date.now()}@bia.hn`);

    const r = await repo.pedirInformacion({ solicitudId: id, preguntas: PREGUNTAS, pedidaPor: "c@b.co" });

    expect(r.ronda).toBe(1);
    const tras = await repo.obtenerSolicitud(id);
    // El estado intacto es el punto de todo el diseño: los filtros de la bandeja y los KPI
    // no deben enterarse de que hay una ronda abierta.
    expect(tras?.estado).toBe("ENVIADA_A_COMPRAS");
    expect(tras?.informacionPendiente).toBe(true);
    expect(tras?.informacionPreguntas?.preguntas).toHaveLength(1);
    expect(tras?.informacionDesde).toBeTruthy();
  });

  it("responder limpia la bandera y guarda las respuestas con su ronda", async () => {
    const { repo, id } = await solicitudViva(`respuesta.${Date.now()}@bia.hn`);
    await repo.pedirInformacion({ solicitudId: id, preguntas: PREGUNTAS });

    const r = await repo.responderInformacion({ solicitudId: id, respuestas: { materiales: "Acero" } });

    expect(r.yaRespondida).toBe(false);
    const tras = await repo.obtenerSolicitud(id);
    expect(tras?.informacionPendiente).toBe(false);
    expect(tras?.informacionRespuesta?.respuestas.materiales).toBe("Acero");
    expect(tras?.informacionRespuesta?.ronda).toBe(1);
    expect(tras?.estado).toBe("ENVIADA_A_COMPRAS");
  });

  it("responder dos veces no duplica: la segunda es no-op", async () => {
    const { repo, id } = await solicitudViva(`doble.${Date.now()}@bia.hn`);
    await repo.pedirInformacion({ solicitudId: id, preguntas: PREGUNTAS });
    await repo.responderInformacion({ solicitudId: id, respuestas: { materiales: "Acero" } });

    const segunda = await repo.responderInformacion({ solicitudId: id, respuestas: { materiales: "Otro" } });

    expect(segunda.yaRespondida).toBe(true);
    const tras = await repo.obtenerSolicitud(id);
    expect(tras?.informacionRespuesta?.respuestas.materiales).toBe("Acero");
  });

  it("no admite dos rondas abiertas a la vez", async () => {
    const { repo, id } = await solicitudViva(`paralelo.${Date.now()}@bia.hn`);
    await repo.pedirInformacion({ solicitudId: id, preguntas: PREGUNTAS });

    await expect(repo.pedirInformacion({ solicitudId: id, preguntas: PREGUNTAS })).rejects.toThrow(/Ya hay una ronda/);
  });

  it("la segunda ronda se numera 2 y el ciclo continúa", async () => {
    const { repo, id } = await solicitudViva(`rondas.${Date.now()}@bia.hn`);
    await repo.pedirInformacion({ solicitudId: id, preguntas: PREGUNTAS });
    await repo.responderInformacion({ solicitudId: id, respuestas: { materiales: "Acero" } });

    const segunda = await repo.pedirInformacion({
      solicitudId: id,
      preguntas: [{ campoKey: "plazo_entrega", pregunta: "¿Para cuándo?" }],
    });

    expect(segunda.ronda).toBe(2);
    const tras = await repo.obtenerSolicitud(id);
    expect(tras?.informacionPreguntas?.ronda).toBe(2);
  });

  it("una solicitud cerrada no admite preguntas", async () => {
    const repo = new PostgresRepositorio();
    const email = `cerrada.${Date.now()}@bia.hn`;
    const { id } = await solicitudViva(email);
    await repo.transicionarEstado({ solicitudId: id, hacia: "CANCELADA", actorTipo: "admin", nota: "prueba" });

    await expect(repo.pedirInformacion({ solicitudId: id, preguntas: PREGUNTAS })).rejects.toThrow(/cerrada/);
  });

  it("informacionVencida solo ve las que superan el umbral", async () => {
    const { repo, id } = await solicitudViva(`vencida.${Date.now()}@bia.hn`);
    await repo.pedirInformacion({ solicitudId: id, preguntas: PREGUNTAS });

    // Recién pedida: con umbral de 3 días todavía no aparece.
    expect((await repo.informacionVencida(3)).some((v) => v.solicitud.id === id)).toBe(false);
    // Y el umbral 0 la trae, que es la prueba de que la consulta filtra bien.
    const vencidas = await repo.informacionVencida(0);
    const mia = vencidas.find((v) => v.solicitud.id === id);
    expect(mia?.ronda).toBe(1);
  }, 30000);
});
