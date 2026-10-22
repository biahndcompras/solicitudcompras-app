"use client";

import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import Link from "next/link";
import { useId, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "@/components/ui-ext/Modal";
import { Ribbon } from "@/components/brand/Ribbon";
import { Icon } from "@/components/ui/Icon";
import { ease } from "@/lib/design/motion";
import {
  useSolicitudWizard,
  TEXTO_FASE_ENVIO,
  fechaEnPasado,
  type WizardState,
  type CoordinadorPublico,
  type EstadoEnvio,
  type FaseEnvio,
} from "@/hooks/useSolicitudWizard";
import { CATEGORIAS, nombreCategoria } from "@/lib/domain/categorias";
import { formatoFechaLegible } from "@/lib/domain/semaforo";
import { ACCEPT_ARCHIVO, MAX_MB_ARCHIVO } from "@/lib/domain/archivos";

// El rail se deriva del estado real del wizard (5 pasos, no 4 inventados).
// `label` es el nombre largo del rail de escritorio; `corto` el de la barra móvil.
// Ninguno de los dos se repite: el texto visible es único en el documento.
const PASOS = [
  { id: 2, label: "Captura Inicial", corto: "Captura" },
  { id: 3, label: "Clasificación", corto: "Tipo" },
  { id: 4, label: "Detalles técnicos", corto: "Detalles" },
  { id: 5, label: "Documento", corto: "Resumen" },
  { id: 6, label: "Enviada", corto: "Listo" },
] as const;

/* El encabezado vive UNA vez, en el `<section>` (para poder hacerse sticky); cada paso
   declaraba el suyo y se iba con el scroll. Títulos y bajadas, por paso. */
const TITULOS_PASO: Record<number, string> = {
  1: "¿Qué necesita?",
  2: "¿Qué necesita?",
  3: "Clasificación de su solicitud",
  4: "Detalles para cotizar",
  5: "Su solicitud está lista",
  6: "Su solicitud fue enviada",
};
const BAJADAS_PASO: Record<number, string> = {
  1: "Describa brevemente su solicitud.",
  2: "Describa brevemente su solicitud.",
  3: "Revise la sugerencia del asistente y ajústela si hace falta.",
  4: "Complete la información técnica requerida para su solicitud.",
  5: "Revise el resumen antes de enviar a Compras.",
  6: "Compras ya tiene su solicitud. Le avisaremos cuando haya una comparativa lista.",
};

export function SolicitanteWizard() {
  const searchParams = useSearchParams();
  const nuevo = (searchParams.get("nuevo") ?? "") === "1";
  // La identidad viaja al hook: la URL decide a quién pertenece el borrador que se restaura.
  const identidad = useMemo(
    () => ({
      email: searchParams.get("email") ?? "",
      nombre: searchParams.get("nombre") ?? "",
      area: searchParams.get("area") ?? "",
    }),
    [searchParams]
  );
  const w = useSolicitudWizard(nuevo, identidad);
  const {
    estado, set, siguiente, anterior, irA, pasoValido, faltantes, obligatoriosPendientes, assessmentIncompleto, envio, enviarSolicitud,
    guardarBorrador, cancelar, borradoAt, persistenciaOk, clasificandoIA, clasificarIA, evaluandoAssessment,
    evaluarAssessment, reintentarConContexto, coordinadores, elegirArchivoLogo, errorArchivo,
    limpiarErrorArchivo, pendienteBorrador, retomarBorrador, descartarBorrador,
  } = w;
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Un solo modal para las dos condiciones del envío: pueden ocurrir a la vez (faltan
  // obligatorios Y el assessment no se preparó) y dos overlays encima del otro serían
  // innavegables.
  const [gateEnvio, setGateEnvio] = useState(false);
  const faltanObligatorios = obligatoriosPendientes.length > 0;
  const assessmentRoto = assessmentIncompleto !== null;
  const hayAviso = faltanObligatorios || assessmentRoto;
  // El envío nunca se bloquea en silencio: se avisa y la decisión final es del solicitante,
  // que es quien sabe si puede resolverlo antes de la fecha.
  const intentarEnviar = useCallback(() => {
    if (hayAviso) {
      setGateEnvio(true);
      return;
    }
    enviarSolicitud();
  }, [hayAviso, enviarSolicitud]);
  const listo = estado.paso >= 6;
  const indicePaso = PASOS.findIndex((p) => p.id === estado.paso);
  const pasoVisible = PASOS[indicePaso] ?? PASOS[0];

  // El paso nuevo siempre arranca arriba. Antes el `<section>` conservaba el `scrollTop` del
  // paso anterior, así que al llegar al resumen el título ya estaba fuera de pantalla y el
  // solicitante veía la tarjeta a media altura sin saber en qué paso estaba.
  // `scrollTop` y no `scrollTo`: jsdom (los tests) no implementa `Element.scrollTo`.
  const refSeccion = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (refSeccion.current) refSeccion.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [estado.paso]);


  return (
    <div className="bia-ds min-h-dvh bg-surface-soft p-0 md:flex md:items-start md:justify-center md:p-8">
      <main className="mx-auto flex w-full max-w-[1120px] flex-col overflow-hidden border-y border-hairline bg-canvas md:min-h-[640px] md:flex-row md:rounded-sm md:border">
        {/* Barra compacta (<md). Vive como hija DIRECTA de <main>, no dentro del <aside>:
            `position: sticky` solo tiene recorrido dentro de su bloque contenedor, y dentro
            del <aside> ese bloque mide 120 px en móvil para una barra de 119 px: no había
            dónde pegarse y el logo + el nombre del paso se iban con el scroll.
            [MEDIDO 390x844] top 1 → -1199 px antes; 1 → 0 px con la barra en <main>. */}
        <div className="sticky top-0 z-30 border-b border-hairline bg-canvas/95 px-4 py-3 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-3">
            <MarcaBia />
            <div className="min-w-0 flex-1">
              <p className="text-caption font-semibold text-body uppercase tracking-wider leading-none">
                Paso {indicePaso + 1} de {PASOS.length}
              </p>
              <p className="text-sm font-semibold text-ink truncate leading-tight">
                {pasoVisible.corto}
              </p>
            </div>
            <span
              className={
                "shrink-0 text-caption font-semibold px-2 py-1 rounded-sm " +
                (listo ? "text-success bg-surface-soft" : estado.paso >= 5 ? "text-ink bg-surface-soft" : "text-ink bg-surface-soft")
              }
            >
              {listo ? "Enviada" : estado.paso >= 5 ? "Lista para envío" : persistenciaOk ? "Borrador activo" : "Sin guardar"}
            </span>
          </div>
          <ol className="mt-2 flex items-center gap-1" aria-hidden="true">
            {PASOS.map((paso, i) => (
              <li key={paso.id} className="flex-1">
                <span
                  className={
                    "block h-1.5 rounded-sm " +
                    (estado.paso > paso.id ? "bg-primary" : estado.paso === paso.id ? "bg-mint" : "bg-surface-soft")
                  }
                />
                <span className="sr-only">{`Paso ${i + 1} de ${PASOS.length}: ${paso.label}`}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Las acciones del borrador NO van dentro de la barra sticky: 57 px de cabecera fija
            dan el contexto (logo + nombre del paso), 120 px se comen el 14% del alto útil y
            además tapan el `PasoAcciones` de abajo. Arriba se ven igual; al bajar se van. */}
        {estado.paso < 6 ? (
          <div className="border-b border-hairline px-4 py-2 md:hidden">
            <div className="flex items-center gap-2">
              <BotonBorradorMobile borradoAt={borradoAt} persistenciaOk={persistenciaOk} onGuardar={guardarBorrador} />
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="min-h-[44px] px-3 text-xs font-semibold text-critical bg-canvas border border-[var(--color-text-critical)] rounded-sm"
              >
                Descartar
              </button>
              <Link
                href="/guias/manual-solicitante"
                className="ml-auto min-h-[44px] inline-flex items-center text-xs font-semibold text-body"
              >
                ¿Necesitás ayuda?
              </Link>
            </div>
          </div>
        ) : null}

        {/* Rail vertical del progreso (md+). En <md no existe: su contenido era la barra
            compacta de arriba, que ya salió de aquí. */}
        <aside
          aria-label="Progreso de la solicitud"
          className="on-dark hidden shrink-0 border-r border-on-dark-line bg-canvas-dark md:block md:overflow-hidden"
        >
          <div className="relative hidden h-full flex-col p-6 md:flex md:w-[280px] lg:w-[320px] lg:p-8">
            <Ribbon className="pointer-events-none absolute inset-x-0 bottom-0 h-48 w-full opacity-20" />
            <div className="relative z-10 mb-8 flex items-center gap-2 md:mb-12">
              <MarcaBia onDark />
              <span className="text-body-md font-medium text-on-dark">Compras</span>
            </div>

            <div className="relative z-10 flex h-full flex-col">
              <p className="eyebrow mb-4 text-on-dark-muted">Progreso de la solicitud</p>
              <ol className="flex flex-col gap-1">
                {PASOS.map((paso, index) => {
                  const isActive = estado.paso === paso.id;
                  const isDone = estado.paso > paso.id;
                  const alcanzable = paso.id <= estado.maxAlcanzado && paso.id < 6;
                  const contenido = (
                    <>
                      <span
                        className={
                          "grid size-5 shrink-0 place-items-center rounded-xs " +
                          (isDone
                            ? "bg-mint text-ink"
                            : isActive
                              ? "bg-canvas text-ink"
                              : "bg-surface-dark-soft text-on-dark-muted")
                        }
                      >
                        {isDone ? <Icon name="check" size={11} /> : <span className="mono-caption">{index + 1}</span>}
                      </span>
                      <span
                        className={
                          "min-w-0 truncate text-caption " +
                          (isActive ? "font-medium text-on-dark" : isDone ? "text-on-dark" : "text-on-dark-muted")
                        }
                      >
                        {paso.label}
                      </span>
                    </>
                  );
                  return (
                    <li key={paso.id}>
                      {alcanzable ? (
                        <button
                          type="button"
                          onClick={() => irA(paso.id)}
                          className={
                            "flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors " +
                            (isActive ? "bg-surface-dark-soft" : "hover:bg-surface-dark-soft/60")
                          }
                        >
                          {contenido}
                        </button>
                      ) : (
                        <span className="flex items-center gap-3 px-2 py-2">{contenido}</span>
                      )}
                    </li>
                  );
                })}
              </ol>

              <EstadoActual listo={listo} enPaso={estado.paso} borradoAt={borradoAt} persistenciaOk={persistenciaOk} />
              {estado.paso < 6 ? (
                <AccionesBorrador
                  borradoAt={borradoAt}
                  persistenciaOk={persistenciaOk}
                  onGuardar={guardarBorrador}
                  onCancelar={() => setConfirmCancel(true)}
                />
              ) : null}
            </div>
          </div>
        </aside>

        {/* Main form area. En <md crece con el contenido (la página hace scroll) para que el
            paso activo sea legible completo y el CTA quede siempre alcanzable. */}
        <section
          ref={refSeccion}
          className="flex min-w-0 flex-1 flex-col bg-canvas p-5 md:p-8"
        >
          {/* El encabezado vive aquí, no en cada paso: es lo único que puede hacerse sticky
              y es lo que se perdía al bajar en el paso 5. `sticky` desde md: el scroller es
              el `<section>`; en <md lo que se pega arriba es la barra compacta del rail (que
              ya lleva logo + nombre del paso), y dos cabeceras pegadas se taparían.
              El paso 6 no lo lleva: es una pantalla de celebración centrada, sin scroll. */}
          {estado.paso >= 2 && estado.paso <= 5 ? (
            <header
              className="mb-5 shrink-0 border-b border-hairline pb-4"
            >
              <h1 className="mb-1 text-display-lg text-ink">{TITULOS_PASO[estado.paso]}</h1>
              <p className="text-sm text-body mb-0">{BAJADAS_PASO[estado.paso]}</p>
            </header>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row">
            <motion.div
              key={estado.paso}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease }}
              className="flex min-w-0 flex-1 flex-col"
            >
          {estado.paso === 2 ? (
            <PasoCaptura estado={estado} set={set} siguiente={siguiente} pasoValido={pasoValido} faltantes={faltantes} clasificarIA={clasificarIA} clasificandoIA={clasificandoIA} />
          ) : estado.paso === 3 ? (
            <PasoClasificacion estado={estado} set={set} siguiente={siguiente} anterior={anterior} clasificandoIA={clasificandoIA} clasificarIA={clasificarIA} evaluarAssessment={evaluarAssessment} evaluandoAssessment={evaluandoAssessment} />
          ) : estado.paso === 4 ? (
            <PasoDetalles estado={estado} set={set} siguiente={siguiente} anterior={anterior} pasoValido={pasoValido} faltantes={faltantes} evaluandoAssessment={evaluandoAssessment} evaluarAssessment={evaluarAssessment} elegirArchivoLogo={elegirArchivoLogo} errorArchivo={errorArchivo} limpiarErrorArchivo={limpiarErrorArchivo} reintentarConContexto={reintentarConContexto} />
          ) : estado.paso === 5 ? (
            <PasoDocumento estado={estado} set={set} enviarSolicitud={intentarEnviar} anterior={anterior} envio={envio} coordinadores={coordinadores} persistenciaOk={persistenciaOk} />
          ) : estado.paso === 6 ? (
            <PasoConfirmacion estado={estado} referencia={envio.estado === "ok" ? envio.referencia : undefined} />
          ) : (
            /* Cualquier paso fuera de rango (solo alcanzable con estado corrupto) vuelve a
               la captura. Antes caía en la confirmación y decía "Su solicitud fue enviada". */
            <PasoCaptura estado={estado} set={set} siguiente={siguiente} pasoValido={pasoValido} faltantes={faltantes} clasificarIA={clasificarIA} clasificandoIA={clasificandoIA} />
          )}
            </motion.div>

            {estado.paso >= 2 && estado.paso <= 5 ? (
              <aside className="hidden w-[280px] shrink-0 xl:block" aria-label="Resumen de la solicitud">
                <ResumenVivo estado={estado} />
              </aside>
            ) : null}
          </div>
        </section>
      </main>

      {pendienteBorrador ? (
        <Modal
          open
          onClose={retomarBorrador}
          title="Hay una solicitud a medias"
          className="max-w-[440px]"
          footer={
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={descartarBorrador}
                className="min-h-[44px] w-full rounded-sm border border-hairline bg-canvas px-4 text-caption font-medium text-ink hover:bg-surface-soft"
              >
                Empezar de cero
              </button>
              <button
                type="button"
                onClick={retomarBorrador}
                className="w-full min-h-[44px] rounded-sm bg-primary px-4 text-sm font-semibold text-white hover:bg-surface-dark-soft"
              >
                Retomar el borrador
              </button>
            </div>
          }
        >
          <p className="text-caption leading-relaxed text-body">
            Encontramos una solicitud sin terminar ({pendienteBorrador.resumen}).
            {pendienteBorrador.guardadoEn
              ? ` Se guardó en este navegador el ${new Date(pendienteBorrador.guardadoEn).toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}.`
              : ""}
          </p>
          <p className="mt-2 text-caption leading-relaxed text-body">
            Puede retomarla o empezar de cero. Nada se borra hasta que lo elija.
          </p>
        </Modal>
      ) : null}

      {confirmCancel ? (
        <Modal
          open
          onClose={() => setConfirmCancel(false)}
          title="Descartar la solicitud"
          className="max-w-md"
          footer={
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={cancelar}
                className="w-full min-h-[44px] rounded-sm bg-[var(--color-bg-critical)] px-4 text-caption font-semibold text-white hover:bg-[var(--color-bg-critical)]"
              >
                Descartar y salir
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="min-h-[44px] w-full rounded-sm border border-hairline bg-canvas px-4 text-caption font-medium text-ink hover:bg-surface-soft"
              >
                Seguir editando
              </button>
            </div>
          }
        >
          <p className="text-caption leading-relaxed text-body">
            Va a perder los datos de esta solicitud como borrador y volver al inicio.
            Esta acción no se puede deshacer.
          </p>
        </Modal>
      ) : null}

      {gateEnvio ? (
        <Modal
          open
          onClose={() => setGateEnvio(false)}
          title={
            assessmentRoto
              ? "No pudimos preparar las preguntas"
              : `Faltan ${obligatoriosPendientes.length} ${obligatoriosPendientes.length === 1 ? "dato obligatorio" : "datos obligatorios"}`
          }
          className="max-w-md"
          footer={
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setGateEnvio(false);
                  irA(4);
                  if (assessmentRoto) void evaluarAssessment();
                }}
                className="w-full min-h-[44px] rounded-sm bg-primary px-4 text-caption font-semibold text-white hover:bg-surface-dark-soft"
              >
                {assessmentRoto ? "Reintentar el asistente" : "Completar los datos"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGateEnvio(false);
                  enviarSolicitud();
                }}
                className="min-h-[44px] w-full rounded-sm border border-hairline bg-canvas px-4 text-caption font-medium text-ink hover:bg-surface-soft"
              >
                Enviar de todos modos
              </button>
            </div>
          }
        >
          {assessmentRoto ? (
            <div className="mb-4 rounded-sm border border-hairline bg-surface-soft/70 p-3">
              <p className="text-caption leading-relaxed text-ink">
                {assessmentIncompleto === "error"
                  ? "El asistente no pudo preparar las preguntas. Si envía ahora, su solicitud llega a Compras solo con el título y la descripción: los proveedores cotizarían cosas distintas y la comparativa no serviría."
                  : "Las preguntas del asistente todavía no están listas. Si envía ahora, su solicitud llega a Compras sin los detalles técnicos que hacen comparables las cotizaciones."}
              </p>
            </div>
          ) : null}

          {faltanObligatorios ? (
            <>
              <p className="text-caption leading-relaxed text-body">
                Compras necesita estos datos para que los proveedores coticen de forma comparable.
                Puede enviarla igual, pero la solicitud llegará incompleta.
              </p>
              <ul className="mt-3 space-y-1.5" role="list">
                {obligatoriosPendientes.slice(0, 8).map((p) => (
                  <li key={p.campoKey} className="flex items-start gap-2 text-caption text-ink">
                    <span aria-hidden="true" className="mt-[3px] h-1.5 w-1.5 rounded-sm bg-periwinkle shrink-0" />
                    <span>
                      {p.etiqueta.length > 96 ? `${p.etiqueta.slice(0, 96).trimEnd()}…` : p.etiqueta}
                      {p.noSe ? <span className="text-body"> — marcado como «No lo sé»</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              {obligatoriosPendientes.length > 8 ? (
                <p className="mt-2 text-xs text-body">
                  y {obligatoriosPendientes.length - 8} más.
                </p>
              ) : null}
            </>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function ResumenVivo({ estado }: { estado: WizardState }) {
  const paso = Math.min(5, Math.max(1, estado.paso - 1));
  // El par producto/servicio lo eligen las tarjetas y vive en `subtipo`; `tipoNecesidad`
  // es el detalle del catálogo. El resumen refleja lo que la persona ve seleccionado.
  const tipo =
    estado.subtipo === "producto"
      ? "Producto"
      : estado.subtipo === "servicio"
        ? "Servicio"
        : estado.subtipo === "mixto"
          ? "Mixto"
          : "Por definir";

  return (
    <div className="sticky top-8 flex flex-col gap-4 rounded-sm bg-canvas p-4 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
      <p className="eyebrow text-body">Resumen</p>
      <p className="text-body-md font-medium text-ink">{estado.titulo?.trim() || "Sin título todavía"}</p>
      <dl className="divide-y divide-hairline">
        <FilaResumen label="Necesidad" valor={tipo} />
        <FilaResumen
          label="Categoría"
          valor={estado.tipoNecesidad ? nombreCategoria(estado.tipoNecesidad) : "Por definir"}
        />
        <FilaResumen label="Tipo de solicitud" valor={estado.paso >= 3 ? estado.clasificacion || "—" : "Por clasificar"} />
        <FilaResumen
          label="Fecha requerida"
          valor={estado.fechaRequerida ? formatoFechaLegible(estado.fechaRequerida) : "Por definir"}
        />
        <FilaResumen label="Área" valor={estado.area || "—"} />
        <FilaResumen
          label="Respuestas"
          valor={String(Object.keys(estado.assessmentRespuestas ?? {}).length)}
        />
      </dl>
      <div>
        <div className="flex items-center justify-between text-caption">
          <span className="text-body">Paso</span>
          <span className="font-medium text-ink">{paso} de 5</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full bg-surface-soft">
          <div className="h-1.5 bg-primary transition-[width] duration-300" style={{ width: `${(paso / 5) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function FilaResumen({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-caption text-body">{label}</dt>
      <dd className="truncate text-right text-caption font-medium text-ink">{valor}</dd>
    </div>
  );
}

function MarcaBia({ onDark = false }: { onDark?: boolean }) {
  return (
    <div
      className={
        "grid size-7 shrink-0 place-items-center rounded-sm " +
        (onDark ? "bg-mint text-ink" : "bg-primary text-on-dark")
      }
    >
      <span className="text-caption font-bold tracking-tighter">BIA</span>
    </div>
  );
}

function EstadoActual({
  listo,
  enPaso,
  borradoAt,
  persistenciaOk,
}: {
  listo: boolean;
  enPaso: number;
  borradoAt: number | null;
  persistenciaOk: boolean;
}) {
  return (
    <div className="mt-auto rounded-sm bg-surface-dark-soft px-4 py-3">
      <span className="eyebrow text-on-dark-muted">Estado actual</span>
      <span className="mt-1.5 block w-fit rounded-xs bg-mint px-2 py-0.5 text-caption font-medium text-ink">
        {listo ? "Enviada" : enPaso >= 5 ? "Lista para envío" : persistenciaOk ? "Borrador activo" : "Sin guardar"}
      </span>
      {/* Si el navegador no deja guardar, se dice: "Borrador activo" sería mentira. */}
      <p className={"mt-1.5 text-caption " + (persistenciaOk ? "text-on-dark-muted" : "text-critical")}>
        {!persistenciaOk
          ? "Este navegador no nos deja guardar nada. No cierre la pestaña: si se pierde, no hay recuperación."
          : borradoAt
            ? `Guardado a las ${new Date(borradoAt).toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })}.`
            : "Se guarda solo mientras escribe en este navegador."}
      </p>
    </div>
  );
}

function AccionesBorrador({
  borradoAt,
  persistenciaOk,
  onGuardar,
  onCancelar,
}: {
  borradoAt: number | null;
  persistenciaOk: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={onGuardar}
        className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-sm bg-mint px-3 py-2.5 text-caption font-medium text-ink transition-colors hover:opacity-90"
      >
        {borradoAt && persistenciaOk ? (
          <>
            <Icon name="check" size={14} />
            Guardado
          </>
        ) : (
          <>
            <Icon name="download" size={14} />
            Guardar borrador
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-sm border border-[var(--color-text-critical)] px-3 py-2.5 text-caption font-medium text-on-dark transition-colors hover:bg-surface-dark-soft"
      >
        <Icon name="close" size={14} />
        Cancelar y descartar
      </button>
      {borradoAt && persistenciaOk ? (
        <p className="text-center text-caption text-mint">Borrador guardado en este navegador.</p>
      ) : null}
    </div>
  );
}

function BotonBorradorMobile({
  borradoAt,
  persistenciaOk,
  onGuardar,
}: {
  borradoAt: number | null;
  persistenciaOk: boolean;
  onGuardar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onGuardar}
      className="mono-label min-h-[44px] rounded-sm bg-primary px-3 text-on-dark"
    >
      {borradoAt && persistenciaOk ? "Guardado" : "Guardar"}
    </button>
  );
}

/** Fila de acciones del paso: fija (sticky) en móvil para que el CTA nunca quede bajo
 *  el scroll oculto ni lo tape el teclado virtual; en md mantiene el layout original.
 *  El motivo del CTA deshabilitado se muestra SIEMPRE: en móvil estaba en `hidden sm:block`
 *  y a 390px un botón deshabilitado no decía por qué (A12.1). En móvil baja a su propia
 *  línea; en md se queda en la fila. */
function PasoAcciones({
  atras,
  children,
  motivo,
}: {
  atras?: () => void;
  children: React.ReactNode;
  motivo?: string;
}) {
  return (
    <div className="sticky md:static bottom-0 z-20 -mx-5 md:mx-0 mt-auto px-5 md:px-0 pt-3 pb-1 md:py-0 bg-canvas md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-t md:border-t-0 border-hairline/70 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      {motivo ? (
        <span
          className="order-last sm:order-none w-full sm:w-auto text-left sm:text-right text-xs font-medium text-body sm:text-body leading-snug"
          data-motivo-cta
        >
          {motivo}
        </span>
      ) : null}
      {atras ? (
        <button onClick={atras} className="min-h-[44px] px-2 text-sm font-medium text-body hover:text-ink transition-colors">
          Atrás
        </button>
      ) : (
        <span aria-hidden className="hidden sm:inline-block" />
      )}
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  );
}

/* ---------- STEP 2: Captura inicial ---------- */
function PasoCaptura({
  estado,
  set,
  siguiente,
  pasoValido,
  faltantes,
  clasificarIA,
  clasificandoIA,
}: {
  estado: WizardState;
  set: <K extends keyof WizardState>(key: K, valor: WizardState[K]) => void;
  siguiente: () => void;
  pasoValido: boolean;
  faltantes: string[];
  clasificarIA: () => void;
  clasificandoIA: boolean;
}) {
  // Deep link sin identidad (?nuevo=1 sin parámetros, o recarga de /solicitud/nueva):
  // sin esto el paso 2 exige un área que no hay dónde capturar y el flujo queda trabado.
  const faltaIdentidad = !estado.area.trim() || !estado.nombre.trim();
  return (
    <div className="flex-1 flex flex-col w-full step-enter">
      {faltaIdentidad ? (
        <div className="rounded-sm border border-hairline bg-surface-soft/70 p-5 mb-5" role="region" aria-label="Datos de quien solicita">
          <p className="text-sm font-semibold text-ink mb-3">
            Nos faltan sus datos para registrar la solicitud
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!estado.nombre.trim() ? (
              <div>
                <label htmlFor="nombre-identidad" className="block text-xs font-medium text-ink mb-1.5">
                  Su nombre completo
                </label>
                <input
                  id="nombre-identidad"
                  type="text"
                  value={estado.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  placeholder="Ej.: Juan Pérez"
                  className="w-full min-h-[44px] bg-canvas border border-hairline rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[var(--color-border-strong)] "
                />
              </div>
            ) : null}
            {!estado.area.trim() ? (
              <div>
                <label htmlFor="area-identidad" className="block text-xs font-medium text-ink mb-1.5">
                  Área / departamento
                </label>
                <input
                  id="area-identidad"
                  type="text"
                  value={estado.area}
                  onChange={(e) => set("area", e.target.value)}
                  placeholder="Ej.: Marketing"
                  aria-invalid={!estado.area.trim() ? true : false}
                  aria-describedby="hint-area-identidad"
                  className="w-full min-h-[44px] bg-canvas border border-hairline rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[var(--color-border-strong)] "
                />
                <p id="hint-area-identidad" className="text-caption text-ink mt-1.5">
                  Sin el área no se puede continuar: la solicitud necesita saber a qué equipo pertenece.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mb-5 rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="titulo" className="mb-1.5 block text-caption font-medium text-ink">Título de la solicitud</label>
            <input
              id="titulo"
              type="text"
              value={estado.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Ej. Sombrillas brandeadas — activación playa"
              maxLength={200}
              className="min-h-[44px] w-full rounded-sm bg-canvas px-4 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_#000]"
            />
          </div>

          <div>
            <label htmlFor="tipo-necesidad" className="mb-1.5 block text-caption font-medium text-ink">Categoría</label>
            <select
              id="tipo-necesidad"
              value={estado.tipoNecesidad}
              onChange={(e) => set("tipoNecesidad", e.target.value)}
              className="min-h-[44px] w-full cursor-pointer rounded-sm bg-canvas px-4 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_#000]"
            >
              <option value="" disabled>Seleccione…</option>
              {CATEGORIAS.map((c) => (
                <option key={c.clave} value={c.clave}>{c.etiqueta}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fecha-requerida" className="mb-1.5 block text-caption font-medium text-ink">¿Para cuándo lo necesita?</label>
            <input
              id="fecha-requerida"
              type="date"
              min={hoyISO()}
              value={estado.fechaRequerida}
              onChange={(e) => set("fechaRequerida", e.target.value)}
              aria-invalid={estado.fechaRequerida && fechaEnPasado(estado.fechaRequerida) ? true : undefined}
              aria-describedby={estado.fechaRequerida && fechaEnPasado(estado.fechaRequerida) ? "error-fecha-requerida" : undefined}
              className="min-h-[44px] w-full rounded-sm bg-canvas px-4 py-2.5 text-body-md text-body shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_#000]"
            />
            {estado.fechaRequerida && fechaEnPasado(estado.fechaRequerida) ? (
              <p id="error-fecha-requerida" role="alert" className="mt-1.5 text-caption font-medium text-critical">
                La fecha requerida ya pasó. Elija hoy o una fecha futura.
              </p>
            ) : estado.fechaRequerida && diasHasta(estado.fechaRequerida) < 5 ? (
              <p className="mt-1.5 text-caption text-body">Este plazo es muy corto para cotizar. ¿Es una urgencia real?</p>
            ) : null}
          </div>

          <fieldset className="md:col-span-2">
            <legend className="mb-2 block text-caption font-medium text-ink">¿Producto o servicio?</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([["producto", "Producto", "Bien físico: materiales, empaques, artículos."], ["servicio", "Servicio", "Trabajo o actividad: logística, diseño, consultoría."]] as const).map(([val, label, ayuda]) => {
                const activo = estado.subtipo === val;
                return (
                  <label key={val} className="group relative cursor-pointer">
                    <input
                      type="radio"
                      name="prod_serv"
                      checked={activo}
                      onChange={() => set("subtipo", val)}
                      className="peer sr-only"
                    />
                    <div className="flex h-full items-start gap-3 rounded-sm bg-canvas p-4 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-shadow peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-border-strong)] group-has-[:checked]:shadow-[inset_0_0_0_2px_#000]">
                      <span
                        className={
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full " +
                          (activo ? "bg-primary" : "shadow-[inset_0_0_0_1px_var(--color-border-hairline)]")
                        }
                        aria-hidden
                      >
                        {activo ? <span className="size-1.5 rounded-full bg-canvas" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-body-md font-medium text-ink">{label}</span>
                        <span className="mt-0.5 block text-caption text-body">{ayuda}</span>
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="md:col-span-2">
            <label htmlFor="descripcion" className="mb-1.5 block text-caption font-medium text-ink">
              Descripción breve <span className="text-critical">*</span>
            </label>
            <textarea
              id="descripcion"
              value={estado.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={3}
              placeholder="Añada un poco más de contexto…"
              maxLength={5000}
              className="w-full resize-none rounded-sm bg-canvas px-4 py-3 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_#000]"
            />
            <p className="mt-1 text-caption text-body md:hidden">{estado.descripcion.length}/5000 caracteres</p>
          </div>
        </div>
      </div>
      <PasoAcciones motivo={pasoValido ? `Área: ${estado.area}` : `Falta: ${faltantes.join(", ")}`}>
        <button onClick={() => { clasificarIA(); siguiente(); }} disabled={!pasoValido} className="bg-primary text-white text-sm px-6 min-h-[44px] rounded-sm font-medium hover:bg-surface-dark-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
          {clasificandoIA ? "Clasificando…" : "Continuar"}
          <svg className="text-sm" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </PasoAcciones>
    </div>
  );
}

/* ---------- STEP 3: Clasificación ---------- */
function PasoClasificacion({
  estado,
  set,
  siguiente,
  anterior,
  clasificandoIA,
  clasificarIA,
  evaluarAssessment,
  evaluandoAssessment,
}: {
  estado: WizardState;
  set: <K extends keyof WizardState>(key: K, valor: WizardState[K]) => void;
  siguiente: () => void;
  anterior: () => void;
  clasificandoIA: boolean;
  clasificarIA: () => void;
  evaluarAssessment: () => void;
  evaluandoAssessment: boolean;
}) {
  const opts = [
    { v: "RFI", sigla: "RFI", nombre: "Solicitud de Información", texto: "Todavía estoy explorando opciones, no sé qué existe en el mercado." },
    { v: "RFQ", sigla: "RFQ", nombre: "Solicitud de Cotización", texto: "Ya sé qué necesito, solo me falta comparar precio y tiempos." },
    { v: "RFP", sigla: "RFP", nombre: "Solicitud de Propuesta", texto: "Tengo un problema o proyecto amplio, busco que el proveedor proponga una solución." },
  ] as const;
  const sinSugerencia = estado.confianzaClasificacion < 0.7;
  return (
    <div className="flex-1 flex flex-col w-full step-enter">

      <div className="bg-canvas rounded-sm border border-hairline/60 p-6 md:p-8 mb-5  relative overflow-hidden" role="status" aria-live="polite">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full translate-x-4 -translate-y-4" />
        <div className="flex items-center gap-2 mb-5 relative z-10 flex-wrap">
          {clasificandoIA ? (
            <span className="bg-primary text-white text-caption font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
              Clasificando…
            </span>
          ) : estado.clasificacionError ? (
            <span className="bg-surface-soft text-ink text-caption font-bold px-2 py-1 rounded uppercase tracking-wider">
              Asistente no disponible
            </span>
          ) : estado.confianzaClasificacion >= 0.7 ? (
            <>
              <span className="bg-primary text-white text-caption font-bold px-2 py-1 rounded uppercase tracking-wider">
                Sugerencia del asistente
              </span>
              <span className="text-xs font-semibold text-success uppercase tracking-wider">
                {Math.round(estado.confianzaClasificacion * 100)}% confianza
              </span>
            </>
          ) : (
            <span className="bg-surface-dark-soft text-white text-caption font-bold px-2 py-1 rounded uppercase tracking-wider">
              Sin sugerencia
            </span>
          )}
        </div>
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight mb-3 text-ink relative z-10">
          {clasificandoIA
            ? "Analizando su solicitud…"
            : !sinSugerencia
              ? <>Esto parece una <span className={"font-semibold " + tipoTextoColor()}>{estado.clasificacion}</span></>
              : "Elija el tipo que mejor describa su necesidad"}
        </h2>
        {!sinSugerencia ? (
          <>
            <p className="text-sm font-semibold text-ink relative z-10 mb-2">
              {estado.clasificacion === "RFQ"
                ? "Solicitud de Cotización"
                : estado.clasificacion === "RFI"
                  ? "Solicitud de Información"
                  : "Solicitud de Propuesta"}
            </p>
            <p className="text-caption text-body relative z-10 max-w-md leading-relaxed mb-1">
              {estado.clasificacion === "RFQ"
                ? "Ya sabe exactamente qué necesita — solo nos falta cotizar el precio con los proveedores del mercado."
                : estado.clasificacion === "RFI"
                  ? "Todavía estás explorando qué existe en el mercado antes de decidir."
                  : "Tiene un problema o proyecto amplio y busca que un proveedor proponga la solución."}
            </p>
            {estado.razonamientoBreve ? (
              <p className="text-caption text-body italic relative z-10">Razón: {estado.razonamientoBreve}</p>
            ) : null}
          </>
        ) : (
          <>
            {/* Nunca culpamos al solicitante: si fue la IA la que no respondió, se dice eso. */}
            <p className="text-caption text-body relative z-10 max-w-md leading-relaxed">
              {estado.clasificacionError
                ? "El asistente automático no pudo responder ahora mismo. Puede seguir igual: elija una opción y la solicitud continúa."
                : "El asistente no está seguro de qué tipo encaja mejor. Elija una opción y siga — puede cambiarla después con el coordinador."}
            </p>
            {estado.clasificacionError ? (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={clasificarIA}
                  data-reintentar-ia
                  className="min-h-[36px] px-3 text-xs font-semibold text-ink bg-canvas border border-hairline rounded-sm"
                >
                  Reintentar clasificación
                </button>
                <span className="text-caption text-body">También puede continuar manualmente.</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <p className="text-sm text-body mb-3 font-medium">¿No le parece correcto? Puede cambiarlo con un clic:</p>
      <div className="space-y-3 mb-6">
        {opts.map((o) => (
          <label key={o.v} className={"group flex items-start gap-3 p-4 rounded-sm border border-hairline bg-canvas cursor-pointer hover:border-[var(--color-border-strong)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-border-strong)] has-[:checked]:ring-1 transition-all  " + (estado.clasificacion === o.v ? tipoCardChecked() : "")}>
            <input type="radio" name="classif" checked={estado.clasificacion === o.v} onChange={() => { set("clasificacion", o.v); set("clasificacionCorregida", true); }} className="sr-only" />
            <div className={"mt-0.5 w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center transition-colors " + (estado.clasificacion === o.v ? tipoRadioOn() : "border-hairline")}>
              <div className="w-1.5 h-1.5 bg-canvas rounded-sm" style={{ opacity: estado.clasificacion === o.v ? 1 : 0 }} />
            </div>
            <div>
              <div className="text-sm font-medium text-ink leading-none mb-1.5">
                {o.sigla} <span className="text-xs text-body font-normal ml-1">— {o.nombre}</span>
              </div>
              <div className="text-caption text-body">{"«" + o.texto + "»"}</div>
            </div>
          </label>
        ))}
      </div>
      <PasoAcciones atras={anterior}>
        <button onClick={() => { evaluarAssessment(); siguiente(); }} disabled={evaluandoAssessment} className="bg-primary text-white text-sm px-6 min-h-[44px] rounded-sm font-medium hover:bg-surface-dark-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
          {evaluandoAssessment ? "Evaluando…" : "Confirmar clasificación"}
          <svg className="text-sm" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </PasoAcciones>
    </div>
  );
}

/* ---------- STEP 4: Detalles técnicos ---------- */
function PasoDetalles({
  estado,
  set,
  siguiente,
  anterior,
  pasoValido,
  faltantes,
  evaluandoAssessment,
  evaluarAssessment,
  elegirArchivoLogo,
  errorArchivo,
  limpiarErrorArchivo,
  reintentarConContexto,
}: {
  estado: WizardState;
  set: <K extends keyof WizardState>(key: K, valor: WizardState[K]) => void;
  siguiente: () => void;
  anterior: () => void;
  pasoValido: boolean;
  faltantes: string[];
  evaluandoAssessment: boolean;
  evaluarAssessment: () => void;
  elegirArchivoLogo: (f: File | null) => Promise<{ ok: boolean; mensaje?: string }>;
  errorArchivo: string | null;
  limpiarErrorArchivo: () => void;
  reintentarConContexto: (extra: string) => Promise<void>;
}) {
  const [contextoExtra, setContextoExtra] = useState("");
  const hayPreguntas = estado.assessmentPreguntas.length > 0 || (estado.camposPlantilla?.length ?? 0) > 0;
  return (
    <div className="flex-1 flex flex-col w-full step-enter pb-0 relative">
      {evaluandoAssessment ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-canvas/80 backdrop-blur-[3px] rounded-sm" role="status" aria-live="polite">
          <svg className="animate-spin text-ink" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <circle cx="12" cy="12" r="10" opacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          <div className="text-lg font-bold text-ink text-center px-6">Preparando preguntas del asistente…</div>
          <div className="text-sm text-body text-center px-6">Analizando su solicitud para preguntar lo que los proveedores necesitan</div>
          <div className="w-56 h-1.5 rounded-sm bg-surface-soft overflow-hidden">
            <div className="h-full w-1/3 rounded-sm bg-primary animate-pulse" />
          </div>
        </div>
      ) : null}
      {/* Estado de error del asistente: visible, accionable y sin culpar al solicitante. */}
      {estado.assessmentEstado === "error" ? (
        <div className="mb-5 rounded-sm border border-hairline bg-surface-soft/80 p-5" role="alert" data-reintentar-ia>
          <div className="text-sm font-semibold text-ink mb-1">No pudimos preparar las preguntas del asistente</div>
          <p className="text-caption text-ink leading-relaxed mb-3">
            {estado.assessmentError ?? "El asistente no respondió."} Puede reintentar o continuar sin ellas: Compras te va a pedir lo que falte.
          </p>
          <button
            type="button"
            disabled={evaluandoAssessment}
            onClick={() => evaluarAssessment()}
            className="min-h-[40px] bg-primary text-white text-xs px-5 rounded-sm font-medium hover:bg-surface-dark-soft disabled:opacity-40"
          >
            {evaluandoAssessment ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      ) : null}

      {/* F2: la IA necesita más contexto antes de preguntar */}
      {estado.contextoInsuficiente ? (
        <div className="mb-5 rounded-sm border border-hairline bg-surface-soft/70 p-5">
          <div className="text-sm font-semibold text-ink mb-1">Necesitamos un poco más de contexto</div>
          <p className="text-xs text-ink leading-relaxed mb-3">
            Para hacer las preguntas correctas a los proveedores, cuéntenos un poco más de lo que necesita:
          </p>
          {estado.preguntasContexto.length > 0 ? (
            <ul className="list-disc pl-5 mb-3 space-y-1">
              {estado.preguntasContexto.map((p, i) => (
                <li key={i} className="text-xs text-ink">{p}</li>
              ))}
            </ul>
          ) : null}
          <label htmlFor="contexto-extra" className="sr-only">Detalle adicional para el asistente</label>
          <textarea
            id="contexto-extra"
            value={contextoExtra}
            onChange={(e) => setContextoExtra(e.target.value)}
            rows={3}
            placeholder="Ej.: pelota de fútbol tamaño 5, para torneo juvenil al aire libre, con los colores de la marca…"
            className="w-full bg-canvas border border-hairline rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-[var(--color-border-strong)]  resize-none"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!contextoExtra.trim() || evaluandoAssessment}
              onClick={() => { reintentarConContexto(contextoExtra); setContextoExtra(""); }}
              className="min-h-[40px] bg-primary text-white text-xs px-5 rounded-sm font-medium hover:bg-surface-dark-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {evaluandoAssessment ? "Reanalizando…" : "Reintentar con más detalle"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="bg-canvas rounded-sm border border-hairline/60 p-5 md:p-6 mb-4 ">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-caption font-semibold uppercase tracking-wider text-body">Información de su solicitud</span>
        </div>
        <div className="mb-5 rounded-sm bg-surface-soft border border-hairline p-4">
          <div className="text-sm font-medium text-ink mb-1 break-words">{estado.titulo || "Sin título"}</div>
          <div className="text-caption text-body line-clamp-2">{estado.descripcion || "Sin descripción adicional."}</div>
        </div>
        <div className="flex items-center justify-between gap-3 p-4 bg-surface-soft border border-hairline rounded-sm">
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink mb-0.5">¿Lleva marca o branding?</div>
            <div className="text-caption text-body leading-tight">Material POP, uniformes, empaques, etc.</div>
          </div>
          <button
            type="button"
            aria-pressed={estado.llevaBranding}
            aria-label="¿Lleva marca o branding?"
            onClick={() => { set("llevaBranding", !estado.llevaBranding); limpiarErrorArchivo(); }}
            className={"relative shrink-0 ml-2 w-12 h-7 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-strong)] " + (estado.llevaBranding ? "bg-primary" : "bg-surface-soft")}
          >
            <span className={"absolute top-[3px] left-[3px] w-5 h-5 bg-canvas border border-hairline rounded-sm transition-transform " + (estado.llevaBranding ? "translate-x-5" : "")} />
          </button>
        </div>
      </div>

      {estado.llevaBranding ? (
        <div
          className={"border-2 border-dashed rounded-sm p-6 bg-canvas transition-colors mb-5  " + (estado.archivoLogo ? "border-[var(--color-text-success)] bg-surface-soft" : errorArchivo ? "border-[var(--color-text-critical)] bg-canvas" : "border-hairline hover:bg-surface-soft")}
        >
          <label className="flex flex-col items-center justify-center cursor-pointer">
            <input
              type="file"
              className="sr-only"
              accept={ACCEPT_ARCHIVO}
              aria-invalid={errorArchivo ? true : false}
              aria-describedby={errorArchivo ? "error-archivo" : "hint-archivo"}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void elegirArchivoLogo(f);
                e.target.value = "";
              }}
            />
            <div className={"w-12 h-12 rounded-sm flex items-center justify-center mb-3 " + (estado.archivoLogo ? "bg-surface-soft" : "bg-surface-soft")}>
              {estado.archivoLogo ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success"><path d="M5 13l4 4L19 7"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-body"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16"/></svg>
              )}
            </div>
            <span className="text-sm font-medium text-ink mb-1 text-center break-words px-2">{estado.archivoLogo || "Subir arte o logo oficial"}</span>
            <span className="inline-flex min-h-[40px] items-center text-xs font-semibold text-ink bg-surface-soft border border-hairline rounded-sm px-4">
              Elegir archivo
            </span>
            <span id="hint-archivo" className="text-caption text-body text-center max-w-xs leading-relaxed mt-2">
              PNG, JPG o PDF, hasta {MAX_MB_ARCHIVO} MB de tamaño. <span className="font-semibold text-body">Obligatorio</span> para que el proveedor use la versión correcta.
            </span>
            {errorArchivo ? (
              <span id="error-archivo" role="alert" className="text-xs font-semibold text-critical text-center max-w-xs mt-2">
                {errorArchivo}
              </span>
            ) : null}
          </label>
        </div>
      ) : null}

      {estado.contextoInvestigado?.trim() ? (
        <div className="mb-5 rounded-sm border border-hairline bg-surface-soft/70 px-4 py-3" role="note" aria-label="Qué entendimos de su solicitud">
          <div className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <p className="text-caption leading-relaxed text-ink">{estado.contextoInvestigado.trim()}</p>
          </div>
        </div>
      ) : null}

      {estado.camposPlantilla && estado.camposPlantilla.length > 0 ? (
        <div className="mb-5 space-y-4" role="group" aria-label="Información comercial" aria-live="polite">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-success"><path d="M4 5l3 4L19 7"/><circle cx="6.5" cy="18.5" r="1.5"/></svg>
            <span className="block text-xs font-semibold text-ink uppercase tracking-wider">
              Información comercial ({estado.camposPlantilla.length})
            </span>
          </div>
          {estado.camposPlantilla.map((cp) => (
            <CampoRespuesta
              key={cp.campoKey}
              etiqueta={cp.label}
              obligatorio={cp.obligatorio}
              ayuda={cp.ayuda}
              respuesta={estado.assessmentRespuestas[cp.campoKey]}
              onRespuesta={(valor, noSe) =>
                set("assessmentRespuestas", { ...estado.assessmentRespuestas, [cp.campoKey]: { valor, noSe } })
              }
            />
          ))}
        </div>
      ) : null}

      {estado.assessmentPreguntas.length > 0 ? (
        <div className="mb-5 space-y-4" role="group" aria-label="Preguntas del asistente" aria-live="polite">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
            <span className="block text-xs font-semibold text-ink uppercase tracking-wider">
              El asistente necesita estos detalles ({estado.assessmentPreguntas.length})
            </span>
          </div>
          {estado.assessmentPreguntas.map((aq, i) => (
            <CampoRespuesta
              key={aq.campoKey || `p-${i}`}
              etiqueta={aq.pregunta}
              obligatorio={aq.critica}
              ayuda={aq.ejemplo ? `Ej.: ${aq.ejemplo}` : undefined}
              sugerencias={aq.sugerencias}
              respuesta={estado.assessmentRespuestas[aq.campoKey]}
              onRespuesta={(valor, noSe) =>
                set("assessmentRespuestas", { ...estado.assessmentRespuestas, [aq.campoKey]: { valor, noSe } })
              }
            />
          ))}
        </div>
      ) : null}

      {estado.assessmentEstado === "listo" && !hayPreguntas ? (
        <p className="text-sm text-body mb-5">
          El asistente no necesita datos adicionales: con lo que escribiste alcanza para cotizar.
        </p>
      ) : null}

      <PasoAcciones atras={anterior} motivo={pasoValido ? "" : `Falta: ${faltantes.join(", ")}`}>
        <button onClick={siguiente} disabled={!pasoValido || evaluandoAssessment} className="bg-primary text-white text-sm px-6 min-h-[44px] rounded-sm font-medium hover:bg-surface-dark-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
          Generar documento
          <svg className="text-sm" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/></svg>
        </button>
      </PasoAcciones>
    </div>
  );
}

/** Campo de respuesta del assessment: texto + "No lo sé" + sugerencias. */
function CampoRespuesta({
  etiqueta,
  ayuda,
  obligatorio,
  sugerencias,
  respuesta,
  onRespuesta,
}: {
  etiqueta: string;
  ayuda?: string;
  obligatorio?: boolean;
  sugerencias?: string[];
  respuesta?: { valor: string; noSe: boolean };
  onRespuesta: (valor: string, noSe: boolean) => void;
}) {
  const completada = respuesta?.noSe === true || (respuesta?.valor ?? "").trim().length > 0;
  // El id se deriva de useId, no del texto de la pregunta: dos preguntas de la IA que
  // comparten los primeros 40 caracteres producían el MISMO id, y el <label for> del
  // segundo campo enfocaba el input del primero (A11.4).
  const id = `campo-${useId()}`;
  return (
    <div className={"rounded-sm border p-5 transition-all " + (completada ? "bg-surface-soft border-hairline" : "bg-surface-soft/40 border-hairline")}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <label htmlFor={id} className={"font-semibold text-ink text-[15px] " + (respuesta?.noSe ? "text-body" : "")}>
          {etiqueta}
          {obligatorio ? <span className="text-body"> *</span> : null}
        </label>
        <span className={"shrink-0 inline-flex items-center gap-1 text-caption font-bold uppercase tracking-wider px-2 py-1 rounded-sm " + (completada ? "bg-surface-soft text-success" : "bg-surface-soft text-ink")}>
          {completada ? "Listo" : "Pendiente"}
        </span>
      </div>
      {sugerencias && sugerencias.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <span className="text-caption text-body font-semibold uppercase tracking-wider">Sugerido:</span>
          {sugerencias.map((sug) => {
            const activa = respuesta?.valor === sug;
            return (
              <button
                key={sug}
                type="button"
                title={sug}
                onClick={() => onRespuesta(activa ? "" : sug, false)}
                className={"text-xs font-semibold px-3 min-h-[36px] rounded-sm border transition-all max-w-[240px] truncate " + (activa ? "bg-primary text-white border-[var(--color-border-strong)]" : "bg-canvas text-body border-hairline hover:border-hairline hover:text-ink")}
              >
                {sug}
              </button>
            );
          })}
          <span className="text-caption text-body italic">o escriba su propia respuesta:</span>
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id={id}
          type="text"
          value={respuesta?.valor ?? ""}
          onChange={(e) => onRespuesta(e.target.value, false)}
          placeholder={ayuda || etiqueta}
          disabled={respuesta?.noSe === true}
          className={"w-full min-h-[44px] bg-canvas border rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:ring-1 transition-all " + (respuesta?.noSe === true ? "opacity-50 border-hairline" : "border-hairline focus:border-[var(--color-border-strong)] ")}
        />
        <label className={"shrink-0 inline-flex items-center justify-center gap-2 px-3.5 min-h-[44px] rounded-sm border text-xs font-semibold cursor-pointer transition-all select-none " + (respuesta?.noSe === true ? "bg-surface-soft border-hairline text-ink" : "bg-canvas border-hairline text-body hover:border-[var(--color-border-strong)]")}>
          <input
            type="checkbox"
            checked={respuesta?.noSe === true}
            onChange={(e) => onRespuesta("", e.target.checked)}
            className="w-4 h-4 rounded accent-[var(--color-bg-primary)]"
          />
          No lo sé
        </label>
      </div>
    </div>
  );
}

/* ---------- STEP 5: Documento ---------- */
function PasoDocumento({
  estado,
  set,
  enviarSolicitud,
  anterior,
  envio,
  coordinadores,
  persistenciaOk,
}: {
  estado: WizardState;
  set: <K extends keyof WizardState>(key: K, valor: WizardState[K]) => void;
  enviarSolicitud: () => void;
  anterior: () => void;
  envio: EstadoEnvio;
  coordinadores: CoordinadorPublico[];
  /** Para no prometer un borrador guardado cuando el navegador no lo permitió (A11.3). */
  persistenciaOk: boolean;
}) {
  const coordSeleccionado = coordinadores.find((c) => c.id === estado.coordinadorId);
  const cargandoCompradores = coordinadores.length === 0;
  return (
    // min-h-full (no h-full): con h-full los flex-hijos se comprimían y la tarjeta
    // con overflow-hidden recortaba el contenido tras la descripción (bug reportado).
    <div className="flex-1 flex flex-col w-full step-enter">
      <div className="bg-canvas rounded-sm border border-hairline  p-6 relative mx-auto w-full max-w-md overflow-hidden mb-5 shrink-0">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-mint" />
        <div className="flex justify-between items-start mb-6 mt-2 border-b border-hairline pb-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold tracking-tighter">BIA</span>
            </div>
            <div className="min-w-0">
              <span className="block text-caption font-semibold text-body uppercase tracking-wider mb-0.5">Referencia Única</span>
              <span className="block text-sm font-mono font-semibold text-body break-all">{`${estado.clasificacion || "SOL"}-${new Date().getFullYear()}-XXXX`}</span>
              <span className="block text-caption text-body mt-0.5">La referencia definitiva se asigna al enviar</span>
            </div>
          </div>
          <span className={tipoBadgeClases()}>
            {estado.clasificacion}
          </span>
        </div>
        <div className="space-y-5">
          <div>
            <span className="block text-caption text-body uppercase tracking-wider mb-1 font-semibold">Título de la Solicitud</span>
            <span className="text-sm font-medium text-ink leading-snug break-words">{estado.titulo || "—"}</span>
          </div>
          {estado.descripcion ? (
            <div>
              <span className="block text-caption text-body uppercase tracking-wider mb-1 font-semibold">Descripción</span>
              <span className="text-caption font-medium text-ink leading-relaxed break-words whitespace-pre-wrap">{estado.descripcion}</span>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <span className="block text-caption text-body uppercase tracking-wider mb-1 font-semibold">Solicitante</span>
              <span className="text-caption font-medium text-ink break-words">{estado.nombre || "—"}</span>
            </div>
            <div>
              <span className="block text-caption text-body uppercase tracking-wider mb-1 font-semibold">Área</span>
              <span className="text-caption font-medium text-ink break-words">{estado.area || "—"}</span>
            </div>
            <div>
              <span className="block text-caption text-body uppercase tracking-wider mb-1 font-semibold">Tipo de necesidad</span>
              <span className="text-caption font-medium text-ink break-words">{nombreCategoria(estado.tipoNecesidad)}</span>
            </div>
            <div>
              <span className="block text-caption text-body uppercase tracking-wider mb-1 font-semibold">Fecha requerida</span>
              <span className="text-caption font-medium text-ink">{formatoFechaLegible(estado.fechaRequerida)}</span>
            </div>
          </div>
          <div className="bg-surface-soft rounded-sm p-3 border border-hairline flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-body mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <div>
              <span className="block text-caption text-body uppercase tracking-wider mb-0.5 font-semibold">Clasificación Asignada</span>
              <span className="text-caption font-medium text-ink">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <span className={tipoDotClases()} />
                  {estado.clasificacion}
                </span>{" "}
                — {tipoNombreCompleto(estado.clasificacion)}
              </span>
            </div>
          </div>
          {(estado.archivoLogo || estado.camposPlantilla?.length || estado.assessmentPreguntas.length) ? (
            <div className="border-t border-hairline pt-4 space-y-2.5">
              <span className="block text-caption text-body uppercase tracking-wider font-semibold">Detalles de la solicitud</span>
              {estado.archivoLogo ? (
                <div className="flex items-center justify-between gap-3 text-caption">
                  <span className="text-body shrink-0">Logo / arte del producto</span>
                  <span className="font-medium text-ink text-right truncate max-w-[60%]" title={estado.archivoLogo}>{estado.archivoLogo}</span>
                </div>
              ) : null}
              {estado.camposPlantilla?.map((cp) => {
                const r = estado.assessmentRespuestas[cp.campoKey];
                return (
                  <div key={cp.campoKey} className="flex items-start justify-between gap-3 text-caption border-b border-hairline pb-1.5">
                    <span className="text-body shrink-0 max-w-[45%]">{cp.label}</span>
                    <span className={"font-medium text-right break-words " + (r?.noSe ? "text-body italic" : "text-ink")}>
                      {r?.noSe ? "(no lo sé)" : r?.valor?.trim() ? r.valor : "—"}
                    </span>
                  </div>
                );
              })}
              {estado.assessmentPreguntas.map((q, i) => {
                const r = estado.assessmentRespuestas[q.campoKey];
                return (
                  <div key={q.campoKey || `q-${i}`} className="flex items-start justify-between gap-3 text-caption border-b border-hairline pb-1.5">
                    <span className="text-body shrink-0 max-w-[45%]">{q.pregunta}</span>
                    <span className={"font-medium text-right break-words " + (r?.noSe ? "text-body italic" : "text-ink")}>
                      {r?.noSe ? "(no lo sé)" : r?.valor?.trim() ? r.valor : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-canvas rounded-sm border border-hairline/70  p-5 md:p-6 mb-4 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
          <span className="block text-caption font-semibold uppercase tracking-wider text-body">¿A qué comprador va dirigida la solicitud?</span>
        </div>
        {cargandoCompradores ? (
          <p className="text-xs text-body mt-2" role="status">Cargando compradores…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
            {coordinadores.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => set("coordinadorId", c.id)}
                className={
                  "text-left rounded-sm border px-3.5 py-3 min-h-[44px] transition-all " +
                  (estado.coordinadorId === c.id
                    ? "border-[var(--color-border-strong)] bg-surface-soft ring-1 ring-[var(--color-border-strong)]"
                    : "border-hairline bg-canvas hover:border-[var(--color-border-strong)]")
                }
              >
                <span className={"block text-sm font-semibold " + (estado.coordinadorId === c.id ? "text-ink" : "text-ink")}>{c.nombre}</span>
                <span className="block text-caption text-body mt-0.5">
                  {c.categorias.length > 0 ? c.categorias.map((cat) => nombreCategoria(cat)).join(" · ") : "Todas las categorías"}
                </span>
              </button>
            ))}
          </div>
        )}
        {coordSeleccionado ? (
          <p className="mt-3 text-xs text-ink flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
            Irá asignada a <b>{coordSeleccionado.nombre}</b>
          </p>
        ) : !cargandoCompradores ? (
          <p className="mt-3 text-xs text-ink">No hay compradores configurados: Compras asignará uno al recibir la solicitud.</p>
        ) : null}
      </div>

      {envio.estado === "error" ? (
        <div role="alert" className="mb-4 rounded-sm border border-[var(--color-text-critical)] bg-surface-soft/70 p-4">
          <p className="text-caption text-critical leading-relaxed">{envio.mensaje}</p>
          {/* Solo se promete el respaldo si existe. Decirlo con el navegador en modo privado
              era una mentira que el solicitante pagaba al recargar y perderlo todo (A11.3). */}
          {persistenciaOk ? (
            <p className="text-caption text-critical/80 mt-1">Su solicitud no se perdió: quedó guardada como borrador en este navegador.</p>
          ) : (
            <p className="text-caption text-critical font-medium mt-1">Este navegador no nos dejó guardar copia: si cierra la pestaña, se pierde. Copie sus datos antes de salir.</p>
          )}
        </div>
      ) : null}

      {envio.estado === "enviando" ? <ProgresoEnvio key={envio.fase} fase={envio.fase} /> : null}

      <PasoAcciones atras={anterior}>
        <button onClick={enviarSolicitud} disabled={envio.estado === "enviando"} className="bg-primary text-white text-sm px-8 min-h-[44px] rounded-sm font-medium hover:bg-primary disabled:opacity-60 transition-all flex items-center gap-2  ">
          {envio.estado === "enviando" ? "Enviando…" : envio.estado === "error" ? "Reintentar envío" : "Enviar solicitud"}
          <svg className="text-sm" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </PasoAcciones>
    </div>
  );
}

/**
 * El envío son TRES llamadas encadenadas. Decir solo "Enviando…" durante 30 s a oscuras fue
 * justo lo que hizo perder la confianza del solicitante ("se tardó mucho en enviar"): no hay
 * forma de distinguir "está pensando" de "se colgó". Ahora se nombra la fase real y se cuenta
 * el tiempo, para que la espera sea información y no incertidumbre.
 */
function ProgresoEnvio({ fase }: { fase: FaseEnvio }) {
  // El contador se reinicia solo porque el padre lo monta con `key={fase}`: cada fase es
  // un componente nuevo, sin setState dentro de un efecto.
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="mb-4 rounded-sm border border-hairline bg-surface-soft/70 p-4 flex items-start gap-3">
      <span className="w-4 h-4 rounded-sm border-2 border-[var(--color-border-strong)] border-t-transparent animate-spin shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-caption font-semibold text-ink leading-snug">{TEXTO_FASE_ENVIO[fase]}</p>
        <p className="text-caption text-ink/80 mt-0.5">
          {segundos < 5
            ? "Esto puede tardar un momento la primera vez."
            : `Llevamos ${segundos} s. No cierres la pestaña.`}
        </p>
      </div>
    </div>
  );
}

/* ---------- STEP 6: Confirmación ---------- */
function PasoConfirmacion({ estado, referencia }: { estado: WizardState; referencia?: string }) {
  const docUrl = estado.solicitudId
    ? `/api/solicitudes/${estado.solicitudId}/documento?email=${encodeURIComponent(estado.email)}`
    : null;
  const pasos = [
    ["Compras cotiza", "El equipo pide ofertas a los proveedores de la categoría."],
    ["Recibe la comparativa", "Le llega un correo con el enlace para comparar."],
    ["Usted decide", "Elige la opción y Compras cierra la solicitud."],
  ];
  return (
    <div className="flex flex-col gap-6">
      <section className="on-dark relative isolate overflow-hidden rounded-sm bg-canvas-dark px-6 py-10 text-center">
        <Ribbon className="pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-30" />
        <div className="relative z-10 flex flex-col items-center">
          <span className="grid size-14 place-items-center rounded-sm bg-mint text-ink">
            <Icon name="check" size={26} />
          </span>
          <h1 className="mt-5 text-display-xl text-on-dark">Su solicitud fue enviada</h1>
          {referencia ? (
            <p className="mono-label mt-3 rounded-xs bg-surface-dark-soft px-3 py-1.5 text-on-dark">{referencia}</p>
          ) : null}
          <p className="mt-3 max-w-md text-caption text-on-dark-muted">
            Le avisaremos a <span className="font-medium text-on-dark break-all">{estado.email || "su correo"}</span> en
            cuanto haya una comparativa lista para que decida.
          </p>
        </div>
      </section>

      <section className="rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
        <p className="eyebrow mb-4 text-body">Qué sigue</p>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {pasos.map(([titulo, texto], i) => (
            <li key={titulo} className="flex gap-3">
              <span className="mono-label grid size-6 shrink-0 place-items-center rounded-xs bg-mint text-ink">
                {i + 1}
              </span>
              <span>
                <span className="block text-caption font-medium text-ink">{titulo}</span>
                <span className="block text-caption text-body">{texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {docUrl ? (
        <section className="flex flex-col gap-3 rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <span className="eyebrow text-body">Documento generado</span>
            <p className="mt-1 truncate text-body-md font-medium text-ink">{estado.titulo || "Solicitud"}</p>
            <p className="text-caption text-body">
              {estado.clasificacion} · {estado.email || "—"}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-sm bg-primary px-4 text-on-dark transition-colors hover:bg-surface-dark-soft"
            >
              <Icon name="file" size={14} />
              Ver PDF
            </a>
            <a
              href={docUrl}
              download={`${estado.solicitudId}.pdf`}
              className="mono-label inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-sm px-4 text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-colors hover:bg-surface-soft"
            >
              <Icon name="download" size={14} />
              Descargar
            </a>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-body">Comprador asignado: <span className="font-medium text-ink">Equipo Compras BIA</span></p>
        <div className="flex flex-wrap gap-2">
          <a
            href={estado.email ? `/mis-solicitudes?email=${encodeURIComponent(estado.email)}` : "/mis-solicitudes"}
            className="mono-label inline-flex min-h-[44px] items-center rounded-sm bg-primary px-4 text-on-dark transition-colors hover:bg-surface-dark-soft"
          >
            Ver mis solicitudes
          </a>
          <a
            href="/guias/manual-solicitante"
            className="mono-label inline-flex min-h-[44px] items-center rounded-sm px-4 text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-colors hover:bg-surface-soft"
          >
            Guía
          </a>
        </div>
      </div>
    </div>
  );
}

function diasHasta(fecha: string): number {
  const val = new Date(fecha);
  const hoy = new Date();
  return Math.ceil(Math.abs(val.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

/** Hoy en "YYYY-MM-DD" local: el `min` del input de fecha (no admite días pasados). */
function hoyISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Badge de tipo de solicitud: RFQ = celeste, RFI = naranja, RFP = amarillo.
function tipoBadgeClases(): string {
  return "px-2.5 py-1 rounded-xs text-caption font-bold uppercase tracking-wider bg-surface-soft text-ink border border-hairline";
}

function tipoDotClases(): string {
  return "w-2 h-2 rounded-sm bg-primary inline-block";
}

// Colores coherentes por tipo para los radio options del PasoClasificacion.
type ClasesTipo = { card: string; esquema: string };
function tipoVisual(): ClasesTipo {
  return {
    card: "border-[var(--color-border-strong)] ring-[var(--color-border-strong)] bg-surface-soft",
    esquema: "border-[var(--color-border-strong)] bg-primary",
  };
}

function tipoCardChecked(): string {
  return tipoVisual().card;
}

function tipoRadioOn(): string {
  return tipoVisual().esquema;
}

function tipoTextoColor(): string {
  return "text-ink";
}

function tipoNombreCompleto(tipo: string): string {
  if (tipo === "RFQ") return "Solicitud de Cotización";
  if (tipo === "RFI") return "Solicitud de Información";
  return "Solicitud de Propuesta";
}
