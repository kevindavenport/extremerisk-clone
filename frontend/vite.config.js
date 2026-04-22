import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // VITE_BASE_PATH is set to /risklens/ in the GitHub Actions workflow.
  // Locally it defaults to / so nothing changes for dev.
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    port: 5173,
  },
});
