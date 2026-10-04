import { requireAuth } from "@/lib/auth";
import { SesionProvider } from "@/lib/sesion-context";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";

export const metadata = {
  title: "Panel de Compras — Portal de Compras BIA",
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await requireAuth(["coordinador"]);

  // Resolver el id local del coordinador en la tabla `usuario` por su email (para queries asignadas).
  let localId: string | undefined;
  try {
    const repo = new PostgresRepositorio();
    // Sin fallback a `coordenadores[0]`: si el correo de la sesión no está en la tabla
    // `usuario`, antes se le mostraba LA BANDEJA DEL PRIMER COORDINADOR sin avisar. La
    // bandeja queda vacía y la API responde 403 con un mensaje que dice qué hacer.
    localId = (await repo.usuarioLocalPorEmail(sesion.email))?.id;
  } catch {
    localId = undefined;
  }

  return (
    <SesionProvider
      value={{ nombre: sesion.nombre, email: sesion.email, rol: sesion.rol, localId }}
    >
      {children}
    </SesionProvider>
  );
}