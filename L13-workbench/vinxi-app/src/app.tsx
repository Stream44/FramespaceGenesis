import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./theme.css";
import "./app.css";

// Detect base path at runtime: if URL is /0.2.0-rc.10/foo, base is /0.2.0-rc.10
// This handles the cache-bust prefix injected by ModelServer
function getBasePath(): string {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/^(\/[\d]+\.[\d]+\.[\d]+[^/]*)/);
    return match ? match[1] : "";
}

const BASE_PATH = getBasePath();

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
