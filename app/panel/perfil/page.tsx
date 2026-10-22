import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/ui/primitives";
import { getSession } from "@/lib/auth";

const ROL_LEGIBLE: Record<string, string> = {
  admin: "Administración",
  coordinador: "Coordinación de Compras",
  solicitante: "Solicitante",
};

export default async function PanelPerfilPage() {
  const sesion = await getSession();
  const nombre = sesion?.nombre?.trim() || "—";
  const correo = sesion?.email?.trim() || "—";
  const rol = sesion?.rol ? ROL_LEGIBLE[sesion.rol] ?? sesion.rol : "—";

  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Identidad y rol con el que entras al portal." />
      <div className="max-w-2xl">
        <Panel title="Datos de la cuenta" subtitle="Se leen de su cuenta de acceso.">
          <dl className="divide-y divide-hairline">
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <dt className="text-caption text-body">Nombre</dt>
              <dd className="text-right text-body-md text-ink">{nombre}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <dt className="text-caption text-body">Correo</dt>
              <dd className="break-all text-right text-body-md text-ink">{correo}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <dt className="text-caption text-body">Rol</dt>
              <dd className="text-right text-body-md text-ink">{rol}</dd>
            </div>
          </dl>
        </Panel>
        <p className="mt-4 text-caption text-body">
          Nombre, correo y rol se leen de su cuenta de acceso. Para cambiarlos, un administrador
          debe gestionarlo desde Coordinadores.
        </p>
      </div>
    </>
  );
}
