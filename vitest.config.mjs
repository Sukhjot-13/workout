import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { transformWithOxc } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [{
    name: "next-page-jsx",
    enforce: "pre",
    transform(code, id) {
      if (id === path.join(rootDir, "app/page.js")) {
        return transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
      }
    },
  }],
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,jsx}"],
  },
});
