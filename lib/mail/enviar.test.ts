import { describe, it, expect, vi, beforeEach } from "vitest";
import { enviarCorreo } from "./enviar";
import { renderCorreo } from "./plantillas";
import type { CorreoEnviado } from "@/lib/domain/types";
import type { Repositorio } from "@/lib/db/repositorio";

vi.mock("./cliente", () => ({
  enviarConResend: vi.fn(),
  getRemitente: () => "Portal de Compras BIA <no-reply@compras.bia>",
}));

import { enviarConResend } from "./cliente";

function mockRepo() {
  return {
    registrarCorreo: vi.fn(async (input): Promise<CorreoEnviado> => ({
      id: "c1",
      solicitudId: input.solicitudId,
      tipoCorreo: input.tipoCorreo,
      destinatario: input.destinatario,
      asunto: input.asunto,
      estadoEnvio: input.estadoEnvio,
      intentos: input.intentos ?? 1,
      errorDetalle: input.errorDetalle,
      fechaEnvio: "2026-08-13T12:00:00Z",
    })),
  } as unknown as Repositorio;
}

const datos = {
  numeroReferencia: "RFQ-2026-014",
  titulo: "Sombrillas brandeadas",
  coordinadorNombre: "Carlos Mejía",
  solicitanteNombre: "María Reyes",
  tipo: "RFQ",
  area: "Marketing",
};

describe("envio de correo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registra como enviado cuando Resend responde ok", async () => {
    vi.mocked(enviarConResend).mockResolvedValue({ ok: true, id: "email_1" });
    const repo = mockRepo();
    const c = await enviarCorreo({ repo, tipoCorreo: "1", solicitudId: "s1", destinatario: "carlos@bia.com", datos });
    expect(c.estadoEnvio).toBe("enviado");
    expect(repo.registrarCorreo).toHaveBeenCalledTimes(1);
  });

  it("registra como fallido tras reintentos y guarda el error", async () => {
    vi.mocked(enviarConResend).mockResolvedValue({ ok: false, error: "bounce" });
    const repo = mockRepo();
    const c = await enviarCorreo({ repo, tipoCorreo: "1", solicitudId: "s1", destinatario: "carlos@bia.com", datos, reintentos: 2 });
    expect(c.estadoEnvio).toBe("fallido");
    expect(c.errorDetalle).toBe("bounce");
    expect(enviarConResend).toHaveBeenCalledTimes(2);
  });

  it("correo 3 incluye el enlace público", () => {
    const { asunto, html } = renderCorreo("3", { ...datos, urlComparativa: "https://bia.com/c/tok123" });
    expect(html).toContain("tok123");
    expect(asunto).toContain("comparativo");
  });
});
// Correos del ciclo de preguntas al solicitante (spec 010). Un error de plantilla no se ve
// hasta que el correo sale de verdad, y para entonces ya le llegó a una persona.
describe("correos del ciclo de preguntas (6, 7 y 8)", () => {
  const base = { numeroReferencia: "RFQ-2026-0042", titulo: "Pintura epóxica", solicitanteNombre: "María" };
  const preguntas = [
    { pregunta: "¿De qué material?", respuesta: "Acero" },
    { pregunta: "¿Para cuándo?" },
  ];

  it("el correo 6 lista todas las preguntas y enlaza con el correo del solicitante", () => {
    const { asunto, html } = renderCorreo("6", {
      ...base,
      coordinadorNombre: "Bryan",
      preguntas,
      urlDetalle: "https://bia.com/mis-solicitudes/abc?email=m%40b.co",
    });

    expect(asunto).toContain("RFQ-2026-0042");
    expect(html).toContain("¿De qué material?");
    expect(html).toContain("¿Para cuándo?");
    expect(html).toContain("mis-solicitudes/abc?email=");
    // El saludo va al solicitante, no al coordinador: este correo lo recibe quien pidió.
    expect(html).toContain("María");
  });

  it("el correo 7 muestra cada pregunta con su respuesta", () => {
    const { html } = renderCorreo("7", { ...base, coordinadorNombre: "Bryan", preguntas, ronda: 2 });

    expect(html).toContain("¿De qué material?");
    expect(html).toContain("Acero");
    // Una pregunta sin responder se dice, no se deja el hueco en blanco.
    expect(html).toContain("sin responder");
    expect(html).toContain("ronda 2");
  });

  it("el correo 8 dice cuántos días pasaron y repite las preguntas pendientes", () => {
    const { asunto, html } = renderCorreo("8", { ...base, coordinadorNombre: "Bryan", preguntas, diasEsperando: 4 });

    expect(asunto).toContain("4 días");
    expect(html).toContain("4 días");
    expect(html).toContain("¿De qué material?");
  });

  it("sin preguntas no revienta (una ronda vacía no debería existir, pero no puede tirar el envío)", () => {
    expect(() => renderCorreo("6", base)).not.toThrow();
    expect(() => renderCorreo("7", base)).not.toThrow();
    expect(() => renderCorreo("8", base)).not.toThrow();
  });

  it("escapa el HTML de las respuestas: vienen del solicitante sin sesión", () => {
    const { html } = renderCorreo("7", {
      ...base,
      coordinadorNombre: "Bryan",
      preguntas: [{ pregunta: "¿Material?", respuesta: '<script>alert("x")</script>' }],
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
