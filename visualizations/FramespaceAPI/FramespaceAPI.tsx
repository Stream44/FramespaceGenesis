// ── Model API visualization panel ────────────────────────────────────
// Shows all engine API methods simultaneously in a nested dockview grid,
// tiled 2-across. Each method is a draggable/resizable dockview panel.

import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import type { JSX, Accessor, Setter } from "solid-js";
import { render } from "solid-js/web";
import { DockviewComponent } from "dockview-core";
import type { CreateComponentOptions, IContentRenderer, IHeaderActionsRenderer, DockviewGroupPanel } from "dockview-core";
import "dockview-core/dist/styles/dockview.css";
import type { VisualizationContext } from "../../workbench/app/src/lib/visualizations/types";
import type { EndpointDef, EngineSchema } from "../../workbench/app/src/lib/engines";
import { ResultView, RawJsonView } from "../../workbench/app/src/lib/renderLib";
import type { JsonValue } from "../../workbench/app/src/lib/renderLib";

// ── Verbose logging (disable with window.VERBOSE = false) ────────────
function vlog(context: string, ...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) console.log(`[FramespaceAPI/${context}]`, ...args);
}

// ── Shared view-tab state per panel (keyed by panel path) ────────────
const viewTabSignals = new Map<string, [Accessor<"rendered" | "raw">, Setter<"rendered" | "raw">]>();
function getViewTab(path: string): [Accessor<"rendered" | "raw">, Setter<"rendered" | "raw">] {
    if (!viewTabSignals.has(path)) {
        viewTabSignals.set(path, createSignal<"rendered" | "raw">("rendered"));
    }
    return viewTabSignals.get(path)!;
}

// ── Workbench context arg names ──────────────────────────────────────
// These arg names are auto-filled from the workbench context, not from user input.
const CONTEXT_ARG_NAMES = new Set(["spineInstanceUri"]);

// ── Component ────────────────────────────────────────────────────────

export function FramespaceAPI(props: { ctx: VisualizationContext }): JSX.Element {
    let containerRef: HTMLDivElement | undefined;
    let dockview: DockviewComponent | undefined;
    const disposers: (() => void)[] = [];

    const engine = () => {
        const engines = props.ctx.engines;
        return engines["Capsule-Ladybug-v0"] ?? Object.values(engines)[0] ?? null;
    };

    const schema = (): EngineSchema | null => engine()?.schema() ?? null;

    // Reactive workbench context — maps context arg names to their values
    const workbenchContext = (): Record<string, string> => {
        const ctx: Record<string, string> = {};
        const si = props.ctx.selectedSpineInstance();
        if (si) ctx.spineInstanceUri = si;
        return ctx;
    };

    // Wait for schema then build dockview panels
    let built = false;
    createEffect(() => {
        const s = schema();
        if (s && !built && containerRef) {
            built = true;
            buildDockview(s);
        }
    });

    function buildDockview(s: EngineSchema) {
        if (!containerRef) return;

        // Only show Encapsulate/CapsuleSpine methods
        const allEndpoints = Object.entries(s.endpoints)
            .filter(([, def]) => def.namespace === "Encapsulate/CapsuleSpine")
            .map(([path, def]) => ({
                path,
                name: path.split("/").pop()!,
                ...def,
            }));

        allEndpoints.sort((a, b) => a.name.localeCompare(b.name));
        vlog("buildDockview", `${allEndpoints.length} endpoints:`, allEndpoints.map(e => e.name));
        for (const ep of allEndpoints) {
            const localArgs = ep.args.filter((a: any) => !CONTEXT_ARG_NAMES.has(a.name));
            const ctxArgs = ep.args.filter((a: any) => CONTEXT_ARG_NAMES.has(a.name));
            vlog("buildDockview", `  ${ep.name}: localArgs=${JSON.stringify(localArgs.map((a: any) => a.name))}, ctxArgs=${JSON.stringify(ctxArgs.map((a: any) => a.name))}, discovery=${ep.discovery ?? '(none)'}`);
        }

        const COLS = 2;
        const rows = Math.ceil(allEndpoints.length / COLS);

        dockview = new DockviewComponent(containerRef, {
            createComponent: (options: CreateComponentOptions): IContentRenderer => {
                const ep = allEndpoints.find(e => e.path === options.id);
                if (!ep) {
                    return {
                        element: document.createElement("div"),
                        init: () => { },
                        dispose: () => { },
                    };
                }

                const el = document.createElement("div");
                el.style.width = "100%";
                el.style.height = "100%";
                el.style.overflow = "auto";

                let disposeRender: (() => void) | undefined;

                return {
                    element: el,
                    init: () => {
                        vlog("panel.init", ep.name);
                        disposeRender = render(() => (
                            <MethodPanelContent
                                path={ep.path}
                                name={ep.name}
                                endpoint={ep}
                                engine={engine}
                                schema={schema}
                                workbenchContext={workbenchContext}
                            />
                        ), el);
                        disposers.push(disposeRender);
                    },
                    dispose: () => {
                        disposeRender?.();
                    },
                };
            },
            createRightHeaderActionComponent: (group: DockviewGroupPanel): IHeaderActionsRenderer => {
                const el = document.createElement("div");
                el.style.display = "flex";
                el.style.alignItems = "center";
                el.style.gap = "2px";
                el.style.paddingRight = "6px";
                let disposeRender: (() => void) | undefined;
                return {
                    element: el,
                    init: (params) => {
                        // Find which panel is in this group
                        const panelId = group.panels?.[0]?.id;
                        if (!panelId) return;
                        disposeRender = render(() => {
                            const [viewTab, setViewTab] = getViewTab(panelId);
                            return (
                                <div class="ma-header-actions">
                                    <button
                                        class={`ma-header-tab ${viewTab() === "rendered" ? "active" : ""}`}
                                        onClick={() => setViewTab("rendered")}
                                    >Rendered</button>
                                    <button
                                        class={`ma-header-tab ${viewTab() === "raw" ? "active" : ""}`}
                                        onClick={() => setViewTab("raw")}
                                    >Raw</button>
                                </div>
                            );
                        }, el);
                    },
                    dispose: () => { disposeRender?.(); },
                };
            },
            className: "dockview-theme-dark",
        });

        // Build a reliable 2-column grid
        const groupGrid: string[][] = [];

        for (let i = 0; i < allEndpoints.length; i++) {
            const ep = allEndpoints[i];
            const row = Math.floor(i / COLS);
            const col = i % COLS;

            if (!groupGrid[row]) groupGrid[row] = [];

            if (i === 0) {
                const panel = dockview.addPanel({
                    id: ep.path,
                    component: ep.path,
                    title: ep.name,
                });
                groupGrid[row][col] = panel.group?.id ?? "";
            } else if (col === 0) {
                const refGroup = groupGrid[row - 1][0];
                const panel = dockview.addPanel({
                    id: ep.path,
                    component: ep.path,
                    title: ep.name,
                    position: { referenceGroup: refGroup, direction: "below" },
                });
                groupGrid[row][col] = panel.group?.id ?? "";
            } else {
                const refGroup = groupGrid[row][0];
                const panel = dockview.addPanel({
                    id: ep.path,
                    component: ep.path,
                    title: ep.name,
                    position: { referenceGroup: refGroup, direction: "right" },
                });
                groupGrid[row][col] = panel.group?.id ?? "";
            }
        }

        requestAnimationFrame(() => {
            if (!dockview) return;
            const groups = dockview.groups;
            if (groups.length === 0) return;

            const totalWidth = containerRef!.offsetWidth;
            const totalHeight = containerRef!.offsetHeight;
            const colWidth = Math.floor(totalWidth / COLS);
            const rowHeight = Math.floor(totalHeight / rows);

            for (const group of groups) {
                group.api.setSize({ width: colWidth, height: rowHeight });
            }
        });
    }

    onCleanup(() => {
        disposers.forEach(d => d());
        dockview?.dispose();
    });

    return (
        <div class="ma-root">
            <Show when={schema()} fallback={
                <div class="ma-loading">Waiting for engine connection...</div>
            }>
                <div class="ma-dockview" ref={containerRef} />
            </Show>
        </div>
    );
}

// ── Method Panel Content (rendered inside each dockview panel) ───────

function MethodPanelContent(props: {
    path: string;
    name: string;
    endpoint: EndpointDef;
    engine: () => any;
    schema: () => EngineSchema | null;
    workbenchContext: () => Record<string, string>;
}): JSX.Element {
    const [result, setResult] = createSignal<any>(null);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [elapsed, setElapsed] = createSignal<number | null>(null);
    const [viewTab] = getViewTab(props.path);
    // Local args are the ones the user provides (e.g. capsuleName).
    // Context args (e.g. spineInstanceUri) come from workbenchContext.
    const [localArgs, setLocalArgs] = createSignal<Record<string, string>>({});
    const [isDiscoveryView, setIsDiscoveryView] = createSignal(false);
    const [discoveryPreviews, setDiscoveryPreviews] = createSignal<Record<string, JsonValue>>({});

    const ep = props.endpoint;

    // Classify args: which are local (user-provided) vs context (workbench-provided)
    const localArgDefs = ep.args.filter((a: any) => !CONTEXT_ARG_NAMES.has(a.name));
    const contextArgDefs = ep.args.filter((a: any) => CONTEXT_ARG_NAMES.has(a.name));

    // Merge context + local args into a single args object for API calls
    const mergedArgs = (): Record<string, string> => {
        return { ...props.workbenchContext(), ...localArgs() };
    };

    // Are all LOCAL required args filled?
    const hasAllLocalArgs = (): boolean => {
        return localArgDefs.every((a: any) =>
            a.optional || (localArgs()[a.name] != null && localArgs()[a.name] !== "")
        );
    };

    // Should we show discovery? Only when local required args are missing.
    const shouldDiscover = (): boolean => {
        return localArgDefs.length > 0 && !hasAllLocalArgs() && !!ep.discovery;
    };

    const callMethod = async (overrideLocalArgs?: Record<string, string>) => {
        const e = props.engine();
        if (!e) { vlog(props.name, "callMethod — no engine, skipping"); return; }

        const local = overrideLocalArgs ?? localArgs();
        if (overrideLocalArgs) setLocalArgs(overrideLocalArgs);

        const ctx = props.workbenchContext();
        const merged = { ...ctx, ...local };

        setLoading(true);
        setError(null);
        setResult(null);
        setElapsed(null);
        setIsDiscoveryView(false);

        let actualPath = props.path;
        let isDiscovery = false;

        vlog(props.name, `callMethod — ctx:`, ctx, `local:`, local, `merged:`, merged);

        // Check if local required args are missing → use discovery
        const localFilled = localArgDefs.every((a: any) => {
            const val = local[a.name];
            return a.optional || (val != null && val !== "");
        });

        if (!localFilled && ep.discovery) {
            actualPath = ep.discovery;
            isDiscovery = true;
            setIsDiscoveryView(true);
            vlog(props.name, `callMethod — DISCOVERY: local args missing, calling ${actualPath}`);
        } else {
            vlog(props.name, `callMethod — DIRECT: calling ${actualPath} with merged args:`, merged);
        }

        try {
            const t0 = performance.now();
            // For discovery calls, pass context args to the discovery endpoint
            // For direct calls, pass all merged args
            const callArgs = isDiscovery ? ctx : merged;
            vlog(props.name, `callMethod — e.call("${actualPath}", ${JSON.stringify(callArgs)})`);
            const data = await e.call(actualPath, callArgs);
            setElapsed(Math.round(performance.now() - t0));
            setResult(data);
            vlog(props.name, `callMethod — SUCCESS: method=${data?.method}, #=${data?.result?.["#"]}, items=${data?.result?.list?.length ?? "(not a list)"}, isDiscovery=${isDiscovery}`);

            const discoveryItems = Array.isArray(data.result) ? data.result : data.result?.list;
            if (isDiscovery && ep.filterField && Array.isArray(discoveryItems)) {
                vlog(props.name, `callMethod — fetching ${discoveryItems.length} discovery previews`);
                fetchDiscoveryPreviews(discoveryItems);
            }
        } catch (err: any) {
            setElapsed(null);
            const msg = err?.message ?? (typeof err === "string" ? err : "Request failed");
            vlog(props.name, `callMethod — ERROR: ${msg}`);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const fetchDiscoveryPreviews = async (items: any[]) => {
        const e = props.engine();
        if (!e) return;
        const filterField = ep.filterField!;
        const firstLocalArg = localArgDefs[0];
        if (!firstLocalArg) return;
        const ctx = props.workbenchContext();
        const previews: Record<string, JsonValue> = {};
        const batch = items.slice(0, 50);
        await Promise.all(batch.map(async (item) => {
            const val = item[filterField];
            if (typeof val !== "string") return;
            try {
                // Merge context args + the selected local arg value
                const data = await e.call(props.path, { ...ctx, [firstLocalArg.name]: val });
                previews[val] = data.result ?? null;
            } catch { /* skip failed previews */ }
        }));
        setDiscoveryPreviews(previews);
    };

    const handleEntityClick = (field: string, value: string) => {
        vlog(props.name, "handleEntityClick — field:", field, "value:", value);
        const firstLocalArg = localArgDefs[0];
        if (!firstLocalArg) { vlog(props.name, "handleEntityClick — no local arg, ignoring"); return; }
        const newLocal = { [firstLocalArg.name]: value };
        vlog(props.name, "handleEntityClick — setting local args:", newLocal);
        setLocalArgs(newLocal);
        setIsDiscoveryView(false);
        callMethod(newLocal);
    };

    const clearAllFilters = () => {
        vlog(props.name, "clearAllFilters — clearing local args only");
        setLocalArgs({});
        // Re-fire with empty local args (will trigger discovery if needed)
        callMethod({});
    };

    const setArgValue = (name: string, value: string) => {
        setLocalArgs(prev => ({ ...prev, [name]: value }));
    };

    const clearArgValue = (name: string) => {
        setLocalArgs(prev => {
            const next = { ...prev };
            delete next[name];
            return next;
        });
    };

    const resultData = () => {
        const r = result();
        return r?.result ?? null;
    };

    // ── Reactive effect: re-fire when workbench context changes ─────
    // This replaces the old onMount auto-fetch logic.
    // Tracks workbenchContext() — when it changes, re-fire the API call.
    let initialized = false;
    createEffect(() => {
        const ctx = props.workbenchContext();
        const e = props.engine();
        if (!e) return;

        vlog(props.name, `reactive effect — ctx:`, ctx, `initialized: ${initialized}`);

        // Always fire: merge current context with current local args
        callMethod().catch(() => { });
        initialized = true;
    });

    return (
        <div class="ma-method-body">
            <Show when={isDiscoveryView() && localArgDefs.length > 0}>
                <div class="select-entity-bar">
                    <span class="select-entity-label">Select Entity</span>
                    <span class="select-entity-hint">
                        Click a highlighted <strong>{ep.filterField}</strong> value to filter
                    </span>
                </div>
            </Show>

            <Show when={!isDiscoveryView() && localArgDefs.length > 0}>
                <div class="args-panel">
                    <span class="args-label">Filters:</span>
                    <For each={localArgDefs}>
                        {(arg) => (
                            <div class="arg-row">
                                <label>{arg.name}:</label>
                                <div class="arg-input-wrap">
                                    <input
                                        type="text"
                                        placeholder={`${arg.type}`}
                                        value={localArgs()[arg.name] ?? ""}
                                        onInput={(e) => setArgValue(arg.name, e.currentTarget.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") callMethod(); }}
                                    />
                                    <Show when={(localArgs()[arg.name] ?? "") !== ""}>
                                        <button
                                            class="clear-btn"
                                            onClick={() => {
                                                clearArgValue(arg.name);
                                                const next = { ...localArgs() };
                                                delete next[arg.name];
                                                callMethod(next);
                                            }}
                                        >×</button>
                                    </Show>
                                </div>
                            </div>
                        )}
                    </For>
                    <div class="filter-actions">
                        <button class="filter-btn" onClick={() => callMethod()}>Filter</button>
                        <button class="clear-filter-btn" onClick={() => clearAllFilters()}>Clear</button>
                    </div>
                </div>
            </Show>

            <div class="ma-method-status">
                <Show when={isDiscoveryView()}>
                    <span class="discovery-badge">
                        discovery: {result()?.method}
                    </span>
                </Show>
                <Show when={elapsed()}>
                    <span class="ma-method-elapsed">{elapsed()}ms</span>
                </Show>
                <button class="ma-method-refresh" onClick={() => callMethod()}>↻</button>
            </div>

            <div
                class="ma-method-output"
                ref={(el: HTMLDivElement) => {
                    const onSelect = ((e: CustomEvent) => {
                        const id = e.detail?.$id;
                        vlog(props.name, "rep.select event — type:", e.type, "$id:", id);
                        if (typeof id === "string" && ep.filterField) {
                            handleEntityClick(ep.filterField, id);
                        }
                    }) as EventListener;
                    el.addEventListener("Capsules.select.Capsule", onSelect);
                    el.addEventListener("SpineInstances.select.SpineInstance", onSelect);
                }}
            >
                <Show when={loading()}>
                    <div class="loading-state">Loading...</div>
                </Show>
                <Show when={error()}>
                    <div class="error-text">{error()}</div>
                </Show>
                <Show when={resultData() != null}>
                    <Show when={viewTab() === "rendered"} fallback={
                        <RawJsonView data={resultData()} />
                    }>
                        <ResultView
                            data={resultData()}
                            filterField={isDiscoveryView() ? ep.filterField : undefined}
                            onClickValue={isDiscoveryView() ? handleEntityClick : undefined}
                            getPreview={isDiscoveryView()
                                ? (key: string) => discoveryPreviews()[key]
                                : undefined}
                        />
                    </Show>
                </Show>
            </div>
        </div>
    );
}
