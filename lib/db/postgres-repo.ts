// Adaptador PostgreSQL del Repositorio — Portal de Compras BIA.
// Persistencia sobre el esquema migrado 001–006. Transición de estado + evento en la misma transacción.
import type { Pool } from "pg";
import { pool as obtenerPool } from "./pool";
import type {
  CampoCatalogo,
  Comparativa,
  CorreoEnviado,
  Cotizacion,
  Decision,
  DocumentoGenerado,
  EventoTrazabilidad,
  LinkPublico,
  RespuestaCampo,
  Solicitud,
  Usuario,
} from "@/lib/domain/types";
import type { MetricasDashboard } from "@/lib/domain/metrics";
import type {
  Repositorio,
  TransicionResultado,
  FiltrosMetricas,
} from "./repositorio";

function aISO(v: unknown): string | undefined {
  if (v == null) return undefined;
  return v instanceof Date ? v.toISOString() : String(v);
}

function filaSolicitud(f: Record<string, unknown>): Solicitud {
  return {
    id: String(f.id),
    numeroReferencia: (f.numero_referencia as string) ?? undefined,
    tipo: (f.tipo as Solicitud["tipo"]) ?? undefined,
    subtipo: (f.subtipo as Solicitud["subtipo"]) ?? undefined,
    categoria: (f.categoria as string) ?? undefined,
    estado: f.estado as Solicitud["estado"],
    titulo: String(f.titulo),
    descripcion: (f.descripcion as string) ?? undefined,
    solicitanteEmail: String(f.solicitante_email),
    solicitanteNombre: String(f.solicitante_nombre),
    areaSolicitante: (f.area_solicitante as string) ?? undefined,
    coordinadorId: (f.coordinador_id as string) ?? undefined,
    fechaRequerida: f.fecha_requerida ? String(f.fecha_requerida) : undefined,
    fechaCreacion: aISO(f.fecha_creacion) ?? "",
    fechaEnvio: aISO(f.fecha_envio),
    fechaCierre: aISO(f.fecha_cierre),
    clasificacionConfianza: f.clasificacion_confianza != null ? Number(f.clasificacion_confianza) : undefined,
    clasificacionCorregida: Boolean(f.clasificacion_corregida),
    notificacionFallida: Boolean(f.notificacion_fallida),
  };
}

function mapeoCotizacion(f: Record<string, unknown>): Cotizacion {
  return {
    id: String(f.id),
    solicitudId: String(f.solicitud_id),
    proveedorNombre: String(f.proveedor_nombre),
    proveedorIdentificacionFiscal: (f.proveedor_identificacion_fiscal as string) ?? undefined,
    proveedorContacto: (f.proveedor_contacto as string) ?? undefined,
    formatoOriginal: f.formato_original as Cotizacion["formatoOriginal"],
    valorNeto: f.valor_neto == null ? undefined : Number(f.valor_neto),
    moneda: (f.moneda as string) ?? undefined,
    impuestosDesglosados: f.impuestos_desglosados === null ? undefined : Boolean(f.impuestos_desglosados),
    montoIsv: f.monto_isv == null ? undefined : Number(f.monto_isv),
    montoOtrosImpuestos: f.monto_otros_impuestos == null ? undefined : Number(f.monto_otros_impuestos),
    valorTotal: f.valor_total == null ? undefined : Number(f.valor_total),
    plazoEntrega: (f.plazo_entrega as string) ?? undefined,
    formaPago: (f.forma_pago as string) ?? undefined,
    vigenciaOferta: (f.vigencia_oferta as string) ?? undefined,
    garantia: (f.garantia as string) ?? undefined,
    especificacionesOfertadas: f.especificaciones_ofertadas as Record<string, string>,
    observacionesFiscales: (f.observaciones_fiscales as string) ?? undefined,
    confianzaExtraccion: f.confianza_extraccion as Record<string, number>,
    editadaManualmente: Boolean(f.editada_manualmente),
    fechaCarga: String(f.fecha_carga),
  };
}

export class PostgresRepositorio implements Repositorio {
  private _pg?: Pool;

  constructor(pg?: Pool) {
    if (pg) this._pg = pg;
  }

  // Pool lazy: no se conecta hasta la primera consulta, para no exigir DATABASE_URL
  // al importar el módulo (p. ej. en el build de Vercel).
  private get pg(): Pool {
    if (!this._pg) this._pg = obtenerPool();
    return this._pg;
  }

  async crearSolicitud(
    datos: Parameters<Repositorio["crearSolicitud"]>[0],
    opciones: Parameters<Repositorio["crearSolicitud"]>[1]
  ): Promise<Solicitud> {
    const res = await this.pg.query(
      `INSERT INTO solicitud (titulo, solicitante_email, solicitante_nombre, estado,
         area_solicitante, descripcion, categoria, tipo, subtipo, fecha_requerida)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
         $8::tipo_solicitud, $9::subtipo_solicitud, NULLIF($10,'')::date)
       RETURNING *`,
      [
        datos.titulo,
        datos.solicitanteEmail.toLowerCase(),
        datos.solicitanteNombre,
        datos.estado,
        opciones?.areaSolicitante ?? null,
        opciones?.descripcion ?? null,
        opciones?.categoria ?? null,
        // La clasificación IA del wizard llega como tipo/subtipo; si no hay, quedan NULL
        // (el enum de Postgres rechazaría un valor vacío o inválido).
        opciones?.tipo && ["RFI", "RFQ", "RFP"].includes(opciones.tipo) ? opciones.tipo : null,
        opciones?.subtipo && ["producto", "servicio", "mixto"].includes(opciones.subtipo) ? opciones.subtipo : null,
        opciones?.fechaRequerida ?? null,
      ]
    );
    return filaSolicitud(res.rows[0]);
  }

  async guardarRespuestas(solicitudId: string, respuestas: RespuestaCampo[]): Promise<void> {
    for (const r of respuestas) {
      await this.pg.query(
        `INSERT INTO respuesta_campo (solicitud_id, campo_key, campo_label, valor, valor_numerico, origen)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (solicitud_id, campo_key) DO UPDATE
           SET valor = EXCLUDED.valor, valor_numerico = EXCLUDED.valor_numerico, origen = EXCLUDED.origen`,
        [solicitudId, r.campoKey, r.campoLabel, r.valor ?? null, r.valorNumerico ?? null, r.origen]
      );
    }
  }

  // Genera el número de referencia dentro de la transacción del cambio de estado.
  // Formato desde configuracion.formato_numero_referencia: {{TIPO}}-{{ANIO}}-{{SECUENCIA}}.
  private async generarNumeroReferenciaTx(
    client: { query: (sql: string, vals?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
    tipo: string | undefined
  ): Promise<string> {
    const cfg = await client.query(
      "SELECT valor FROM configuracion WHERE clave = 'formato_numero_referencia'"
    );
    const formatoRaw = cfg.rows[0]?.valor;
    const formato = typeof formatoRaw === "string"
      ? formatoRaw
      : String(formatoRaw ?? "{{TIPO}}-{{ANIO}}-{{SECUENCIA}}");

    const prefijoTipo = (tipo ?? "SOL").toUpperCase();
    const anio = new Date().getFullYear();
    const patron = `^${prefijoTipo}-${anio}-(\\d+)$`;
    const seq = await client.query(
      `SELECT COALESCE(MAX((regexp_match(numero_referencia, $1))[1]::int), 0) + 1 AS siguiente
       FROM solicitud WHERE numero_referencia ~ $1`,
      [patron]
    );
    const secuencia = Number(seq.rows[0]?.siguiente ?? 1);

    return formato
      .replace("{{TIPO}}", prefijoTipo)
      .replace("{{ANIO}}", String(anio))
      .replace("{{SECUENCIA}}", String(secuencia).padStart(4, "0"));
  }

  async transicionarEstado(
    input: Parameters<Repositorio["transicionarEstado"]>[0]
  ): Promise<TransicionResultado> {
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      const sel = await client.query(
        "SELECT * FROM solicitud WHERE id = $1 FOR UPDATE",
        [input.solicitudId]
      );
      if (!sel.rows[0]) throw new Error("Solicitud no encontrada");
      const actual = filaSolicitud(sel.rows[0]);

      // Reglas de transición (cerebro) — se valida contra el estado actual.
      const esTerminal = ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"].includes(
        input.hacia
      );
      const fechaEnv = input.hacia === "ENVIADA_A_COMPRAS" && !actual.fechaEnvio
        ? new Date().toISOString()
        : actual.fechaEnvio;
      const fechaCierre = esTerminal ? new Date().toISOString() : actual.fechaCierre;

      // Número de referencia real: se genera una vez, al primer envío a Compras.
      let numeroReferencia = actual.numeroReferencia ?? null;
      if (input.hacia === "ENVIADA_A_COMPRAS" && !numeroReferencia) {
        numeroReferencia = await this.generarNumeroReferenciaTx(client, actual.tipo);
      }

      const upd = await client.query(
        `UPDATE solicitud
         SET estado = $2,
             fecha_envio = COALESCE($3, fecha_envio),
             fecha_cierre = COALESCE($4, fecha_cierre),
             numero_referencia = COALESCE($5, numero_referencia)
         WHERE id = $1
         RETURNING *`,
        [input.solicitudId, input.hacia, fechaEnv, fechaCierre, numeroReferencia]
      );
      const evento = await client.query(
        `INSERT INTO evento_trazabilidad
           (solicitud_id, tipo_evento, estado_anterior, estado_nuevo, actor_tipo, actor_identificador, nota)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id`,
        [
          input.solicitudId,
          "cambio_estado",
          actual.estado,
          input.hacia,
          input.actorTipo,
          input.actorIdentificador ?? null,
          input.nota ?? null,
        ]
      );
      await client.query("COMMIT");
      return { solicitud: filaSolicitud(upd.rows[0]), eventoId: String(evento.rows[0].id) };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async registrarDecisionYCerrar(input: {
    comparativaId: string;
    solicitudId: string;
    cotizacionSeleccionadaId?: string;
    decididoPorEmail: string;
    ningunaOpcion: boolean;
    comentario?: string;
  }): Promise<void> {
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      const sel = await client.query(
        "SELECT * FROM solicitud WHERE id = $1 FOR UPDATE",
        [input.solicitudId]
      );
      if (!sel.rows[0]) throw new Error("Solicitud no encontrada");
      const actual = filaSolicitud(sel.rows[0]);
      if (actual.estado !== "ENVIADA_A_SOLICITANTE") {
        throw new Error("La solicitud no está en espera de decisión");
      }

      await client.query(
        `INSERT INTO decision (comparativa_id, cotizacion_seleccionada_id, decidido_por_email, ninguna_opcion, comentario)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          input.comparativaId,
          input.ningunaOpcion ? null : input.cotizacionSeleccionadaId ?? null,
          input.decididoPorEmail,
          input.ningunaOpcion,
          input.comentario ?? null,
        ]
      );

      const hacia = input.ningunaOpcion ? "CERRADA_SIN_DECISION" : "CERRADA_CON_DECISION";
      await client.query(
        `UPDATE solicitud SET estado = $2, fecha_cierre = now()
         WHERE id = $1`,
        [input.solicitudId, hacia]
      );
      await client.query(
        `INSERT INTO evento_trazabilidad
           (solicitud_id, tipo_evento, estado_anterior, estado_nuevo, actor_tipo, actor_identificador, nota)
         VALUES ($1,'decision',$2,$3,'solicitante',$4,$5)`,
        [
          input.solicitudId,
          actual.estado,
          hacia,
          input.decididoPorEmail,
          input.ningunaOpcion ? "Ninguna opción seleccionada" : "Decisión por enlace público",
        ]
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async listarCoordinadores(): Promise<Usuario[]> {
    const res = await this.pg.query(
      "SELECT id, nombre, email, rol, categorias_asignadas, activo FROM usuario WHERE rol = 'coordinador' AND activo = true"
    );
    return res.rows.map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      email: String(f.email),
      rol: f.rol,
      categoriasAsignadas: f.categorias_asignadas ?? [],
      activo: Boolean(f.activo),
    }));
  }

  async listarTodas(): Promise<Solicitud[]> {
    const res = await this.pg.query("SELECT * FROM solicitud ORDER BY fecha_creacion DESC");
    return res.rows.map(filaSolicitud);
  }

  async listarPorCoordinador(coordinadorId: string): Promise<Solicitud[]> {
    const res = await this.pg.query(
      "SELECT * FROM solicitud WHERE coordinador_id = $1 ORDER BY fecha_creacion DESC",
      [coordinadorId]
    );
    return res.rows.map(filaSolicitud);
  }

  async asignarCoordinador(solicitudId: string, coordinadorId: string): Promise<void> {
    await this.pg.query(
      "UPDATE solicitud SET coordinador_id = $2 WHERE id = $1",
      [solicitudId, coordinadorId]
    );
  }

  async listarPorEmail(email: string): Promise<Solicitud[]> {
    // Solicitante: solo referencia, título, estado y fechas (sin montos ni email expuesto).
    const res = await this.pg.query(
      `SELECT id, numero_referencia, titulo, estado, fecha_creacion, fecha_cierre,
              tipo, area_solicitante
       FROM solicitud WHERE solicitante_email = $1 ORDER BY fecha_creacion DESC`,
      [email.toLowerCase()]
    );
    return res.rows.map((f) => ({
      id: String(f.id),
      numeroReferencia: f.numero_referencia as string | null ?? undefined,
      titulo: String(f.titulo),
      estado: f.estado as Solicitud["estado"],
      fechaCreacion: String(f.fecha_creacion),
      fechaCierre: f.fecha_cierre ? String(f.fecha_cierre) : undefined,
      tipo: (f.tipo as Solicitud["tipo"]) ?? undefined,
      areaSolicitante: (f.area_solicitante as string) ?? undefined,
    })) as Solicitud[];
  }

  async obtenerSolicitud(id: string): Promise<Solicitud | null> {
    const res = await this.pg.query("SELECT * FROM solicitud WHERE id = $1", [id]);
    return res.rows[0] ? filaSolicitud(res.rows[0]) : null;
  }

  async guardarCotizacion(cotizacion: Omit<Cotizacion, "id">): Promise<Cotizacion> {
    const res = await this.pg.query(
      `INSERT INTO cotizacion
         (solicitud_id, proveedor_nombre, proveedor_identificacion_fiscal, proveedor_contacto,
          formato_original, valor_neto, moneda, impuestos_desglosados, monto_isv,
          monto_otros_impuestos, valor_total, plazo_entrega, forma_pago, vigencia_oferta, garantia,
          especificaciones_ofertadas, observaciones_fiscales, confianza_extraccion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        cotizacion.solicitudId,
        cotizacion.proveedorNombre,
        cotizacion.proveedorIdentificacionFiscal ?? null,
        cotizacion.proveedorContacto ?? null,
        cotizacion.formatoOriginal,
        cotizacion.valorNeto ?? null,
        cotizacion.moneda ?? null,
        cotizacion.impuestosDesglosados ?? null,
        cotizacion.montoIsv ?? null,
        cotizacion.montoOtrosImpuestos ?? null,
        cotizacion.valorTotal ?? null,
        cotizacion.plazoEntrega ?? null,
        cotizacion.formaPago ?? null,
        cotizacion.vigenciaOferta ?? null,
        cotizacion.garantia ?? null,
        JSON.stringify(cotizacion.especificacionesOfertadas ?? {}),
        cotizacion.observacionesFiscales ?? null,
        JSON.stringify(cotizacion.confianzaExtraccion ?? {}),
      ]
    );
    return mapeoCotizacion(res.rows[0]);
  }

  async actualizarCotizacion(
    id: string,
    datos: Partial<Omit<Cotizacion, "id" | "solicitudId">>
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const m: Record<string, keyof typeof datos> = {
      proveedor_nombre: "proveedorNombre",
      proveedor_identificacion_fiscal: "proveedorIdentificacionFiscal",
      proveedor_contacto: "proveedorContacto",
      formato_original: "formatoOriginal",
      valor_neto: "valorNeto",
      moneda: "moneda",
      impuestos_desglosados: "impuestosDesglosados",
      monto_isv: "montoIsv",
      monto_otros_impuestos: "montoOtrosImpuestos",
      valor_total: "valorTotal",
      plazo_entrega: "plazoEntrega",
      forma_pago: "formaPago",
      vigencia_oferta: "vigenciaOferta",
      garantia: "garantia",
      especificaciones_ofertadas: "especificacionesOfertadas",
      observaciones_fiscales: "observacionesFiscales",
      confianza_extraccion: "confianzaExtraccion",
      editada_manualmente: "editadaManualmente",
      fecha_carga: "fechaCarga",
    };

    for (const [col, key] of Object.entries(m)) {
      const val = datos[key];
      if (val !== undefined) {
        sets.push(`${col} = $${i++}`);
        vals.push(typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)
          ? JSON.stringify(val)
          : val);
      }
    }

    if (sets.length === 0) return;

    vals.push(id);
    await this.pg.query(
      `UPDATE cotizacion SET ${sets.join(", ")} WHERE id = $${i}`,
      vals
    );
  }

  async listarCotizaciones(solicitudId: string): Promise<Cotizacion[]> {
    const res = await this.pg.query(
      "SELECT * FROM cotizacion WHERE solicitud_id = $1 ORDER BY fecha_carga ASC",
      [solicitudId]
    );
    return res.rows.map(mapeoCotizacion);
  }

  async eliminarCotizacion(id: string): Promise<void> {
    await this.pg.query("DELETE FROM cotizacion WHERE id = $1", [id]);
  }

  async guardarComparativa(solicitudId: string, comparativa: Comparativa): Promise<Comparativa> {
    await this.pg.query(
      `INSERT INTO comparativa
         (solicitud_id, pros_contras, discrepancias_detectadas, sugerencia_ia, cotizacion_sugerida_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (solicitud_id) DO UPDATE
         SET pros_contras = EXCLUDED.pros_contras,
             discrepancias_detectadas = EXCLUDED.discrepancias_detectadas,
             sugerencia_ia = EXCLUDED.sugerencia_ia,
             cotizacion_sugerida_id = EXCLUDED.cotizacion_sugerida_id
       RETURNING *`,
      [
        solicitudId,
        JSON.stringify(comparativa.prosContras),
        JSON.stringify(comparativa.discrepanciasDetectadas),
        comparativa.sugerenciaIA ?? null,
        comparativa.cotizacionSugeridaId ?? null,
      ]
    );
    return comparativa;
  }

  async actualizarRutaExcel(solicitudId: string, ruta: string): Promise<void> {
    await this.pg.query(
      "UPDATE comparativa SET ruta_excel = $2 WHERE solicitud_id = $1",
      [solicitudId, ruta]
    );
  }

  async guardarRecomendacionComprador(solicitudId: string, recomendacion: string): Promise<void> {
    await this.pg.query(
      `UPDATE comparativa
       SET recomendacion_comprador = $2, fecha_recomendacion = now()
       WHERE solicitud_id = $1`,
      [solicitudId, recomendacion]
    );
  }

  async registrarDecision(
    decision: Parameters<Repositorio["registrarDecision"]>[0]
  ): Promise<Decision> {
    const res = await this.pg.query(
      `INSERT INTO decision
         (comparativa_id, cotizacion_seleccionada_id, decidido_por_email, ninguna_opcion, comentario)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        decision.comparativaId,
        decision.cotizacionSeleccionadaId ?? null,
        decision.decididoPorEmail,
        decision.ningunaOpcion,
        decision.comentario ?? null,
      ]
    );
    const f = res.rows[0];
    return {
      id: String(f.id),
      comparativaId: String(f.comparativa_id),
      cotizacionSeleccionadaId: f.cotizacion_seleccionada_id ?? undefined,
      decididoPorEmail: String(f.decidido_por_email),
      fechaDecision: String(f.fecha_decision),
      ningunaOpcion: Boolean(f.ninguna_opcion),
      comentario: f.comentario ?? undefined,
    };
  }

    async obtenerDecisionPorSolicitud(solicitudId: string): Promise<Decision | null> {
    const res = await this.pg.query(
      `SELECT d.* FROM decision d
       JOIN comparativa c ON c.id = d.comparativa_id
       WHERE c.solicitud_id = $1
       ORDER BY d.fecha_decision DESC
       LIMIT 1`,
      [solicitudId]
    );
    const f = res.rows[0];
    if (!f) return null;
    return {
      id: String(f.id),
      comparativaId: String(f.comparativa_id),
      cotizacionSeleccionadaId: f.cotizacion_seleccionada_id ?? undefined,
      decididoPorEmail: String(f.decidido_por_email),
      fechaDecision: String(f.fecha_decision),
      ningunaOpcion: Boolean(f.ninguna_opcion),
      comentario: f.comentario ?? undefined,
    };
  }

  async listarEventos(solicitudId: string): Promise<EventoTrazabilidad[]> {
    const res = await this.pg.query(
      `SELECT * FROM evento_trazabilidad
       WHERE solicitud_id = $1
       ORDER BY timestamp ASC`,
      [solicitudId]
    );
    return res.rows.map((f) => ({
      id: String(f.id),
      solicitudId: String(f.solicitud_id),
      tipoEvento: f.tipo_evento,
      estadoAnterior: f.estado_anterior ?? undefined,
      estadoNuevo: f.estado_nuevo ?? undefined,
      actorTipo: f.actor_tipo ?? "sistema",
      actorIdentificador: f.actor_identificador ?? undefined,
      nota: f.nota ?? undefined,
      timestamp: new Date(f.timestamp).toISOString(),
    }));
  }

  async obtenerComparativaPorId(id: string): Promise<Comparativa | null> {
    const res = await this.pg.query(
      "SELECT * FROM comparativa WHERE id = $1",
      [id]
    );
    if (!res.rows[0]) return null;
    const f = res.rows[0];
    return {
      id: String(f.id),
      solicitudId: String(f.solicitud_id),
      prosContras: (f.pros_contras as Record<string, { pros: string[]; contras: string[] }>) ?? {},
      discrepanciasDetectadas: f.discrepancias_detectadas ?? [],
      sugerenciaIA: f.sugerencia_ia ?? undefined,
      cotizacionSugeridaId: f.cotizacion_sugerida_id ?? undefined,
      recomendacionComprador: f.recomendacion_comprador ?? undefined,
      fechaRecomendacion: f.fecha_recomendacion ?? undefined,
      fechaGeneracion: String(f.fecha_generacion),
    };
  }

  async obtenerComparativaPorSolicitudId(solicitudId: string): Promise<Comparativa | null> {
    const res = await this.pg.query(
      "SELECT * FROM comparativa WHERE solicitud_id = $1",
      [solicitudId]
    );
    if (!res.rows[0]) return null;
    const f = res.rows[0];
    return {
      id: String(f.id),
      solicitudId: String(f.solicitud_id),
      prosContras: (f.pros_contras as Record<string, { pros: string[]; contras: string[] }>) ?? {},
      discrepanciasDetectadas: f.discrepancias_detectadas ?? [],
      sugerenciaIA: f.sugerencia_ia ?? undefined,
      cotizacionSugeridaId: f.cotizacion_sugerida_id ?? undefined,
      recomendacionComprador: f.recomendacion_comprador ?? undefined,
      fechaRecomendacion: f.fecha_recomendacion ?? undefined,
      fechaGeneracion: String(f.fecha_generacion),
    };
  }

  async crearLinkPublico(comparativaId: string, token: string, fechaExpiracion?: string): Promise<LinkPublico> {
    const res = await this.pg.query(
      `INSERT INTO link_publico (comparativa_id, token, fecha_expiracion)
       VALUES ($1, $2, $3)
       RETURNING id, comparativa_id, token, fecha_expiracion, veces_accedido, revocado`,
      [comparativaId, token, fechaExpiracion ?? null]
    );
    const f = res.rows[0];
    return {
      id: String(f.id),
      comparativaId: String(f.comparativa_id),
      token: String(f.token),
      fechaExpiracion: f.fecha_expiracion ? String(f.fecha_expiracion) : undefined,
      vecesAccedido: Number(f.veces_accedido),
      revocado: Boolean(f.revocado),
    };
  }

  async obtenerLinkPorToken(token: string): Promise<LinkPublico | null> {
    const res = await this.pg.query("SELECT * FROM link_publico WHERE token = $1", [token]);
    const f = res.rows[0];
    if (!f) return null;
    return {
      id: String(f.id),
      comparativaId: String(f.comparativa_id),
      token: String(f.token),
      fechaExpiracion: f.fecha_expiracion ? String(f.fecha_expiracion) : undefined,
      vecesAccedido: Number(f.veces_accedido),
      revocado: Boolean(f.revocado),
    };
  }

  async registrarAccesoLink(token: string): Promise<void> {
    await this.pg.query(
      "UPDATE link_publico SET veces_accedido = veces_accedido + 1, ultimo_acceso = now() WHERE token = $1",
      [token]
    );
  }

  async leerConfig(clave: string): Promise<unknown> {
    const res = await this.pg.query("SELECT valor FROM configuracion WHERE clave = $1", [clave]);
    return res.rows[0]?.valor ?? null;
  }

  async guardarConfig(clave: string, valor: unknown): Promise<void> {
    await this.pg.query(
      `INSERT INTO configuracion (clave, valor) VALUES ($1, $2)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
      [clave, JSON.stringify(valor)]
    );
  }

  async metricasDashboard(filtros?: FiltrosMetricas): Promise<MetricasDashboard> {
    const cond: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const desde =
      filtros?.desde ??
      (filtros?.rango === "dia"
        ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        : filtros?.rango === "semana"
          ? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
          : filtros?.rango === "mes"
            ? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
            : undefined);

    if (desde) { cond.push(`fecha_creacion >= $${i++}::date`); vals.push(desde); }
    if (filtros?.hasta) { cond.push(`fecha_creacion <= $${i++}::date`); vals.push(filtros.hasta); }
    if (filtros?.coordinador) { cond.push(`coordinador_id = $${i++}`); vals.push(filtros.coordinador); }
    if (filtros?.categoria) { cond.push(`categoria = $${i++}`); vals.push(filtros.categoria); }

    const where = cond.length ? ` WHERE ${cond.join(" AND ")}` : " WHERE true";

    const n = (sql: string) =>
      this.pg.query(sql, vals).then((r) => Number(r.rows[0]?.n ?? 0));

    const enviadas = await n(`SELECT count(*) AS n FROM solicitud${where} AND estado <> 'BORRADOR'`);
    const cerradas = await n(`SELECT count(*) AS n FROM solicitud${where} AND estado = 'CERRADA_CON_DECISION'`);
    const activas = await n(
      `SELECT count(*) AS n FROM solicitud${where} AND estado NOT IN ('CERRADA_CON_DECISION','CERRADA_SIN_DECISION','CANCELADA','BORRADOR')`
    );
    const sinDecision = await n(
      `SELECT count(*) AS n FROM solicitud${where} AND estado NOT IN ('CERRADA_CON_DECISION','CERRADA_SIN_DECISION','CANCELADA')
       AND fecha_creacion < now() - interval '${Number(filtros?.umbralDias ?? 5)} days'`
    );

    const tCicloRes = await this.pg.query(
      `SELECT EXTRACT(EPOCH FROM AVG(fecha_cierre - fecha_envio)) / 86400.0 AS d
       FROM solicitud${where}
       AND estado = 'CERRADA_CON_DECISION' AND fecha_envio IS NOT NULL AND fecha_cierre IS NOT NULL`,
      vals
    );
    const tiempoCicloDias =
      tCicloRes.rows[0]?.d == null ? null : Number(tCicloRes.rows[0].d);

    const volRes = await this.pg.query(
      `SELECT coordinador_id AS c, count(*) AS k FROM solicitud${where} AND coordinador_id IS NOT NULL GROUP BY coordinador_id`,
      vals
    );
    const volumenPorCoordinador: Record<string, number> = {};
    for (const r of volRes.rows) volumenPorCoordinador[String(r.c)] = Number(r.k);

    const tipoRes = await this.pg.query(
      `SELECT COALESCE(tipo::text, 'SIN_TIPO') AS t, count(*) AS k FROM solicitud${where} GROUP BY t`,
      vals
    );
    const distribucionPorTipo: Record<string, number> = {};
    for (const r of tipoRes.rows) distribucionPorTipo[String(r.t)] = Number(r.k);

    return {
      tasaConversion: enviadas === 0 ? null : (cerradas / enviadas) * 100,
      tiempoCicloPromedioDias: tiempoCicloDias,
      solicitudesActivas: activas,
      solicitudesSinDecision: sinDecision,
      volumenPorCoordinador,
      distribucionPorTipo,
    };
  }

  async listarCampoCatalogo(incluirInactivos = false): Promise<CampoCatalogo[]> {
    const res = await this.pg.query(
      `SELECT * FROM campo_catalogo ${incluirInactivos ? "" : "WHERE activo = true"} ORDER BY orden`
    );
    return res.rows.map((f) => ({
      campoKey: String(f.campo_key),
      label: String(f.label),
      ayuda: f.ayuda ?? undefined,
      tipoDato: f.tipo_dato,
      catalogoOpciones: f.catalogo_opciones ?? undefined,
      obligatorio: Boolean(f.obligatorio),
      origen: f.origen,
      seccionPdf: f.seccion_pdf ?? undefined,
      orden: Number(f.orden),
      validacion: f.validacion ?? undefined,
      activo: Boolean(f.activo),
    }));
  }

  listarCamposDePlantilla(
    tipo: "RFI" | "RFQ" | "RFP",
    subtipo?: string,
    categoria?: string
  ): Promise<CampoCatalogo[]> {
    return this.pg.query(
      `SELECT cc.*
         FROM plantilla p
         JOIN plantilla_campo pc ON pc.plantilla_id = p.id
         JOIN campo_catalogo cc ON cc.id = pc.campo_id
        WHERE p.activa = true
          AND p.tipo = $1
          AND ($2::text IS NULL OR p.subtipo::text = $2)
          AND ($3::text IS NULL OR p.categoria::text = $3 OR p.categoria IS NULL)
        ORDER BY pc.orden, cc.orden`
    , [tipo, subtipo, categoria]).then((res) =>
      res.rows.map((f) => ({
        campoKey: String(f.campo_key),
        label: String(f.label),
        ayuda: f.ayuda ?? undefined,
        tipoDato: f.tipo_dato,
        catalogoOpciones: f.catalogo_opciones ?? undefined,
        obligatorio: Boolean(f.obligatorio),
        origen: f.origen,
        seccionPdf: f.seccion_pdf ?? undefined,
        orden: Number(f.orden),
        validacion: f.validacion ?? undefined,
        activo: Boolean(f.activo),
      }))
    );
  }

  async guardarCampoCatalogo(campo: Omit<CampoCatalogo, "validacion" | "activo"> & { validacion?: CampoCatalogo["validacion"]; activo?: boolean }): Promise<void> {
    await this.pg.query(
      `INSERT INTO campo_catalogo (campo_key, label, ayuda, tipo_dato, catalogo_opciones, obligatorio, origen, seccion_pdf, orden, validacion, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (campo_key) DO UPDATE SET
         label = EXCLUDED.label, ayuda = EXCLUDED.ayuda, tipo_dato = EXCLUDED.tipo_dato,
         catalogo_opciones = EXCLUDED.catalogo_opciones, obligatorio = EXCLUDED.obligatorio,
         origen = EXCLUDED.origen, seccion_pdf = EXCLUDED.seccion_pdf, orden = EXCLUDED.orden,
         validacion = EXCLUDED.validacion, activo = EXCLUDED.activo`,
      [
        campo.campoKey,
        campo.label,
        campo.ayuda ?? null,
        campo.tipoDato,
        campo.catalogoOpciones ?? null,
        campo.obligatorio,
        campo.origen,
        campo.seccionPdf ?? null,
        campo.orden,
        JSON.stringify(campo.validacion ?? {}),
        campo.activo ?? true,
      ]
    );
  }

  async actualizarCampoCatalogo(campoKey: string, datos: Partial<Pick<CampoCatalogo, "activo">>): Promise<void> {
    if (datos.activo === undefined) return;
    await this.pg.query("UPDATE campo_catalogo SET activo = $2 WHERE campo_key = $1", [campoKey, datos.activo]);
  }

  async persistirDocumento(input: {
    solicitudId: string;
    tipo: string;
    rutaPdf: string;
    plantillaVersion?: number;
  }): Promise<DocumentoGenerado> {
    const res = await this.pg.query(
      `INSERT INTO documento_generado (solicitud_id, tipo, ruta_pdf, plantilla_version)
       VALUES ($1, $2, $3, $4)
       RETURNING id, solicitud_id, tipo, ruta_pdf, version, plantilla_version, fecha_generacion`,
      [input.solicitudId, input.tipo, input.rutaPdf, input.plantillaVersion ?? 1]
    );
    const f = res.rows[0];
    return {
      id: String(f.id),
      solicitudId: String(f.solicitud_id),
      tipo: f.tipo,
      rutaPdf: String(f.ruta_pdf),
      version: Number(f.version),
      plantillaVersion: Number(f.plantilla_version),
      fechaGeneracion: String(f.fecha_generacion),
    };
  }

  async registrarCorreo(input: {
    solicitudId: string;
    tipoCorreo: string;
    destinatario: string;
    asunto?: string;
    estadoEnvio: CorreoEnviado["estadoEnvio"];
    intentos?: number;
    errorDetalle?: string;
  }): Promise<CorreoEnviado> {
    const res = await this.pg.query(
      `INSERT INTO correo_enviado (solicitud_id, tipo_correo, destinatario, asunto, estado_envio, intentos, error_detalle)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, solicitud_id, tipo_correo, destinatario, asunto, estado_envio, intentos, error_detalle, fecha_envio`,
      [
        input.solicitudId,
        input.tipoCorreo,
        input.destinatario,
        input.asunto ?? null,
        input.estadoEnvio,
        input.intentos ?? 1,
        input.errorDetalle ?? null,
      ]
    );
    const f = res.rows[0];
    return {
      id: String(f.id),
      solicitudId: String(f.solicitud_id),
      tipoCorreo: String(f.tipo_correo),
      destinatario: String(f.destinatario),
      asunto: f.asunto ?? undefined,
      estadoEnvio: f.estado_envio,
      intentos: Number(f.intentos),
      errorDetalle: f.error_detalle ?? undefined,
      fechaEnvio: String(f.fecha_envio),
    };
  }
}