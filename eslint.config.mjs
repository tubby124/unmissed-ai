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
    // Obsidian vault — third-party compiled JS, not project source
    "CALLINGAGENTS/**",
    // Non-app scripts, audit tests, and docs — not part of the compiled app
    "scripts/**",
    "docs/**",
    "tests/s12-audit/**",
    "tests/canary/**",
    "tests/promptfoo/**",
    "tests/retrieval-eval/**",
  ]),
  // Downgrade pre-existing React Compiler + cosmetic rules from error to warn.
  // These span dozens of pre-existing files; fixing them is a separate pass.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react/no-unescaped-entities": "warn",
      "react/jsx-no-comment-textnodes": "warn",
    },
  },
  // Downgrade no-explicit-any to warn in test files — tests intentionally use `any`
  // for casting mock DB rows and Supabase stubs.
  {
    files: ["src/lib/__tests__/**", "tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
