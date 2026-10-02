"use client";

// CTA de decisión en el detalle de "Mis solicitudes".
// El token de decisión solo vive en el navegador que abrió el enlace público (ver
// lib/enlaces-decision.ts): el servidor no lo expone y esta página es un Server Component,
// así que el token se lee del mapa local. Si no hay token, se dice la verdad: que la
// decisión llega por el correo de Compras.
import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  snapshotDecision,
  servidorDecision,
  suscribirDecision,
  esperandoDecision,
  type MapaDecision,
} from "@/lib/enlaces-decision";

export function CTADecision({ solicitudId, estado }: { solicitudId: string; estado: string }) {
  const tokens = useSyncExternalStore(
    suscribirDecision,
    snapshotDecision,
    servidorDecision
  ) as MapaDecision;
  const token = tokens[solicitudId]?.token;

  if (token) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Tu decisión es el siguiente paso</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Abriste este enlace en este navegador: podés decidir sin volver al correo.
          </div>
        </div>
        <Link
          href={`/comparativa/${encodeURIComponent(token)}`}
          className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-5 text-sm font-semibold text-white bg-slate-900 rounded-full"
        >
          Decidir ahora
        </Link>
      </div>
    );
  }

  if (esperandoDecision(estado)) {
    return (
      <p className="mt-4 text-xs text-amber-700 bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3">
        Compras ya te envió un enlace para decidir. Abrilo desde el correo: si lo abrís en este
        navegador, el botón de decidir aparece aquí y en el listado.
      </p>
    );
  }
  return null;
}
