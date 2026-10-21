// Marco corporativo de los correos.
//
// Lo que se fija: que NINGUNA de las 8 comunicaciones salga como texto plano (todas pasan por
// el layout con logo, título y pie) y que el copy esté en **usted** (ADR 0008). Las plantillas
// viejas decían "Adjunto encontrarás", "Cargá las cotizaciones", "te enviaremos"...
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderCorreo, type DatosCorreo, type TipoCorreo } from "./plantillas";

const TIPOS: TipoCorreo[] = ["1", "2", "3", "4", "5", "6", "7", "8"];

const BASE: DatosCorreo = {
  coordinadorNombre: "Bryan Bonilla",
  solicitanteNombre: "Edgar Calderón",
  numeroReferencia: "RFQ-2026-0042",
  titulo: "Sombrillas corporativas",
  tipo: "RFQ",
  area: "Mercadeo",
  fechaRequerida: "2026-11-12",
  resumen: "500 sombrillas con logo",
  urlPanel: "https://compras.bia.hn/panel/solicitud/s1",
  urlComparativa: "https://compras.bia.hn/comparativa/tok",
  urlDetalle: "https://compras.bia.hn/mis-solicitudes/s1?email=e%40bia.hn",
  cantidadCotizaciones: 2,
  recomendacion: "La opción de PlayaPromo es la más conveniente.",
  proveedorSeleccionado: "PlayaPromo",
  valorNeto: "L 10,000",
  valorTotal: "L 11,500",
  plazoEntrega: "12 días",
  fechaDecision: "2026-10-20",
  tiempoCiclo: "4 días",
  diasSinMovimiento: 6,
  estadoActual: "EN_COTIZACION",
  preguntas: [{ pregunta: "¿De qué material?", respuesta: "Poliéster" }],
  ronda: 2,
  diasEsperando: 4,
};

let previo: string | undefined;
beforeEach(() => {
  previo = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://compras.bia.hn";
});
afterEach(() => {
  if (previo === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previo;
});

describe("marco corporativo de los correos", () => {
  it("las 8 plantillas salen con el layout (no como texto plano)", () => {
    for (const tipo of TIPOS) {
      const { html } = renderCorreo(tipo, BASE);
      expect(html, `correo ${tipo}`).toContain("<!DOCTYPE html>");
      expect(html, `correo ${tipo}`).toContain("Portal de Compras BIA");
      expect(html, `correo ${tipo}`).toContain("font-family");
      // Logo servido por URL absoluta (un cliente de correo no lee archivos locales).
      expect(html, `correo ${tipo}`).toContain("https://compras.bia.hn/bia-logo.png");
    }
  });

  it("ningún cuerpo quedó como HTML suelto sin marco", () => {
    for (const tipo of TIPOS) {
      const { html } = renderCorreo(tipo, BASE);
      expect(html, `correo ${tipo}`).toMatch(/<body[\s>]/);
      expect(html, `correo ${tipo}`).toContain("correo automático");
      expect(html.length, `correo ${tipo}`).toBeGreaterThan(800);
    }
  });

  it("el copy está en usted: sin voseo ni tú", () => {
    const prohibidas = [
      /encontrarás/i,
      /cargá\b/i,
      /revisá\b/i,
      /te enviaremos/i,
      /confirmes/i,
      /pediste/i,
      /tuyo/i,
      /podés\b/i,
      /tenés\b/i,
      /elegí\b/i,
      /mirá\b/i,
    ];
    for (const tipo of TIPOS) {
      const { html, asunto } = renderCorreo(tipo, BASE);
      for (const re of prohibidas) {
        expect(re.test(html) || re.test(asunto), `correo ${tipo} usa "${re}"`).toBe(false);
      }
    }
  });

  it("incluye la llamada a la acción con la URL real", () => {
    const { html } = renderCorreo("6", BASE);
    expect(html).toContain("Responder ahora");
    expect(html).toContain("mis-solicitudes/s1?email=");
  });

  it("sin NEXT_PUBLIC_APP_URL no rompe: cae al nombre de la marca sin logo", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { html } = renderCorreo("2", BASE);
    expect(html).not.toContain("bia-logo.png");
    expect(html).toContain("BIA Compras");
  });
});
