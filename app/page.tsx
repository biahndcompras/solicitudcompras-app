"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/screens/auth/AuthLayout";
import { Button } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/forms";
import { guardarBorradorEmail, limpiarBorrador } from "@/lib/cookie";

const PASOS = [
  ["Describa qué necesita", "Título, tipo y fecha. El asistente le ayuda a completar el detalle."],
  ["Compras cotiza", "El equipo pide ofertas a proveedores y arma la comparativa."],
  ["Usted decide", "Recibe un enlace, compara y elige. Sin contraseñas."],
] as [string, string][];

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [emailWarning, setEmailWarning] = useState(false);

  // Inicia una solicitud NUEVA: descarta cualquier borrador anterior y actualiza la
  // cookie de continuidad, así el wizard no retoma la solicitud previa del mismo correo.
  function nuevaSolicitud(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    limpiarBorrador();
    guardarBorradorEmail(email);
    router.push(
      `/solicitud/nueva?nuevo=1&email=${encodeURIComponent(email)}&nombre=${encodeURIComponent(nombre)}&area=${encodeURIComponent(area)}`
    );
  }

  const valido = email.includes("@") && email.includes(".") && nombre.trim() !== "" && area.trim() !== "";

  function onEmail(input: string) {
    setEmail(input);
    if (input.length > 0) {
      const okFormato = input.includes("@") && input.includes(".");
      setEmailError(!okFormato);
      const dominio = input.split("@")[1];
      setEmailWarning(okFormato && !!dominio && !/bia\.(com|hn)$/.test(dominio) && !dominio.includes("institucional"));
    } else {
      setEmailError(false);
      setEmailWarning(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Portal de Compras · Solicitudes"
      headline="Pida lo que necesita. Compras lo cotiza. Usted decide."
      points={PASOS}
      footer="Portal de Compras BIA · Solicitudes"
    >
      <div>
        <p className="eyebrow text-body">Nueva solicitud</p>
        <h1 className="mt-3 text-display-lg text-ink">¿Qué necesita comprar?</h1>
        <p className="mt-2 text-caption text-body">Ingrese sus datos para comenzar. Le responde Compras por correo.</p>

        <form className="mt-7 flex flex-col gap-5" onSubmit={nuevaSolicitud}>
          <TextField
            label="Su correo institucional"
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="ejemplo@bia.com"
            autoComplete="email"
            aria-invalid={emailError || undefined}
            error={emailError ? "El formato del correo es inválido." : undefined}
            helper={
              emailWarning
                ? "Este correo no parece institucional. Puede continuar, pero Compras lo va a revisar."
                : undefined
            }
            required
          />

          <TextField
            label="Su nombre completo"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Juan Pérez"
            autoComplete="name"
            required
          />

          <TextField
            label="Área / departamento"
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Marketing"
            autoComplete="organization-title"
            required
          />

          <Button type="submit" disabled={!valido} icon="arrow-up-right" className="mt-1 w-full">
            Continuar
          </Button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-caption">
          <Link href="/mis-solicitudes" className="font-medium text-body underline underline-offset-4 hover:text-ink">
            Mis solicitudes
          </Link>
          <Link href="/guias/manual-solicitante" className="font-medium text-body underline underline-offset-4 hover:text-ink">
            Guía rápida
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
