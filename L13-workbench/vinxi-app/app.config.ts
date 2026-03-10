import { defineConfig } from "@solidjs/start/config";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

const MODEL_SERVER_ORIGIN = `http://localhost:${process.env.MODEL_SERVER_PORT || 4000}`;

// In production builds, CACHE_BUST_PATH_PREFIX is set (e.g. "0.2.0-rc.10").
// Vite's `base` controls the public path for all emitted assets.
// In dev mode, everything runs from root "/".
const cacheBustPrefix = process.env.CACHE_BUST_PATH_PREFIX;
const isProductionBuild = !!cacheBustPrefix;
const base = isProductionBuild ? `/${cacheBustPrefix}/` : undefined;

export default defineConfig({
    ssr: false,
    server: {
        routeRules: {
            "/api-server/**": {
                proxy: { to: `${MODEL_SERVER_ORIGIN}/api-server/**` },
            },
        },
    },
    vite: {
        ...(base ? { base } : {}),
        server: {
            fs: {
                allow: [
                    resolve(__dir, "../../visualizations"),
                    resolve(__dir, "../../L6-semantic-models"),
                    resolve(__dir, "../../L8-view-models"),
                ],
            },
            proxy: {
                "/api-server": {
                    target: MODEL_SERVER_ORIGIN,
                },
            },
        },
        resolve: {
            alias: {
                "~viz": resolve(__dir, "../../visualizations"),
                "~L6": resolve(__dir, "../../L6-semantic-models"),
                "~L8": resolve(__dir, "../../L8-view-models"),
            },
            dedupe: ["solid-js", "solid-js/web", "solid-js/store", "dockview-core", "cytoscape"],
        },
        optimizeDeps: {
            include: ["cytoscape", "dockview-core"],
        },
    },
});
