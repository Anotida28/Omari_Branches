import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3061",
      "/health": "http://localhost:3061",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-mui": ["@mui/material", "@mui/lab", "@emotion/react", "@emotion/styled"],
          "vendor-charts": ["recharts"],
          "vendor-query": ["@tanstack/react-query", "axios"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
});
