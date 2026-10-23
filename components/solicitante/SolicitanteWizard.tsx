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
    estado, set, siguiente, anterior, irA, pasoValido, obligatoriosPendientes, assessmentIncompleto, envio, enviarSolicitud,
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

  // El paso nuevo siempre arranca arriba. Antes el `<section>` conservaba el `scrollTop` del
  // paso anterior, así que al llegar al resumen el título ya estaba fuera de pantalla y el
  // solicitante veía la tarjeta a media altura sin saber en qué paso estaba.
  // `scrollTop` y no `scrollTo`: jsdom (los tests) no implementa `Element.scrollTo`.
  const refSeccion = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (refSeccion.current) refSeccion.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [estado.paso]);


  const pasoActual = Math.min(5, Math.max(1, estado.paso - 1));

  return (
    <div className="bia-ds bia-wizard flex min-h-dvh bg-canvas">
      <aside className="on-dark relative hidden w-[248px] shrink-0 flex-col overflow-hidden bg-canvas-dark p-4 lg:flex">
        <Ribbon className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full opacity-15" />
        <Link href="/" className="relative z-10 mb-8 flex items-center gap-2 px-2 pt-1">
          <MarcaBia onDark />
          <span className="text-body-md font-medium text-on-dark">Compras</span>
        </Link>

        <p className="eyebrow relative z-10 px-2 text-on-dark-muted">Solicitud</p>
        <ol className="relative z-10 mt-3 flex flex-col gap-0.5">
          {PASOS.map((paso, index) => {
            const isActive = estado.paso === paso.id;
            const isDone = estado.paso > paso.id;
            const alcanzable = paso.id <= estado.maxAlcanzado && paso.id < 6;
            const contenido = (
              <>
                <span
                  className={
                    "grid size-5 shrink-0 place-items-center rounded-xs " +
                    (isActive
                      ? "bg-canvas text-primary"
                      : isDone
                        ? "bg-primary text-on-dark"
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
                      (isActive ? "bg-primary" : "hover:bg-surface-dark-soft/60")
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

        <div className="relative z-10 mt-auto flex flex-col gap-3 pt-6">
          <div className="rounded-sm bg-surface-dark-soft px-3 py-2.5">
            <p className="truncate text-caption text-on-dark">{estado.titulo?.trim() || "Sin título"}</p>
            <div className="mt-2 h-1.5 w-full bg-[#26263a]">
              <div
                className="h-1.5 bg-primary transition-[width] duration-300"
                style={{ width: `${(pasoActual / 5) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-on-dark-muted">
              {listo ? "Enviada" : persistenciaOk ? "Borrador activo" : "Sin guardar"}
            </span>
            {!listo ? (
              <button
                type="button"
                onClick={guardarBorrador}
                aria-label="Guardar borrador"
                className="grid size-8 place-items-center rounded-sm bg-surface-dark-soft text-on-dark transition-colors hover:bg-[#3d4350]"
              >
                <Icon name="download" size={14} />
              </button>
            ) : null}
          </div>
          {!listo ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="text-left text-caption font-medium text-on-dark-muted transition-colors hover:text-on-dark"
            >
              Descartar
            </button>
          ) : null}
          <Link
            href="/mis-solicitudes"
            className="text-caption text-on-dark-muted underline underline-offset-4 transition-colors hover:text-on-dark"
          >
            Mis solicitudes
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 border-b border-hairline bg-canvas/95 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <MarcaBia />
            <div className="flex flex-1 items-center gap-1">
              {PASOS.map((p) => (
                <span
                  key={p.id}
                  className={
                    "h-1 flex-1 rounded-xs " +
                    (estado.paso > p.id
                      ? "bg-primary"
                      : estado.paso === p.id
                        ? "bg-primary opacity-30"
                        : "bg-surface-soft")
                  }
                />
              ))}
            </div>
            <span className="mono-label text-body">
              {indicePaso + 1}/{PASOS.length}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {!listo ? (
              <>
                <BotonBorradorMobile borradoAt={borradoAt} persistenciaOk={persistenciaOk} onGuardar={guardarBorrador} />
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="text-caption font-medium text-body"
                >
                  Descartar
                </button>
              </>
            ) : null}
            <Link href="/mis-solicitudes" className="ml-auto text-caption text-body underline underline-offset-4">
              Mis solicitudes
            </Link>
          </div>
        </div>

        <main ref={refSeccion} className="min-w-0 flex-1 px-4 pt-6 pb-16 sm:px-8 sm:pt-8">
          {estado.paso >= 2 && estado.paso <= 5 ? (
            <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
              <h1 className="text-display-lg text-ink">{TITULOS_PASO[estado.paso]}</h1>
              <span className="mono-label text-body">Paso {indicePaso + 1} de 5</span>
            </header>
          ) : null}
          <motion.div
            key={estado.paso}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease }}
            className="flex flex-col"
          >
          {estado.paso === 2 ? (
            <PasoCaptura estado={estado} set={set} siguiente={siguiente} pasoValido={pasoValido} clasificarIA={clasificarIA} clasificandoIA={clasificandoIA} />
          ) : estado.paso === 3 ? (
            <PasoClasificacion estado={estado} set={set} siguiente={siguiente} anterior={anterior} clasificandoIA={clasificandoIA} clasificarIA={clasificarIA} evaluarAssessment={evaluarAssessment} evaluandoAssessment={evaluandoAssessment} />
          ) : estado.paso === 4 ? (
            <PasoDetalles estado={estado} set={set} siguiente={siguiente} anterior={anterior} pasoValido={pasoValido} evaluandoAssessment={evaluandoAssessment} evaluarAssessment={evaluarAssessment} elegirArchivoLogo={elegirArchivoLogo} errorArchivo={errorArchivo} limpiarErrorArchivo={limpiarErrorArchivo} reintentarConContexto={reintentarConContexto} />
          ) : estado.paso === 5 ? (
            <PasoDocumento estado={estado} set={set} enviarSolicitud={intentarEnviar} anterior={anterior} envio={envio} coordinadores={coordinadores} persistenciaOk={persistenciaOk} />
          ) : estado.paso === 6 ? (
            <PasoConfirmacion
              estado={estado}
              referencia={envio.estado === "ok" ? envio.referencia : undefined}
              coordinadores={coordinadores}
            />
          ) : (
            /* Cualquier paso fuera de rango (solo alcanzable con estado corrupto) vuelve a
               la captura. Antes caía en la confirmación y decía "Su solicitud fue enviada". */
            <PasoCaptura estado={estado} set={set} siguiente={siguiente} pasoValido={pasoValido} clasificarIA={clasificarIA} clasificandoIA={clasificandoIA} />
          )}
          </motion.div>
        </main>
      </div>

      {pendienteBorrador ? (
        <Modal
          open
          onClose={retomarBorrador}
          title="Hay una solicitud a medias"
          className="bia-wizard max-w-[440px]"
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
          className="bia-wizard max-w-md"
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
              : obligatoriosPendientes.length === 1
                ? "Falta 1 dato obligatorio"
                : `Faltan ${obligatoriosPendientes.length} datos obligatorios`
          }
          className="bia-wizard max-w-md"
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
      className="mono-label min-h-[44px] rounded-sm px-3 text-body shadow-[inset_0_0_0_1px_var(--color-border-hairline)]"
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
function PasoAcciones({ atras, children }: { atras?: () => void; children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-canvas/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-t lg:border-hairline lg:bg-transparent lg:px-0 lg:pt-4 lg:pb-0 lg:backdrop-blur-none">
      {atras ? (
        <button
          type="button"
          onClick={atras}
          className="min-h-[44px] text-caption font-medium text-body transition-colors hover:text-ink"
        >
          Atrás
        </button>
      ) : (
        <span aria-hidden />
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
  clasificarIA,
  clasificandoIA,
}: {
  estado: WizardState;
  set: <K extends keyof WizardState>(key: K, valor: WizardState[K]) => void;
  siguiente: () => void;
  pasoValido: boolean;
  clasificarIA: () => void;
  clasificandoIA: boolean;
}) {
  // Deep link sin identidad (?nuevo=1 sin parámetros, o recarga de /solicitud/nueva):
  // sin esto el paso 2 exige un área que no hay dónde capturar y el flujo queda trabado.
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(estado.email.trim());
  const faltaIdentidad = !correoValido || !estado.area.trim() || !estado.nombre.trim();
  const [intentado, setIntentado] = useState(false);
  return (
    <div className="flex-1 flex flex-col w-full step-enter">
      {faltaIdentidad ? (
        <div className="mb-5 rounded-sm border border-hairline bg-surface-soft/70 p-5" role="region" aria-label="Datos de quien solicita">
          <p className="mono-label mb-3 text-body">Datos de quien solicita</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {!correoValido ? (
              <div className="sm:col-span-2">
                <label htmlFor="email-identidad" className="mb-1.5 block text-caption font-medium text-ink">
                  Su correo institucional
                </label>
                <input
                  id="email-identidad"
                  type="email"
                  value={estado.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="ejemplo@bia.com"
                  aria-invalid={intentado && !correoValido ? true : undefined}
                  className="min-h-[44px] w-full rounded-sm bg-canvas px-4 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-primary)]"
                />
                {intentado && !correoValido ? (
                  <p className="mt-1.5 text-caption text-critical">
                    {estado.email.trim() ? "El formato del correo es inválido." : "El correo es obligatorio."}
                  </p>
                ) : null}
              </div>
            ) : null}
            {!estado.nombre.trim() ? (
              <div>
                <label htmlFor="nombre-identidad" className="mb-1.5 block text-caption font-medium text-ink">
                  Su nombre completo
                </label>
                <input
                  id="nombre-identidad"
                  type="text"
                  value={estado.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  placeholder="Ej.: Juan Pérez"
                  className="min-h-[44px] w-full rounded-sm bg-canvas px-4 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-primary)]"
                />
              </div>
            ) : null}
            {!estado.area.trim() ? (
              <div>
                <label htmlFor="area-identidad" className="mb-1.5 block text-caption font-medium text-ink">
                  Área / departamento
                </label>
                <input
                  id="area-identidad"
                  type="text"
                  value={estado.area}
                  onChange={(e) => set("area", e.target.value)}
                  placeholder="Ej.: Marketing"
                  aria-invalid={intentado && !estado.area.trim() ? true : undefined}
                  className="min-h-[44px] w-full rounded-sm bg-canvas px-4 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-primary)]"
                />
                {intentado && !estado.area.trim() ? (
                  <p className="mt-1.5 text-caption text-critical">El área es obligatoria.</p>
                ) : null}
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
              aria-invalid={intentado && !estado.titulo.trim() ? true : undefined}
              className="min-h-[44px] w-full rounded-sm bg-canvas px-4 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-primary)]"
            />
            {intentado && !estado.titulo.trim() ? (
              <p className="mt-1.5 text-caption text-critical">El título es obligatorio.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="tipo-necesidad" className="mb-1.5 block text-caption font-medium text-ink">Categoría</label>
            <select
              id="tipo-necesidad"
              value={estado.tipoNecesidad}
              onChange={(e) => set("tipoNecesidad", e.target.value)}
              aria-invalid={intentado && !estado.tipoNecesidad ? true : undefined}
              className="min-h-[44px] w-full cursor-pointer rounded-sm bg-canvas px-4 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-primary)]"
            >
              <option value="" disabled>Seleccione…</option>
              {CATEGORIAS.map((c) => (
                <option key={c.clave} value={c.clave}>{c.etiqueta}</option>
              ))}
            </select>
            {intentado && !estado.tipoNecesidad ? (
              <p className="mt-1.5 text-caption text-critical">Elija una categoría.</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="fecha-requerida" className="mb-1.5 block text-caption font-medium text-ink">¿Para cuándo lo necesita?</label>
            <input
              id="fecha-requerida"
              type="date"
              min={hoyISO()}
              value={estado.fechaRequerida}
              onChange={(e) => set("fechaRequerida", e.target.value)}
              aria-invalid={
                (intentado && !estado.fechaRequerida) || (estado.fechaRequerida && fechaEnPasado(estado.fechaRequerida))
                  ? true
                  : undefined
              }
              aria-describedby={estado.fechaRequerida && fechaEnPasado(estado.fechaRequerida) ? "error-fecha-requerida" : undefined}
              className="min-h-[44px] w-full rounded-sm bg-canvas px-4 py-2.5 text-body-md text-body shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-primary)]"
            />
            {intentado && !estado.fechaRequerida ? (
              <p className="mt-1.5 text-caption text-critical">La fecha es obligatoria.</p>
            ) : estado.fechaRequerida && fechaEnPasado(estado.fechaRequerida) ? (
              <p id="error-fecha-requerida" role="alert" className="mt-1.5 text-caption text-critical">
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
                    <div className="flex h-full items-start gap-3 rounded-sm bg-canvas p-4 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-shadow peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-border-strong)] group-has-[:checked]:shadow-[inset_0_0_0_2px_var(--color-primary)]">
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
              Descripción breve
            </label>
            <textarea
              id="descripcion"
              value={estado.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={3}
              placeholder="Qué necesita, para qué y para cuándo"
              maxLength={5000}
              aria-invalid={intentado && !estado.descripcion.trim() ? true : undefined}
              className="w-full resize-none rounded-sm bg-canvas px-4 py-3 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-primary)]"
            />
            {intentado && !estado.descripcion.trim() ? (
              <p className="mt-1.5 text-caption text-critical">La descripción es obligatoria.</p>
            ) : null}
            <p className="mt-1 text-caption text-body md:hidden">{estado.descripcion.length}/5000 caracteres</p>
          </div>
        </div>
      </div>
      <PasoAcciones>
        <button
          onClick={() => {
            if (!pasoValido) {
              setIntentado(true);
              return;
            }
            clasificarIA();
            siguiente();
          }}
          disabled={clasificandoIA}
          className="bg-primary text-on-dark text-sm px-6 min-h-[44px] rounded-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2"
        >
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

      <div className="mb-5 rounded-sm bg-canvas p-6 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] md:p-8" role="status" aria-live="polite">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {clasificandoIA ? (
            <span className="mono-label flex items-center gap-1.5 text-primary">
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
              Clasificando…
            </span>
          ) : estado.clasificacionError ? (
            <span className="mono-label text-body">Asistente no disponible</span>
          ) : estado.confianzaClasificacion >= 0.7 ? (
            <>
              <span className="mono-label text-primary">Sugerencia del asistente</span>
              <span className="mono-label text-success">{Math.round(estado.confianzaClasificacion * 100)}% confianza</span>
            </>
          ) : (
            <span className="mono-label text-body">Sin sugerencia</span>
          )}
        </div>
        <h2 className="mb-2 text-display-md text-ink">
          {clasificandoIA
            ? "Analizando su solicitud…"
            : !sinSugerencia
              ? <>Esto parece una <span className="font-semibold">{estado.clasificacion}</span></>
              : "Elija el tipo que mejor describa su necesidad"}
        </h2>
        {!sinSugerencia ? (
          estado.razonamientoBreve ? (
            <p className="max-w-2xl text-body-md text-body">{estado.razonamientoBreve}</p>
          ) : null
        ) : (
          <>
            {/* Nunca culpamos al solicitante: si fue la IA la que no respondió, se dice eso. */}
            <p className="mt-1 max-w-2xl text-body-md text-body">
              {estado.clasificacionError
                ? "El asistente no pudo responder ahora mismo. Puede seguir igual eligiendo una opción."
                : "El asistente no está seguro de qué tipo encaja mejor. Elija una opción y siga — puede cambiarla después con el coordinador."}
            </p>
            {estado.clasificacionError ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={clasificarIA}
                  data-reintentar-ia
                  className="min-h-[36px] rounded-sm bg-canvas px-3 text-caption font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)]"
                >
                  Reintentar clasificación
                </button>
                <span className="text-caption text-body">También puede continuar manualmente.</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <p className="mb-3 text-caption font-medium text-body">¿No es correcto? Elija otro tipo:</p>
      <div className="mb-6 space-y-3">
        {opts.map((o) => {
          const activo = estado.clasificacion === o.v;
          return (
            <label key={o.v} className="group relative block cursor-pointer">
              <input type="radio" name="classif" checked={activo} onChange={() => { set("clasificacion", o.v); set("clasificacionCorregida", true); }} className="peer sr-only" />
              <div className="flex items-start gap-3 rounded-sm bg-canvas p-4 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-shadow group-hover:shadow-[inset_0_0_0_1px_var(--color-border-strong)] group-has-[:checked]:shadow-[inset_0_0_0_2px_var(--color-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-border-strong)]">
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
                  <span className="block text-body-md font-medium text-ink">
                    {o.sigla} <span className="font-normal text-body">— {o.nombre}</span>
                  </span>
                  <span className="mt-0.5 block text-caption text-body">{o.texto}</span>
                </span>
              </div>
            </label>
          );
        })}
      </div>
      <PasoAcciones atras={anterior}>
        <button onClick={() => { evaluarAssessment(); siguiente(); }} disabled={evaluandoAssessment} className="flex min-h-[44px] items-center gap-2 rounded-sm bg-primary px-6 text-body-md font-medium text-on-dark transition-colors hover:bg-surface-dark-soft disabled:cursor-not-allowed disabled:opacity-40">
          {evaluandoAssessment ? "Evaluando…" : "Confirmar clasificación"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
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
  evaluandoAssessment: boolean;
  evaluarAssessment: () => void;
  elegirArchivoLogo: (f: File | null) => Promise<{ ok: boolean; mensaje?: string }>;
  errorArchivo: string | null;
  limpiarErrorArchivo: () => void;
  reintentarConContexto: (extra: string) => Promise<void>;
}) {
  const [contextoExtra, setContextoExtra] = useState("");
  const [intentado, setIntentado] = useState(false);
  const refArchivo = useRef<HTMLDivElement | null>(null);
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
            {estado.assessmentError ?? "El asistente no respondió."}
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
          {estado.preguntasContexto.length > 0 ? (
            <ul className="mb-3 list-disc space-y-1 pl-5">
              {estado.preguntasContexto.map((p, i) => (
                <li key={i} className="text-caption text-ink">{p}</li>
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
              className="min-h-[40px] rounded-sm bg-primary px-5 text-caption font-medium text-on-dark transition-colors hover:bg-surface-dark-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {evaluandoAssessment ? "Reanalizando…" : "Reintentar"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] md:p-6">
        <p className="mono-label mb-3 text-body">Información de su solicitud</p>
        <div className="mb-5 rounded-sm bg-surface-soft p-4">
          <div className="mb-1 break-words text-body-md font-medium text-ink">{estado.titulo || "Sin título"}</div>
          <div className="line-clamp-2 text-caption text-body">{estado.descripcion || "Sin descripción adicional."}</div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-sm bg-surface-soft p-4">
          <div className="text-body-md font-medium text-ink">¿Lleva marca o branding?</div>
          <div className="flex items-center gap-2.5">
            <span className="text-caption text-body">{estado.llevaBranding ? "Sí" : "No"}</span>
            <button
              type="button"
              aria-pressed={estado.llevaBranding}
              aria-label="¿Lleva marca o branding?"
              onClick={() => { set("llevaBranding", !estado.llevaBranding); limpiarErrorArchivo(); }}
              className={"relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-strong)] " + (estado.llevaBranding ? "bg-primary" : "bg-[var(--color-border-hairline)]")}
            >
              <span className={"absolute left-0.5 top-0.5 size-5 rounded-full bg-canvas shadow-sm transition-transform " + (estado.llevaBranding ? "translate-x-5" : "")} />
            </button>
          </div>
        </div>
      </div>

      {estado.llevaBranding ? (
        <div
          ref={refArchivo}
          className={"mb-5 rounded-sm border border-dashed p-6 bg-canvas transition-colors " + (estado.archivoLogo ? "border-[var(--color-text-success)] bg-surface-soft" : errorArchivo ? "border-[var(--color-text-critical)] bg-canvas" : "border-hairline hover:bg-surface-soft")}
        >
          <label className="flex cursor-pointer flex-col items-center justify-center">
            <input
              type="file"
              className="sr-only"
              accept={ACCEPT_ARCHIVO}
              aria-invalid={errorArchivo || (intentado && !estado.archivoLogo) ? true : false}
              aria-describedby={errorArchivo ? "error-archivo" : intentado && !estado.archivoLogo ? "error-archivo-requerido" : "hint-archivo"}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void elegirArchivoLogo(f);
                e.target.value = "";
              }}
            />
            <div className={"mb-3 grid size-12 place-items-center rounded-sm " + (estado.archivoLogo ? "bg-[var(--color-text-success)]/10" : "bg-surface-soft")}>
              {estado.archivoLogo ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success"><path d="M5 13l4 4L19 7"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-body"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16"/></svg>
              )}
            </div>
            <span className="mb-1 break-words px-2 text-center text-body-md font-medium text-ink">{estado.archivoLogo || "Subir arte o logo oficial"}</span>
            <span className="inline-flex min-h-[36px] items-center rounded-sm bg-canvas px-4 text-caption font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
              {estado.archivoLogo ? "Cambiar archivo" : "Elegir archivo"}
            </span>
            <span id="hint-archivo" className="mt-2 text-caption text-body">
              PNG, JPG o PDF · {MAX_MB_ARCHIVO} MB
            </span>
            {errorArchivo ? (
              <span id="error-archivo" role="alert" className="mt-2 max-w-xs text-center text-caption font-medium text-critical">
                {errorArchivo}
              </span>
            ) : intentado && !estado.archivoLogo ? (
              <span id="error-archivo-requerido" role="alert" className="mt-2 text-center text-caption font-medium text-critical">
                Suba el arte o logo oficial para continuar.
              </span>
            ) : null}
          </label>
        </div>
      ) : null}

      {estado.camposPlantilla && estado.camposPlantilla.length > 0 ? (
        <div className="mb-5 space-y-4" role="group" aria-label="Información comercial" aria-live="polite">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-success"><path d="M4 5l3 4L19 7"/><circle cx="6.5" cy="18.5" r="1.5"/></svg>
            <span className="mono-label text-body">
              Información comercial ({estado.camposPlantilla.length})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>
      ) : null}

      {estado.assessmentPreguntas.length > 0 ? (
        <div className="mb-5 space-y-4" role="group" aria-label="Preguntas del asistente" aria-live="polite">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-body"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
            <span className="mono-label text-body">
              El asistente necesita estos detalles ({estado.assessmentPreguntas.length})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>
      ) : null}

      {estado.assessmentEstado === "listo" && !hayPreguntas ? (
        <p className="text-sm text-body mb-5">
          El asistente no necesita datos adicionales: con lo que escribió alcanza para cotizar.
        </p>
      ) : null}

      <PasoAcciones atras={anterior}>
        <button
          onClick={() => {
            if (!pasoValido) {
              setIntentado(true);
              requestAnimationFrame(() => refArchivo.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
              return;
            }
            siguiente();
          }}
          disabled={evaluandoAssessment}
          className="flex min-h-[44px] items-center gap-2 rounded-sm bg-primary px-6 text-body-md font-medium text-on-dark transition-colors hover:bg-surface-dark-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generar documento
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"/></svg>
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
    <div className={"rounded-sm p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-colors " + (completada ? "bg-surface-soft" : "bg-canvas")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <label htmlFor={id} className={"text-body-md font-medium " + (respuesta?.noSe ? "text-body" : "text-ink")}>
          {etiqueta}
        </label>
        <span className={"mono-label shrink-0 " + (completada ? "text-success" : "text-body")}>
          {completada ? "Listo" : "Pendiente"}
        </span>
      </div>
      {sugerencias && sugerencias.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="mono-label text-body">Sugerido:</span>
          {sugerencias.map((sug) => {
            const activa = respuesta?.valor === sug;
            return (
              <button
                key={sug}
                type="button"
                title={sug}
                onClick={() => onRespuesta(activa ? "" : sug, false)}
                className={"max-w-[240px] truncate rounded-sm px-3 text-caption font-medium transition-colors " + (activa ? "min-h-[32px] bg-primary text-on-dark" : "min-h-[32px] bg-canvas text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)]")}
              >
                {sug}
              </button>
            );
          })}
          <span className="text-caption text-body">o escriba su respuesta:</span>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={id}
          type="text"
          value={respuesta?.valor ?? ""}
          onChange={(e) => onRespuesta(e.target.value, false)}
          placeholder={ayuda || "Escriba su respuesta"}
          aria-required={obligatorio ? true : undefined}
          disabled={respuesta?.noSe === true}
          className={"min-h-[44px] w-full rounded-sm bg-canvas px-4 py-2.5 text-body-md text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-primary)] disabled:opacity-50"}
        />
        <label className={"inline-flex min-h-[44px] shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-sm px-3.5 text-caption font-medium transition-colors " + (respuesta?.noSe === true ? "bg-surface-soft text-ink" : "bg-canvas text-body shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:text-ink")}>
          <input
            type="checkbox"
            checked={respuesta?.noSe === true}
            onChange={(e) => onRespuesta("", e.target.checked)}
            className="size-4 rounded accent-[var(--color-bg-primary)]"
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
      <div className="relative mb-5 w-full shrink-0 overflow-hidden rounded-sm bg-canvas p-6 shadow-[inset_0_0_0_1px_var(--color-border-hairline)]">
        <div className="absolute left-0 top-0 h-1.5 w-full bg-primary" />
        <div className="flex justify-between items-start mb-6 mt-2 border-b border-hairline pb-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold tracking-tighter">BIA</span>
            </div>
            <div className="min-w-0">
              <span className="mono-label mb-0.5 block text-body">Referencia única</span>
              <span className="block break-all font-mono text-body-md font-semibold text-ink">{`${estado.clasificacion || "SOL"}-${new Date().getFullYear()}-XXXX`}</span>
              <span className="mt-0.5 block text-caption text-body">La referencia definitiva se asigna al enviar</span>
            </div>
          </div>
          <span className={tipoBadgeClases()}>
            {estado.clasificacion}
          </span>
        </div>
        <div className="space-y-5">
          <div>
            <span className="mono-label mb-1 block text-body">Título de la solicitud</span>
            <span className="break-words text-body-md font-medium leading-snug text-ink">{estado.titulo || "—"}</span>
          </div>
          {estado.descripcion ? (
            <div>
              <span className="mono-label mb-1 block text-body">Descripción</span>
              <span className="whitespace-pre-wrap break-words text-body-md leading-relaxed text-ink">{estado.descripcion}</span>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <span className="mono-label mb-1 block text-body">Solicitante</span>
              <span className="break-words text-body-md text-ink">{estado.nombre || "—"}</span>
            </div>
            <div>
              <span className="mono-label mb-1 block text-body">Área</span>
              <span className="break-words text-body-md text-ink">{estado.area || "—"}</span>
            </div>
            <div>
              <span className="mono-label mb-1 block text-body">Tipo de necesidad</span>
              <span className="break-words text-body-md text-ink">{nombreCategoria(estado.tipoNecesidad)}</span>
            </div>
            <div>
              <span className="mono-label mb-1 block text-body">Fecha requerida</span>
              <span className="text-body-md text-ink">{formatoFechaLegible(estado.fechaRequerida)}</span>
            </div>
          </div>
          <div className="bg-surface-soft rounded-sm p-3 border border-hairline flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-body mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <div>
              <span className="mono-label mb-0.5 block text-body">Clasificación asignada</span>
              <span className="text-body-md text-ink">
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
              <span className="mono-label block text-body">Detalles de la solicitud</span>
              {estado.archivoLogo ? (
                <div className="flex items-center justify-between gap-3 text-caption">
                  <span className="shrink-0 text-ink">Logo / arte del producto</span>
                  <span className="font-medium text-ink text-right truncate max-w-[60%]" title={estado.archivoLogo}>{estado.archivoLogo}</span>
                </div>
              ) : null}
              {estado.camposPlantilla?.map((cp) => {
                const r = estado.assessmentRespuestas[cp.campoKey];
                return (
                  <div key={cp.campoKey} className="flex items-start justify-between gap-4 border-b border-hairline pb-2 text-caption">
                    <span className="max-w-[45%] shrink-0 text-ink">{cp.label}</span>
                    <span className={"break-words text-right font-medium " + (r?.noSe ? "italic text-body" : "text-ink")}>
                      {r?.noSe ? "(no lo sé)" : r?.valor?.trim() ? r.valor : "—"}
                    </span>
                  </div>
                );
              })}
              {estado.assessmentPreguntas.map((q, i) => {
                const r = estado.assessmentRespuestas[q.campoKey];
                return (
                  <div key={q.campoKey || `q-${i}`} className="flex items-start justify-between gap-4 border-b border-hairline pb-2 text-caption">
                    <span className="max-w-[45%] shrink-0 text-ink">{q.pregunta}</span>
                    <span className={"break-words text-right font-medium " + (r?.noSe ? "italic text-body" : "text-ink")}>
                      {r?.noSe ? "(no lo sé)" : r?.valor?.trim() ? r.valor : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-4 shrink-0 rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] md:p-6">
        <div className="mb-1 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-body"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
          <span className="text-body-md font-medium text-ink">¿A qué comprador va dirigida la solicitud?</span>
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
                  "min-h-[44px] rounded-sm px-3.5 py-3 text-left transition-shadow " +
                  (estado.coordinadorId === c.id
                    ? "bg-surface-soft shadow-[inset_0_0_0_2px_var(--color-primary)]"
                    : "bg-canvas shadow-[inset_0_0_0_1px_var(--color-border-hairline)] hover:shadow-[inset_0_0_0_1px_var(--color-border-strong)]")
                }
              >
                <span className="block text-body-md font-semibold text-ink">{c.nombre}</span>
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
        <button onClick={enviarSolicitud} disabled={envio.estado === "enviando"} className="flex min-h-[44px] items-center gap-2 rounded-sm bg-primary px-8 text-body-md font-medium text-on-dark transition-opacity hover:opacity-90 disabled:opacity-60">
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
function PasoConfirmacion({
  estado,
  referencia,
  coordinadores,
}: {
  estado: WizardState;
  referencia?: string;
  coordinadores: CoordinadorPublico[];
}) {
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
        <p className="text-caption text-body">
          Comprador asignado:{" "}
          <span className="font-medium text-ink">
            {coordinadores.find((c) => c.id === estado.coordinadorId)?.nombre ?? "Equipo Compras BIA"}
          </span>
        </p>
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

function tipoNombreCompleto(tipo: string): string {
  if (tipo === "RFQ") return "Solicitud de Cotización";
  if (tipo === "RFI") return "Solicitud de Información";
  return "Solicitud de Propuesta";
}
