import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import { fileURLToPath, URL } from "node:url";
import manifest from "./manifest.config";

// ProxyPilot Chrome Extension build config.
// @crxjs handles MV3 manifest generation, HMR and bundling of the
// popup (React), background service worker and content assets.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    target: "esnext",
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  server: {
    port: 5199,
    strictPort: true,
    hmr: { port: 5199 },
  },
});
