import { NextResponse } from "next/server";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { detectarAlertas, type AlertaCompras } from "@/lib/domain/alertas";
import type { Cotizacion, EventoTrazabilidad, Solicitud } from "@/lib/domain/types";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

const TIPOS_ALERTA = ["inactividad", "sin_desglose_fiscal", "una_sola_cotizacion", "discrepancia"] as const;
type TipoAlerta = (typeof TIPOS_ALERTA)[number];

/**
 * Cuerpo del POST (4.4.10). El admin elige qué tipos procesar y puede pedir un preview.
 *  - `tipos` ausente = todos los tipos (compatibilidad con el disparo previo sin selección).
 *  - `tipos: []` = ninguno (la UI no debería llegar aquí, pero no se inventa un default).
 *  - `preview: true` = detectar y devolver sin enviar correo ni marcar avisos.
 */
async function leerSeleccion(req: Request): Promise<{ tipos: TipoAlerta[]; preview: boolean }> {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const b = (body && typeof body === "object" ? body : {}) as { tipos?: unknown; preview?: unknown };
  const tipos = Array.isArray(b.tipos)
    ? (b.tipos.filter((t) => (TIPOS_ALERTA as readonly string[]).includes(String(t))) as TipoAlerta[])
    : [...TIPOS_ALERTA];
  return { tipos, preview: b.preview === true };
}

export async function POST(req: Request) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { tipos, preview } = await leerSeleccion(req);
    const umbral = Number((await repo.leerConfig("umbral_dias_sin_movimiento")) ?? 5);
    const destAdmin = String((await repo.leerConfig("destinatario_alertas")) ?? "").trim();

    const solicitudes = await repo.listarTodas();
    const cotsMap: Record<string, Cotizacion[]> = {};
    const eventosMap: Record<string, EventoTrazabilidad[]> = {};
    for (const s of solicitudes) {
      cotsMap[s.id] = await repo.listarCotizaciones(s.id);
      eventosMap[s.id] = await repo.listarEventos(s.id);
    }

    // Discrepancias: el dato vive en `comparativa.discrepancias_detectadas` (array). La ruta
    // nunca lo leía, así que la rama estaba muerta. Solo se consulta si el tipo fue elegido,
    // para no encadenar consultas inútiles cuando no se pide.
    const discrepanciasPorSolicitud: Record<string, boolean> = {};
    if (tipos.includes("discrepancia")) {
      for (const s of solicitudes) {
        const comparativa = await repo.obtenerComparativaPorSolicitudId(s.id);
        if ((comparativa?.discrepanciasDetectadas?.length ?? 0) > 0) discrepanciasPorSolicitud[s.id] = true;
      }
    }

    const detectadas = detectarAlertas({
      solicitudes,
      cotizacionesPorSolicitud: cotsMap,
      eventosPorSolicitud: eventosMap,
      discrepanciasPorSolicitud,
      umbralDias: umbral,
    });
    const alertas: AlertaCompras[] = detectadas.filter((a) => tipos.includes(a.tipo));

    // Preview: se devuelve lo detectado y no se toca nada (ni correo ni marcador de 4.11.7).
    if (preview) {
      return NextResponse.json({ alertas, correosEnviados: 0, recordatorios: 0, preview: true });
    }

    // Correo 5 (alerta de inactividad). Va al coordinador ASIGNADO y a administración
    // (`destinatario_alertas`), no solo al buzón global: el coordinador es quien tiene la
    // solicitud detenida y el único que puede destrabarla; administración conserva la
    // supervisión del flujo. Se deduplican los buzones.
    //
    // 4.11.7: un aviso por movimiento. Se guarda hasta qué movimiento se avisó y se salta la
    // solicitud si no se movió desde entonces, para que un segundo clic en "Ejecutar alertas"
    // no repita el correo. Si la solicitud se mueve y vuelve a quedar inactiva, su último
    // movimiento es posterior al avisado y el correo se re-arma solo.
    let enviadas = 0;
    const avisos = await repo.alertasInactividadAvisadas();
    const solicitudPorId = new Map(solicitudes.map((s) => [s.id, s]));
    const { enviarCorreo } = await import("@/lib/mail/enviar");
    for (const a of alertas.filter((x) => x.tipo === "inactividad")) {
      const solicitud = solicitudPorId.get(a.solicitudId);
      if (!solicitud) continue;

      const movimientoMs = ultimoMovimientoMs(
        solicitud,
        cotsMap[a.solicitudId] ?? [],
        eventosMap[a.solicitudId] ?? []
      );
      // Sin un movimiento válido no se puede comparar ni marcar: el detector tampoco alerta
      // sin fechas de movimiento, así que este caso no debería llegar.
      if (!Number.isFinite(movimientoMs)) continue;

      const yaAvisadoMs = avisos[a.solicitudId];
      if (yaAvisadoMs != null && movimientoMs <= yaAvisadoMs) continue;

      const destinatarios = await destinatariosDeAlerta(solicitud.coordinadorId, destAdmin);
      let algunoEnviado = false;
      for (const destinatario of destinatarios) {
        try {
          const r = await enviarCorreo({
            repo,
            tipoCorreo: "5",
            solicitudId: a.solicitudId,
            destinatario,
            datos: {
              numeroReferencia: solicitud.numeroReferencia,
              titulo: solicitud.titulo,
              solicitanteNombre: solicitud.solicitanteNombre,
              coordinadorNombre: "Compras",
              diasSinMovimiento: umbral,
              estadoActual: solicitud.estado,
              fechaRequerida: solicitud.fechaRequerida,
              urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/panel/solicitud/${a.solicitudId}`,
            },
          });
          // `enviarCorreo` no lanza cuando Resend falla: devuelve "fallido". Contarlo como
          // enviado (como hacía el `.then`) mentiría en la respuesta y apagaría la alerta.
          if (r.estadoEnvio === "enviado") {
            enviadas += 1;
            algunoEnviado = true;
          }
        } catch {
          // `enviarCorreo` ya registra el fallo en `correo_enviado`.
        }
      }
      // Se marca solo si algún correo salió de verdad: si fallaron todos, el próximo clic
      // reintenta en vez de apagar la alerta sin haber avisado a nadie.
      if (algunoEnviado) await repo.marcarAlertaInactividad(a.solicitudId, movimientoMs);
    }

    // Recordatorio 010 (RF-62): las rondas de preguntas que superaron el umbral sin
    // respuesta. Se engancha acá y no a un programador propio porque el proyecto no tiene
    // ninguno: hoy este botón es el único disparador real. El día que haya cron, la ruta de
    // /api/cron/recordatorios hace lo mismo sin tocar esto.
    const diasRecordatorio = Number(await repo.leerConfig("recordatorio_informacion_dias")) || 3;
    let recordatorios = 0;
    const { enviarCorreo: enviar } = await import("@/lib/mail/enviar");
    for (const v of await repo.informacionVencida(diasRecordatorio)) {
      const destinatario = await destinatarioDe(v.solicitud.coordinadorId);
      if (!destinatario) continue;
      try {
        const r = await enviar({
          repo,
          tipoCorreo: "8",
          solicitudId: v.solicitud.id,
          destinatario,
          datos: {
            numeroReferencia: v.solicitud.numeroReferencia,
            titulo: v.solicitud.titulo,
            solicitanteNombre: v.solicitud.solicitanteNombre,
            coordinadorNombre: "Compras",
            diasEsperando: v.dias,
            preguntas: (v.solicitud.informacionPreguntas?.preguntas ?? []).map((p) => ({ pregunta: p.pregunta })),
            urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/panel/solicitud/${v.solicitud.id}`,
          },
        });
        // Solo se marca si el correo salió: `enviar` devuelve "fallido" en vez de lanzar, y
        // marcarla igual apagaría el recordatorio para esa ronda sin haber avisado.
        if (r.estadoEnvio !== "enviado") continue;
        await repo.marcarRecordatorioInformacion(v.solicitud.id, v.ronda);
        recordatorios += 1;
      } catch {
        // `enviar` ya registra el fallo en `correo_enviado`.
      }
    }

    return NextResponse.json({ alertas, correosEnviados: enviadas, recordatorios });
  } catch {
    return NextResponse.json({ error: "Error al ejecutar alertas" }, { status: 500 });
  }
}

/** A quién va el recordatorio: el coordinador asignado, o el alias. Nunca al solicitante. */
async function destinatarioDe(coordinadorId?: string): Promise<string | null> {
  if (coordinadorId) {
    const coordinadores = await repo.listarCoordinadores();
    const asignado = coordinadores.find((c) => c.id === coordinadorId);
    if (asignado?.email) return asignado.email;
  }
  return process.env.MAIL_COORDINADOR_DEFAULT || null;
}

/**
 * Buzones del correo 5: el coordinador asignado (o el alias si no hay) y administración
 * (`destinatario_alertas`). Sin repetir, para no mandarle dos veces el mismo correo a quien
 * figure en ambos.
 */
async function destinatariosDeAlerta(coordinadorId: string | undefined, admin: string): Promise<string[]> {
  const destinatarios = new Set<string>();
  const coordinador = await destinatarioDe(coordinadorId);
  if (coordinador) destinatarios.add(coordinador);
  if (admin) destinatarios.add(admin);
  return [...destinatarios];
}

/**
 * "Último movimiento" de una solicitud, con el mismo criterio que el detector
 * (`lib/domain/alertas.ts`): el máximo entre el envío, los eventos de trazabilidad, la última
 * carga de cotización y la creación. El dominio lo calcula en privado para decidir si alerta;
 * el marcador de 4.11.7 necesita el mismo valor para saber si la solicitud se movió desde el
 * último aviso. Si el dominio cambia su definición, esta copia debe seguirla.
 */
function ultimoMovimientoMs(
  s: Solicitud,
  cotizaciones: Cotizacion[],
  eventos: EventoTrazabilidad[]
): number {
  let max = new Date(s.fechaCreacion).getTime();
  const considerar = (ms: number) => {
    if (Number.isFinite(ms) && (!Number.isFinite(max) || ms > max)) max = ms;
  };
  if (s.fechaEnvio) considerar(new Date(s.fechaEnvio).getTime());
  for (const e of eventos) considerar(new Date(e.timestamp).getTime());
  for (const c of cotizaciones) if (c.fechaCarga) considerar(new Date(c.fechaCarga).getTime());
  return max;
}
