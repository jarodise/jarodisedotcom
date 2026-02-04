// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vitePluginSvgr from "vite-plugin-svgr";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss(), vitePluginSvgr({})],
  },
  devToolbar: {
    enabled: false,
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        // Exclude tag pagination pages
        if (page.includes('/tags/') && /\/\d+\/?$/.test(page)) {
          return false;
        }
        // Exclude archive pagination pages  
        if (page.includes('/archive/') && /\/\d+\/?$/.test(page)) {
          return false;
        }
        return true;
      }
    })
  ],

  markdown: {
    shikiConfig: {
      defaultColor: false,
      themes: {
        light: "github-light-high-contrast", // one-light
        dark: "github-dark", // plastic
      },
      wrap: true,
    },
  },

  prefetch: {
    prefetchAll: true,
    // defaultStrategy: "load",
  },

  output: "static",
  site: "https://jarodise.com",
});
