"use client";

// Hook del wizard del solicitante — usa la capa de dominio (cerebro) y persiste vía API.
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SubtipoSolicitud, TipoSolicitud } from "@/lib/domain/types";
import { bloqueoB2Activo } from "@/lib/domain/rules";
import { leerBorradorEmail, guardarBorradorEmail, guardarBorrador, limpiarBorrador, leerBorrador } from "@/lib/cookie";

export type PasoWizard = 1 | 2 | 3 | 4 | 5 | 6;

export type EstadoEnvio =
  | { estado: "inactivo" }
  | { estado: "enviando" }
  | { estado: "ok"; referencia?: string }
  | { estado: "error"; mensaje: string };

export type WizardState = {
  paso: PasoWizard;
  maxAlcanzado: PasoWizard;
  email: string;
  nombre: string;
  titulo: string;
  tipoNecesidad: string;
  subtipo: SubtipoSolicitud;
  fechaRequerida: string;
  area: string;
  descripcion: string;
  clasificacion: TipoSolicitud;
  confianzaClasificacion: number;
  razonamientoBreve: string;
  clasificacionCorregida: boolean;
  llevaBranding: boolean;
  archivoLogo: string;
  assessmentListo: boolean;
  assessmentPreguntas: { campoKey: string; pregunta: string; ejemplo?: string; sugerencias?: string[] }[];
  contextoInsuficiente: boolean;
  preguntasContexto: string[];
  camposPlantilla?: { campoKey: string; label: string; tipoDato: string; ayuda?: string; obligatorio: boolean; seccionPdf?: string }[];
  assessmentRespuestas: Record<string, { valor: string; noSe: boolean }>;
  solicitudId: string | null;
  coordinadorId: string;
};

function estadoInicial(nuevo: boolean): WizardState {
  const base: WizardState = {
    paso: 2,
    maxAlcanzado: 2,
    email: leerBorradorEmail() ?? "",
    nombre: "",
    titulo: "",
    tipoNecesidad: "",
    subtipo: "producto",
    fechaRequerida: "",
    area: "",
    descripcion: "",
    clasificacion: "RFQ",
    confianzaClasificacion: 0.9,
    razonamientoBreve: "",
    clasificacionCorregida: false,
    llevaBranding: true,
    archivoLogo: "",
    assessmentListo: false,
    assessmentPreguntas: [],
    contextoInsuficiente: false,
    preguntasContexto: [],
    camposPlantilla: [],
    assessmentRespuestas: {},
    solicitudId: null,
    coordinadorId: "",
  };
  // En una solicitud NUEVA (viniendo de P1) no se restaura ningún borrador anterior.
  // El borrador previo ya fue limpiado al arrancar desde la home.
  if (nuevo) {
    return base;
  }
  // Solo retoma el borrador si coincide con el email y no es una solicitud ya enviada.
  const guardado = leerBorrador<WizardState>();
  if (guardado && guardado.email === base.email && guardado.solicitudId === null) {
    return { ...guardado, email: base.email };
  }
  return base;
}

export type CoordinadorPublico = { id: string; nombre: string; categorias: string[] };

export function useSolicitudWizard(nuevo = false) {
  const router = useRouter();
  const [estado, setEstado] = useState<WizardState>(() => estadoInicial(nuevo));
  const [envio, setEnvio] = useState<EstadoEnvio>({ estado: "inactivo" });
  const [borradoAt, setBorradoAt] = useState<number | null>(null);
  const [clasificandoIA, setClasificandoIA] = useState(false);
  const [evaluandoAssessment, setEvaluandoAssessment] = useState(false);
  const [coordinadores, setCoordinadores] = useState<CoordinadorPublico[]>([]);
  // H2: archivo real del logo (File vive en memoria; solo el nombre se persiste en el borrador).
  const archivoLogoFileRef = useRef<File | null>(null);
  const setArchivoLogoFile = useCallback((f: File | null) => {
    archivoLogoFileRef.current = f;
  }, []);

  // Cargar compradores disponibles y preseleccionar por categoría al llegar al paso de documento.
  useEffect(() => {
    if (estado.paso !== 5) return;
    let activo = true;
    (async () => {
      try {
        const { api } = await import("@/lib/api-client");
        const lista = await api.listarCoordinadoresPublicos();
        if (!activo) return;
        setCoordinadores(lista);
        if (!estado.coordinadorId) {
          const porCategoria = lista.filter((c) => c.categorias.includes(estado.tipoNecesidad));
          const sugerido = porCategoria[0] ?? lista[0];
          if (sugerido) setEstado((s) => ({ ...s, coordinadorId: sugerido.id }));
        }
      } catch {
        if (activo) setCoordinadores([]);
      }
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.paso]);

  // Autoguarda el borrador en cada cambio (para que back/forward y recarga conserven los datos).
  useEffect(() => {
    if (estado.paso >= 6) return;
    guardarBorrador({ ...estado, email: estado.email });
  }, [estado]);

  const siguiente = useCallback(() => {
    setEstado((s) => {
      const paso = Math.min(6, s.paso + 1) as PasoWizard;
      guardarBorradorEmail(s.email);
      return { ...s, paso, maxAlcanzado: Math.max(s.maxAlcanzado, paso) as PasoWizard };
    });
  }, []);

  // Clasificación IA del solicitante (P2→P3). Llamada server-side vía API.
  const clasificarIA = useCallback(async () => {
    setClasificandoIA(true);
    try {
      const { api } = await import("@/lib/api-client");
      const res = await api.clasificarIA({
        titulo: estado.titulo,
        descripcion: estado.descripcion,
        categoria: estado.tipoNecesidad,
      });
      if (res && res.confianza >= 0.7) {
        setEstado((s) => ({
          ...s,
          clasificacion: res.tipo ?? "RFQ",
          subtipo: res.subtipo ?? "producto",
          confianzaClasificacion: res.confianza,
          razonamientoBreve: res.razonamiento_breve,
        }));
      } else {
        // Confianza baja o fallo → sin preselección.
        setEstado((s) => ({ ...s, confianzaClasificacion: 0 }));
      }
    } catch {
      setEstado((s) => ({ ...s, confianzaClasificacion: 0 }));
    } finally {
      setClasificandoIA(false);
    }
  }, [estado.titulo, estado.descripcion, estado.tipoNecesidad]);

  // Assessment IA del solicitante (P3→P4). Llamada server-side vía API.
  // `opts.descripcion` permite re-evaluar con una descripción ampliada (F2: más contexto).
  const evaluarAssessment = useCallback(async (opts?: { descripcion?: string }) => {
    const descripcion = opts?.descripcion ?? estado.descripcion;
    setEvaluandoAssessment(true);
    try {
      const { api } = await import("@/lib/api-client");
      const catalogo: import("@/lib/domain/types").CampoCatalogo[] = [];
      const res = await api.assessmentIA({
        titulo: estado.titulo,
        descripcion,
        tipo: estado.clasificacion,
        subtipo: estado.subtipo,
        categoria: estado.tipoNecesidad,
        camposCapturados: [
          { campoKey: "titulo", valor: estado.titulo },
          { campoKey: "descripcion", valor: descripcion },
          { campoKey: "tipoNecesidad", valor: estado.tipoNecesidad },
        ],
        catalogo,
        llevaBranding: estado.llevaBranding,
        archivoLogo: estado.archivoLogo,
      });
      if (res) {
        setEstado((s) => ({
          ...s,
          descripcion,
          assessmentPreguntas: res.preguntas.map((p) => ({
            campoKey: p.campoKey,
            pregunta: p.pregunta,
            ejemplo: p.ejemplo_respuesta || undefined,
            sugerencias: p.sugerencias,
          })),
          camposPlantilla: res.camposPlantilla ?? [],
          assessmentListo: res.sin_preguntas_pendientes,
          contextoInsuficiente: res.contexto_insuficiente ?? false,
          preguntasContexto: res.preguntas_contexto ?? [],
        }));
      } else {
        setEstado((s) => ({ ...s, descripcion, assessmentListo: true, contextoInsuficiente: false, preguntasContexto: [] }));
      }
    } catch {
      setEstado((s) => ({ ...s, descripcion, assessmentListo: true, contextoInsuficiente: false, preguntasContexto: [] }));
    } finally {
      setEvaluandoAssessment(false);
    }
  }, [estado.titulo, estado.descripcion, estado.tipoNecesidad, estado.clasificacion, estado.subtipo, estado.llevaBranding, estado.archivoLogo]);

  // F2: el solicitante amplía la descripción y re-ejecuta el assessment.
  const reintentarConContexto = useCallback(async (extra: string) => {
    const ampliada = `${estado.descripcion ? estado.descripcion.trim() + "\n" : ""}${extra.trim()}`;
    setEstado((s) => ({ ...s, contextoInsuficiente: false, preguntasContexto: [] }));
    await evaluarAssessment({ descripcion: ampliada });
  }, [estado.descripcion, evaluarAssessment]);

  // Persiste la solicitud al pasar del paso 5 (documento) al 6 (confirmación).
  const enviarSolicitud = useCallback(async () => {
    setEnvio({ estado: "enviando" });
    try {
      const { api } = await import("@/lib/api-client");
      const creada = await api.crearSolicitud({
        titulo: estado.titulo,
        solicitanteEmail: estado.email,
        solicitanteNombre: estado.nombre || "Colaborador",
        areaSolicitante: estado.area,
        descripcion: estado.descripcion,
        categoria: estado.tipoNecesidad,
        // Persistir la clasificación (antes se perdía: el sidebar y las métricas
        // de distribución por tipo quedaban vacíos).
        tipo: estado.clasificacion,
        subtipo: estado.subtipo,
        fechaRequerida: estado.fechaRequerida,
      });
      // H2: subir el logo/archivo real del producto (si el solicitante lo adjuntó).
      if (archivoLogoFileRef.current) {
        await api.subirArchivoLogo(creada.id, archivoLogoFileRef.current);
      }
      const transicion = await api.transicionar({
        solicitudId: creada.id,
        hacia: "ENVIADA_A_COMPRAS",
        actorTipo: "solicitante",
        actorIdentificador: estado.email,
        nota: "Solicitud completada por el solicitante",
        coordinadorId: estado.coordinadorId || undefined,
        respuestas: {
          titulo: estado.titulo,
          tipoNecesidad: estado.tipoNecesidad,
          descripcion: estado.descripcion,
          subtipo: estado.subtipo,
          llevaBranding: String(estado.llevaBranding),
          ...Object.fromEntries(
            Object.entries(estado.assessmentRespuestas).map(([k, v]) => [
              `assessment_${k}`,
              v.noSe ? "(no lo sé)" : (v.valor || ""),
            ])
          ),
        },
      });
      // La referencia real se genera en la transición a ENVIADA_A_COMPRAS, no al crear.
      setEnvio({ estado: "ok", referencia: transicion.solicitud.numeroReferencia });
      setEstado((s) => ({ ...s, paso: 6, maxAlcanzado: 6, solicitudId: creada.id }));
    } catch (e) {
      setEnvio({
        estado: "error",
        mensaje: e instanceof Error ? e.message : "No se pudo enviar la solicitud",
      });
    }
  }, [estado]);

  const anterior = useCallback(() => {
    setEstado((s) => ({ ...s, paso: Math.max(1, s.paso - 1) as PasoWizard }));
  }, []);

  const irA = useCallback((paso: PasoWizard) => {
    setEstado((s) =>
      paso <= s.maxAlcanzado ? { ...s, paso } : s
    );
  }, []);

  const set = useCallback(
    <K extends keyof WizardState>(key: K, valor: WizardState[K]) => {
      setEstado((s) => ({ ...s, [key]: valor }));
    },
    []
  );

  const pasoValido = useMemo(() => {
    const s = estado;
    switch (s.paso) {
      case 1:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim());
      case 2:
        return Boolean(s.titulo.trim() && s.tipoNecesidad && s.fechaRequerida && s.area.trim());
      case 3:
        return true;
      case 4:
        // B2: branding sin logo bloquea (RN-03)
        return !bloqueoB2Activo({ llevaBranding: s.llevaBranding, archivoLogo: s.archivoLogo });
      case 5:
        return true;
      case 6:
        return true;
    }
  }, [estado]);

  const guardarBorradorActual = useCallback(() => {
    const copia = { ...estado, paso: estado.paso as PasoWizard, maxAlcanzado: estado.maxAlcanzado as PasoWizard };
    guardarBorrador(copia);
    setBorradoAt(Date.now());
  }, [estado]);

  const cancelar = useCallback(() => {
    limpiarBorrador();
    router.push("/");
  }, [router]);

  return {
    estado,
    siguiente,
    anterior,
    irA,
    set,
    pasoValido,
    envio,
    enviarSolicitud,
    clasificandoIA,
    clasificarIA,
    evaluandoAssessment,
    evaluarAssessment,
    reintentarConContexto,
    coordinadores,
    setArchivoLogoFile,
    guardarBorrador: guardarBorradorActual,
    cancelar,
    borradoAt,
  };
}
