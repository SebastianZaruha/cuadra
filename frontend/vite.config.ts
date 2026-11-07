import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const raiz = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(raiz, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 43123,
    proxy: {
      "/api": "http://127.0.0.1:43124",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 43123,
    proxy: {
      "/api": "http://127.0.0.1:43124",
    },
  },
});
