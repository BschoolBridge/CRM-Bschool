import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "mysql://crm:crm@127.0.0.1:3306/crm_test",
      SECRET_KEY: "test-secret-key-at-least-32-characters",
      REDIS_URL: "",
    },
  },
});
