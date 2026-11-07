import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ESLint already ignores node_modules. Next already ignores .next.
    ".superpowers/**",
    // Layout reference, not application source.
    "docs/ref/**",
  ]),
]);

export default eslintConfig;
