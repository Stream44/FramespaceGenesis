import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./theme.css";
import "./app.css";

// Vite's base config (set via CACHE_BUST_PATH_PREFIX in app.config.ts) controls
// all asset URLs at build time. The Router base uses the same value so client-side
// routing matches the URL prefix (e.g. /0.2.0-rc.10/).
// import.meta.env.BASE_URL is "/" in dev, "/<version>/" in production builds.
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
    return (
        <Router
            base={BASE_PATH}
            root={props => (
                <MetaProvider>
                    <Title>Framespace Workbench</Title>
                    <Suspense>{props.children}</Suspense>
                </MetaProvider>
            )}
        >
            <FileRoutes />
        </Router>
    );
}
