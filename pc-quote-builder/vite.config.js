/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: usa el nombre del repo
  base: "/cotiza-pc/",
  build: {
    // build a la carpeta docs en la RAÍZ del repo
    outDir: "../docs",
    // docs/ also contains the canonical product source of truth.
    emptyOutDir: false,
  },
});
