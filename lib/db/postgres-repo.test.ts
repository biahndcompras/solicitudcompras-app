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
    // El paso por EN_COTIZACION no es decorativo: la máquina de estados NO permite saltar de
    // ENVIADA_A_COMPRAS a COMPARATIVA_LISTA (esa es la transición que valida el repo, 4.10.5).
    // Es el mismo camino que sigue la ruta HTTP de comparativa: primero EN_COTIZACION, luego
    // COMPARATIVA_LISTA. Este helper lo saltaba y por eso quedaba probando una transición inválida.
    await repo.transicionarEstado({ solicitudId: s.id, hacia: "EN_COTIZACION", actorTipo: "coordinador" });
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

describeDb("registro de respuestas del solicitante (spec 010, D4)", () => {
  it("la respuesta queda como valor del campo y el evento la distingue de una edición de Compras", async () => {
    const repo = new PostgresRepositorio();
    const email = `campos.${Date.now()}@bia.hn`;
    const s = await repo.crearSolicitud(
      { titulo: "Campos", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );
    await repo.transicionarEstado({ solicitudId: s.id, hacia: "ENVIADA_A_COMPRAS", actorTipo: "solicitante", actorIdentificador: email });

    // `materiales` existe en el catálogo semilla, así que la respuesta tiene dónde escribirse.
    await repo.pedirInformacion({
      solicitudId: s.id,
      preguntas: [{ campoKey: "materiales", pregunta: "¿De qué material?" }],
    });
    await repo.responderInformacion({ solicitudId: s.id, respuestas: { materiales: "Acero inoxidable" }, respondidoPor: email });

    const campos = await repo.listarRespuestas(s.id);
    const material = campos.find((c) => c.campoKey === "materiales");
    expect(material?.valor).toBe("Acero inoxidable");

    // La trazabilidad deja ver que fue el solicitante y en qué ronda, no una edición de Compras.
    const eventos = await repo.listarEventos(s.id);
    const resp = eventos.find((e) => e.tipoEvento === "respuesta_solicitante");
    expect(resp).toBeTruthy();
    expect(resp?.actorTipo).toBe("solicitante");
    expect(resp?.nota).toMatch(/Ronda 1/);
  }, 30000);
});

describeDb("recordatorio de información vencida (spec 010, RF-62)", () => {
  // La antigüedad se simula con SQL directo en vez de con un método del repo: un método de
  // producción que solo existe para los tests es superficie que nadie más va a usar y que
  // hay que mantener.
  async function retroceder(id: string, dias: number) {
    const { Client } = await import("pg");
    const c = new Client({ connectionString: DATABASE_URL });
    await c.connect();
    await c.query("UPDATE solicitud SET informacion_desde = now() - make_interval(days => $2) WHERE id = $1", [id, dias]);
    await c.end();
  }

  async function conRonda(email: string, diasAtras: number) {
    const repo = new PostgresRepositorio();
    const s = await repo.crearSolicitud(
      { titulo: "R", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );
    await repo.transicionarEstado({ solicitudId: s.id, hacia: "ENVIADA_A_COMPRAS", actorTipo: "solicitante", actorIdentificador: email });
    await repo.pedirInformacion({ solicitudId: s.id, preguntas: [{ campoKey: "materiales", pregunta: "¿Material?" }] });
    // Se retrocede la fecha para simular antigüedad sin esperar 3 días reales.
    await retroceder(s.id, diasAtras);
    return { repo, id: s.id };
  }

  it("una ronda reciente NO aparece; una vieja sí", async () => {
    const { repo, id } = await conRonda(`reciente.${Date.now()}@bia.hn`, 1);
    expect((await repo.informacionVencida(3)).some((v) => v.solicitud.id === id)).toBe(false);

    await retroceder(id, 4);
    const vencidas = await repo.informacionVencida(3);
    const mia = vencidas.find((v) => v.solicitud.id === id);
    expect(mia).toBeTruthy();
    expect(mia?.dias).toBeGreaterThanOrEqual(3);
    expect(mia?.ronda).toBe(1);
  }, 30000);

  it("marcar el recordatorio la saca de la lista: no se repite todos los días", async () => {
    const { repo, id } = await conRonda(`marcada.${Date.now()}@bia.hn`, 5);
    const vencida = (await repo.informacionVencida(3)).find((v) => v.solicitud.id === id);
    expect(vencida).toBeTruthy();

    await repo.marcarRecordatorioInformacion(id, vencida!.ronda);

    expect((await repo.informacionVencida(3)).some((v) => v.solicitud.id === id)).toBe(false);
  }, 30000);

  it("una ronda NUEVA vuelve a armar el recordatorio", async () => {
    const { repo, id } = await conRonda(`rearma.${Date.now()}@bia.hn`, 5);
    const primera = (await repo.informacionVencida(3)).find((v) => v.solicitud.id === id)!;
    await repo.marcarRecordatorioInformacion(id, primera.ronda);
    await repo.responderInformacion({ solicitudId: id, respuestas: { materiales: "Acero" } });

    // Ronda 2: pedida y envejecida.
    await repo.pedirInformacion({ solicitudId: id, preguntas: [{ campoKey: "materiales", pregunta: "¿Otra vez?" }] });
    await retroceder(id, 5);

    const segunda = (await repo.informacionVencida(3)).find((v) => v.solicitud.id === id);
    expect(segunda?.ronda).toBe(2);
  }, 30000);
});

describeDb("el solicitante solo puede responder lo que le preguntaron", () => {
  it("descarta una respuesta a un campo que la ronda no pregunto", async () => {
    const repo = new PostgresRepositorio();
    const email = `solo-preguntado.${Date.now()}@bia.hn`;
    const s = await repo.crearSolicitud(
      { titulo: "Solo lo preguntado", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );
    await repo.transicionarEstado({ solicitudId: s.id, hacia: "ENVIADA_A_COMPRAS", actorTipo: "solicitante", actorIdentificador: email });
    await repo.pedirInformacion({
      solicitudId: s.id,
      preguntas: [{ campoKey: "color_acabado", pregunta: "¿Qué color?" }],
    });

    // La ronda preguntó por color; esto intenta escribir un campo que Compras no pidió, y que
    // igual termina en el RFQ de los proveedores.
    const r = await repo.responderInformacion({
      solicitudId: s.id,
      respuestas: { color_acabado: "Gris", plazo_entrega: "entrega inmediata garantizada" },
    });

    expect(r.yaRespondida).toBe(false);
    const tras = await repo.obtenerSolicitud(s.id);
    // La válida pasa…
    expect(tras?.informacionRespuesta?.respuestas.color_acabado).toBe("Gris");
    // …y la que nadie pidió no queda ni en la ronda ni en el campo.
    expect(tras?.informacionRespuesta?.respuestas.plazo_entrega).toBeUndefined();
    const campos = await repo.listarRespuestas(s.id);
    expect(campos.find((c) => c.campoKey === "plazo_entrega")).toBeUndefined();
  }, 30000);
});

describeDb("tasa de ISV desde configuración (doc 16 §2.4)", () => {
  it("lee la tasa vigente en vez de un 15% cableado", async () => {
    const repo = new PostgresRepositorio();
    const original = await repo.leerConfig("tasa_isv");
    try {
      await repo.guardarConfig("tasa_isv", 0.18);
      expect(await repo.tasaIsv()).toBe(0.18);

      await repo.guardarConfig("tasa_isv", 0.15);
      expect(await repo.tasaIsv()).toBe(0.15);
    } finally {
      await repo.guardarConfig("tasa_isv", original ?? 0.15);
    }
  }, 30000);

  it("una tasa inválida cae al respaldo, no rompe la validación fiscal", async () => {
    const repo = new PostgresRepositorio();
    const original = await repo.leerConfig("tasa_isv");
    try {
      await repo.guardarConfig("tasa_isv", 15); // 15 en vez de 0.15: error humano típico
      expect(await repo.tasaIsv()).toBe(0.15);
      await repo.guardarConfig("tasa_isv", "no-es-un-numero");
      expect(await repo.tasaIsv()).toBe(0.15);
    } finally {
      await repo.guardarConfig("tasa_isv", original ?? 0.15);
    }
  }, 30000);
});

describeDb("las respuestas del wizard se persisten como campos (4.5.6)", () => {
  it("guardarRespuestasPorClave resuelve la etiqueta del catálogo y omite claves inventadas", async () => {
    const repo = new PostgresRepositorio();
    const email = `wizard.${Date.now()}@bia.hn`;
    const s = await repo.crearSolicitud(
      { titulo: "Wizard", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );

    await repo.guardarRespuestasPorClave(s.id, {
      cantidad: "45 galones",
      plazo_entrega: "2026-11-15",
      campo_que_no_existe: "x",
    });

    const campos = await repo.listarRespuestas(s.id);
    const porClave = Object.fromEntries(campos.map((c) => [c.campoKey, c.valor]));
    expect(porClave.cantidad).toBe("45 galones");
    expect(porClave.plazo_entrega).toBe("2026-11-15");
    // Una clave fuera del catálogo no crea una fila huérfana.
    expect(porClave.campo_que_no_existe).toBeUndefined();

    // La etiqueta viene del catálogo, no del campoKey crudo.
    expect(campos.find((c) => c.campoKey === "cantidad")?.campoLabel).toBeTruthy();
  }, 30000);

  it("volver a guardar el mismo campo lo actualiza, no lo duplica", async () => {
    const repo = new PostgresRepositorio();
    const email = `wizard2.${Date.now()}@bia.hn`;
    const s = await repo.crearSolicitud(
      { titulo: "Wizard2", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );

    await repo.guardarRespuestasPorClave(s.id, { cantidad: "10" });
    await repo.guardarRespuestasPorClave(s.id, { cantidad: "45 galones" });

    const campos = (await repo.listarRespuestas(s.id)).filter((c) => c.campoKey === "cantidad");
    expect(campos).toHaveLength(1);
    expect(campos[0].valor).toBe("45 galones");
  }, 30000);
});

/**
 * 4.10.3 — La UI renderiza `creacion`, `carga_cotizacion`, `generacion_comparativa`,
 * `envio_correo` y `acceso_link`, pero nadie los insertaba: la línea de tiempo salía vacía
 * de los hitos que el usuario espera ver. Estos tests atan cada tipo de evento a su punto de
 * inserción en el repo, para que ese hueco no vuelva.
 */
describeDb("trazabilidad: los eventos que la UI muestra se insertan (4.10.3)", () => {
  async function nuevaSolicitud(repo: PostgresRepositorio, email: string) {
    return repo.crearSolicitud(
      { titulo: "Trazable", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );
  }

  it("crear la solicitud deja un evento 'creacion'", async () => {
    const repo = new PostgresRepositorio();
    const s = await nuevaSolicitud(repo, `traza-creacion.${Date.now()}@bia.hn`);

    const eventos = await repo.listarEventos(s.id);
    expect(eventos.some((e) => e.tipoEvento === "creacion")).toBe(true);
  }, 30000);

  it("guardar una cotización deja un evento 'carga_cotizacion'", async () => {
    const repo = new PostgresRepositorio();
    const s = await nuevaSolicitud(repo, `traza-cotizacion.${Date.now()}@bia.hn`);

    await repo.guardarCotizacion({
      solicitudId: s.id,
      proveedorNombre: "Proveedor A",
      formatoOriginal: "manual",
      especificacionesOfertadas: {},
      confianzaExtraccion: {},
      editadaManualmente: false,
      fechaCarga: new Date().toISOString(),
    });

    const eventos = await repo.listarEventos(s.id);
    expect(eventos.some((e) => e.tipoEvento === "carga_cotizacion")).toBe(true);
  }, 30000);

  it("guardar la comparativa deja un evento 'generacion_comparativa'", async () => {
    const repo = new PostgresRepositorio();
    const s = await nuevaSolicitud(repo, `traza-comparativa.${Date.now()}@bia.hn`);

    await repo.guardarComparativa(s.id, {
      id: "",
      solicitudId: s.id,
      fechaGeneracion: new Date().toISOString(),
      prosContras: {},
      discrepanciasDetectadas: [],
    });

    const eventos = await repo.listarEventos(s.id);
    expect(eventos.some((e) => e.tipoEvento === "generacion_comparativa")).toBe(true);
  }, 30000);

  it("regenerar/actualizar la comparativa NO duplica el hito 'generacion_comparativa'", async () => {
    const repo = new PostgresRepositorio();
    const s = await nuevaSolicitud(repo, `traza-comparativa-2.${Date.now()}@bia.hn`);
    const base = {
      id: "",
      solicitudId: s.id,
      fechaGeneracion: new Date().toISOString(),
      prosContras: {},
      discrepanciasDetectadas: [],
    };

    await repo.guardarComparativa(s.id, base);
    // La descarga de Excel (ruta fuera de alcance) vuelve a llamar guardarComparativa: es un
    // upsert, no una nueva generación, y no debe escribir otro hito.
    await repo.guardarComparativa(s.id, { ...base, sugerenciaIA: "regenerada" });

    const hitos = (await repo.listarEventos(s.id)).filter((e) => e.tipoEvento === "generacion_comparativa");
    expect(hitos).toHaveLength(1);
  }, 30000);

  it("registrar un correo enviado deja un evento 'envio_correo'", async () => {
    const repo = new PostgresRepositorio();
    const s = await nuevaSolicitud(repo, `traza-correo.${Date.now()}@bia.hn`);

    await repo.registrarCorreo({
      solicitudId: s.id,
      tipoCorreo: "1",
      destinatario: "compras@bia.hn",
      estadoEnvio: "enviado",
    });

    const eventos = await repo.listarEventos(s.id);
    expect(eventos.some((e) => e.tipoEvento === "envio_correo")).toBe(true);
  }, 30000);

  it("un correo fallido NO se muestra como 'envio_correo'", async () => {
    const repo = new PostgresRepositorio();
    const s = await nuevaSolicitud(repo, `traza-correo-fallido.${Date.now()}@bia.hn`);

    await repo.registrarCorreo({
      solicitudId: s.id,
      tipoCorreo: "1",
      destinatario: "compras@bia.hn",
      estadoEnvio: "fallido",
      errorDetalle: "timeout del proveedor",
    });

    const eventos = await repo.listarEventos(s.id);
    // Decir "correo enviado" cuando falló sería mentir en la trazabilidad; el fallo vive en correo_enviado.
    expect(eventos.some((e) => e.tipoEvento === "envio_correo")).toBe(false);
  }, 30000);

  it("el alta idempotente no duplica la solicitud ni el evento 'creacion'", async () => {
    const repo = new PostgresRepositorio();
    const email = `traza-idem.${Date.now()}@bia.hn`;
    const clave = "clave-idem-traza-1234";
    const datos = { titulo: "Idem", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" as const };
    const opciones = { descripcion: "d", categoria: "administrativa", idempotencyKey: clave };

    const s1 = await repo.crearSolicitud(datos, opciones);
    const s2 = await repo.crearSolicitud(datos, opciones);

    expect(s2.id).toBe(s1.id);
    const creaciones = (await repo.listarEventos(s1.id)).filter((e) => e.tipoEvento === "creacion");
    expect(creaciones).toHaveLength(1);
  }, 30000);

  it("registrar un acceso al enlace deja un evento 'acceso_link'", async () => {
    const repo = new PostgresRepositorio();
    const s = await nuevaSolicitud(repo, `traza-acceso.${Date.now()}@bia.hn`);
    const comparativa = await repo.guardarComparativa(s.id, {
      id: "",
      solicitudId: s.id,
      fechaGeneracion: new Date().toISOString(),
      prosContras: {},
      discrepanciasDetectadas: [],
    });
    const link = await repo.crearLinkPublico(comparativa.id, `tok-${Date.now()}`);

    await repo.registrarAccesoLink(link.token);

    const eventos = await repo.listarEventos(s.id);
    expect(eventos.some((e) => e.tipoEvento === "acceso_link")).toBe(true);
  }, 30000);
});

/**
 * 4.10.5 — La máquina de estados se validaba SOLO en la ruta HTTP. El repo es el último
 * guardián: cualquier endpoint que lo llame directo podía saltar estados. Aquí no se prueba
 * "el happy path" — se prueba que una transición prohibida se rechaza y NO muta la solicitud.
 */
describeDb("transicionarEstado valida la máquina de estados (4.10.5)", () => {
  it("rechaza saltar estados y no deja la solicitud a medio camino", async () => {
    const repo = new PostgresRepositorio();
    const s = await repo.crearSolicitud(
      { titulo: "No salta", solicitanteEmail: `salto.${Date.now()}@bia.hn`, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );

    // BORRADOR → COMPARATIVA_LISTA no existe en la máquina.
    await expect(
      repo.transicionarEstado({ solicitudId: s.id, hacia: "COMPARATIVA_LISTA", actorTipo: "coordinador" })
    ).rejects.toThrow(/Transición inválida/);

    expect((await repo.obtenerSolicitud(s.id))?.estado).toBe("BORRADOR");
  }, 30000);

  it("una solicitud terminal (cancelada) no admite ninguna transición", async () => {
    const repo = new PostgresRepositorio();
    const s = await repo.crearSolicitud(
      { titulo: "Terminal", solicitanteEmail: `terminal.${Date.now()}@bia.hn`, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );
    await repo.transicionarEstado({ solicitudId: s.id, hacia: "CANCELADA", actorTipo: "admin" });

    await expect(
      repo.transicionarEstado({ solicitudId: s.id, hacia: "ENVIADA_A_COMPRAS", actorTipo: "admin" })
    ).rejects.toThrow(/Transición inválida/);

    expect((await repo.obtenerSolicitud(s.id))?.estado).toBe("CANCELADA");
  }, 30000);
});

/**
 * 4.7.7 / RN-04 — La columna `clasificacion_corregida` existía desde la migración 004 y el
 * mapeo de lectura la exponía, pero el INSERT nunca la escribía: toda solicitud nacía con el
 * DEFAULT false, así que la precisión del clasificador (doc 16) era incalculable. Aquí se ata
 * la escritura al INSERT (mismo statement que el evento `creacion`).
 */
describeDb("crearSolicitud persiste la corrección de clasificación (4.7.7)", () => {
  it("guarda clasificacionCorregida=true y lo relee de la fila", async () => {
    const repo = new PostgresRepositorio();
    const s = await repo.crearSolicitud(
      { titulo: "Corregida", solicitanteEmail: `corregida.${Date.now()}@bia.hn`, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa", tipo: "RFQ", clasificacionCorregida: true }
    );

    expect(s.clasificacionCorregida).toBe(true);
    // Y persiste tras releer, no solo en el RETURNING del INSERT.
    expect((await repo.obtenerSolicitud(s.id))?.clasificacionCorregida).toBe(true);
  }, 30000);

  it("una solicitud sin corrección queda en false por defecto", async () => {
    const repo = new PostgresRepositorio();
    const s = await repo.crearSolicitud(
      { titulo: "Sin corregir", solicitanteEmail: `sincorregir.${Date.now()}@bia.hn`, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa", tipo: "RFQ" }
    );

    expect(s.clasificacionCorregida).toBe(false);
  }, 30000);

  it("el alta idempotente conserva el valor de clasificacionCorregida de la fila existente", async () => {
    const repo = new PostgresRepositorio();
    const email = `corregida-idem.${Date.now()}@bia.hn`;
    const clave = "clave-corregida-idem-1234";
    const datos = { titulo: "Idem corregida", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" as const };

    const s1 = await repo.crearSolicitud(datos, { descripcion: "d", categoria: "administrativa", clasificacionCorregida: true, idempotencyKey: clave });
    // Un reintento con otra clasificación NO reescribe la fila ya creada: devuelve la original.
    const s2 = await repo.crearSolicitud(datos, { descripcion: "d", categoria: "administrativa", clasificacionCorregida: false, idempotencyKey: clave });

    expect(s2.id).toBe(s1.id);
    expect(s2.clasificacionCorregida).toBe(true);
  }, 30000);
});

/**
 * 4.11.7 — El marcador que impide reenviar el correo 5 en cada clic de "Ejecutar alertas".
 * Se prueba contra la base real porque lo que importa es que el timestamp sobreviva el
 * round-trip a Postgres (precisión) y que el upsert re-arme el aviso con un movimiento nuevo.
 */
describeDb("marcador de la alerta de inactividad (4.11.7)", () => {
  async function nueva(email: string) {
    const repo = new PostgresRepositorio();
    const s = await repo.crearSolicitud(
      { titulo: "Inactividad", solicitanteEmail: email, solicitanteNombre: "T", estado: "BORRADOR" },
      { descripcion: "d", categoria: "administrativa" }
    );
    return { repo, id: s.id };
  }

  it("sin aviso previo no hay marca", async () => {
    const { repo, id } = await nueva(`sin-aviso.${Date.now()}@bia.hn`);
    expect((await repo.alertasInactividadAvisadas())[id]).toBeUndefined();
  }, 30000);

  it("guarda el movimiento avisado y lo relee igual", async () => {
    const { repo, id } = await nueva(`marca.${Date.now()}@bia.hn`);
    const movimiento = new Date("2026-09-01T10:00:00Z").getTime();

    await repo.marcarAlertaInactividad(id, movimiento);

    expect((await repo.alertasInactividadAvisadas())[id]).toBe(movimiento);
  }, 30000);

  it("un movimiento posterior actualiza la marca (re-arma el aviso)", async () => {
    const { repo, id } = await nueva(`rearma.${Date.now()}@bia.hn`);
    await repo.marcarAlertaInactividad(id, 1000);
    await repo.marcarAlertaInactividad(id, 2000);

    expect((await repo.alertasInactividadAvisadas())[id]).toBe(2000);
  }, 30000);
});
