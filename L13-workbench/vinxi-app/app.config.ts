import { defineConfig } from "@solidjs/start/config";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

const MODEL_SERVER_ORIGIN = `http://localhost:${process.env.MODEL_SERVER_PORT || 4000}`;
export default defineConfig({
    ssr: false,
    server: {
        routeRules: {
            "/api-server/**": {
                proxy: { to: `${MODEL_SERVER_ORIGIN}/api/**` },
            },
        },
    },
    vite: {
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
                    rewrite: (path: string) => path.replace(/^\/api-server/, "/api"),
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
