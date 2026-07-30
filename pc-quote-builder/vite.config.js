/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/cotiza-pc/",
  build: {
    outDir: "../docs",
    emptyOutDir: false,
  },
  test: {
    include: ["src/**/*.test.{js,jsx}", "../scripts/**/*.test.js"],
  },
});
