import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const globals = {
  window: "readonly",
  document: "readonly",
  console: "readonly",
  fetch: "readonly",
  Request: "readonly",
  Response: "readonly",
  alert: "readonly",
  confirm: "readonly",
  prompt: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Headers: "readonly",
  FormData: "readonly",
  File: "readonly",
  Blob: "readonly",
  FileReader: "readonly",
  TextDecoder: "readonly",
  TextEncoder: "readonly",
  DecompressionStream: "readonly",
  createImageBitmap: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  navigator: "readonly",
  location: "readonly",
  history: "readonly",
  performance: "readonly",
  crypto: "readonly",
  atob: "readonly",
  btoa: "readonly",
  structuredClone: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  MutationObserver: "readonly",
  ResizeObserver: "readonly",
  IntersectionObserver: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  Element: "readonly",
  HTMLElement: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  EventTarget: "readonly",
  Node: "readonly",
  process: "readonly",
  describe: "readonly",
  it: "readonly",
  test: "readonly",
  expect: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
  vi: "readonly",
};

const reactRules = {
  ...reactPlugin.configs.recommended.rules,
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "warn",
  "react/react-in-jsx-scope": "off",
  "react/prop-types": "off",
  "react/no-unescaped-entities": "off",
  "react/jsx-no-comment-textnodes": "off",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  // JS/JSX files (Icons.jsx, test files)
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals,
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: {
      react: { version: "18" },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactRules,
      "no-empty": "off",
      "no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
      }],
      "no-undef": "error",
      "no-useless-assignment": "off",
    },
  },
  // TS/TSX files — use typescript-eslint parser for type-aware linting
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["src/**/*.{ts,tsx}"],
  })),
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals,
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: {
      react: { version: "18" },
    },
    rules: {
      ...reactRules,
      // Preserve existing code style (files converted from JS — var usage is intentional)
      "no-var": "off",
      "no-empty": "off",
      "no-useless-assignment": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow @ts-ignore (files use it sparingly); prefer @ts-expect-error going forward
      "@typescript-eslint/ban-ts-comment": "off",
      // Allow void expressions used as statements (common pattern in this codebase)
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
];
