import { describe, it, expect } from "vitest";
import {
  BORRADOR_VERSION,
  CLAVE_BORRADOR,
  desenvolverBorrador,
  envolverBorrador,
  mismoCorreo,
  sanearBorradorSolicitud,
  sanearPreguntas,
  borradorRestaurable,
  type CamposBorradorSolicitud,
} from "./borrador";

const BASE: CamposBorradorSolicitud<"RFQ", "producto"> = {
  paso: 2,
  maxAlcanzado: 2,
  email: "mj.e2e@biabrands.co",
  nombre: "Solicitante E2E",
  titulo: "",
  tipoNecesidad: "",
  subtipo: "producto",
  fechaRequerida: "",
  area: "Trade Marketing",
  descripcion: "",
  clasificacion: "RFQ",
  confianzaClasificacion: 0.9,
  razonamientoBreve: "",
  clasificacionCorregida: false,
  llevaBranding: true,
  archivoLogo: "",
  assessmentPreguntas: [],
  contextoInsuficiente: false,
  preguntasContexto: [],
  camposPlantilla: [],
  assessmentRespuestas: {},
  solicitudId: null,
  claveEnvio: "3f1b0c2a-9d4e-4a7b-8c11-2e5a6d7f8a90",
  coordinadorId: "",
};

describe("borrador · el sobre y su lectura tolerante", () => {
  it("envuelve con versión y marca de tiempo (para que 'Borrador activo' sea verdad)", () => {
    const sobre = envolverBorrador({ paso: 2 }, 1234);
    expect(sobre.v).toBe(BORRADOR_VERSION);
    expect(sobre.guardadoEn).toBe(1234);
    const leido = desenvolverBorrador(JSON.stringify(sobre));
    expect(leido?.guardadoEn).toBe(1234);
    expect(leido?.estado).toEqual({ paso: 2 });
  });

  it.each([
    ["json inválido", "{{{no es json"],
    ["array", "[]"],
    ["null", "null"],
    ["string", '"hola"'],
    ["número", "42"],
    ["vacío", ""],
    ["undefined", undefined],
  ])("devuelve null ante %s en vez de romper", (_caso, raw) => {
    expect(desenvolverBorrador(raw as string | undefined)).toBeNull();
  });

  it("lee el formato legacy (estado plano sin sobre)", () => {
    const leido = desenvolverBorrador(JSON.stringify({ paso: 4, titulo: "viejo" }));
    expect(leido?.estado).toEqual({ paso: 4, titulo: "viejo" });
    expect(leido?.guardadoEn).toBeNull();
  });

  it("la clave del almacenamiento es la que el producto documenta", () => {
    expect(CLAVE_BORRADOR).toBe("bia_borrador");
  });
});

describe("borrador · saneamiento de entrada hostil", () => {
  it("acota el paso a 2..6 y nunca deja el paso 1 (que no tiene pantalla)", () => {
    expect(sanearBorradorSolicitud(BASE, { paso: 99 }).paso).toBe(6);
    expect(sanearBorradorSolicitud(BASE, { paso: 0 }).paso).toBe(2);
    // A11.2: paso 1 caía en el branch de confirmación y decía "fue enviada".
    expect(sanearBorradorSolicitud(BASE, { paso: 1 }).paso).toBe(2);
    expect(sanearBorradorSolicitud(BASE, { paso: "tres" }).paso).toBe(BASE.paso);
    expect(sanearBorradorSolicitud(BASE, { maxAlcanzado: 99 }).maxAlcanzado).toBe(6);
  });

  it("descarta valores con el tipo equivocado sin propagarlos", () => {
    const s = sanearBorradorSolicitud(BASE, {
      descripcion: { a: 1 },
      clasificacion: "ZZZ",
      confianzaClasificacion: 99,
      fechaRequerida: "no-es-fecha",
      solicitudId: "no-uuid",
      coordinadorId: 5,
      llevaBranding: "sí",
    });
    expect(s.descripcion).toBe("");
    expect(s.clasificacion).toBe("RFQ");
    expect(s.confianzaClasificacion).toBe(1);
    expect(s.fechaRequerida).toBe("");
    expect(s.solicitudId).toBeNull();
    expect(s.coordinadorId).toBe("");
    expect(s.llevaBranding).toBe(true);
  });

  it("un número donde se espera texto se normaliza, y un array se descarta", () => {
    const s = sanearBorradorSolicitud(BASE, { titulo: 42, nombre: ["a", "b"] });
    expect(s.titulo).toBe("42");
    expect(s.nombre).toBe("");
  });

  it("recorta un texto gigante (1 MB) al tope en vez de guardarlo entero", () => {
    const s = sanearBorradorSolicitud(BASE, { descripcion: "X".repeat(1_000_000) });
    expect(s.descripcion.length).toBe(20_000);
  });

  it("ignora preguntas sin texto y les da campoKey a las que sí lo tienen", () => {
    const p = sanearPreguntas([null, 5, { pregunta: "" }, { campoKey: "", pregunta: "Cantidad?" }]);
    expect(p).toHaveLength(1);
    expect(p[0].pregunta).toBe("Cantidad?");
    expect(p[0].campoKey).toBe("pregunta_4");
  });

  it("conserva `critica`: sin ella el borrador no puede avisar de los obligatorios", () => {
    const p = sanearPreguntas([
      { campoKey: "plazo_entrega", pregunta: "¿Para cuándo?", critica: true },
      { campoKey: "color_acabado", pregunta: "¿Color?" },
      { campoKey: "garantias", pregunta: "¿Garantía?", critica: "sí" },
    ]);
    expect(p[0].critica).toBe(true);
    // Ausente o no-booleano → undefined, nunca truthy: un string "sí" que se cuele no
    // puede convertir una pregunta opcional en obligatoria.
    expect(p[1].critica).toBeUndefined();
    expect(p[2].critica).toBeUndefined();
  });

  it("normaliza respuestas (string legacy o {valor,noSe})", () => {
    const s = sanearBorradorSolicitud(BASE, {
      assessmentRespuestas: { a: "hola", b: { valor: "x", noSe: true }, c: 7 },
    });
    expect(s.assessmentRespuestas).toEqual({
      a: { valor: "hola", noSe: false },
      b: { valor: "x", noSe: true },
      c: { valor: "7", noSe: false },
    });
  });
});

describe("borrador · a quién pertenece (A11.1)", () => {
  it("el correo se compara sin distinguir mayúsculas ni espacios", () => {
    expect(mismoCorreo(" A@B.com ", "a@b.com")).toBe(true);
    expect(mismoCorreo("a@b.com", "c@d.com")).toBe(false);
  });

  it("restaura el borrador del mismo correo aunque venga en mayúsculas", () => {
    const guardado = { ...BASE, titulo: "BORRADOR DE MAYUSCULAS" };
    expect(borradorRestaurable(guardado, "mj.e2e@biabrands.co")).toBe(true);
    expect(borradorRestaurable({ ...guardado, email: "MJ.E2E@BIABRANDS.CO" }, "mj.e2e@biabrands.co")).toBe(true);
  });

  it("NO restaura el borrador de otro correo ni uno ya enviado", () => {
    const guardado = { ...BASE, titulo: "De otra persona" };
    expect(borradorRestaurable(guardado, "victima@otra.com")).toBe(false);
    expect(
      borradorRestaurable({ ...guardado, solicitudId: "aaaaaaaa-0000-4000-8000-000000000001" }, BASE.email)
    ).toBe(false);
  });

  it("no restaura un borrador sin nada capturado", () => {
    const vacio = { ...BASE, titulo: "", descripcion: "", area: "", nombre: "" };
    expect(borradorRestaurable(vacio, BASE.email)).toBe(false);
  });
});
