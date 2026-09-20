import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/postcss";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  publicDir: "../../public",
  resolve: {
    alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true } },
  },
  build: { outDir: "dist", emptyOutDir: true },
  css: { postcss: { plugins: [tailwind()] } },
});
