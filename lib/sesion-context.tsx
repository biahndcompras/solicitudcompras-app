"use client";

import { createContext, useContext, type ReactNode } from "react";

export type UsuarioSesion = {
  nombre: string;
  email: string;
  rol: "coordinador" | "admin" | "solicitante";
  // id del usuario en la DB local `usuario` (u1..u5), usado para queries por coordinador.
  localId?: string;
};

const SesionContext = createContext<UsuarioSesion | null>(null);

export function SesionProvider({ value, children }: { value: UsuarioSesion | null; children: ReactNode }) {
  return <SesionContext.Provider value={value}>{children}</SesionContext.Provider>;
}

export function useSesion(): UsuarioSesion | null {
  return useContext(SesionContext);
}
