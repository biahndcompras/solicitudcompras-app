// Correo de invitación a una cuenta del portal (4.13.9).
//
// Usa el mismo layout corporativo que el resto de los correos. El enlace viene de
// `generateLink` de Supabase (invitación real: la persona define su contraseña).
import { boton, layoutCorreo, parrafo, parrafoFinal } from "./layout";

export function invitacionCorreo(input: {
  nombre: string;
  email: string;
  actionLink: string;
  esAdmin: boolean;
}): { asunto: string; html: string } {
  const rol = input.esAdmin ? "administrador" : "coordinador de Compras";
  return {
    asunto: "Invitación al Portal de Compras BIA",
    html: layoutCorreo({
      titulo: "Le damos la bienvenida al Portal de Compras",
      etiqueta: "Invitación",
      preheader: "Active su cuenta y defina su contraseña.",
      contenido:
        parrafo(`Hola, ${input.nombre}:`) +
        parrafo(
          `Se creó una cuenta de <strong>${rol}</strong> para <strong>${input.email}</strong> en el Portal de Compras BIA.`
        ) +
        parrafo("Para activarla, defina su contraseña con este botón:") +
        boton(input.actionLink, "Activar mi cuenta") +
        parrafoFinal("Si usted no esperaba esta invitación, puede ignorar este correo."),
    }),
  };
}
