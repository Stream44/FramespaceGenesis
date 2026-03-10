// ── Framespaces panel ────────────────────────────────────────────────
// Renders links for each framespace defined in the instance's config.
// The config is the source of truth; schema provides descriptions.
// Each link triggers the visualization method for the framespace.

import { For, Show, createMemo } from "solid-js";
import type { JSX } from "solid-js";
import type { EngineSchema } from "../../../L13-workbench/vinxi-app/src/lib/modelApiClient";

const URI_TRIM_PREFIX = '@stream44.studio/FramespaceGenesis/';

function trimUri(uri: string): string {
    let result = uri;
    if (result.startsWith(URI_TRIM_PREFIX)) result = result.substring(URI_TRIM_PREFIX.length);
    // Strip #method suffix for display
    const hashIdx = result.indexOf('#');
    if (hashIdx >= 0) result = result.substring(0, hashIdx);
    // Remove trailing /ModelQueryMethods
    if (result.endsWith('/ModelQueryMethods')) result = result.substring(0, result.length - '/ModelQueryMethods'.length);
    return result;
}

// ── Panel metadata ───────────────────────────────────────────────────
// Exported so the workbench can use this to configure the dockview panel.
export const panelDef = {
    id: "framespace-models",
    title: "Framespaces",
    description: "Framespace visualization links from instance config",
    position: "left" as const,
    tabComponent: "no-close-tab",
    initialWidthCols: 3,
    maxWidthCols: 5,
    minWidthCols: 2,
};

// ── Types ────────────────────────────────────────────────────────────

export type FramespaceLink = {
    uri: string;
    label: string;
    methodName: string;
    methodPath: string;
};

// ── Component ────────────────────────────────────────────────────────

export function FramespacesPanel(props: {
    schema: () => EngineSchema | null;
    framespaces: () => Record<string, any> | null;
    onFramespaceClick: (link: FramespaceLink) => void;
    activePanelId?: () => string | null;
}): JSX.Element {
    const links = createMemo((): FramespaceLink[] => {
        const fs = props.framespaces();
        if (!fs) return [];
        const s = props.schema();
        const result: FramespaceLink[] = [];
        for (const [uri, entry] of Object.entries(fs)) {
            // Extract the base URI (strip #method suffix) and method name
            const hashIdx = uri.indexOf('#');
            const baseUri = hashIdx >= 0 ? uri.substring(0, hashIdx) : uri;
            const ns = baseUri.replace(/\//g, '~');

            // Get method name and label from visualizationMethod config
            const vizMethods = entry?.visualizationMethod;
            const methodName = vizMethods ? Object.keys(vizMethods)[0] : null;
            if (!methodName) continue;
            const methodConfig = vizMethods[methodName] ?? {};
            const label = methodConfig.label ?? trimUri(uri);

            // Build the API path from the namespace
            const apiDef = s?.apis?.[ns];
            const basePath = apiDef?.basePath ?? `/api/${ns}`;
            const methodPath = `${basePath}/${methodName}`;

            result.push({
                uri,
                label,
                methodName,
                methodPath,
            });
        }
        return result;
    });

    return (
        <div class="fapi-list">
            <Show when={links().length === 0}>
                <div class="fapi-empty">Select an instance to see framespaces</div>
            </Show>
            <For each={links()}>
                {(link: FramespaceLink) => (
                    <button
                        class={`fapi-launch-btn${props.activePanelId?.() === link.methodPath ? ' fapi-launch-btn--active' : ''}`}
                        onClick={() => props.onFramespaceClick(link)}
                    >
                        {link.label}
                    </button>
                )}
            </For>
        </div>
    );
}
