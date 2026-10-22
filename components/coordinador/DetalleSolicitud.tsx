"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CargaCotizaciones } from "./CargaCotizaciones";
import { ComparativaView } from "./Comparativa";
import { Recomendacion } from "./Recomendacion";
import { Modal } from "./Modal";
import { PedirInformacion, type CampoParaPreguntar } from "./PedirInformacion";
import { DocumentosAdjuntos } from "@/components/shared/DocumentosAdjuntos";
import { FormularioYRespuestas } from "@/components/shared/FormularioYRespuestas";
import { Icon } from "@/components/ui/Icon";
import { Button, ButtonLink, Panel, cx } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/forms";
import type { PreguntaOriginal } from "@/lib/domain/formulario";
import { api } from "@/lib/api-client";
import { nombreCategoria } from "@/lib/domain/categorias";
import { formatoFechaLegible, fechaInput } from "@/lib/domain/semaforo";
import type { Cotizacion, Comparativa, Decision, RondaPreguntas, Solicitud } from "@/lib/domain/types";

type Etapa = 7 | 8 | 9;

const ESTADOS_TERMINALES = ["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"];

// P2-7: los pasos se nombran por lo que hacen, no por numeración interna. El número
// sigue visible como apoyo visual, pero la etiqueta manda.
const ETAPAS: { n: Etapa; label: string }[] = [
  { n: 7, label: "Cotizaciones" },
  { n: 8, label: "Comparativa" },
  { n: 9, label: "Recomendación" },
];

type DetalleSolicitudProps = {
  solicitud: Solicitud;
  decision?: Decision;
  proveedorElegido?: string;
  /** Campos del catálogo, para atar una pregunta a un campo (opcional al preguntar). */
  campos?: CampoParaPreguntar[];
  /** Formulario original (plantilla congelada + assessment) con sus respuestas. */
  formulario?: PreguntaOriginal[];
  /** Historial completo de rondas de preguntas (4.13.20). */
  rondas?: RondaPreguntas[];
};

export function DetalleSolicitud({ solicitud, decision, proveedorElegido, campos = [], formulario = [], rondas = [] }: DetalleSolicitudProps) {
  const router = useRouter();
  const terminal = ESTADOS_TERMINALES.includes(solicitud.estado);
  const [etapa, setEtapa] = useState<Etapa>(7);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCotizaciones, setErrorCotizaciones] = useState<string | null>(null);
  const [intentoCarga, setIntentoCarga] = useState(0);
  const [comparativaData, setComparativaData] = useState<Comparativa | undefined>(undefined);
  const [errorComparativa, setErrorComparativa] = useState<string | null>(null);
  const [enlaceEnviado, setEnlaceEnviado] = useState<{ token: string; url: string } | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  // Re-cotización (2.3/H12)
  const [reabriendo, setReabriendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [editFecha, setEditFecha] = useState(fechaInput(solicitud.fechaRequerida));
  const [editDesc, setEditDesc] = useState(solicitud.descripcion ?? "");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  // Confirmaciones in-app: `window.confirm` no dice la consecuencia ni abre en móvil (P3-11).
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [pidiendoInfo, setPidiendoInfo] = useState(false);
  const [confirmarReabrir, setConfirmarReabrir] = useState(false);
  const generandoRef = useRef(false);

  // Cancela la solicitud (3.5): disponible para coordinador y admin; registra evento CANCELADA.
  // CANCELADA es terminal en la máquina de estados: no hay vuelta atrás desde el portal.
  async function cancelarSolicitud() {
    setCancelando(true);
    setErrorEnvio(null);
    try {
      await api.transicionar({
        solicitudId: solicitud.id,
        hacia: "CANCELADA",
        actorTipo: "coordinador",
        nota: "Cancelada desde el panel por el coordinador",
      });
      router.refresh();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo cancelar la solicitud");
    } finally {
      setCancelando(false);
    }
  }

  async function enviarComparativa(recomendacion: string): Promise<boolean> {
    if (!comparativaData) return false;
    setErrorEnvio(null);
    try {
      const res = await api.transicionar({
        solicitudId: solicitud.id,
        hacia: "ENVIADA_A_SOLICITANTE",
        actorTipo: "coordinador",
        nota: recomendacion,
      });
      if (res.enlace) setEnlaceEnviado(res.enlace);
      return true;
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo enviar");
      return false;
    }
  }

  // Re-cotización (2.3/H12): devuelve la solicitud a EN_COTIZACION para ajustar
  // cotizaciones o datos y regenerar la comparativa.
  async function reabrirCotizaciones() {
    setReabriendo(true);
    setErrorEnvio(null);
    try {
      await api.transicionar({
        solicitudId: solicitud.id,
        hacia: "EN_COTIZACION",
        actorTipo: "coordinador",
        nota: "Re-cotización: se reabre para ajustes con el proveedor",
      });
      setComparativaData(undefined);
      setErrorComparativa(null);
      router.refresh();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo reabrir para re-cotizar");
    } finally {
      setReabriendo(false);
    }
  }

  // Re-cotización (2.3/H12): edita fecha requerida y/o descripción de la solicitud activa.
  async function guardarEdicion() {
    setGuardandoEdicion(true);
    setErrorEnvio(null);
    try {
      await api.editarSolicitud(solicitud.id, {
        descripcion: editDesc.trim() || undefined,
        fechaRequerida: editFecha || undefined,
      });
      setEditando(false);
      router.refresh();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudieron guardar los cambios");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  // Un fallo al listar cotizaciones NO se convierte en "no hay cotizaciones": tiene su
  // propia rama con reintento (P1-5). `intentoCarga` fuerza el reintento.
  useEffect(() => {
    let vivo = true;
    api
      .listarCotizaciones(solicitud.id)
      .then((c) => {
        if (vivo) setCotizaciones(c);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setCotizaciones([]);
        // Un fallo de red (TypeError) no trae mensaje de producto; un error HTTP sí, y ese
        // texto se muestra tal cual (p. ej. "No autenticado").
        setErrorCotizaciones(
          e instanceof Error && !(e instanceof TypeError) && e.message
            ? e.message
            : "No se pudo conectar con el servidor para traer las cotizaciones. Revise su conexión e intente de nuevo."
        );
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [solicitud.id, intentoCarga]);

  // Recarga tras crear/editar/eliminar una cotización: silenciosa (no hace parpadear la
  // lista) pero sin tragar fallos: si el refresco falla, aparece la rama de error.
  function recargarCotizaciones() {
    setErrorCotizaciones(null);
    setIntentoCarga((n) => n + 1);
  }

  // Reintento explícito tras un error: sí muestra el estado de carga.
  function reintentarCotizaciones() {
    setErrorCotizaciones(null);
    setCargando(true);
    setIntentoCarga((n) => n + 1);
  }

  const tieneComparativa = useMemo(
    () => cotizaciones.length >= 2,
    [cotizaciones.length]
  );

  const generandoComparativa = etapa === 8 && !comparativaData && !errorComparativa;

  // Genera la comparativa con IA en el SERVIDOR (route /api/solicitudes/[id]/comparativa),
  // que hace la llamada a OpenRouter con la clave y cae a fallback determinístico si falla.
  // generandoRef evita el doble disparo al cambiar de tab 08→09 mientras aún carga (H8).
  // Un fallo NO se traga: sin esto la vista caía en "faltan cotizaciones" cuando en realidad
  // hay 2+ y lo que falló fue la generación (mismo patrón que P1-5).
  useEffect(() => {
    if (terminal || !tieneComparativa || comparativaData || errorComparativa || etapa === 7 || generandoRef.current) return;
    let vivo = true;
    generandoRef.current = true;
    api
      .generarComparativa(solicitud.id)
      .then((c) => {
        if (vivo) setComparativaData(c);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setErrorComparativa(
          e instanceof Error && !(e instanceof TypeError) && e.message
            ? e.message
            : "No se pudo generar la comparativa. Intente de nuevo."
        );
      })
      .finally(() => {
        if (vivo) generandoRef.current = false;
      });
    return () => {
      vivo = false;
    };
  }, [tieneComparativa, comparativaData, errorComparativa, solicitud.id, etapa, terminal]);

  const puedeReabrir = ["COMPARATIVA_LISTA", "ENVIADA_A_SOLICITANTE"].includes(solicitud.estado);
  // Con una ronda ya abierta no se puede pedir otra: el servidor lo rechaza con 409 y el
  // botón no debe ofrecer algo que va a fallar.
  const rondaAbierta = solicitud.informacionPendiente === true;
  const puedePedirInfo = !terminal && !rondaAbierta;
  const indiceEtapa = ETAPAS.findIndex((e) => e.n === etapa);

  const pasos = ETAPAS.map((t) => ({
    ...t,
    activo: etapa === t.n,
    bloqueado: !tieneComparativa && t.n === 8,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Banda de solicitud cerrada: muestra la decisión y congela el flujo */}
      {terminal ? (
        <div className="rounded-sm bg-canvas px-5 py-4 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
          <div className="flex items-start gap-3">
            <span
              className={cx(
                "grid size-10 shrink-0 place-items-center rounded-sm",
                decision && !decision.ningunaOpcion ? "bg-mint text-ink" : "bg-surface-soft text-ink"
              )}
            >
              <Icon name={decision && !decision.ningunaOpcion ? "check-circle" : "info"} size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-body-md font-medium text-ink">
                {solicitud.estado === "CANCELADA"
                  ? "Solicitud cancelada"
                  : decision?.ningunaOpcion
                    ? "Cerrada sin decisión — el solicitante no eligió ninguna opción"
                    : solicitud.estado === "CERRADA_SIN_DECISION"
                      ? "Cerrada sin decisión"
                      : "Solicitud cerrada con decisión"}
              </p>
              <p className="mt-0.5 text-caption text-body">
                {decision && !decision.ningunaOpcion ? (
                  <>
                    El solicitante eligió <span className="font-medium text-ink">{proveedorElegido ?? "una opción"}</span>
                    {solicitud.fechaCierre ? <> · {new Date(solicitud.fechaCierre).toLocaleDateString("es-HN")}</> : null}.
                  </>
                ) : (
                  "El ciclo terminó; no hay acciones pendientes para Compras."
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Barra de acciones: navegación a la izquierda, acciones de la solicitud a la derecha.
          En móvil las secundarias viven en «Más» para no empujar el contenido. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/panel" variant="outline" icon="chevron-left">
          Bandeja
        </ButtonLink>
        {terminal ? null : (
          <>
            <div className="sm:hidden">
              <MenuMas>
                {(cerrar) => (
                  <div className="flex flex-col p-1">
                    {puedePedirInfo ? (
                      <button
                        type="button"
                        onClick={() => { cerrar(); setPidiendoInfo(true); }}
                        className="w-full rounded-xs px-3 py-2.5 text-left text-caption font-medium text-ink hover:bg-surface-soft"
                      >
                        Pedir información al solicitante
                      </button>
                    ) : null}
                    {puedeReabrir ? (
                      <button
                        type="button"
                        onClick={() => { cerrar(); setConfirmarReabrir(true); }}
                        className="w-full rounded-xs px-3 py-2.5 text-left text-caption font-medium text-ink hover:bg-surface-soft"
                      >
                        Reabrir cotizaciones
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => { cerrar(); setEditando((v) => !v); }}
                      className="w-full rounded-xs px-3 py-2.5 text-left text-caption font-medium text-ink hover:bg-surface-soft"
                    >
                      {editando ? "Cerrar edición" : "Editar datos"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { cerrar(); setConfirmarCancelar(true); }}
                      className="w-full rounded-xs px-3 py-2.5 text-left text-caption font-medium text-critical hover:bg-surface-soft"
                    >
                      Cancelar solicitud
                    </button>
                  </div>
                )}
              </MenuMas>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              {puedePedirInfo ? (
                <Button variant="outline" onClick={() => setPidiendoInfo(true)}>
                  Pedir información
                </Button>
              ) : null}
              {puedeReabrir ? (
                <Button variant="outline" onClick={() => setConfirmarReabrir(true)} disabled={reabriendo}>
                  {reabriendo ? "Reabriendo…" : "Reabrir cotizaciones"}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setEditando((v) => !v)}>
                {editando ? "Cerrar edición" : "Editar datos"}
              </Button>
              <Button variant="danger" onClick={() => setConfirmarCancelar(true)} disabled={cancelando}>
                {cancelando ? "Cancelando…" : "Cancelar solicitud"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Dónde estoy y a dónde voy (P2-7): el paso manda, el número es apoyo. */}
      <div className="flex flex-col gap-2">
        <p className="text-caption text-body">
          <span className="font-medium text-ink">Paso {indiceEtapa + 1} de 3</span> · {ETAPAS[indiceEtapa].label}
        </p>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Etapas de la solicitud">
          {pasos.map((p, i) => (
            <li key={p.n}>
              <button
                type="button"
                onClick={() => setEtapa(p.n)}
                disabled={p.bloqueado}
                aria-current={p.activo ? "step" : undefined}
                className={cx(
                  "flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left transition-colors",
                  p.activo
                    ? "bg-primary text-on-dark"
                    : "text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:bg-surface-soft",
                  p.bloqueado && "opacity-40"
                )}
              >
                <span
                  className={cx(
                    "mono-label grid size-6 shrink-0 place-items-center rounded-xs",
                    p.activo ? "bg-mint text-ink" : "bg-surface-soft text-ink"
                  )}
                >
                  0{p.n}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-caption font-medium">{p.label}</span>
                  <span className="block text-caption opacity-70">Paso {i + 1}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {!terminal && !tieneComparativa ? (
          <p className="text-caption text-body">Comparativa se habilita con 2 cotizaciones cargadas</p>
        ) : null}
      </div>

      {editando && !terminal ? (
        <Panel title="Editar datos para re-cotizar" subtitle="Los cambios quedan registrados en la trazabilidad.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Fecha requerida"
              type="date"
              value={editFecha}
              onChange={(e) => setEditFecha(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-medium text-ink">Descripción</span>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-sm bg-canvas px-3 py-2 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none focus:shadow-[inset_0_0_0_1px_#000]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={guardarEdicion} disabled={guardandoEdicion}>
              {guardandoEdicion ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_388px]">
        <div className="min-w-0">
          {errorEnvio ? (
            <p role="alert" className="mb-4 rounded-sm px-4 py-3 text-caption text-critical shadow-[inset_0_0_0_1px_var(--color-text-critical)]">
              {errorEnvio}
            </p>
          ) : null}

          {errorCotizaciones && !cargando ? (
            <div role="alert" className="flex flex-col items-center gap-2 rounded-sm bg-canvas px-5 py-8 text-center shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
              <p className="text-body-lg text-ink">No pudimos cargar las cotizaciones</p>
              <p className="text-caption text-body">{errorCotizaciones}</p>
              <Button variant="outline" size="sm" icon="refresh" onClick={reintentarCotizaciones}>
                Reintentar
              </Button>
            </div>
          ) : cargando ? (
            <p className="text-caption text-body">Cargando cotizaciones…</p>
          ) : etapa === 7 ? (
            <CargaCotizaciones
              solicitudId={solicitud.id}
              cotizaciones={cotizaciones}
              soloLectura={terminal}
              onCotizacionCargada={recargarCotizaciones}
              onGenerar={() => { setErrorComparativa(null); setEtapa(8); }}
            />
          ) : etapa === 8 ? (
            comparativaData ? (
              <ComparativaView
                solicitudId={solicitud.id}
                solicitud={solicitud}
                comparativa={comparativaData}
                cotizaciones={cotizaciones}
                onContinuar={() => setEtapa(9)}
              />
            ) : errorComparativa ? (
              <div role="alert" className="flex flex-col items-center gap-2 rounded-sm bg-canvas px-5 py-8 text-center shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
                <p className="text-body-lg text-ink">No pudimos generar la comparativa</p>
                <p className="text-caption text-body">{errorComparativa}</p>
                <p className="text-caption text-body">Las {cotizaciones.length} cotizaciones siguen cargadas: puede reintentar sin volver a subirlas.</p>
                <Button variant="outline" size="sm" icon="refresh" onClick={() => setErrorComparativa(null)}>
                  Reintentar
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-caption text-body">
                {generandoComparativa ? "Generando comparativa…" : "Se necesitan al menos 2 cotizaciones cargadas para generar la comparativa."}
              </p>
            )
          ) : (
            <Recomendacion
              cotizaciones={cotizaciones}
              prosContras={comparativaData?.prosContras ?? {}}
              sugerenciaIA={comparativaData?.sugerenciaIA}
              cotizacionSugeridaId={comparativaData?.cotizacionSugeridaId}
              enlace={enlaceEnviado}
              onEnviar={enviarComparativa}
            />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Panel title="Solicitante" subtitle={solicitud.areaSolicitante ?? "Área por definir"}>
            <p className="text-body-md text-ink">{solicitud.solicitanteNombre}</p>
            <p className="text-caption text-body">{solicitud.solicitanteEmail}</p>
            <p className="mt-3 whitespace-pre-line text-caption text-ink">{solicitud.descripcion || "Sin descripción."}</p>
          </Panel>

          <Panel title="Detalles">
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="eyebrow text-body">Categoría</dt>
                <dd className="mt-1 text-caption text-ink">{nombreCategoria(solicitud.categoria)}</dd>
              </div>
              <div>
                <dt className="eyebrow text-body">Subtipo</dt>
                <dd className="mt-1 text-caption text-ink">
                  {solicitud.subtipo ? (solicitud.subtipo === "producto" ? "Producto" : "Servicio") : "Por definir"}
                </dd>
              </div>
              <div>
                <dt className="eyebrow text-body">Fecha requerida</dt>
                <dd className="mt-1 text-caption text-ink">
                  {solicitud.fechaRequerida ? formatoFechaLegible(solicitud.fechaRequerida) : "Por definir"}
                </dd>
              </div>
              {solicitud.archivoLogoNombre ? (
                <div>
                  <dt className="eyebrow text-body">Logo / archivo del producto</dt>
                  <dd className="mt-1">
                    <a
                      href={`/api/solicitudes/${solicitud.id}/logo`}
                      className="inline-flex items-center gap-1.5 text-caption font-medium text-ink underline underline-offset-4 hover:opacity-80"
                      title={`Descargar ${solicitud.archivoLogoNombre}`}
                    >
                      <Icon name="download" size={14} />
                      {solicitud.archivoLogoNombre}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          <DocumentosAdjuntos solicitudId={solicitud.id} />
          <FormularioYRespuestas
            preguntas={formulario}
            rondas={rondas}
            rondaAbierta={rondaAbierta ? (solicitud.informacionPreguntas?.ronda ?? null) : null}
          />
        </aside>
      </div>

      {/* Confirmaciones in-app (P3-11): cada una dice la consecuencia concreta, no solo
          el nombre de la acción. CANCELADA es terminal y el enlace público deja de
          permitir decidir, así que ambas consecuencias se dicen antes de confirmar. */}
      <PedirInformacion
        solicitudId={solicitud.id}
        campos={campos}
        abierto={pidiendoInfo}
        onCerrar={() => setPidiendoInfo(false)}
      />

      {confirmarCancelar ? (
        <Modal
          onCerrar={() => setConfirmarCancelar(false)}
          titulo="¿Cancelar esta solicitud?"
          descripcion={`«${solicitud.titulo}»${solicitud.numeroReferencia ? ` (${solicitud.numeroReferencia})` : ""} se cierra y queda registrada como CANCELADA.`}
        >
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-slate-400">•</span>
              <span>El solicitante deja de tener una comparativa que decidir.</span>
            </li>
            {solicitud.estado === "ENVIADA_A_SOLICITANTE" ? (
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-slate-400">•</span>
                <span>Si ya se le envió el enlace público, deja de poder registrar su decisión.</span>
              </li>
            ) : null}
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-slate-400">•</span>
              <span>
                Las {cotizaciones.length} {cotizaciones.length === 1 ? "cotización registrada" : "cotizaciones registradas"} {cotizaciones.length === 1 ? "queda" : "quedan"} en el historial, pero ya no se pueden comparar ni re-cotizar.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-slate-400">•</span>
              <span>No se puede deshacer: CANCELADA es un estado terminal.</span>
            </li>
          </ul>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmarCancelar(false)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => { setConfirmarCancelar(false); void cancelarSolicitud(); }}
              disabled={cancelando}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {cancelando ? "Cancelando…" : "Sí, cancelar la solicitud"}
            </button>
          </div>
        </Modal>
      ) : null}

      {confirmarReabrir ? (
        <Modal
          onCerrar={() => setConfirmarReabrir(false)}
          titulo="¿Reabrir para re-cotizar?"
          descripcion={`«${solicitud.titulo}»${solicitud.numeroReferencia ? ` (${solicitud.numeroReferencia})` : ""} vuelve a «Esperando cotizaciones».`}
        >
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-slate-400">•</span>
              <span>La comparativa generada se descarta: hay que volver a generarla.</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-slate-400">•</span>
              <span>Las {cotizaciones.length} {cotizaciones.length === 1 ? "cotización cargada se conserva" : "cotizaciones cargadas se conservan"}; solo cambia el estado del proceso.</span>
            </li>
            {solicitud.estado === "ENVIADA_A_SOLICITANTE" ? (
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-amber-600">•</span>
                <span>El enlace público que ya se le envió al solicitante deja de permitir decidir: va a tener que enviar la comparativa de nuevo cuando termine.</span>
              </li>
            ) : null}
          </ul>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmarReabrir(false)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => { setConfirmarReabrir(false); void reabrirCotizaciones(); }}
              disabled={reabriendo}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {reabriendo ? "Reabriendo…" : "Sí, reabrir"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** Menú "⋯ más" de las acciones secundarias en <sm (P0-2). */
function MenuMas({ children }: { children: (cerrar: () => void) => React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const alClicFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const alEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClicFuera);
    document.addEventListener("keydown", alEscape);
    return () => {
      document.removeEventListener("mousedown", alClicFuera);
      document.removeEventListener("keydown", alEscape);
    };
  }, [abierto]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="menu-mas-acciones"
        onClick={() => setAbierto((v) => !v)}
        className="mono-label inline-flex items-center gap-1.5 rounded-sm px-3.5 py-2.5 text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-colors hover:bg-surface-soft"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        Más
      </button>
      {abierto ? (
        <div
          id="menu-mas-acciones"
          className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-sm bg-canvas shadow-[var(--shadow-soft-drop)]"
        >
          {children(() => setAbierto(false))}
        </div>
      ) : null}
    </div>
  );
}
