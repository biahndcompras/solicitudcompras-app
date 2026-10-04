// Estas tres rutas devuelven la información más sensible del sistema: la solicitud completa
// con las cotizaciones (precios, ISV, correos) y los archivos del producto.
//
// Antes eran públicas y su única "protección" era que el UUID no se adivina. Un UUID no es
// un token: viaja en la URL, se copia en enlaces y se filtra en capturas. Y el panel del
// coordinador no llama a `GET /api/solicitudes/[id]` (usa el repo desde el servidor), así que
// cerrarlo no rompe nada de la app.
import { describe, it, expect, vi, beforeEach } from "vitest";

const obtenerSolicitud = vi.fn();
const obtenerArchivoLogo = vi.fn();
const listarCotizaciones = vi.fn();
const guardarArchivoLogo = vi.fn();
const actualizarCamposSolicitud = vi.fn();
const generarDocumento = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    obtenerSolicitud = (...a: unknown[]) => obtenerSolicitud(...a);
    obtenerArchivoLogo = (...a: unknown[]) => obtenerArchivoLogo(...a);
    listarCotizaciones = (...a: unknown[]) => listarCotizaciones(...a);
    guardarArchivoLogo = (...a: unknown[]) => guardarArchivoLogo(...a);
    actualizarCamposSolicitud = (...a: unknown[]) => actualizarCamposSolicitud(...a);
  },
}));
vi.mock("@/lib/pdf/generador", () => ({
  generarDocumento: (...a: unknown[]) => generarDocumento(...a),
}));

const sesion = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => sesion() }));

import { GET as getSolicitud, PATCH as patchSolicitud } from "./route";
import { GET as getDocumento } from "./documento/route";
import { GET as getLogo } from "./logo/route";

const ID = "22222222-2222-4222-8222-222222222222";
const SOLICITUD = {
  id: ID,
  solicitanteEmail: "mj.e2e@biabrands.co",
  solicitanteNombre: "Solicitante E2E",
  titulo: "Sombrillas",
  numeroReferencia: "RFQ-2026-0042",
  tipo: "RFQ",
};

function pedir(url: string) {
  return new Request(url);
}
const params = Promise.resolve({ id: ID });

beforeEach(() => {
  sesion.mockReset().mockResolvedValue(null);
  obtenerSolicitud.mockReset().mockResolvedValue(SOLICITUD);
  obtenerArchivoLogo.mockReset().mockResolvedValue({ nombre: "logo.png", bytea: Buffer.from("png") });
  listarCotizaciones.mockReset().mockResolvedValue([{ id: "c1", proveedorNombre: "Alfa", valorTotal: 11500 }]);
  guardarArchivoLogo.mockReset().mockResolvedValue(undefined);
  actualizarCamposSolicitud.mockReset().mockResolvedValue(undefined);
  generarDocumento.mockReset().mockResolvedValue({ buffer: Buffer.from("%PDF-1.4"), tipo: "RFQ", referencia: "RFQ-2026-0042" });
});

describe("GET /api/solicitudes/[id] · nunca público", () => {
  it("sin sesión responde 401 y NO devuelve la solicitud", async () => {
    const res = await getSolicitud(pedir(`http://localhost/api/solicitudes/${ID}`), { params });
    expect(res.status).toBe(401);
    expect(generarDocumento).not.toHaveBeenCalled();
  });

  it("sin sesión tampoco devuelve las cotizaciones con precios", async () => {
    const res = await getSolicitud(pedir(`http://localhost/api/solicitudes/${ID}`), { params });
    const texto = await res.text();
    expect(texto).not.toContain("11500");
    expect(texto).not.toContain("Proveedor");
  });

  it("con sesión de coordinador sí devuelve", async () => {
    sesion.mockResolvedValue({ rol: "coordinador", email: "c@biafoods.co" });
    const res = await getSolicitud(pedir(`http://localhost/api/solicitudes/${ID}`), { params });
    expect(res.status).toBe(200);
  });

  it("coordinador sigue pudiendo re-cotizar: el PATCH no se rompió", async () => {
    sesion.mockResolvedValue({ rol: "coordinador", email: "c@biafoods.co" });
    const res = await patchSolicitud(
      new Request(`http://localhost/api/solicitudes/${ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: "nueva descripción" }),
      }),
      { params }
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /api/solicitudes/[id]/documento · el solicitante ve SU pdf", () => {
  it("el solicitante dueño lo descarga con su correo, sin sesión", async () => {
    const res = await getDocumento(
      pedir(`http://localhost/api/solicitudes/${ID}/documento?email=mj.e2e%40biabrands.co`),
      { params }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("sin correo responde 401: es lo que rompía la pantalla de confirmación", async () => {
    const res = await getDocumento(pedir(`http://localhost/api/solicitudes/${ID}/documento`), { params });
    expect(res.status).toBe(401);
  });

  it("otro correo NO descarga el PDF", async () => {
    const res = await getDocumento(
      pedir(`http://localhost/api/solicitudes/${ID}/documento?email=curioso%40biafoods.co`),
      { params }
    );
    expect(res.status).toBe(401);
    expect(generarDocumento).not.toHaveBeenCalled();
  });

  it("Compras también puede verlo (sin correo)", async () => {
    sesion.mockResolvedValue({ rol: "coordinador", email: "c@biafoods.co" });
    const res = await getDocumento(pedir(`http://localhost/api/solicitudes/${ID}/documento`), { params });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/solicitudes/[id]/logo · material de marca del solicitante", () => {
  it("el solicitante dueño lo descarga con su correo", async () => {
    const res = await getLogo(
      pedir(`http://localhost/api/solicitudes/${ID}/logo?email=mj.e2e%40biabrands.co`),
      { params }
    );
    expect(res.status).toBe(200);
  });

  it("sin correo ni sesión responde 401 y no lee el archivo", async () => {
    const res = await getLogo(pedir(`http://localhost/api/solicitudes/${ID}/logo`), { params });
    expect(res.status).toBe(401);
    expect(obtenerArchivoLogo).not.toHaveBeenCalled();
  });

  it("otro correo NO descarga el logo", async () => {
    const res = await getLogo(
      pedir(`http://localhost/api/solicitudes/${ID}/logo?email=curioso%40biafoods.co`),
      { params }
    );
    expect(res.status).toBe(401);
    expect(obtenerArchivoLogo).not.toHaveBeenCalled();
  });
});