"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CargaCotizaciones } from "./CargaCotizaciones";
import { ComparativaView } from "./Comparativa";
import { Recomendacion } from "./Recomendacion";
import { Modal } from "./Modal";
import { api } from "@/lib/api-client";
import { nombreCategoria } from "@/lib/domain/categorias";
import { formatoFechaLegible, fechaInput } from "@/lib/domain/semaforo";
import type { Cotizacion, Comparativa, Decision, Solicitud } from "@/lib/domain/types";

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
};

export function DetalleSolicitud({ solicitud, decision, proveedorElegido }: DetalleSolicitudProps) {
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
            : "No se pudo conectar con el servidor para traer las cotizaciones. Revisá tu conexión e intentá de nuevo."
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
            : "No se pudo generar la comparativa. Intentá de nuevo."
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
  const indiceEtapa = ETAPAS.findIndex((e) => e.n === etapa);

  return (
    <div className="pt-2">
      {/* Banda de solicitud cerrada: muestra la decisión y congela el flujo */}
      {terminal ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-emerald-900">
              {solicitud.estado === "CANCELADA"
                ? "Solicitud cancelada"
                : decision?.ningunaOpcion
                  ? "Cerrada sin decisión — el solicitante no eligió ninguna opción"
                  : solicitud.estado === "CERRADA_SIN_DECISION"
                    ? "Cerrada sin decisión"
                    : "Solicitud cerrada con decisión"}
            </div>
            <div className="text-xs text-emerald-800 mt-0.5">
              {decision && !decision.ningunaOpcion
                ? <>El solicitante eligió <span className="font-semibold">{proveedorElegido ?? "una opción"}</span>{solicitud.fechaCierre ? <> · {new Date(solicitud.fechaCierre).toLocaleDateString("es-HN")}</> : null}.</>
                : "El ciclo terminó; no hay acciones pendientes para Compras."}
            </div>
          </div>
        </div>
      ) : null}

      {/* Barra de acciones. Antes eran 7 controles en una sola fila sin wrap dentro de un
          shell con `overflow-hidden`: a 390px "Cancelar solicitud" quedaba cortada y los
          tres pasos desaparecían (P0-2). Ahora en <sm se apila en dos filas — Volver +
          "⋯ más", y los pasos a ancho completo — y en sm+ conserva la fila actual. */}
      <div className="mb-5 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link href="/panel" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-white/70 hover:bg-white transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
            Volver al panel
          </Link>
          {terminal ? null : (
            <div className="sm:hidden">
              <MenuMas>
                {(cerrar) => (
                  <div className="flex flex-col">
                    {puedeReabrir ? (
                      <button
                        type="button"
                        onClick={() => { cerrar(); setConfirmarReabrir(true); }}
                        className="w-full text-left px-4 py-3 min-h-[44px] text-sm font-semibold text-amber-800 hover:bg-amber-50 transition-colors"
                      >
                        Reabrir cotizaciones
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => { cerrar(); setEditando((v) => !v); }}
                      className="w-full text-left px-4 py-3 min-h-[44px] text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {editando ? "Cerrar edición" : "Editar datos"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { cerrar(); setConfirmarCancelar(true); }}
                      className="w-full text-left px-4 py-3 min-h-[44px] text-sm font-semibold text-rose-700 hover:bg-rose-50 transition-colors border-t border-slate-100"
                    >
                      Cancelar solicitud
                    </button>
                  </div>
                )}
              </MenuMas>
            </div>
          )}
        </div>

        {terminal ? null : (
          <div className="hidden sm:flex items-center gap-2">
            {puedeReabrir ? (
              <button
                type="button"
                onClick={() => setConfirmarReabrir(true)}
                disabled={reabriendo}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold tracking-tight transition-colors text-amber-700 hover:bg-amber-50 border border-amber-200 bg-white/70 disabled:opacity-50"
              >
                {reabriendo ? "Reabriendo…" : "Reabrir cotizaciones"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold tracking-tight transition-colors text-slate-700 hover:bg-white border border-slate-200 bg-white/70"
            >
              {editando ? "Cerrar edición" : "Editar datos"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmarCancelar(true)}
              disabled={cancelando}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold tracking-tight transition-colors text-rose-600 hover:bg-rose-50 border border-rose-200 bg-white/70 disabled:opacity-50"
            >
              {cancelando ? "Cancelando…" : "Cancelar solicitud"}
            </button>
          </div>
        )}
      </div>

      {/* P2-7: dónde estoy + a dónde voy. El número de paso queda como apoyo visual. */}
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Paso {indiceEtapa + 1} de 3</span>
            <span aria-hidden="true"> · </span>
            {ETAPAS[indiceEtapa].label}
          </div>
          {!terminal && !tieneComparativa ? (
            <div className="text-xs text-slate-500">Comparativa se habilita con 2 cotizaciones cargadas</div>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:inline-flex sm:items-center">
          {ETAPAS.map((t) => {
            const activo = etapa === t.n;
            return (
              <button
                key={t.n}
                type="button"
                aria-pressed={activo}
                disabled={!tieneComparativa && t.n === 8}
                onClick={() => setEtapa(t.n)}
                className={
                  "flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-2 sm:px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold tracking-tight transition-colors border " +
                  (activo
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "text-slate-700 hover:bg-white/70 border-slate-200")
                }
              >
                <span className={"text-xs " + (activo ? "text-white/70" : "text-slate-400")}>0{t.n}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {editando && !terminal ? (
        <div className="mb-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="text-sm font-semibold text-slate-900 mb-4">Editar datos para re-cotizar (2.3)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-700 mb-1.5">Fecha requerida</span>
              <input
                type="date"
                value={editFecha}
                onChange={(e) => setEditFecha(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-700 mb-1.5">Descripción</span>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={guardarEdicion}
              disabled={guardandoEdicion}
              className="bg-slate-900 text-white text-xs px-6 py-2.5 rounded-full font-medium hover:bg-slate-800 disabled:opacity-40"
            >
              {guardandoEdicion ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8">
              {errorEnvio ? (
                <div className="mb-4 rounded-xl px-4 py-3 text-sm text-rose-700 bg-rose-50 border border-rose-200" role="alert">{errorEnvio}</div>
              ) : null}
              {errorCotizaciones && !cargando ? (
                /* Un fallo de red no es una solicitud sin cotizaciones (P1-5). */
                <div className="rounded-xl px-5 py-6 text-center border border-amber-200 bg-amber-50" role="alert">
                  <div className="text-sm font-semibold text-slate-900">No pudimos cargar las cotizaciones</div>
                  <div className="text-xs text-slate-600 mt-1">{errorCotizaciones}</div>
                  <button
                    type="button"
                    onClick={reintentarCotizaciones}
                    className="mt-4 inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 min-h-[44px] rounded-full hover:bg-slate-800 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
                    Reintentar
                  </button>
                </div>
              ) : cargando ? (
                <p className="text-sm text-slate-500">Cargando cotizaciones…</p>
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
                  <ComparativaView solicitudId={solicitud.id} comparativa={comparativaData} cotizaciones={cotizaciones} onContinuar={() => setEtapa(9)} />
                ) : errorComparativa ? (
                  <div className="rounded-xl px-5 py-6 text-center border border-amber-200 bg-amber-50" role="alert">
                    <div className="text-sm font-semibold text-slate-900">No pudimos generar la comparativa</div>
                    <div className="text-xs text-slate-600 mt-1">{errorComparativa}</div>
                    <div className="text-xs text-slate-500 mt-1">Las {cotizaciones.length} cotizaciones siguen cargadas: podés reintentar sin volver a subirlas.</div>
                    <button
                      type="button"
                      onClick={() => setErrorComparativa(null)}
                      className="mt-4 inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 min-h-[44px] rounded-full hover:bg-slate-800 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    {generandoComparativa ? (
                      <>
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                        Generando comparativa…
                      </>
                    ) : (
                      "Se necesitan al menos 2 cotizaciones cargadas para generar la comparativa."
                    )}
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
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-5 flex items-center gap-3 border-b border-slate-100">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-700"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
              </div>
              <div>
                <div className="text-base font-semibold text-slate-900">{solicitud.solicitanteNombre}</div>
                <div className="text-sm text-slate-500">{solicitud.areaSolicitante ?? "—"}</div>
              </div>
            </div>
            <div className="p-5 bg-slate-50/50">
              <div className="text-sm text-slate-600 leading-relaxed">{solicitud.descripcion || "Sin descripción."}</div>
              <div className="mt-3 flex items-center gap-2 text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                <span className="text-sm font-medium text-slate-700">{solicitud.solicitanteEmail}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/></svg>
              Detalles de la solicitud
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Categoría</span>
                <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg text-right">{nombreCategoria(solicitud.categoria)}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Subtipo</span>
                <span className="font-semibold text-slate-900 text-right">{solicitud.subtipo ? (solicitud.subtipo === "producto" ? "Producto" : "Servicio") : "Por definir"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Fecha requerida</span>
                {solicitud.fechaRequerida ? (
                  <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">{formatoFechaLegible(solicitud.fechaRequerida)}</span>
                ) : (
                  <span className="text-slate-400 font-medium">Por definir</span>
                )}
              </div>
              {solicitud.archivoLogoNombre ? (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-slate-500">Logo/archivo del producto</span>
                  <a
                    href={`/api/solicitudes/${solicitud.id}/logo`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-sky-700 hover:bg-sky-50 border border-sky-200"
                    title={`Descargar ${solicitud.archivoLogoNombre}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    {solicitud.archivoLogoNombre}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {/* Confirmaciones in-app (P3-11): cada una dice la consecuencia concreta, no solo
          el nombre de la acción. CANCELADA es terminal y el enlace público deja de
          permitir decidir, así que ambas consecuencias se dicen antes de confirmar. */}
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
                <span>El enlace público que ya se le envió al solicitante deja de permitir decidir: vas a tener que enviar la comparativa de nuevo cuando termines.</span>
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
        className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-slate-700 hover:bg-white border border-slate-200 bg-white/70 transition-all"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        Más
      </button>
      {abierto ? (
        <div
          id="menu-mas-acciones"
          className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden step-enter"
        >
          {children(() => setAbierto(false))}
        </div>
      ) : null}
    </div>
  );
}
