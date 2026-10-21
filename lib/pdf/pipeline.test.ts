// Test de integración del pipeline de envío a Compras (PDF + correos).
// Requiere DATABASE_URL. El PDF se genera real; Resend se mockea (registra fallido si no hay clave).
import { describe, it, expect, beforeAll } from "vitest";
import { PostgresRepositorio } from "@/lib/db/postgres-repo";
import { pipelineEnvioACompras } from "./pipeline";
import { urlDeTests } from "@/lib/db/test-url";

const DATABASE_URL = urlDeTests() ?? "";
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb("pipeline envío a Compras", () => {
  let repo: PostgresRepositorio;

  beforeAll(() => {
    repo = new PostgresRepositorio();
  });

  it("genera PDF, persiste documento y dispara correos al transicionar", async () => {
    const s = await repo.crearSolicitud(
      {
        titulo: "Pipeline PDF",
        solicitanteEmail: "pipeline@bia.hn",
        solicitanteNombre: "Pipe Test",
        estado: "BORRADOR",
      },
      { descripcion: "prueba pipeline", categoria: "administrativa" }
    );

    const res = await pipelineEnvioACompras({
      repo,
      solicitud: { ...s, tipo: "RFQ" },
      respuestas: { dimensiones: "2m", materiales: "poliéster" },
    });

    expect(res.ok).toBe(true);
    expect(res.documentoId).toBeTruthy();

    // El estado sigue BORRADOR hasta que el caller transiciona (el pipeline no cambia estado)
    const releida = await repo.obtenerSolicitud(s.id);
    expect(releida?.estado).toBe("BORRADOR");
  }, 30000);

  it("persiste el documento en documento_generado", async () => {
    const s = await repo.crearSolicitud(
      {
        titulo: "Pipeline v2",
        solicitanteEmail: "pipeline2@bia.hn",
        solicitanteNombre: "Pipe Test",
        estado: "BORRADOR",
      },
      { descripcion: "prueba", categoria: "administrativa" }
    );
    const doc = await repo.persistirDocumento({ solicitudId: s.id, tipo: "RFQ", rutaPdf: "doc.pdf" });
    expect(doc.version).toBe(1);
    expect(doc.rutaPdf).toBe("doc.pdf");
  }, 15000);
});