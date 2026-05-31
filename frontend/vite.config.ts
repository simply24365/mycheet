import path from "node:path";
import { defineConfig } from "vite";
import WailsTypedEvents from "@wailsio/runtime/plugins/vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "src": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
  plugins: [tailwindcss(), react(), WailsTypedEvents("./bindings")],
});