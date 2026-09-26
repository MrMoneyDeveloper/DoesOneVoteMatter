import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { summaryPlugin } from "./pipeline/summary-plugin.ts";
export default defineConfig({
  plugins: [react(), summaryPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/echarts/") || id.includes("/zrender/"))
            return "charts";
          if (id.includes("/gsap/")) return "animation";
        },
      },
    },
  },
});
