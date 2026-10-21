// Token firmado de descarga (4.13.11). El enlace del correo abre el archivo sin sesión, así
// que el token tiene que: atar el adjunto a la solicitud, caducar y no poder falsificarse.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { firmarDescarga, verificarDescarga } from "./token";

let previo: string | undefined;
beforeEach(() => {
  previo = process.env.DOWNLOAD_SECRET;
  process.env.DOWNLOAD_SECRET = "secreto-de-prueba";
});
afterEach(() => {
  if (previo === undefined) delete process.env.DOWNLOAD_SECRET;
  else process.env.DOWNLOAD_SECRET = previo;
});

describe("token de descarga", () => {
  it("firma y verifica el mismo adjunto y la misma solicitud", () => {
    const t = firmarDescarga("adj-1", "sol-1")!;
    expect(verificarDescarga(t, "adj-1", "sol-1")).toMatchObject({ adjuntoId: "adj-1", solicitudId: "sol-1" });
  });

  it("NO sirve para otro adjunto ni para otra solicitud", () => {
    const t = firmarDescarga("adj-1", "sol-1")!;
    expect(verificarDescarga(t, "adj-2", "sol-1")).toBeNull();
    expect(verificarDescarga(t, "adj-1", "sol-2")).toBeNull();
  });

  it("caduca", () => {
    const t = firmarDescarga("adj-1", "sol-1", -1)!;
    expect(verificarDescarga(t, "adj-1", "sol-1")).toBeNull();
  });

  it("no acepta un token manipulado", () => {
    const t = firmarDescarga("adj-1", "sol-1")!;
    const roto = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(t, "base64url").toString()), adjuntoId: "adj-2" })
    ).toString("base64url");
    expect(verificarDescarga(roto, "adj-2", "sol-1")).toBeNull();
  });

  it("sin secreto configurado no firma (el correo omite el botón)", () => {
    delete process.env.DOWNLOAD_SECRET;
    delete process.env.CRON_SECRET;
    expect(firmarDescarga("adj-1", "sol-1")).toBeNull();
  });
});
