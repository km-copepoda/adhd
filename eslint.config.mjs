import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma generated client output (gitignored, environment-dependent).
    "src/generated/**",
  ]),
  {
    // next/image を <img> でモックするのは意図的（LCP最適化の対象外）。
    files: ["src/__tests__/**"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Playwright の fixture が `page` / `use` という名前のため
    // React Hook と誤検知される（e2e/fixtures.ts）。純粋な誤検知。
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    // 依存パッケージ不要の CommonJS 単体スクリプト。ESM化する必然性がない。
    files: ["scripts/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
