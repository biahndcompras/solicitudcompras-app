// Word y PowerPoint (4.5.1 ampliado). Los formatos modernos son ZIP con XML: se extrae el
// texto sin IA, así que la prueba es determinística.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extraerTextoOficina } from "./oficina";

async function docx(parrafos: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const body = parrafos.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  zip.file("word/document.xml", `<w:document><w:body>${body}</w:body></w:document>`);
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

async function pptx(slides: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  slides.forEach((texto, i) => {
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${texto}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
    );
  });
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

describe("extracción de texto de Office", () => {
  it("lee los párrafos de un .docx conservando los saltos", async () => {
    const texto = await extraerTextoOficina(await docx(["Ferretería La Económica", "Total L 37,030.00"]), ".docx");
    expect(texto).toContain("Ferretería La Económica");
    expect(texto).toContain("Total L 37,030.00");
    expect(texto.split("\n").length).toBeGreaterThanOrEqual(2);
  });

  it("lee las diapositivas de un .pptx en orden", async () => {
    const texto = await extraerTextoOficina(await pptx(["Proveedor Alfa", "Oferta: L 11,500"]), ".pptx");
    expect(texto).toContain("## Diapositiva 1");
    expect(texto).toContain("Proveedor Alfa");
    expect(texto).toContain("## Diapositiva 2");
    expect(texto.indexOf("Diapositiva 1")).toBeLessThan(texto.indexOf("Diapositiva 2"));
  });

  it("un ZIP que no es Word ni PowerPoint falla con un mensaje claro", async () => {
    const zip = new JSZip();
    zip.file("otra-cosa.txt", "x");
    const bytes = new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
    await expect(extraerTextoOficina(bytes, ".docx")).rejects.toThrow(/docx válido/i);
  });
});
