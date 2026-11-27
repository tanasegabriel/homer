import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "url";
import fs from "fs";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import { version } from "./package.json";
import resolveMock from "./dummy-data/resolve.js";

const DEMO_CONFIG = fileURLToPath(
  new URL("./dummy-data/demo.yml", import.meta.url),
);

function writeVersionPlugin() {
  return {
    name: "write-version",
    apply: "build",
    closeBundle() {
      fs.writeFileSync("dist/VERSION", version);
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function dummyDataPlugin(mode) {
  const serve = ({ middlewares }) => {
    middlewares.use(async (req, res, next) => {
      const pathname = req.url?.split("?")[0];
      const demoConfig = mode === "demo" && pathname === "/assets/config.yml";
      const mock =
        pathname === "/dummy-data" || pathname?.startsWith("/dummy-data/");
      if (!demoConfig && !mock) {
        next();
        return;
      }
      try {
        if (demoConfig) {
          res.end(fs.readFileSync(DEMO_CONFIG));
          return;
        }
        const body = await readBody(req);
        const file = resolveMock(req.url, { method: req.method, body });
        res.statusCode = file ? 200 : 404;
        res.end(file ? fs.readFileSync(file) : "");
      } catch (error) {
        next(error);
      }
    });
  };

  return {
    name: "dummy-data",
    configureServer: serve,
    configurePreviewServer: serve,
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "",
  build: {
    assetsDir: "resources",
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    writeVersionPlugin(),
    dummyDataPlugin(mode),
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      useCredentials: true,
      manifestFilename: "assets/manifest.json",
      manifest: {
        name: "Homer dashboard",
        short_name: "Homer",
        description: "Home Server Dashboard",
        theme_color: "#3367D6",
        start_url: "../",
        scope: "../",
        icons: [
          {
            src: "./icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "./icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        navigateFallback: null,
      },
    }),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./node_modules", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
    restoreMocks: true,
    unstubGlobals: true,
  },
}));
