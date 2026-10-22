"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PublicShell } from "@/components/layout/PublicShell";
import { Button } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/forms";
import { guardarBorradorEmail, limpiarBorrador } from "@/lib/cookie";

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
    <PublicShell>
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6">
        <div>
          <p className="eyebrow text-body">Nueva solicitud</p>
          <h1 className="mt-2 text-display-lg text-ink">¿Qué necesita comprar?</h1>
          <p className="mt-2 text-caption text-body">
            Ingrese sus datos para comenzar. Sin contraseñas: Compras le responde por correo.
          </p>
        </div>

        <div className="rounded-sm bg-canvas p-6 shadow-[inset_0_0_0_1px_var(--color-border-hairline)] sm:p-8">
          <form className="flex flex-col gap-5" onSubmit={nuevaSolicitud}>
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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Link
                href={email.includes("@") ? `/mis-solicitudes?email=${encodeURIComponent(email)}` : "/mis-solicitudes"}
                className="text-caption font-medium text-body underline underline-offset-4 transition-colors hover:text-ink"
              >
                Mis solicitudes
              </Link>
              <Button type="submit" disabled={!valido} icon="arrow-up-right">
                Continuar
              </Button>
            </div>
          </form>
        </div>

        <p className="text-caption text-body">
          ¿Primera vez?{" "}
          <Link href="/guias/manual-solicitante" className="font-medium text-ink underline underline-offset-4">
            Vea la guía rápida
          </Link>
          .
        </p>
      </div>
    </PublicShell>
  );
}
