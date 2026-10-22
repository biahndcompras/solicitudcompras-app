import { Suspense } from "react";
import { SolicitanteWizard } from "@/components/solicitante/SolicitanteWizard";

export const metadata = {
  title: "Nueva solicitud — Portal de Compras BIA",
};

/**
 * El wizard trae su propio shell (rail + contenido). Antes esta página lo envolvía en
 * un `max-w-[1160px]` que duplicaba el ancho y dejaba ver el fondo del body.
 */
export default function NuevaSolicitudPage() {
  return (
    <Suspense>
      <SolicitanteWizard />
    </Suspense>
  );
}
