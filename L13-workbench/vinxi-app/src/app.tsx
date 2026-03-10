import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./theme.css";
import "./app.css";

// vinxi overrides BASE_URL to "/_build" in dev, so we use SERVER_BASE_URL
// which is "" in dev and "/<prefix>" in production builds.
const BASE_PATH = (import.meta.env.SERVER_BASE_URL || '').replace(/\/$/, '');

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
