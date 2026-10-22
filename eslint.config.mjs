import { globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // Referencia de diseño: se lee, no se compila ni se lintea (también excluida de tsconfig).
    "frontend-reference/**",
  ]),
  ...nextCoreWebVitals,
  ...nextTs,
];

export default eslintConfig;
