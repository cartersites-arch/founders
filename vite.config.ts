import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(async ({ command }) => {
  // Lazy dynamic import so dev mode doesn't pull in workerd.
  const cloudflarePlugin =
    command === "build"
      ? [
          (await import("@cloudflare/vite-plugin")).cloudflare({
            viteEnvironment: { name: "ssr" },
            ...(process.env.VITE_DEVELOPMENT_PREVIEW === "1" ? { configPath: "wrangler.preview.jsonc" } : {}),
          }),
        ]
      : [];

  return {
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      ...cloudflarePlugin,
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
            // `.functions.ts(x)` files under src/server are RPC stubs —
            // they're transformed at build time so client imports are allowed.
            excludeFiles: [
              "**/server/*.functions.ts",
              "**/server/*.functions.tsx",
              "**/server/**/*.functions.ts",
              "**/server/**/*.functions.tsx",
            ],
          },
        },
      }),
      viteReact(),
    ],
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      // Local review only: do not expose the dev server to external interfaces.
      host: "127.0.0.1",
      port: Number(process.env.PORT) || 8080,
      strictPort: true,
    },
    build: {
      // Serve built JS/CSS under /fw-assets/ so the reverse proxy can route
      // this app's static assets without colliding with other apps on the same domain.
      assetsDir: "fw-assets",
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Pull heavy vendor groups into stable, cacheable chunks instead of
          // inlining them all into the main bundle.
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react/jsx-runtime"],
            "vendor-tanstack": [
              "@tanstack/react-router",
              "@tanstack/react-start",
              "@tanstack/react-query",
            ],
            "vendor-radix": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-collapsible",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-label",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-tooltip",
            ],
            "vendor-charts": ["recharts"],
            "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
            "vendor-supabase": ["@supabase/supabase-js"],
            "vendor-stripe": ["stripe"],
            "vendor-email": ["@react-email/components", "react-email"],
          },
        },
      },
    },
  };
});
