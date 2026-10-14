import { NextResponse } from "next/server";
import { z } from "zod";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { guardApi } from "@/lib/api-guard";

const repo = new PostgresRepositorio();

// Edición parcial: cada atributo es opcional y solo se pisa el que llega.
const patchSchema = z.object({
  activo: z.boolean().optional(),
  label: z.string().min(1).optional(),
  ayuda: z.string().optional(),
  tipoDato: z.enum(["texto", "texto_largo", "numero", "fecha", "seleccion", "seleccion_multiple", "booleano", "archivo", "moneda"]).optional(),
  catalogoOpciones: z.string().optional(),
  obligatorio: z.boolean().optional(),
  origen: z.enum(["plantilla", "assessment"]).optional(),
  seccionPdf: z.string().optional(),
  orden: z.number().optional(),
});

// Editar/desactivar un campo del catálogo.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const existente = (await repo.listarCampoCatalogo(true)).find((c) => c.campoKey === id);
    if (!existente) {
      return NextResponse.json({ error: `No existe un campo con la clave «${id}».` }, { status: 404 });
    }

    // Si solo se cambia el estado, no hay que tocar el resto del campo.
    if (Object.keys(body).every((k) => k === "activo")) {
      if (body.activo !== undefined) {
        await repo.actualizarCampoCatalogo(id, { activo: body.activo });
      }
      return NextResponse.json({ ok: true });
    }

    // Edición parcial segura: se parte del campo actual y se sobrescribe SOLO lo enviado.
    // Antes, un cambio de etiqueta mandaba tipoDato/origen/obligatorio/orden/activo
    // hardcodeados en un upsert total y BORRABA el resto de atributos del campo.
    await repo.guardarCampoCatalogo({
      campoKey: id,
      label: body.label ?? existente.label,
      ayuda: body.ayuda !== undefined ? body.ayuda : existente.ayuda,
      tipoDato: body.tipoDato ?? existente.tipoDato,
      catalogoOpciones: body.catalogoOpciones !== undefined ? body.catalogoOpciones : existente.catalogoOpciones,
      obligatorio: body.obligatorio ?? existente.obligatorio,
      origen: body.origen ?? existente.origen,
      seccionPdf: body.seccionPdf !== undefined ? body.seccionPdf : existente.seccionPdf,
      orden: body.orden ?? existente.orden,
      validacion: existente.validacion,
      activo: body.activo ?? existente.activo,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos", detalles: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo actualizar el campo" }, { status: 500 });
  }
}

// Borrar un campo del catálogo. No se elimina la fila: las respuestas guardadas
// (`respuesta_campo`) referencian el campo por su `campo_key`, así que un borrado físico
// dejaría esas respuestas sin campo que las explique. Se desactiva y se informa.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApi(["admin"]);
  if (auth.negada) return auth.negada;
  try {
    const { id } = await params;
    const existente = (await repo.listarCampoCatalogo(true)).find((c) => c.campoKey === id);
    if (!existente) {
      return NextResponse.json({ error: `No existe un campo con la clave «${id}».` }, { status: 404 });
    }
    await repo.actualizarCampoCatalogo(id, { activo: false });
    return NextResponse.json({
      ok: true,
      desactivado: true,
      mensaje: `El campo «${existente.label}» fue desactivado. Se conserva para no perder las respuestas ya guardadas.`,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el campo" }, { status: 500 });
  }
}
