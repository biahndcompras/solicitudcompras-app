import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { apuntaALaBaseReal, urlDeTests } from "@/lib/db/test-url";

// La suite escribe de verdad en la base. Si DATABASE_URL apunta al piloto (Supabase) y no hay
// TEST_DATABASE_URL, se corta la conexión acá: los tests de integración se omiten y ningún
// camino puede escribir en la base real por accidente.
{
  const urlTests = urlDeTests();
  if (urlTests) {
    process.env.DATABASE_URL = urlTests;
  } else if (apuntaALaBaseReal()) {
    console.warn(
      "[tests] DATABASE_URL apunta a una base remota y no hay TEST_DATABASE_URL: se desactivan los tests de integración."
    );
    process.env.DATABASE_URL = "";
  }
}

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
// Solo aplica en jsdom. Los tests que corren en entorno `node` (p. ej. los que llaman a la IA
// en vivo, que con jsdom fallan con "Expected signal ... to be an instance of AbortSignal")
// no tienen `window`, y este archivo se carga para todos.
if (typeof window !== "undefined") {
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
  // `cleanup()` de Testing Library necesita un DOM; en entorno `node` no hay nada que limpiar.
  if (typeof document !== "undefined") cleanup();
});
