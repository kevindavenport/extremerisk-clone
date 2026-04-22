import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      // Allow serving files from the monorepo root (so data/ is accessible)
      allow: [".."],
    },
  },
  // Expose the data directory as a static asset root
  publicDir: path.resolve(__dirname, ".."),
});
