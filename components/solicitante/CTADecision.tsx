"use client";

// CTA de decisión en el detalle de "Mis solicitudes".
// El token de decisión solo vive en el navegador que abrió el enlace público (ver
// lib/enlaces-decision.ts): el servidor no lo expone y esta página es un Server Component,
// así que el token se lee del mapa local. Si no hay token, se dice la verdad: que la
// decisión llega por el correo de Compras.
import { useSyncExternalStore } from "react";
import {
  snapshotDecision,
  servidorDecision,
  suscribirDecision,
  esperandoDecision,
  type MapaDecision,
} from "@/lib/enlaces-decision";
import { ButtonLink } from "@/components/ui/primitives";

export function CTADecision({ solicitudId, estado }: { solicitudId: string; estado: string }) {
  const tokens = useSyncExternalStore(
    suscribirDecision,
    snapshotDecision,
    servidorDecision
  ) as MapaDecision;
  const token = tokens[solicitudId]?.token;

  if (token) {
    return (
      <div className="flex flex-col gap-3 rounded-sm bg-canvas p-5 shadow-[inset_0_0_0_1px_#000] sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-body-md font-medium text-ink">Su decisión es el siguiente paso</p>
          <p className="mt-0.5 text-caption text-body">
            Abrió este enlace en este navegador: puede decidir sin volver al correo.
          </p>
        </div>
        <ButtonLink href={`/comparativa/${encodeURIComponent(token)}`} variant="primary">
          Decidir ahora
        </ButtonLink>
      </div>
    );
  }

  if (esperandoDecision(estado)) {
    return (
      <p className="rounded-sm bg-surface-soft px-4 py-3 text-caption text-ink">
        Compras ya le envió un enlace para decidir. Ábralo desde el correo: si lo abre en este
        navegador, el botón de decidir aparece aquí y en el listado.
      </p>
    );
  }
  return null;
}
