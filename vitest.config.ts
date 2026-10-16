import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react() as never],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Higiene de la base de desarrollo: barre los residuos de pruebas (@bia.hn) al empezar y
    // borra los de esta corrida al terminar. Ver `vitest.global-setup.ts` (4.10.13).
    globalSetup: ["./vitest.global-setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
  },
});
