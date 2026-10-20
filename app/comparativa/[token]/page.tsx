"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VistaPublica } from "@/components/publica/VistaPublica";
import { cotizacionesFixture, comparativaFixture, usuariosFixture } from "@/lib/fixtures";
import { guardarDecisionToken } from "@/lib/enlaces-decision";
import type { Cotizacion, ProsContras, SubtipoSolicitud } from "@/lib/domain/types";

type Datos = {
  solicitudId: string;
  /** Producto/servicio y detalle que encabezan la comparativa (4.2.2). */
  solicitud?: { titulo: string; descripcion?: string; subtipo?: SubtipoSolicitud } | null;
  cotizaciones: Cotizacion[];
  prosContras: Record<string, ProsContras>;
  recomendacion?: string;
  advertenciaGeneral?: string | null;
  fechaExpiracion?: string | null;
  /** Estado de la solicitud para no ofrecer decidir cuando ya se decidió o volvió a Compras. */
  estadoSolicitud?: string | null;
  /** Decisión ya registrada (para mostrar qué se eligió al recargar el enlace). */
  decision?: { cotizacionSeleccionadaId?: string | null; ningunaOpcion?: boolean } | null;
  /** `false` cuando no se pudo consultar el estado: la vista degrada, no se cae. */
  estadoConsultado?: boolean;
};

export default function ComparativaPublicaPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token) return;
    if (token === "demo-2026") {
      const cmp = comparativaFixture("s014");
      if (!cmp) { setTimeout(() => { setError("Demo no disponible"); setCargando(false); }, 0); return; }
      const coord = usuariosFixture[0];
      setTimeout(() => {
        setDatos({
          solicitudId: "s1",
          cotizaciones: cotizacionesFixture.s014 ?? [],
          prosContras: cmp.prosContras,
          recomendacion: cmp.recomendacionComprador ? `Recomendación de ${coord?.nombre ?? "Compras"}` : undefined,
          advertenciaGeneral: cmp.analysis?.advertenciaGeneral ?? null,
        });
        setCargando(false);
      }, 0);
      return;
    }
    let activo = true;

    const comparativaP = fetch(`/api/comparativas/${encodeURIComponent(token)}`).then(async (r) => {
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        const e = new Error(d.error ?? "Enlace no válido") as Error & { status?: number };
        e.status = r.status;
        throw e;
      }
      return r.json();
    });

    // Estado del enlace en paralelo. Su fallo NO tumba la vista: se degrada a ofrecer la
    // decisión (que es el flujo normal) en lugar de dejar la pantalla en blanco.
    const estadoP = fetch(`/api/comparativas/${encodeURIComponent(token)}/decision`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    Promise.all([comparativaP, estadoP])
      .then(([d, estado]) => {
        if (!activo) return;
        setDatos({
          solicitudId: d.solicitudId,
          solicitud: d.solicitud ?? null,
          cotizaciones: Array.isArray(d.cotizaciones) ? d.cotizaciones : [],
          prosContras: d.comparativa?.prosContras ?? {},
          recomendacion: d.comparativa?.recomendacionComprador,
          advertenciaGeneral: d.comparativa?.analysis?.advertenciaGeneral ?? null,
          fechaExpiracion: d.fechaExpiracion ?? null,
          // El fallback lee el estado si el GET de la comparativa llegara a traerlo
          // (la intención de la spec era devolver `solicitud`); así no dependemos de un solo camino.
          estadoSolicitud: estado?.estado ?? d.solicitud?.estado ?? d.estadoSolicitud ?? null,
          decision: estado?.decision ?? null,
          estadoConsultado: estado !== null,
        });
        // El token ya lo tiene quien abrió el enlace: se guarda solo en SU navegador para
        // que "Mis solicitudes" pueda ofrecer "Decidir" sin exponerlo por la API.
        guardarDecisionToken(d.solicitudId, token);
      })
      .catch((e) => {
        if (activo) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [token]);

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Cargando comparativa…</div>;
  }
  if (error || !datos) {
    return <EnlaceNoDisponible mensaje={error} />;
  }
  return (
    <VistaPublica
      token={token}
      solicitudId={datos.solicitudId}
      solicitud={datos.solicitud ?? null}
      cotizaciones={datos.cotizaciones}
      prosContras={datos.prosContras}
      recomendacion={datos.recomendacion}
      advertenciaGeneral={datos.advertenciaGeneral}
      fechaExpiracion={datos.fechaExpiracion ?? null}
      estadoSolicitud={datos.estadoSolicitud ?? null}
      decision={datos.decision ?? null}
      estadoConsultado={datos.estadoConsultado ?? true}
    />
  );
}

/** Estados differentiated del enlace: inválido / revocado / expirado / sin comparativa. */
function EnlaceNoDisponible({ mensaje }: { mensaje: string | null }) {
  const texto = mensaje ?? "Este enlace no es válido.";
  const esExpirado = /expir/i.test(texto);
  const esRevocado = /revocad/i.test(texto);
  const titulo = esExpirado
    ? "Este enlace expiró"
    : esRevocado
      ? "Este enlace fue revocado"
      : "No se pudo abrir el enlace";
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg max-w-md w-full p-8 text-center">
        <div className="text-2xl mb-3" aria-hidden>🔒</div>
        <h1 className="text-lg font-semibold text-slate-900 mb-2">{titulo}</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          {texto}
          {(esExpirado || esRevocado) && " Pedile a Compras un enlace nuevo para ver la comparativa y decidir."}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center min-h-[44px] px-4 text-sm font-medium text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50"
          >
            Ir al inicio
          </Link>
          <Link
            href="/guias/manual-solicitante"
            className="inline-flex items-center justify-center min-h-[44px] px-4 text-sm font-medium text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50"
          >
            Guía del solicitante
          </Link>
        </div>
      </div>
    </div>
  );
}
