import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/invariants/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      // Windows でも正しいファイルパスを返すよう fileURLToPath を使う
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@spec": fileURLToPath(new URL("./spec", import.meta.url)),
    },
  },
});
