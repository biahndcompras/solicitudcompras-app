import { NextResponse } from "next/server";
import { z } from "zod";
import { clasificar } from "@/lib/ai/orchestrator";
import type { ClasificarOutput } from "@/lib/ai/schemas";

const schema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().optional().default(""),
  categoria: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const res: ClasificarOutput | null = await clasificar(body);
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Entrada inválida", detalles: e.issues }, { status: 400 });
    }
    // La IA nunca bloquea: si falla, se avisa con 503 y el cliente sigue sin preselección
    // (antes: 200 + `null`, que escondía el fallo y lo hacía indistinguible de una
    // clasificación sin confianza). El detalle técnico nunca sale de aquí.
    return NextResponse.json(
      { error: "El asistente no está disponible en este momento." },
      { status: 503 }
    );
  }
}