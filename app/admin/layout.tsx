import { requireAuth } from "@/lib/auth";
import { SesionProvider } from "@/lib/sesion-context";
import { AppShell } from "@/components/layout/AppShell";

export const metadata = {
  title: "Administración — Portal de Compras BIA",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Protección server-side real + datos del usuario autenticado.
  const sesion = await requireAuth(["admin"]);

  return (
    <SesionProvider value={{ nombre: sesion.nombre, email: sesion.email, rol: sesion.rol }}>
      <AppShell>{children}</AppShell>
    </SesionProvider>
  );
}
