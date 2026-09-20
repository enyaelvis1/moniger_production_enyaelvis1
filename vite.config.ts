import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const getManualChunkName = (id: string) => {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("recharts")) {
    return "charts-vendor";
  }

  if (id.includes("react-day-picker")) {
    return "calendar-vendor";
  }

  if (id.includes("framer-motion")) {
    return "motion-vendor";
  }

  if (
    id.includes("/tailwind-merge/") ||
    id.includes("/clsx/") ||
    id.includes("/class-variance-authority/")
  ) {
    return "style-vendor";
  }

  if (id.includes("@supabase/supabase-js")) {
    return "supabase-vendor";
  }

  if (id.includes("@tanstack/react-query")) {
    return "query-vendor";
  }

  if (
    id.includes("react-hook-form") ||
    id.includes("@hookform/resolvers") ||
    id.includes("/zod/")
  ) {
    return "forms-vendor";
  }

  if (id.includes("lucide-react")) {
    return "icons-vendor";
  }

  if (id.includes("date-fns")) {
    return "date-vendor";
  }

  if (
    id.includes("@radix-ui/") ||
    id.includes("/cmdk/") ||
    id.includes("/vaul/") ||
    id.includes("/sonner/") ||
    id.includes("/embla-carousel-react/") ||
    id.includes("/input-otp/")
  ) {
    return "ui-vendor";
  }

  if (
    id.includes("/react-router/") ||
    id.includes("/react-router-dom/") ||
    id.includes("/react-dom/") ||
    id.includes("/react/")
  ) {
    return "react-vendor";
  }

  return undefined;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks: getManualChunkName,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
