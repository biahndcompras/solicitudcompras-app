import { AdminShell } from "@/components/ui-ext/AdminShell";

/**
 * Perfil del administrador.
 *
 * Estado real: NO hay endpoint que persista el perfil (el middleware y los
 * guards de /api/admin solo leen app_metadata.rol de Supabase). La versión
 * anterior renderizaba un formulario editable con valores hardcodeados
 * ("Lady", "admin@bia.com") y un botón "Guardar Cambios" sin handler: el
 * usuario escribía, pulsaba y no pasaba nada — pérdida de datos silenciosa.
 *
 * Aquí la pantalla es de solo lectura y lo dice. Cuando exista
 * PATCH /api/admin/perfil, esta vista pasa a editable con su feedback.
 */
export default function AdminAjustesPage() {
  return (
    <AdminShell title="Mi perfil" subtitle="Identidad y rol con el que entras al portal.">
      <div className="max-w-2xl">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h2 className="text-[13px] font-semibold text-slate-700">Datos de la cuenta</h2>
          </div>
          <dl className="divide-y divide-slate-100 text-[13px]">
            <div className="px-5 py-3 flex items-center justify-between gap-4">
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-medium text-slate-900 text-right">Gestionado por el proveedor de identidad</dd>
            </div>
            <div className="px-5 py-3 flex items-center justify-between gap-4">
              <dt className="text-slate-500">Correo</dt>
              <dd className="font-medium text-slate-900 text-right">Gestionado por el proveedor de identidad</dd>
            </div>
            <div className="px-5 py-3 flex items-center justify-between gap-4">
              <dt className="text-slate-500">Contraseña</dt>
              <dd className="font-medium text-slate-900 text-right">Gestionada por el proveedor de identidad</dd>
            </div>
            <div className="px-5 py-3 flex items-center justify-between gap-4">
              <dt className="text-slate-500">Rol</dt>
              <dd className="font-medium text-slate-900 text-right">Administración</dd>
            </div>
          </dl>
        </div>

        <p className="mt-4 text-[12px] text-slate-500">
          Tu nombre, correo y contraseña se administran donde iniciaste sesión. El rol lo asigna BIA Compras.
        </p>
      </div>
    </AdminShell>
  );
}
