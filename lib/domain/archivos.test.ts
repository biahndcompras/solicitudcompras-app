import { describe, it, expect } from "vitest";
import {
  ACCEPT_ARCHIVO,
  MAX_BYTES_ARCHIVO,
  validarArchivoAdjunto,
  contenidoCoincide,
  pdfLooksCompleto,
} from "./archivos";

const bytes = (...b: number[]) => new Uint8Array(b);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x0a);

describe("archivos · lista blanca de tipos (P1-b)", () => {
  it("el atributo accept NO incluye .svg", () => {
    expect(ACCEPT_ARCHIVO).not.toContain("svg");
    expect(ACCEPT_ARCHIVO).toContain(".png");
    expect(ACCEPT_ARCHIVO).toContain("application/pdf");
  });

  it("rechaza .svg aunque el navegador diga image/svg+xml", () => {
    const r = validarArchivoAdjunto(
      { name: "logo.svg", size: 900, type: "image/svg+xml" },
      bytes(0x3c, 0x73, 0x76, 0x67)
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe("tipo");
  });

  it("rechaza .heic y cualquier extensión fuera de la lista", () => {
    for (const name of ["foto.heic", "malware.exe", "sin-extension", "doble.png.php"]) {
      const r = validarArchivoAdjunto({ name, size: 1000 });
      expect(r.ok, name).toBe(false);
    }
  });

  it("rechaza un tipo MIME fuera de la lista aunque la extensión sea buena", () => {
    const r = validarArchivoAdjunto({ name: "logo.png", size: 1000, type: "text/html" }, PNG);
    expect(r.ok).toBe(false);
  });

  it("acepta los cuatro formatos permitidos", () => {
    expect(validarArchivoAdjunto({ name: "a.png", size: 10, type: "image/png" }, PNG).ok).toBe(true);
    expect(validarArchivoAdjunto({ name: "a.jpg", size: 10, type: "image/jpeg" }, JPG).ok).toBe(true);
    expect(validarArchivoAdjunto({ name: "a.jpeg", size: 10, type: "image/jpeg" }, JPG).ok).toBe(true);
  });
});

describe("archivos · tope de tamaño con mensaje claro", () => {
  it("rechaza 12 MB diciendo cuántos MB pesa y cuál es el máximo", () => {
    const r = validarArchivoAdjunto({ name: "enorme.png", size: 12 * 1024 * 1024, type: "image/png" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("tamano");
    expect(r.mensaje).toContain("12.0 MB");
    expect(r.mensaje).toContain("4 MB");
  });

  it("acepta exactamente el tope y rechaza un byte más", () => {
    expect(validarArchivoAdjunto({ name: "a.png", size: MAX_BYTES_ARCHIVO, type: "image/png" }, PNG).ok).toBe(true);
    const r = validarArchivoAdjunto({ name: "a.png", size: MAX_BYTES_ARCHIVO + 1, type: "image/png" });
    expect(r.ok).toBe(false);
  });

  it("rechaza el archivo vacío", () => {
    const r = validarArchivoAdjunto({ name: "vacio.png", size: 0 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe("vacio");
  });
});

describe("archivos · el contenido tiene que cuadrar con la extensión", () => {
  it("detecta un PDF renombrado a .png", () => {
    expect(contenidoCoincide(".png", PDF)).toBe(false);
    const r = validarArchivoAdjunto({ name: "mentira.png", size: 900, type: "image/png" }, PDF);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe("contenido");
  });

  it("detecta un PDF corrupto/truncado (sin %%EOF)", () => {
    const truncado = new TextEncoder().encode("%PDF-1.4\nalgo sin cerrar");
    expect(pdfLooksCompleto(truncado)).toBe(false);
    const r = validarArchivoAdjunto({ name: "roto.pdf", size: 900, type: "application/pdf" }, truncado);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe("contenido");
    expect(r.ok === false && r.mensaje).toMatch(/corrupto|incompleto/i);
  });

  it("acepta un PDF completo", () => {
    const ok = new TextEncoder().encode("%PDF-1.4\n...contenido...\n%%EOF");
    expect(pdfLooksCompleto(ok)).toBe(true);
    expect(validarArchivoAdjunto({ name: "b.pdf", size: ok.length, type: "application/pdf" }, ok).ok).toBe(true);
  });

  it("no juzga el contenido si no se pudo leer (navegador sin arrayBuffer)", () => {
    expect(validarArchivoAdjunto({ name: "a.png", size: 900, type: "image/png" }).ok).toBe(true);
  });

  it("rechaza un archivo de 3 bytes (no se puede verificar la cabecera)", () => {
    const r = validarArchivoAdjunto({ name: "mini.png", size: 3, type: "image/png" }, bytes(0x89, 0x50, 0x4e));
    expect(r.ok).toBe(false);
  });
});
