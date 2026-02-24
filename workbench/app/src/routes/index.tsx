import { Title } from "@solidjs/meta";
import { onMount, For, Show, createSignal, onCleanup, createEffect } from "solid-js";
import type { Accessor, Setter, JSX } from "solid-js";
import { workbenchStore } from "~/lib/workbenchStore";
import type { EndpointDef, EngineSchema } from "~/lib/engines";
import { ResultView, RawJsonView } from "~/lib/renderLib";
import type { JsonValue } from "~/lib/renderLib";
import "~viz/CapsularSpine/reps/CapsuleSpineTree";
import { createDockview } from "dockview-core";
import type { DockviewTheme } from "dockview-core";
import type {
    DockviewApi,
    GroupPanelPartInitParameters,
    IGroupHeaderProps,
    DockviewGroupPanel,
} from "dockview-core";
import "dockview-core/dist/styles/dockview.css";
import { render } from "solid-js/web";
import { workbenchLib } from "~/lib/workbenchLib";

const themeBlueprintVellum: DockviewTheme = {
    name: "blueprint-vellum",
    className: "dockview-theme-blueprint-vellum",
    gap: 4,
};

// ── Verbose logging ──────────────────────────────────────────────────
function vlog(context: string, ...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) console.log(`[Workbench/${context}]`, ...args);
}

// ── Workbench context arg names ──────────────────────────────────────
const CONTEXT_ARG_NAMES = new Set(["spineInstanceUri"]);

// ── Shared view-tab state per panel (keyed by panel id) ──────────────
const viewTabSignals = new Map<string, [Accessor<"rendered" | "raw">, Setter<"rendered" | "raw">]>();
function getViewTab(id: string): [Accessor<"rendered" | "raw">, Setter<"rendered" | "raw">] {
    if (!viewTabSignals.has(id)) {
        viewTabSignals.set(id, createSignal<"rendered" | "raw">("rendered"));
    }
    return viewTabSignals.get(id)!;
}

// ── Shared panel status (elapsed time + reload) per panel ────────────
type PanelStatus = {
    elapsed: Accessor<number | null>;
    setElapsed: Setter<number | null>;
    reload: Accessor<(() => void) | null>;
    setReload: Setter<(() => void) | null>;
    isDiscovery: Accessor<boolean>;
    setIsDiscovery: Setter<boolean>;
    discoveryMethod: Accessor<string | null>;
    setDiscoveryMethod: Setter<string | null>;
};
const panelStatusMap = new Map<string, PanelStatus>();
function getPanelStatus(id: string): PanelStatus {
    if (!panelStatusMap.has(id)) {
        const [elapsed, setElapsed] = createSignal<number | null>(null);
        const [reload, setReload] = createSignal<(() => void) | null>(null);
        const [isDiscovery, setIsDiscovery] = createSignal(false);
        const [discoveryMethod, setDiscoveryMethod] = createSignal<string | null>(null);
        panelStatusMap.set(id, { elapsed, setElapsed, reload, setReload, isDiscovery, setIsDiscovery, discoveryMethod, setDiscoveryMethod });
    }
    return panelStatusMap.get(id)!;
}

// ── Spine Instance Selection Page ────────────────────────────────────

function SpineInstanceSelector() {
    const instances = () => workbenchStore.spineInstances();
    const isConnecting = () => workbenchStore.engines.some(e => e.status() === "connecting");

    const splitId = (id: string) => {
        const parts = id.split("/");
        const capsuleName = parts.pop() ?? id;
        const filepath = parts.length > 0 ? parts.join("/") + "/" : "";
        return { capsuleName, filepath };
    };

    return (
        <div class="instance-selector">
            <div class="instance-selector-header">
                <h2>Select a Capsule Spine Tree Instance</h2>
                <p class="instance-selector-hint">Choose an instance to open the workbench visualizations</p>
            </div>
            <Show when={isConnecting()}>
                <div class="instance-selector-loading">Connecting to engines...</div>
            </Show>
            <Show when={!isConnecting() && instances().length === 0}>
                <div class="instance-selector-empty">
                    No spine instances found. Make sure the engine API is running.
                </div>
            </Show>
            <div class="instance-list">
                <For each={instances()}>
                    {(inst) => {
                        const { capsuleName, filepath } = splitId(inst.$id);
                        return (
                            <button
                                class="instance-card"
                                onClick={() => workbenchStore.selectSpineInstance(inst.$id)}
                            >
                                <div class="instance-card-header">
                                    <span class="instance-capsule-name">{capsuleName}</span>
                                </div>
                                <Show when={filepath}>
                                    <div class="instance-filepath">{filepath}</div>
                                </Show>
                            </button>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}

// ── Engine Status Indicators ─────────────────────────────────────────

function EngineStatusBar(props: { settingsBtn?: JSX.Element }) {
    const client = workbenchStore.ladybugClient;

    const statusClass = () => {
        const s = client.status();
        if (s === "connected") return "ok";
        if (s === "error" || s === "disconnected") return "error";
        return "";
    };

    const apiMethodText = () => {
        const s = client.status();
        if (s === "connected") return `${client.apiCount()} APIs: ${client.methodCount()} methods`;
        if (s === "connecting") return "connecting...";
        if (s === "disconnected") return "disconnected — reconnecting...";
        if (s === "error") return "disconnected";
        return "idle";
    };

    const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

    const statsText = () => {
        const reqs = client.requestCount();
        const recv = client.payloadReceivedBytes();
        const stats = client.processStats();
        const memPart = stats ? ` · ${stats.memoryMB} MB` : "";
        return `${reqs} reqs · ↓${toMB(recv)} MB${memPart}`;
    };

    return (
        <div class="engine-status-bar">
            <div class="engine-status-line">
                {props.settingsBtn}
                <span class={`engine-status ${statusClass()}`}>
                    <span class="engine-status-dot" />
                    <span class="engine-status-name">{client.name}</span>
                </span>
                <span class="engine-status-detail">{apiMethodText()}</span>
            </div>
            <Show when={client.status() === "connected"}>
                <span class="engine-status-stats">{statsText()}</span>
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
    workbenchContext: () => Record<string, string>;
}) {
    const [result, setResult] = createSignal<any>(null);
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const ps = getPanelStatus(props.path);
    const setElapsed = ps.setElapsed;
    const [viewTab] = getViewTab(props.path);
    const ep = props.endpoint;
    const localArgDefs = ep.args.filter((a: any) => !CONTEXT_ARG_NAMES.has(a.name));

    // Initialize boolean args: default to "true" if description says "defaults to true"
    const initialArgs: Record<string, string> = {};
    for (const arg of localArgDefs) {
        if (arg.type === "boolean" && arg.optional) {
            const desc = (ep.description || "").toLowerCase();
            if (desc.includes(`${arg.name.toLowerCase()} defaults to true`)) {
                initialArgs[arg.name] = "true";
            }
        }
    }

    const [localArgs, setLocalArgs] = createSignal<Record<string, string>>(initialArgs);
    const [discoveryPreviews, setDiscoveryPreviews] = createSignal<Record<string, JsonValue>>({});
    const setIsDiscoveryView = (v: boolean) => { ps.setIsDiscovery(v); };
    const isDiscoveryView = ps.isDiscovery;

    let callSeq = 0;
    const callMethod = async (overrideLocalArgs?: Record<string, string>) => {
        const e = props.engine();
        if (!e) return;

        const seq = ++callSeq;
        const local = overrideLocalArgs ?? localArgs();
        if (overrideLocalArgs) setLocalArgs(overrideLocalArgs);

        const ctx = props.workbenchContext();
        const merged = { ...ctx, ...local };

        vlog(props.name, `[callMethod #${seq}] args:`, JSON.stringify(local), `ctx:`, JSON.stringify(ctx));

        setLoading(true);
        setError(null);
        setResult(null);
        setElapsed(null);
        setIsDiscoveryView(false);
        ps.setDiscoveryMethod(null);

        let actualPath = props.path;
        let isDiscovery = false;

        const localFilled = localArgDefs.every((a: any) => {
            const val = local[a.name];
            return a.optional || (val != null && val !== "");
        });

        if (!localFilled && ep.discovery) {
            actualPath = ep.discovery;
            isDiscovery = true;
            setIsDiscoveryView(true);
            ps.setDiscoveryMethod(actualPath);
            vlog(props.name, `[callMethod #${seq}] DISCOVERY → ${actualPath}`);
        }

        try {
            const t0 = performance.now();
            const callArgs = isDiscovery ? ctx : merged;
            vlog(props.name, `[callMethod #${seq}] fetch ${actualPath}`, JSON.stringify(callArgs));
            const data = await e.call(actualPath, callArgs);
            vlog(props.name, `[callMethod #${seq}] done ${Math.round(performance.now() - t0)}ms`);
            setElapsed(Math.round(performance.now() - t0));
            setResult(data);

            const discoveryItems = Array.isArray(data.result) ? data.result : data.result?.list;
            if (isDiscovery && ep.filterField && Array.isArray(discoveryItems)) {
                fetchDiscoveryPreviews(discoveryItems);
            }
        } catch (err: any) {
            setElapsed(null);
            setError(err?.message ?? "Request failed");
        } finally {
            setLoading(false);
        }
    };

    // Register reload callback in shared panel status
    ps.setReload(() => () => callMethod());

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
                const data = await e.call(props.path, { ...ctx, [firstLocalArg.name]: val });
                previews[val] = data.result ?? null;
            } catch { /* skip */ }
        }));
        setDiscoveryPreviews(previews);
    };

    const handleEntityClick = (field: string, value: string) => {
        const firstLocalArg = localArgDefs[0];
        if (!firstLocalArg) return;
        const newLocal = { [firstLocalArg.name]: value };
        setLocalArgs(newLocal);
        setIsDiscoveryView(false);
        callMethod(newLocal);
    };

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const debouncedCallMethod = (args: Record<string, string>) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => callMethod(args), 300);
    };

    const clearArgValue = (name: string) => {
        setLocalArgs(prev => {
            const next = { ...prev };
            delete next[name];
            return next;
        });
    };

    const resultData = () => result()?.result ?? null;

    // Reactive: re-fire ONLY when workbench context changes (not on localArgs changes).
    // We read the tracked signals first, then call in an untracked block to avoid
    // callMethod's internal signal reads becoming dependencies of this effect.
    let prevCtxJson = "";
    createEffect(() => {
        const ctx = props.workbenchContext();
        const e = props.engine();
        if (!e) return;
        const ctxJson = JSON.stringify(ctx);
        if (ctxJson === prevCtxJson) return;
        prevCtxJson = ctxJson;
        vlog(props.name, `[effect] workbenchContext changed → calling method`);
        // Use untrack to prevent callMethod's signal reads from becoming effect deps
        Promise.resolve().then(() => callMethod()).catch(() => { });
    });

    return (
        <div class="ma-method-body">
            <Show when={localArgDefs.length > 0}>
                <div class="args-panel">
                    <For each={localArgDefs}>
                        {(arg) => {
                            const isEmpty = () => (localArgs()[arg.name] ?? "") === "";
                            const isBool = arg.type === "boolean";
                            const boolVal = () => localArgs()[arg.name] === "true";
                            return (
                                <div class="arg-row">
                                    <label class={isEmpty() && !isBool && !arg.optional ? "arg-label-empty" : ""}>{arg.name}:</label>
                                    <Show when={isBool} fallback={
                                        <div class="arg-input-wrap">
                                            <input
                                                type="text"
                                                placeholder={`${arg.type}`}
                                                value={localArgs()[arg.name] ?? ""}
                                                class={isEmpty() && !arg.optional ? "arg-input-empty" : ""}
                                                onInput={(e) => {
                                                    const val = e.currentTarget.value;
                                                    setLocalArgs(prev => ({ ...prev, [arg.name]: val }));
                                                    debouncedCallMethod({ ...localArgs(), [arg.name]: val });
                                                }}
                                            />
                                            <Show when={!isEmpty()}>
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
                                    }>
                                        <button
                                            class={`arg-toggle ${boolVal() ? "active" : ""}`}
                                            onClick={() => {
                                                const next = boolVal() ? "false" : "true";
                                                setLocalArgs(prev => ({ ...prev, [arg.name]: next }));
                                                callMethod({ ...localArgs(), [arg.name]: next });
                                            }}
                                        >{boolVal() ? "on" : "off"}</button>
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            <Show when={isDiscoveryView()}>
                <div class="ma-method-status">
                    <span class="discovery-badge">discovery: {result()?.method}</span>
                </div>
            </Show>

            <div
                class="ma-method-output"
                ref={(el: HTMLDivElement) => {
                    const onSelect = ((e: CustomEvent) => {
                        const id = e.detail?.$id;
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
                            spineInstanceUri={props.workbenchContext().spineInstanceUri}
                        />
                    </Show>
                </Show>
            </div>
        </div>
    );
}

// ── Framespace API List Panel (rendered inside dockview) ─────────────

function FramespaceApiListPanel(props: {
    schema: () => EngineSchema | null;
    onMethodClick: (path: string, name: string) => void;
}) {
    const apis = () => {
        const s = props.schema();
        if (!s) return [];
        return Object.entries(s.apis ?? {}).map(([ns, api]) => {
            const methods = Object.entries(s.endpoints)
                .filter(([, def]) => def.namespace === ns)
                .map(([path, def]) => ({ path, name: path.split("/").pop()!, ...def }))
                .sort((a, b) => a.name.localeCompare(b.name));
            return { namespace: ns, ...api, methods };
        });
    };

    return (
        <div class="fapi-list">
            <For each={apis()}>
                {(api) => (
                    <div class="fapi-group">
                        <div class="fapi-group-header">
                            <span class="fapi-group-name">{api.namespace}</span>
                            <span class="fapi-group-count">{api.methods.length} methods</span>
                        </div>
                        <div class="fapi-group-desc" innerHTML={workbenchLib.marked.parseInline(api.description) as string} />
                        <div class="fapi-methods">
                            <For each={api.methods}>
                                {(m) => (
                                    <button
                                        class="fapi-method"
                                        onClick={() => props.onMethodClick(m.path, m.name)}
                                    >
                                        <span class="fapi-method-name">{m.name}</span>
                                        <span class="fapi-method-desc">{m.description}</span>
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

// ── Workbench Dockview ───────────────────────────────────────────────

function WorkbenchDockview() {
    let containerRef: HTMLDivElement | undefined;
    let dockApi: DockviewApi | undefined;
    const disposers: (() => void)[] = [];

    const engine = () => {
        return workbenchStore.ladybugClient;
    };

    const workbenchContext = (): Record<string, string> => {
        const ctx: Record<string, string> = {};
        const si = workbenchStore.selectedSpineInstance();
        if (si) ctx.spineInstanceUri = si;
        return ctx;
    };

    // Resolve endpoint def from schema by path
    const getEndpoint = (path: string) => {
        const s = engine().schema();
        if (!s) return null;
        const def = s.endpoints[path];
        if (!def) return null;
        return { path, name: path.split("/").pop()!, ...def };
    };

    // Grid helper: compute column width (conceptual 16-column grid)
    const colWidth = () => containerRef ? Math.floor(containerRef.offsetWidth / 16) : 80;

    // Open a method panel in dockview
    const openMethodPanel = (path: string, name: string) => {
        if (!dockApi) return;
        // If panel already exists, activate it
        const existing = dockApi.getPanel(path);
        if (existing) {
            existing.api.setActive();
            return;
        }

        // Find an existing method panel to add as a tab in the same group
        const methodPanels = dockApi.panels.filter(p => p.id !== "framespace-api");
        if (methodPanels.length > 0) {
            // Add as tab in the same group as the first method panel
            dockApi.addPanel({
                id: path,
                component: "framespace-api-method",
                title: name,
                params: { path, name },
                position: { referencePanel: methodPanels[0].id },
            });
        } else {
            // First method panel — add to the right of the API list
            const apiPanel = dockApi.getPanel("framespace-api");
            dockApi.addPanel({
                id: path,
                component: "framespace-api-method",
                title: name,
                params: { path, name },
                initialWidth: colWidth() * 4,
                position: apiPanel
                    ? { referencePanel: apiPanel.id, direction: "right" }
                    : undefined,
            });
        }
    };

    // Wait for schema, then build panels
    let built = false;
    createEffect(() => {
        const s = engine().schema();
        if (s && !built && containerRef) {
            built = true;
            buildDockview(s);
        }
    });

    function buildDockview(s: EngineSchema) {
        if (!containerRef) return;

        vlog("buildDockview", `APIs: ${Object.keys(s.apis ?? {}).join(", ")}`);

        dockApi = createDockview(containerRef, {
            theme: themeBlueprintVellum,
            createComponent(options) {
                if (options.name === "framespace-api") {
                    // API list panel
                    const el = document.createElement("div");
                    el.style.cssText = "width:100%;height:100%;overflow:auto;";
                    let disposeRender: (() => void) | undefined;
                    return {
                        element: el,
                        init() {
                            disposeRender = render(() => (
                                <FramespaceApiListPanel
                                    schema={() => engine().schema()}
                                    onMethodClick={openMethodPanel}
                                />
                            ), el);
                            disposers.push(disposeRender);
                        },
                        dispose() { disposeRender?.(); },
                    };
                }

                if (options.name === "framespace-api-method") {
                    // Method panel — endpoint resolved from params
                    const el = document.createElement("div");
                    el.style.cssText = "width:100%;height:100%;overflow:auto;";
                    let disposeRender: (() => void) | undefined;
                    return {
                        element: el,
                        init(params: GroupPanelPartInitParameters) {
                            const p = params.params as { path: string; name: string };
                            const ep = getEndpoint(p.path);
                            if (!ep) {
                                el.textContent = `Unknown method: ${p.path}`;
                                return;
                            }
                            disposeRender = render(() => (
                                <MethodPanelContent
                                    path={ep.path}
                                    name={ep.name}
                                    endpoint={ep}
                                    engine={engine}
                                    workbenchContext={workbenchContext}
                                />
                            ), el);
                            disposers.push(disposeRender);
                        },
                        dispose() { disposeRender?.(); },
                    };
                }

                // Fallback
                const el = document.createElement("div");
                el.textContent = `Unknown component: ${options.name}`;
                return { element: el, init() { }, dispose() { } };
            },
            createTabComponent(options) {
                if (options.name === "no-close-tab") {
                    const el = document.createElement("div");
                    el.style.cssText = "padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
                    return {
                        element: el,
                        init(params: GroupPanelPartInitParameters) {
                            el.textContent = params.title ?? "";
                            params.api.onDidTitleChange((e) => { el.textContent = e.title; });
                        },
                        dispose() { },
                    };
                }
                return undefined as any;
            },
            createRightHeaderActionComponent(group: DockviewGroupPanel) {
                const el = document.createElement("div");
                el.style.cssText = "display:flex;align-items:center;gap:2px;padding-right:6px;";

                let disposeRender: (() => void) | undefined;

                const renderToggle = (pid: string) => {
                    // Don't render header actions for the API list panel
                    if (pid === "framespace-api") {
                        if (disposeRender) disposeRender();
                        el.innerHTML = "";
                        return;
                    }
                    if (disposeRender) disposeRender();
                    el.innerHTML = "";
                    disposeRender = render(() => {
                        const [viewTab, setViewTab] = getViewTab(pid);
                        const ps = getPanelStatus(pid);
                        return (
                            <div class="ma-header-actions">
                                <Show when={ps.elapsed() !== null}>
                                    <span class="ma-header-elapsed">{ps.elapsed()}ms</span>
                                </Show>
                                <button
                                    class="ma-header-refresh"
                                    onClick={() => { const fn = ps.reload(); if (fn) fn(); }}
                                >↻</button>
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
                };

                return {
                    element: el,
                    init(params: IGroupHeaderProps) {
                        if (group.activePanel) {
                            renderToggle(group.activePanel.id);
                        }
                        const d = group.api.onDidActivePanelChange((e) => {
                            if (e.panel) renderToggle(e.panel.id);
                        });
                        disposers.push(() => d.dispose());
                    },
                    dispose() { disposeRender?.(); },
                };
            },
        });

        // Add the Framespace API list panel (1/16 grid column initially)
        const cw = colWidth();
        const apiListPanel = dockApi.addPanel({
            id: "framespace-api",
            component: "framespace-api",
            tabComponent: "no-close-tab",
            title: "Framespace API",
            initialWidth: cw * 1,
            maximumWidth: cw * 6,
            minimumWidth: cw * 2,
        });

        // Set group constraints so the API list can't grow beyond 6 columns
        requestAnimationFrame(() => {
            if (apiListPanel.group) {
                apiListPanel.group.api.setConstraints({
                    maximumWidth: cw * 6,
                    minimumWidth: cw * 2,
                });
            }
        });
    }

    onCleanup(() => {
        disposers.forEach(d => d());
        dockApi?.dispose();
    });

    return (
        <div class="wb-dockview" ref={containerRef} />
    );
}

// ── Settings persistence ─────────────────────────────────────────────

const SETTINGS_KEY = "framespace-workbench-settings";

type WorkbenchSettings = {
    openFileCommand: string;
};

function loadSettings(): WorkbenchSettings {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { openFileCommand: "" };
}

function saveSettings(s: WorkbenchSettings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ── Reusable: Command Picker Setting ────────────────────────────────

function SettingCommandPicker(props: {
    value: string;
    onChange: (cmd: string) => void;
}) {
    const [local, setLocal] = createSignal(props.value);

    // Sync when parent value changes
    createEffect(() => setLocal(props.value));

    const commit = (cmd: string) => {
        const trimmed = cmd.trim();
        setLocal(trimmed);
        props.onChange(trimmed);
    };

    return (
        <div class="code-dialog-section">
            <label class="code-dialog-label">Command to open files:</label>
            <div class="code-dialog-cmd-row">
                <input
                    type="text"
                    class="code-dialog-input"
                    placeholder="e.g. code, subl, vim"
                    value={local()}
                    onInput={(e) => setLocal(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(local()); }}
                />
                <button
                    class="code-dialog-btn"
                    onClick={() => commit("code")}
                >code</button>
                <button
                    class="code-dialog-btn"
                    onClick={() => commit("surf")}
                >surf</button>
            </div>
        </div>
    );
}

// ── Settings Dialog ─────────────────────────────────────────────────

function SettingsDialog(props: {
    settings: WorkbenchSettings;
    onSave: (s: WorkbenchSettings) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = createSignal<WorkbenchSettings>({ ...props.settings });

    const save = () => {
        props.onSave(draft());
        props.onClose();
    };

    return (
        <div class="code-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
            <div class="code-dialog">
                <div class="code-dialog-header">
                    <span class="code-dialog-title">Workbench Settings</span>
                    <button class="code-dialog-close" onClick={props.onClose}>×</button>
                </div>

                <SettingCommandPicker
                    value={draft().openFileCommand}
                    onChange={(cmd) => setDraft((prev) => ({ ...prev, openFileCommand: cmd }))}
                />

                <div class="code-dialog-actions">
                    <button class="code-dialog-btn code-dialog-btn-primary" onClick={save}>Save</button>
                    <button class="code-dialog-btn" onClick={props.onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

// ── Code Dialog (first-time command selection + file path) ──────────

function CodeDialog(props: {
    title: string;
    fullpath: string;
    settings: WorkbenchSettings;
    onSaveSettings: (s: WorkbenchSettings) => void;
    onClose: () => void;
}) {
    const [copied, setCopied] = createSignal(false);

    const copyPath = async () => {
        try {
            await navigator.clipboard.writeText(props.fullpath);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
    };

    const launchWithCommand = (cmd: string) => {
        if (!cmd.trim()) return;
        props.onSaveSettings({ ...props.settings, openFileCommand: cmd.trim() });
        execOpenFile(cmd.trim(), props.fullpath);
        props.onClose();
    };

    return (
        <div class="code-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
            <div class="code-dialog">
                <div class="code-dialog-header">
                    <span class="code-dialog-title">{props.title}</span>
                    <button class="code-dialog-close" onClick={props.onClose}>×</button>
                </div>

                <div class="code-dialog-section">
                    <label class="code-dialog-label">Full path:</label>
                    <div class="code-dialog-path-row">
                        <code class="code-dialog-path">{props.fullpath}</code>
                        <button class="code-dialog-copy" onClick={copyPath}>
                            {copied() ? "Copied!" : "Copy"}
                        </button>
                    </div>
                </div>

                <SettingCommandPicker
                    value={props.settings.openFileCommand}
                    onChange={(cmd) => launchWithCommand(cmd)}
                />
            </div>
        </div>
    );
}

// ── Error dialog for background call failures ───────────────────────

type ErrorInfo = { method: string; message: string; stack?: string };

function ErrorDialog(props: { error: ErrorInfo; onClose: () => void }) {
    return (
        <div class="error-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
            <div class="error-dialog">
                <div class="error-dialog-header">
                    <span class="error-dialog-title">⚠ Error</span>
                    <button class="error-dialog-close" onClick={props.onClose}>×</button>
                </div>
                <div class="error-dialog-method">{props.error.method}</div>
                <div class="error-dialog-message">{props.error.message}</div>
                <Show when={props.error.stack}>
                    <pre class="error-dialog-stack">{props.error.stack}</pre>
                </Show>
            </div>
        </div>
    );
}

// ── Reusable: check API result for errors ────────────────────────────

function isApiError(result: any): result is { '#': 'Error'; method: string; message: string; stack?: string } {
    return result && typeof result === 'object' && result['#'] === 'Error';
}

// ── Reusable: open a file in editor ─────────────────────────────────

function execOpenFile(cmd: string, file: string, onError?: (e: ErrorInfo) => void) {
    vlog("openFile", `command=${cmd} file=${file}`);
    workbenchStore.ladybugClient.call("/api/Workbench/openFile", { command: cmd, file })
        .then((data) => {
            if (isApiError(data.result) && onError) onError(data.result);
        })
        .catch((err) => {
            vlog("openFile", "openFile failed:", err);
            if (onError) onError({ method: "Workbench/openFile", message: err.message ?? String(err) });
        });
}

// Resolves a capsule name to its source filepath via getCapsule.
// Uses capsuleSourceLineRef (absolute path with :line suffix) rather than
// source.moduleFilepath (which is relative and resolves incorrectly).
async function resolveCapsuleFilepath(capsuleName: string, onError?: (e: ErrorInfo) => void): Promise<string | null> {
    try {
        const data = await workbenchStore.ladybugClient.call(
            "/api/QueryCapsuleSpineModel/getCapsule",
            { capsuleName },
        );
        if (isApiError(data.result)) {
            if (onError) onError(data.result);
            return null;
        }
        // capsuleSourceLineRef is absolute with :line, e.g. "/Users/.../file.ts:100"
        const lineRef = data.result?.capsuleSourceLineRef as string | undefined;
        return lineRef ?? null;
    } catch (err: any) {
        vlog("resolveCapsuleFilepath", "getCapsule failed:", err);
        if (onError) onError({ method: "QueryCapsuleSpineModel/getCapsule", message: err.message ?? String(err) });
        return null;
    }
}

// ── Main Page ────────────────────────────────────────────────────────

export default function Home() {
    const [ready, setReady] = createSignal(false);
    const [settings, setSettings] = createSignal<WorkbenchSettings>(loadSettings());
    const [codeDialog, setCodeDialog] = createSignal<{ title: string; fullpath: string } | null>(null);
    const [showSettings, setShowSettings] = createSignal(false);
    const [errorDialog, setErrorDialog] = createSignal<ErrorInfo | null>(null);

    const showError = (e: ErrorInfo) => setErrorDialog(e);

    const persistSettings = (s: WorkbenchSettings) => {
        setSettings(s);
        saveSettings(s);
    };

    // Cache for getReps results
    let repsCache: any[] | null = null;

    const resolveRepPath = async (repUri: string): Promise<string> => {
        if (!repsCache) {
            try {
                const data = await workbenchStore.ladybugClient.call("/api/Workbench/getReps", {});
                const result = data.result;
                if (isApiError(result)) { showError(result); repsCache = []; return repUri; }
                repsCache = result?.list ?? [];
            } catch (err: any) {
                showError({ method: "Workbench/getReps", message: err.message ?? String(err) });
                repsCache = [];
            }
        }
        const match = repsCache!.find((r: any) =>
            r.name === repUri.split("/").pop()?.replace(/\.tsx?$/, "") ||
            r.relativePath?.includes(repUri.replace("~viz/", "visualizations/"))
        );
        return match?.fullpath ?? repUri;
    };

    // Unified: open a file — auto-launch if command is saved, else show dialog
    const openCodeFile = (title: string, fullpath: string) => {
        const cmd = settings().openFileCommand;
        if (cmd) {
            execOpenFile(cmd, fullpath, showError);
        } else {
            setCodeDialog({ title, fullpath });
        }
    };

    // Open a capsule's source file by capsule name
    const openCapsuleCode = async (capsuleName: string) => {
        const filepath = await resolveCapsuleFilepath(capsuleName, showError);
        if (filepath) {
            openCodeFile("Open Capsule Source", filepath);
        } else if (!errorDialog()) {
            showError({ method: "openCapsuleCode", message: `Could not resolve filepath for: ${capsuleName}` });
        }
    };

    onMount(async () => {
        await workbenchStore.connectAll();
        setReady(true);

        // Listen for Rep.code.show events (from rep Code button overlay)
        document.addEventListener("Rep.code.show", (async (e: Event) => {
            const repUri = (e as CustomEvent).detail?.repUri;
            if (!repUri) return;
            vlog("Home", `Rep.code.show: ${repUri}`);
            const fullpath = await resolveRepPath(repUri);
            openCodeFile("Open Rep Source", fullpath);
        }) as EventListener);

        // Listen for Capsule.code.open events (from Capsule rep Code button)
        document.addEventListener("Capsule.code.open", ((e: Event) => {
            const filepath = (e as CustomEvent).detail?.filepath;
            if (!filepath) return;
            vlog("Home", `Capsule.code.open: ${filepath}`);
            openCodeFile("Open Capsule Source", filepath);
        }) as EventListener);
    });

    const selected = () => workbenchStore.selectedSpineInstance();

    // Look up the capsuleSourceLineRef from the already-loaded spine instances
    const selectedLineRef = () => {
        const id = selected();
        if (!id) return null;
        const inst = workbenchStore.spineInstances().find((s) => s.$id === id);
        return inst?.capsuleSourceLineRef ?? null;
    };

    const selectedLineSuffix = () => {
        const ref = selectedLineRef();
        if (!ref) return '';
        const m = ref.match(/:(\d+)$/);
        return m ? `:${m[1]}` : '';
    };

    return (
        <div class="wb-root">
            <Title>Framespace Workbench</Title>

            <div class="wb-header">
                <div class="wb-header-left">
                    <div class="wb-title-block">
                        <h1 class="wb-title">Framespace Genesis Workbench</h1>
                        <div class="wb-branding">
                            <img src="/assets/Stream44Studio-Icon-v1.svg" alt="Stream44 Studio" class="wb-branding-icon" />
                            <span>a <a href="https://Stream44.Studio" target="_blank" rel="noopener noreferrer" class="wb-branding-link">Stream44.Studio</a> open dev project</span>
                        </div>
                    </div>

                    <Show when={selected()}>
                        <div class="wb-instance-badge">
                            <span class="wb-instance-prefix">Selected Capsule Spine Tree Instance:</span>
                            <div class="wb-instance-row">
                                <button
                                    class="wb-code-btn"
                                    onClick={() => {
                                        const ref = selectedLineRef();
                                        if (ref) openCodeFile("Open Capsule Source", ref);
                                        else openCapsuleCode(selected()!);
                                    }}
                                    title="Open source file"
                                >Code</button>
                                <div class="wb-instance-filter">
                                    <span class="wb-instance-label">{selected()}<Show when={selectedLineSuffix()}><span class="wb-instance-line">{selectedLineSuffix()}</span></Show></span>
                                    <button
                                        class="wb-instance-clear"
                                        onClick={() => workbenchStore.clearSpineInstance()}
                                        title="Back to instance selection"
                                    >×</button>
                                </div>
                            </div>
                        </div>
                    </Show>
                </div>

                <div class="wb-header-right">
                    <EngineStatusBar settingsBtn={
                        <button
                            class="wb-settings-btn"
                            onClick={() => setShowSettings(true)}
                            title="Workbench Settings"
                        >⚙</button>
                    } />
                </div>
            </div>

            <div class="wb-content">
                <Show when={ready()} fallback={
                    <div class="wb-loading">Connecting to engines...</div>
                }>
                    <Show when={selected()} fallback={<SpineInstanceSelector />}>
                        <WorkbenchDockview />
                    </Show>
                </Show>
                <Show when={ready() && workbenchStore.ladybugClient.status() === "disconnected"}>
                    <div class="wb-disconnected-overlay">
                        <div class="wb-disconnected-message">
                            <span class="wb-disconnected-dot" />
                            Server disconnected — waiting for reconnection...
                        </div>
                    </div>
                </Show>
            </div>

            <Show when={codeDialog()}>
                {(dlg) => (
                    <CodeDialog
                        title={dlg().title}
                        fullpath={dlg().fullpath}
                        settings={settings()}
                        onSaveSettings={persistSettings}
                        onClose={() => setCodeDialog(null)}
                    />
                )}
            </Show>

            <Show when={showSettings()}>
                <SettingsDialog
                    settings={settings()}
                    onSave={persistSettings}
                    onClose={() => setShowSettings(false)}
                />
            </Show>

            <Show when={errorDialog()}>
                {(err) => (
                    <ErrorDialog
                        error={err()}
                        onClose={() => setErrorDialog(null)}
                    />
                )}
            </Show>
        </div>
    );
}
