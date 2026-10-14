// Catálogo de campos · ruta por clave (campoKey).
// 4.4.7: editar un campo enviaba tipoDato/origen/obligatorio/orden/activo HARDCODEADOS en un
// upsert total, así que una edición parcial (solo label) BORRABA el resto de atributos.
// 4.4.9: no existía DELETE. Como las respuestas guardadas referencian el campo por su clave,
// borrar físicamente dejaría huérfanos: el DELETE desactiva y lo explica.
import { describe, it, expect, vi, beforeEach } from "vitest";

const listarCampoCatalogo = vi.fn();
const guardarCampoCatalogo = vi.fn();
const actualizarCampoCatalogo = vi.fn();
const guardApi = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    listarCampoCatalogo = (...a: unknown[]) => listarCampoCatalogo(...a);
    guardarCampoCatalogo = (...a: unknown[]) => guardarCampoCatalogo(...a);
    actualizarCampoCatalogo = (...a: unknown[]) => actualizarCampoCatalogo(...a);
  },
}));

vi.mock("@/lib/api-guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));

import { PATCH, DELETE } from "./route";

const EXISTENTE = {
  campoKey: "plazo",
  label: "Plazo de entrega",
  ayuda: "En días",
  tipoDato: "numero",
  catalogoOpciones: undefined,
  obligatorio: true,
  origen: "plantilla",
  seccionPdf: "Comercial",
  orden: 42,
  validacion: { bloqueante: true },
  activo: true,
};

function patch(id: string, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/admin/campos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

function del(id: string) {
  return DELETE(new Request(`http://localhost/api/admin/campos/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  listarCampoCatalogo.mockReset().mockResolvedValue([EXISTENTE]);
  guardarCampoCatalogo.mockReset().mockResolvedValue(undefined);
  actualizarCampoCatalogo.mockReset().mockResolvedValue(undefined);
  guardApi.mockReset().mockResolvedValue({ sesion: { rol: "admin", email: "admin@biafoods.co" } });
});

describe("PATCH /api/admin/campos/[id] · la edición parcial no destruye (4.4.7)", () => {
  it("cambiar solo la etiqueta conserva el resto de atributos", async () => {
    const res = await patch("plazo", { label: "Nuevo plazo" });

    expect(res.status).toBe(200);
    expect(guardarCampoCatalogo).toHaveBeenCalledTimes(1);
    const enviado = guardarCampoCatalogo.mock.calls[0][0] as Record<string, unknown>;
    expect(enviado).toMatchObject({
      campoKey: "plazo",
      label: "Nuevo plazo",
      ayuda: "En días",
      tipoDato: "numero",
      obligatorio: true,
      origen: "plantilla",
      seccionPdf: "Comercial",
      orden: 42,
      activo: true,
    });
    // La validación existente no se reescribe con `{}`.
    expect(enviado.validacion).toEqual({ bloqueante: true });
  });

  it("respeta el valor nuevo de un campo editable (orden) sin tocar los demás", async () => {
    await patch("plazo", { orden: 7 });

    const enviado = guardarCampoCatalogo.mock.calls[0][0] as Record<string, unknown>;
    expect(enviado.orden).toBe(7);
    expect(enviado.label).toBe("Plazo de entrega");
    expect(enviado.tipoDato).toBe("numero");
  });

  it("404 si el campo no existe (y no guarda nada)", async () => {
    listarCampoCatalogo.mockResolvedValue([]);

    const res = await patch("no-existe", { label: "X" });

    expect(res.status).toBe(404);
    expect(guardarCampoCatalogo).not.toHaveBeenCalled();
  });

  it("guardApi(['admin']) protege el PATCH", async () => {
    guardApi.mockResolvedValue({ negada: Response.json({ error: "No autorizado" }, { status: 403 }) });

    const res = await patch("plazo", { label: "X" });

    expect(res.status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith(["admin"]);
    expect(guardarCampoCatalogo).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/campos/[id] · borrar sin dejar huérfanos (4.4.9)", () => {
  it("desactiva el campo en vez de borrarlo físicamente", async () => {
    const res = await del("plazo");

    expect(res.status).toBe(200);
    expect(actualizarCampoCatalogo).toHaveBeenCalledWith("plazo", { activo: false });
    const body = await res.json();
    expect(body.desactivado).toBe(true);
  });

  it("404 si el campo no existe", async () => {
    listarCampoCatalogo.mockResolvedValue([]);

    const res = await del("no-existe");

    expect(res.status).toBe(404);
    expect(actualizarCampoCatalogo).not.toHaveBeenCalled();
  });

  it("guardApi(['admin']) protege el DELETE", async () => {
    guardApi.mockResolvedValue({ negada: Response.json({ error: "No autorizado" }, { status: 403 }) });

    const res = await del("plazo");

    expect(res.status).toBe(403);
    expect(actualizarCampoCatalogo).not.toHaveBeenCalled();
  });
});
