// ── Models panel (tag-filtered method list) ───────────────────────────
// Shows only methods tagged with this panel's tag. Each method is clickable
// to open as a tab in the main workbench dockview.

import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import type { EngineSchema } from "../../../L13-workbench/vinxi-app/src/lib/modelApiClient";
import { workbenchLib } from "../../../L13-workbench/vinxi-app/src/lib/workbenchLib";

// ── Tag this panel filters by ────────────────────────────────────────
const PANEL_TAG = '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/Models/Panel';

const NS_TRIM_PREFIX = '@framespace.dev~FramespaceGenesis~';
const NS_TRIM_SUFFIX = '~ModelQueryMethods';

function trimNamespace(ns: string): string {
    let result = ns;
    if (result.startsWith(NS_TRIM_PREFIX)) result = result.substring(NS_TRIM_PREFIX.length);
    if (result.endsWith(NS_TRIM_SUFFIX)) result = result.substring(0, result.length - NS_TRIM_SUFFIX.length);
    return result;
}

// ── Panel metadata ───────────────────────────────────────────────────
// Exported so the workbench can use this to configure the dockview panel.
export const panelDef = {
    id: "framespace-models",
    title: "Models",
    description: "Tag-filtered model method list",
    position: "left" as const,
    tabComponent: "no-close-tab",
    initialWidthCols: 3,
    maxWidthCols: 5,
    minWidthCols: 2,
};

// ── Component ────────────────────────────────────────────────────────

export function ModelsPanel(props: {
    schema: () => EngineSchema | null;
    onMethodClick: (path: string, name: string) => void;
}): JSX.Element {
    const apis = () => {
        const s = props.schema();
        if (!s) return [];
        // Collect all endpoints tagged with PANEL_TAG, grouped by namespace
        const byNs: Record<string, { namespace: string; description: string; methods: any[] }> = {};
        for (const [path, def] of Object.entries(s.endpoints)) {
            if (!def.tags || !def.tags[PANEL_TAG]) continue;
            const ns = def.namespace;
            if (!byNs[ns]) {
                const api = s.apis?.[ns];
                byNs[ns] = {
                    namespace: ns,
                    description: api?.description ?? '',
                    methods: [],
                };
            }
            byNs[ns].methods.push({
                path,
                name: path.split("/").pop()!,
                description: def.description,
                // Overlay tag-level properties
                ...def.tags[PANEL_TAG],
            });
        }
        // Sort methods within each group
        for (const g of Object.values(byNs)) {
            g.methods.sort((a: any, b: any) => a.name.localeCompare(b.name));
        }
        return Object.values(byNs).map(g => ({
            ...g,
            displayNamespace: trimNamespace(g.namespace),
        }));
    };

    return (
        <div class="fapi-list">
            <For each={apis()}>
                {(api: { namespace: string; description: string; methods: any[]; displayNamespace: string }) => (
                    <div class="fapi-group">
                        <div class="fapi-group-header">
                            <span class="fapi-group-name">{api.displayNamespace}</span>
                            <span class="fapi-group-count">{api.methods.length} methods</span>
                        </div>
                        <div class="fapi-methods">
                            <For each={api.methods}>
                                {(m: any) => (
                                    <button
                                        class="fapi-method"
                                        onClick={() => props.onMethodClick(m.path, m.name)}
                                    >
                                        <span class="fapi-method-name">{m.label ?? m.name}</span>
                                        <Show when={m.description}>
                                            <span class="fapi-method-desc">{m.description}</span>
                                        </Show>
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>
                )}
            </For>
        </div>
    );
}
