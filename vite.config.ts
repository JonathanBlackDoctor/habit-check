import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "/habit-check/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@firebase/firestore")) return "firestore";
          if (id.includes("@firebase/auth")) return "auth";
          if (
            id.includes("node_modules") &&
            (id.includes("react-dom") || id.includes("/react/"))
          )
            return "react";
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      manifest: {
        name: "Habit Check",
        short_name: "Habit Check",
        lang: "ko",
        description: "지금 할 습관과 오늘의 기도",
        start_url: "/habit-check/",
        scope: "/habit-check/",
        display: "standalone",
        background_color: "#f7f8f2",
        theme_color: "#f7f8f2",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/habit-check/index.html",
        navigateFallbackAllowlist: [
          /^\/habit-check\/(?:index\.html)?(?:\?.*)?$/,
        ],
        globPatterns: ["**/*.{html,js,css,svg,png,webmanifest}"],
        runtimeCaching: [],
      },
    }),
  ],
});
