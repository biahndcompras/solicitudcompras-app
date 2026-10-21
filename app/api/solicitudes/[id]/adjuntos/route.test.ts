// Documentos adjuntos de la solicitud (4.4.12).
//
// Lo que se fija: que no queden abiertos (Compras o el correo dueño), que el servidor valide el
// CONTENIDO (no el nombre), que el solicitante no pueda borrar un documento de Compras, y que
// el aviso por correo salga al otro lado del mostrador.
import { describe, it, expect, vi, beforeEach } from "vitest";

const obtenerSolicitud = vi.fn();
const listarAdjuntos = vi.fn();
const crearAdjunto = vi.fn();
const obtenerAdjunto = vi.fn();
const eliminarAdjunto = vi.fn();
const listarCoordinadores = vi.fn();
const enviarCorreo = vi.fn();
const sesion = vi.fn();

vi.mock("@/lib/db/postgres-repo", () => ({
  PostgresRepositorio: class {
    obtenerSolicitud = (...a: unknown[]) => obtenerSolicitud(...a);
    listarAdjuntos = (...a: unknown[]) => listarAdjuntos(...a);
    crearAdjunto = (...a: unknown[]) => crearAdjunto(...a);
    obtenerAdjunto = (...a: unknown[]) => obtenerAdjunto(...a);
    eliminarAdjunto = (...a: unknown[]) => eliminarAdjunto(...a);
    listarCoordinadores = (...a: unknown[]) => listarCoordinadores(...a);
  },
}));
vi.mock("@/lib/mail/enviar", () => ({ enviarCorreo: (...a: unknown[]) => enviarCorreo(...a) }));
vi.mock("@/lib/auth", () => ({ getSession: () => sesion() }));

import { GET, POST } from "./route";
import { DELETE, GET as DESCARGAR } from "./[adjuntoId]/route";

const ID = "22222222-2222-4222-8222-222222222222";
const SOLICITUD = {
  id: ID,
  numeroReferencia: "RFQ-2026-0042",
  titulo: "Sombrillas",
  estado: "ENVIADA_A_COMPRAS",
  solicitanteEmail: "maria@bia.hn",
  solicitanteNombre: "María",
  coordinadorId: "coord-1",
  clasificacionCorregida: false,
  notificacionFallida: false,
  fechaCreacion: "2026-10-20T10:00:00Z",
};

// Un `File` real (la ruta exige `instanceof`) con los bytes que le pasemos.
function archivo(nombre: string, contenido: Uint8Array, type = "", tamano?: number): File {
  const f = Object.create(File.prototype) as File;
  Object.defineProperties(f, {
    name: { value: nombre },
    size: { value: tamano ?? contenido.byteLength },
    type: { value: type },
    arrayBuffer: {
      value: async () => contenido.buffer.slice(contenido.byteOffset, contenido.byteOffset + contenido.byteLength),
    },
  });
  return f;
}

function pedir(url: string, f?: File) {
  return {
    url,
    formData: async () => ({ get: (k: string) => (k === "archivo" ? f : null) }),
  } as unknown as Request;
}

const PDF = new TextEncoder().encode("%PDF-1.4\n...\n%%EOF\n");
const params = Promise.resolve({ id: ID });

beforeEach(() => {
  delete process.env.MAIL_COORDINADOR_DEFAULT;
  process.env.NEXT_PUBLIC_APP_URL = "https://compras.bia.hn";
  sesion.mockReset().mockResolvedValue(null);
  obtenerSolicitud.mockReset().mockResolvedValue(SOLICITUD);
  listarAdjuntos.mockReset().mockResolvedValue([]);
  crearAdjunto.mockReset().mockImplementation(async (i: { nombreArchivo: string }) => ({ id: "a1", ...i }));
  obtenerAdjunto.mockReset().mockResolvedValue(null);
  eliminarAdjunto.mockReset().mockResolvedValue(true);
  listarCoordinadores.mockReset().mockResolvedValue([
    { id: "coord-1", email: "bbonilla@biabrands.co", nombre: "Bryan", activo: true, categoriasAsignadas: [] },
  ]);
  enviarCorreo.mockReset().mockResolvedValue({ estadoEnvio: "enviado" });
});

describe("GET /api/solicitudes/[id]/adjuntos", () => {
  it("sin correo ni sesión responde 401", async () => {
    const res = await GET(pedir(`http://localhost/api/solicitudes/${ID}/adjuntos`), { params });
    expect(res.status).toBe(401);
    expect(listarAdjuntos).not.toHaveBeenCalled();
  });

  it("el solicitante dueño ve la lista", async () => {
    listarAdjuntos.mockResolvedValue([{ id: "a1", nombreArchivo: "ficha.pdf", creadoEn: "2026-10-20" }]);
    const res = await GET(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos?email=maria%40bia.hn`),
      { params }
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ adjuntos: [{ nombreArchivo: "ficha.pdf" }] });
  });
});

describe("POST /api/solicitudes/[id]/adjuntos", () => {
  it("rechaza un archivo cuyo contenido no corresponde (servidor, no solo cliente)", async () => {
    const falso = archivo("ficha.pdf", new TextEncoder().encode("no soy un pdf"));
    const res = await POST(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos?email=maria%40bia.hn`, falso),
      { params }
    );
    expect(res.status).toBe(415);
    expect(crearAdjunto).not.toHaveBeenCalled();
  });

  it("rechaza una extensión no admitida", async () => {
    const res = await POST(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos?email=maria%40bia.hn`, archivo("x.exe", PDF)),
      { params }
    );
    expect(res.status).toBe(415);
    expect(crearAdjunto).not.toHaveBeenCalled();
  });

  it("el solicitante sube un PDF válido y se avisa al coordinador", async () => {
    const res = await POST(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos?email=maria%40bia.hn`, archivo("ficha.pdf", PDF, "application/pdf")),
      { params }
    );
    expect(res.status).toBe(201);
    expect(crearAdjunto).toHaveBeenCalledWith(
      expect.objectContaining({ nombreArchivo: "ficha.pdf", subidoPorEmail: "maria@bia.hn", actorTipo: "solicitante" })
    );
    expect(enviarCorreo).toHaveBeenCalledWith(
      expect.objectContaining({ tipoCorreo: "9", destinatario: "bbonilla@biabrands.co" })
    );
  });

  it("Compras sube y se avisa al solicitante", async () => {
    sesion.mockResolvedValue({ rol: "coordinador", email: "coord@biafoods.co", nombre: "Coord" });
    const res = await POST(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos`, archivo("ficha.pdf", PDF, "application/pdf")),
      { params }
    );
    expect(res.status).toBe(201);
    expect(enviarCorreo).toHaveBeenCalledWith(
      expect.objectContaining({ tipoCorreo: "9", destinatario: "maria@bia.hn" })
    );
  });
});

describe("límite de tamaño", () => {
  it("rechaza un archivo de más de 4 MB sin leerlo entero", async () => {
    const grande = archivo("grande.pdf", new Uint8Array(10), "application/pdf", 5 * 1024 * 1024);
    const res = await POST(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos?email=maria%40bia.hn`, grande),
      { params }
    );
    expect(res.status).toBe(413);
    expect(crearAdjunto).not.toHaveBeenCalled();
  });
});

describe("descarga y borrado", () => {
  const paramsAdj = Promise.resolve({ id: ID, adjuntoId: "a1" });

  it("descarga el documento con el nombre del archivo", async () => {
    obtenerAdjunto.mockResolvedValue({ id: "a1", nombreArchivo: "ficha.pdf", mimeType: "application/pdf", contenido: PDF });
    const res = await DESCARGAR(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos/a1?email=maria%40bia.hn`),
      { params: paramsAdj }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("ficha.pdf");
  });

  it("el solicitante NO borra un documento que subió Compras", async () => {
    obtenerAdjunto.mockResolvedValue({ id: "a1", nombreArchivo: "ficha.pdf", subidoPorEmail: "coord@biafoods.co" });
    const res = await DELETE(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos/a1?email=maria%40bia.hn`),
      { params: paramsAdj }
    );
    expect(res.status).toBe(403);
    expect(eliminarAdjunto).not.toHaveBeenCalled();
  });

  it("el solicitante borra el suyo y queda el evento", async () => {
    obtenerAdjunto.mockResolvedValue({ id: "a1", nombreArchivo: "ficha.pdf", subidoPorEmail: "maria@bia.hn" });
    const res = await DELETE(
      pedir(`http://localhost/api/solicitudes/${ID}/adjuntos/a1?email=maria%40bia.hn`),
      { params: paramsAdj }
    );
    expect(res.status).toBe(204);
    expect(eliminarAdjunto).toHaveBeenCalledWith(
      expect.objectContaining({ adjuntoId: "a1", actorTipo: "solicitante" })
    );
  });

  it("sin autorización no borra", async () => {
    const res = await DELETE(pedir(`http://localhost/api/solicitudes/${ID}/adjuntos/a1`), { params: paramsAdj });
    expect(res.status).toBe(401);
    expect(eliminarAdjunto).not.toHaveBeenCalled();
  });
});
