import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// En Node 22+ el `localStorage` global experimental pisa al de jsdom y lanza
// ("localStorage is not available because --localstorage-file was not provided").
// Sin almacenamiento, todo lo que persiste el borrador del solicitante deja de
// funcionar en los tests y los fallos se ven como "no se guardó nada" en vez de
// "el código está mal".
//
// Se instala SIEMPRE, sin mirar si ya existe uno. Con el guard `if (!window.localStorage)`
// el almacenamiento que acaban usando los tests depende de si esa versión de Node/flags
// expone el suyo en `window`: mismo código, comportamiento distinto según la máquina, y
// tests que dependen de `localStorage` (p. ej. A11.3, que sustituye `setItem` para simular
// cuota llena) se vuelven intermitentes sin tocar una línea. Un `Storage` en memoria con la
// misma superficie (`length`, `key(i)`) hace el suite determinista.
{
  const memoria = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => (memoria.has(k) ? memoria.get(k)! : null),
      setItem: (k: string, v: string) => void memoria.set(k, String(v)),
      removeItem: (k: string) => void memoria.delete(k),
      clear: () => memoria.clear(),
      key: (i: number) => [...memoria.keys()][i] ?? null,
      get length() {
        return memoria.size;
      },
    },
  });
}

afterEach(() => {
  cleanup();
});
