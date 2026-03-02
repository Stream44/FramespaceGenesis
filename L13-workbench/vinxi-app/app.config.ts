import { defineConfig } from "@solidjs/start/config";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    ssr: false,
    vite: {
        server: {
            fs: {
                allow: [
                    resolve(__dir, "../../visualizations"),
                    resolve(__dir, "../../L6-semantic-models"),
                    resolve(__dir, "../../L8-view-models"),
                ],
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
