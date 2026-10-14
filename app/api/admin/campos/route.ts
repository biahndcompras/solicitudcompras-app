import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

const createSchema = z.object({
  campoKey: z.string().min(1).regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guión bajo"),
  label: z.string().min(1),
  ayuda: z.string().optional(),
  tipoDato: z.enum(["texto", "texto_largo", "numero", "fecha", "seleccion", "seleccion_multiple", "booleano", "archivo", "moneda"]),
  catalogoOpciones: z.string().optional(),
  obligatorio: z.boolean().default(false),
  origen: z.enum(["plantilla", "assessment"]),
  seccionPdf: z.string().optional(),
  orden: z.number().default(100),
});

export async function GET() {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const campos = await repo.listarCampoCatalogo(true);
    return NextResponse.json(campos);
  } catch {
    return NextResponse.json({ error: "Error al listar campos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const body = createSchema.parse(await request.json());
    // La clave es la identidad del campo. Si ya existe, antes se pisaba en silencio
    // (`ON CONFLICT DO UPDATE` devolvía 201): un campo en uso quedaba reescrito sin
    // que nadie se enterara. Ahora se avisa y no se toca nada (409).
    const existente = (await repo.listarCampoCatalogo(true)).find((c) => c.campoKey === body.campoKey);
    if (existente) {
      return NextResponse.json(
        {
          error: `Ya existe un campo con la clave «${body.campoKey}». Elija otra clave o edite el campo existente.`,
        },
        { status: 409 }
      );
    }
    await repo.guardarCampoCatalogo({ ...body, activo: true });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo crear el campo" }, { status: 500 });
  }
}
