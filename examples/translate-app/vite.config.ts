import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const SERVER_PORT = process.env.PORT ?? "4000";

// In dev, Vite serves the React app on :5173 and proxies API/webhook calls to
// the Express server. In production the Express server serves the built app.
export default defineConfig({
  plugins: [react()],
  root: "src/frontend",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": `http://localhost:${SERVER_PORT}`,
      "/webhook": `http://localhost:${SERVER_PORT}`,
    },
  },
});
