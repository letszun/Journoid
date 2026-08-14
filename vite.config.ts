import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/Journoid/" : "/",
  build: {
    outDir: "dist/client",
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  plugins: [react()],
});
