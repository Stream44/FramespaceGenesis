import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./theme.css";
import "./app.css";

const BASE_PATH = import.meta.env.SERVER_BASE_URL || "";

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
