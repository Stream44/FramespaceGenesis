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
                ],
            },
        },
        resolve: {
            alias: {
                "~viz": resolve(__dir, "../../visualizations"),
            },
            dedupe: ["solid-js", "solid-js/web", "solid-js/store", "dockview-core"],
        },
    },
});
