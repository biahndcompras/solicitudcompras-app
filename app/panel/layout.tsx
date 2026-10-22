import { requireAuth } from "@/lib/auth";
import { SesionProvider } from "@/lib/sesion-context";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { AppShell } from "@/components/layout/AppShell";
import { COORDINATOR_PORTAL, coordinatorNav } from "@/components/layout/navigation";

export const metadata = {
  title: "Panel de Compras — Portal de Compras BIA",
};

const TERMINALES = new Set(["CERRADA_CON_DECISION", "CERRADA_SIN_DECISION", "CANCELADA"]);

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await requireAuth(["coordinador"]);

  // Resolver el id local del coordinador en la tabla `usuario` por su email (para queries asignadas).
  let localId: string | undefined;
  let nav = coordinatorNav({ todas: 0, porCotizar: 0, comparativas: 0, esperando: 0, cerradas: 0 });
  try {
    const repo = new PostgresRepositorio();
    // Sin fallback a `coordenadores[0]`: si el correo de la sesión no está en la tabla
    // `usuario`, antes se le mostraba LA BANDEJA DEL PRIMER COORDINADOR sin avisar. La
    // bandeja queda vacía y la API responde 403 con un mensaje que dice qué hacer.
    localId = (await repo.usuarioLocalPorEmail(sesion.email))?.id;
    if (localId) {
      const propias = (await repo.listarPorCoordinador(localId)).filter((s) => s.estado !== "BORRADOR");
      nav = coordinatorNav({
        todas: propias.length,
        porCotizar: propias.filter((s) => ["ENVIADA_A_COMPRAS", "EN_COTIZACION"].includes(s.estado)).length,
        comparativas: propias.filter((s) => s.estado === "COMPARATIVA_LISTA").length,
        esperando: propias.filter((s) => s.estado === "ENVIADA_A_SOLICITANTE").length,
        cerradas: propias.filter((s) => TERMINALES.has(s.estado)).length,
      });
    }
  } catch {
    localId = undefined;
  }

  return (
    <SesionProvider
      value={{ nombre: sesion.nombre, email: sesion.email, rol: sesion.rol, localId }}
    >
      <AppShell
        nav={nav}
        portal={COORDINATOR_PORTAL}
        homeHref="/panel"
        profileHref="/panel/perfil"
      >
        {children}
      </AppShell>
    </SesionProvider>
  );
}
