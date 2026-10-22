import { redirect } from "next/navigation";

/** Un solo login para el equipo: las rutas viejas se conservan como redirección. */
export default function LoginCoordinadorPage() {
  redirect("/login");
}
