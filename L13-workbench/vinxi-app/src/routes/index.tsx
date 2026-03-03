import { Title } from "@solidjs/meta";
import { onMount, For, Show, createSignal, onCleanup, createEffect } from "solid-js";
import type { Accessor, Setter, JSX } from "solid-js";
import { workbenchStore } from "~/lib/workbenchStore";
import type { EndpointDef, EngineSchema } from "~/lib/modelApiClient";
import type { RequestLogEntry } from "~/lib/modelApiClient";
import { ResultView, RawJsonView } from "~/lib/renderLib";
import type { JsonValue } from "~/lib/renderLib";
import { visualizations, onDemandPanels, FramespacesPanel } from "~/lib/visualizations";
import type { FramespaceLink } from "~/lib/visualizations";
import { REQUEST_LOG_PANEL_ID, MODEL_APIS_PANEL_ID, MODELS_PANEL_ID, requestLogPanelDef, modelApisPanelDef } from "~L8/Workbench/ModelAPIs/HeaderStatusElement";
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

// ── Tab Context Menu State ────────────────────────────────────────────
type TabContextMenuState = {
    visible: boolean;
    x: number;
    y: number;
    panelId: string | null;
    groupId: string | null;
};

const [tabContextMenu, setTabContextMenu] = createSignal<TabContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    panelId: null,
    groupId: null,
});

function TabContextMenu(props: { dockApi: () => DockviewApi | null }) {
    const menu = tabContextMenu;

    const handleCloseOthers = () => {
        const api = props.dockApi();
        const state = menu();
        if (!api || !state.panelId || !state.groupId) return;

        const group = api.getGroup(state.groupId);
        if (!group) return;

        const panelsInGroup = api.panels.filter(p => p.group.id === state.groupId);
        for (const panel of panelsInGroup) {
            if (panel.id !== state.panelId) {
                api.removePanel(panel);
            }
        }
        setTabContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleCloseToTheRight = () => {
        const api = props.dockApi();
        const state = menu();
        if (!api || !state.panelId || !state.groupId) return;

        const group = api.getGroup(state.groupId);
        if (!group) return;

        const panelsInGroup = api.panels.filter(p => p.group.id === state.groupId);
        const targetIndex = panelsInGroup.findIndex(p => p.id === state.panelId);
        if (targetIndex === -1) return;

        for (let i = panelsInGroup.length - 1; i > targetIndex; i--) {
            api.removePanel(panelsInGroup[i]);
        }
        setTabContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleClickOutside = (e: MouseEvent) => {
        if (menu().visible) {
            setTabContextMenu(prev => ({ ...prev, visible: false }));
        }
    };

    onMount(() => {
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("contextmenu", handleClickOutside);
    });

    onCleanup(() => {
        document.removeEventListener("click", handleClickOutside);
        document.removeEventListener("contextmenu", handleClickOutside);
    });

    return (
        <Show when={menu().visible}>
            <div
                class="tab-context-menu"
                style={{
                    position: "fixed",
                    left: `${menu().x}px`,
                    top: `${menu().y}px`,
                    "z-index": 10000,
                    background: "var(--dv-tabs-and-actions-container-background-color, #1e1e1e)",
                    border: "1px solid var(--dv-separator-border, #333)",
                    "border-radius": "4px",
                    "box-shadow": "0 2px 8px rgba(0,0,0,0.3)",
                    "min-width": "150px",
                    padding: "4px 0",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    class="tab-context-menu-item"
                    onClick={handleCloseOthers}
                    style={{
                        display: "block",
                        width: "100%",
                        padding: "6px 12px",
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        "text-align": "left",
                        cursor: "pointer",
                        "font-size": "13px",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--dv-activegroup-hiddenpanel-tab-background-color, #2a2a2a)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                    Close Others
                </button>
                <button
                    class="tab-context-menu-item"
                    onClick={handleCloseToTheRight}
                    style={{
                        display: "block",
                        width: "100%",
                        padding: "6px 12px",
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        "text-align": "left",
                        cursor: "pointer",
                        "font-size": "13px",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--dv-activegroup-hiddenpanel-tab-background-color, #2a2a2a)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                    Close to the Right
                </button>
            </div>
        </Show>
    );
}

// ── Verbose logging ──────────────────────────────────────────────────
function vlog(context: string, ...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) console.log(`[Workbench/${context}]`, ...args);
}

// ── Workbench context arg names ──────────────────────────────────────
const CONTEXT_ARG_NAMES = new Set(["spineInstanceTreeId"]);

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

function SpineInstanceSelector(props: { onCodeClick?: (filepath: string) => void }) {
    const instances = () => workbenchStore.spineInstances();
    const isConnecting = () => workbenchStore.api.status() === "connecting";
    const groups = () => workbenchStore.spineInstanceGroups();

    const [activeTab, setActiveTab] = createSignal<"examples" | "tests">("examples");

    // Separate groups by type
    const exampleGroups = () => groups().filter((g: any) => g.type !== 'test');
    const testGroups = () => groups().filter((g: any) => g.type === 'test');

    // Group examples by examplesPath for hierarchical display
    const groupedExamples = () => {
        const byPath: Record<string, { examplesPath: string; engines: any; dirs: { exampleDir: string; items: any[] }[] }> = {};
        for (const g of exampleGroups()) {
            const key = g.examplesPath || g.modelName;
            if (!byPath[key]) byPath[key] = { examplesPath: key, engines: g.engines ?? {}, dirs: [] };
            byPath[key].dirs.push({ exampleDir: g.exampleDir, items: g.list ?? [] });
        }
        return Object.values(byPath);
    };

    // Group tests by modelName for hierarchical display
    const groupedTests = () => {
        const byModel: Record<string, { modelName: string; engines: any; dirs: { exampleDir: string; items: any[] }[] }> = {};
        for (const g of testGroups()) {
            const key = g.modelName;
            if (!byModel[key]) byModel[key] = { modelName: key, engines: g.engines ?? {}, dirs: [] };
            byModel[key].dirs.push({ exampleDir: g.exampleDir, items: g.list ?? [] });
        }
        return Object.values(byModel);
    };

    const exampleCount = () => exampleGroups().reduce((sum: number, g: any) => sum + (g.list?.length ?? 0), 0);
    const testCount = () => testGroups().reduce((sum: number, g: any) => sum + (g.list?.length ?? 0), 0);

    return (
        <div class="instance-selector">
            <div class="instance-selector-header">
                <h2>Select a Model Instance to view</h2>
                <p class="instance-selector-hint">Each example is a Capsule Spine Instance Tree</p>
            </div>
            <Show when={isConnecting()}>
                <div class="instance-selector-loading">Connecting to engines...</div>
            </Show>
            <Show when={!isConnecting() && instances().length === 0}>
                <div class="instance-selector-empty">
                    No spine instances found. Make sure the engine API is running.
                </div>
            </Show>
            <Show when={instances().length > 0}>
                <div class="instance-tabs">
                    <button
                        class={`instance-tab ${activeTab() === "examples" ? "active" : ""}`}
                        onClick={() => setActiveTab("examples")}
                    >
                        Examples <span class="instance-tab-count">{exampleCount()}</span>
                    </button>
                    <button
                        class={`instance-tab ${activeTab() === "tests" ? "active" : ""}`}
                        onClick={() => setActiveTab("tests")}
                    >
                        Tests <span class="instance-tab-count">{testCount()}</span>
                    </button>
                </div>
                <div class="instance-list">
                    <Show when={activeTab() === "examples"}>
                        <For each={groupedExamples()}>
                            {(group) => {
                                const copyPath = async () => {
                                    try {
                                        await navigator.clipboard.writeText(group.examplesPath);
                                    } catch { /* ignore */ }
                                };
                                return (
                                    <div class="instance-model">
                                        <div class="instance-model-row">
                                            <span class="instance-examples-path">{group.examplesPath}<button
                                                class="instance-copy-btn"
                                                onClick={copyPath}
                                                title="Copy path to clipboard"
                                            >⎘</button></span>
                                        </div>
                                        <For each={group.dirs}>
                                            {(dir) => (
                                                <div class="instance-example">
                                                    <div class="instance-example-row">
                                                        <span class="instance-tag instance-tag-example">Example</span>
                                                        <span class="instance-example-name">{dir.exampleDir}</span>
                                                    </div>
                                                    <div class="instance-example-items">
                                                        <For each={dir.items}>
                                                            {(inst: any) => {
                                                                const instanceName = () => (inst.$id as string).split('/').pop() ?? inst.$id;
                                                                const lineSuffix = () => {
                                                                    const ref = inst.capsuleSourceLineRef as string | null;
                                                                    if (!ref) return '';
                                                                    const m = ref.match(/:(\d+)$/);
                                                                    return m ? `:${m[1]}` : '';
                                                                };
                                                                return (
                                                                    <div class="instance-card-row">
                                                                        <button
                                                                            class="instance-card"
                                                                            onClick={() => workbenchStore.selectSpineInstance(inst.$id)}
                                                                        >
                                                                            <span class="instance-tag instance-tag-instance">Instance</span>
                                                                            <span class="instance-capsule-name">{instanceName()}<Show when={lineSuffix()}><span class="instance-line-ref">{lineSuffix()}</span></Show></span>
                                                                        </button>
                                                                        <Show when={inst.capsuleSourceLineRef && props.onCodeClick}>
                                                                            <button
                                                                                class="instance-card-code-btn"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    props.onCodeClick!(inst.capsuleSourceLineRef);
                                                                                }}
                                                                                title="Open source file"
                                                                            >Code</button>
                                                                        </Show>
                                                                    </div>
                                                                );
                                                            }}
                                                        </For>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                );
                            }}
                        </For>
                    </Show>
                    <Show when={activeTab() === "tests"}>
                        <For each={groupedTests()}>
                            {(model) => (
                                <div class="instance-model">
                                    <div class="instance-model-row">
                                        <span class="instance-tag instance-tag-model">Model</span>
                                        <span class="instance-model-name">{model.modelName}</span>
                                    </div>
                                    <For each={model.dirs}>
                                        {(dir) => (
                                            <div class="instance-example">
                                                <div class="instance-example-row">
                                                    <span class="instance-tag instance-tag-test">Test</span>
                                                    <span class="instance-example-name">{dir.exampleDir}</span>
                                                </div>
                                                <div class="instance-example-items">
                                                    <For each={dir.items}>
                                                        {(inst: any) => {
                                                            const instanceName = () => (inst.$id as string).split('/').pop() ?? inst.$id;
                                                            const lineSuffix = () => {
                                                                const ref = inst.capsuleSourceLineRef as string | null;
                                                                if (!ref) return '';
                                                                const m = ref.match(/:(\d+)$/);
                                                                return m ? `:${m[1]}` : '';
                                                            };
                                                            return (
                                                                <div class="instance-card-row">
                                                                    <button
                                                                        class="instance-card"
                                                                        onClick={() => workbenchStore.selectSpineInstance(inst.$id)}
                                                                    >
                                                                        <span class="instance-tag instance-tag-instance">Instance</span>
                                                                        <span class="instance-capsule-name">{instanceName()}<Show when={lineSuffix()}><span class="instance-line-ref">{lineSuffix()}</span></Show></span>
                                                                    </button>
                                                                    <Show when={inst.capsuleSourceLineRef && props.onCodeClick}>
                                                                        <button
                                                                            class="instance-card-code-btn"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                props.onCodeClick!(inst.capsuleSourceLineRef);
                                                                            }}
                                                                            title="Open source file"
                                                                        >Code</button>
                                                                    </Show>
                                                                </div>
                                                            );
                                                        }}
                                                    </For>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            )}
                        </For>
                        <Show when={testCount() === 0}>
                            <div class="instance-selector-empty">No test instances found.</div>
                        </Show>
                    </Show>
                </div>
            </Show>
            <Show when={!workbenchStore.selectedSpineInstance() && instances().length > 0}>
                <div class="instance-howto">
                    <h3>How to build your own model</h3>
                    <ol>
                        <li>Click on <strong>Code</strong> button for an example to launch editor or copy path and find code</li>
                        <li>Click on same example to launch framespace viewer</li>
                        <li>Make changes to source and reload browser</li>
                    </ol>
                    <br />
                    <p><b>NOTE:</b> We are actively exploring how to best author & map components for representation in diagrams. Expect significant progress in the model development experience.</p>
                </div>
            </Show>
        </div>
    );
}

// ── Workbench Header ─────────────────────────────────────────────────

// ── Shared request detail view (used in raw panel header and request log) ──

function RequestDetailView(props: {
    path: string;
    args?: Record<string, string>;
    elapsed?: number | null;
    timestamp?: number;
    result?: any;
}) {
    const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString();
    const argList = () => props.args ? Object.entries(props.args) : [];

    return (
        <div class="request-detail">
            <div class="request-detail-header">
                <span class="request-detail-path">{props.path}</span>
                <Show when={props.elapsed != null}>
                    <span class="request-detail-elapsed">{props.elapsed}ms</span>
                </Show>
                <Show when={props.timestamp != null}>
                    <span class="request-detail-time">{fmtTime(props.timestamp!)}</span>
                </Show>
            </div>
            <Show when={argList().length > 0}>
                <div class="request-detail-args">
                    <For each={argList()}>
                        {([key, val]) => (
                            <div class="request-detail-arg">
                                <span class="request-detail-arg-key">{key}</span>
                                <span class="request-detail-arg-val">{val}</span>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
            <Show when={props.result !== undefined}>
                <code class="request-detail-result">{JSON.stringify(props.result, null, 2)}</code>
            </Show>
        </div>
    );
}

// ── Request Log Panel Content (rendered inside dockview panel) ────────

function RequestLogPanelContent(props: { entries: () => RequestLogEntry[] }) {
    return (
        <div class="request-log-panel">
            <Show when={props.entries().length === 0}>
                <div class="request-log-empty">No model API calls yet.</div>
            </Show>
            <div class="request-log-list">
                <For each={props.entries()}>
                    {(entry) => (
                        <div class="request-log-entry">
                            <RequestDetailView
                                path={entry.path}
                                args={entry.args}
                                elapsed={entry.elapsed}
                                timestamp={entry.timestamp}
                                result={entry.result}
                            />
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}

function WorkbenchHeader(props: {
    selected: () => string | null;
    selectedLineSuffix: () => string;
    onSettingsClick: () => void;
    onCodeClick: () => void;
    onClearInstance: () => void;
}) {
    const client = workbenchStore.api;

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
        <div class="wb-header">
            <div class="wb-title-block">
                <h1 class="wb-title">Framespace Genesis Workbench</h1>
                <div class="wb-branding">
                    <img src="/assets/Stream44Studio-Icon-v1.svg" alt="Stream44 Studio" class="wb-branding-icon" />
                    <span>a <a href="https://Stream44.Studio" target="_blank" rel="noopener noreferrer" class="wb-branding-link">Stream44.Studio</a> open dev project</span>
                </div>
            </div>

            <div class="wb-header-detail">
                {/* Row 1: instance prefix (left) | settings + engine status + api count (right) */}
                <div class="wb-header-detail-row">
                    <div class="wb-header-detail-left">
                        <Show when={props.selected()}>
                            <span class="wb-instance-prefix">Selected model:</span>
                        </Show>
                    </div>
                    <div class="wb-header-detail-right">
                        <button class="wb-settings-btn" onClick={props.onSettingsClick} title="Workbench Settings">⚙</button>
                        <button
                            class="wb-header-btn"
                            onClick={() => openModelApisPanel()}
                            title="Open Model APIs panel"
                        >Model APIs</button>
                        <button
                            class="wb-header-btn"
                            onClick={() => openRequestLogPanel()}
                            title="Open request log panel"
                        >Request Logs</button>
                        <span class="engine-status-detail">{apiMethodText()}</span>
                    </div>
                </div>

                {/* Row 2: Code btn + filter box (left, wraps) | request stats (right) */}
                <div class="wb-header-detail-row">
                    <div class="wb-header-detail-left">
                        <Show when={props.selected()}>
                            <button class="wb-code-btn" onClick={props.onCodeClick} title="Open source file">Code</button>
                            <div class="wb-instance-filter">
                                <span class="wb-instance-label">{props.selected()}<Show when={props.selectedLineSuffix()}><span class="wb-instance-line">{props.selectedLineSuffix()}</span></Show></span>
                                <span class="wb-instance-clear">×</span>
                                <div class="wb-instance-clear-zone" onClick={props.onClearInstance} title="Back to instance selection" />
                            </div>
                        </Show>
                    </div>
                    <div class="wb-header-detail-right">
                        <Show when={client.status() === "connected"}>
                            <span class="engine-status-stats">{statsText()}</span>
                        </Show>
                    </div>
                </div>
            </div>
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
            const resolved = workbenchStore.api.resolveDiscoveryPath(ep.discovery, ep.namespace);
            if (resolved) {
                actualPath = resolved;
                isDiscovery = true;
                setIsDiscoveryView(true);
                ps.setDiscoveryMethod(actualPath);
                vlog(props.name, `[callMethod #${seq}] DISCOVERY → ${actualPath}`);
            }
        }

        try {
            const t0 = performance.now();
            const callArgs = isDiscovery ? ctx : merged;
            vlog(props.name, `[callMethod #${seq}] fetch ${actualPath}`, JSON.stringify(callArgs));
            const data = await e.call(actualPath, callArgs, ctx.engine);
            vlog(props.name, `[callMethod #${seq}] done ${Math.round(performance.now() - t0)}ms`);
            setElapsed(Math.round(performance.now() - t0));

            // Detect model test errors from server
            if (data?.result?.['#'] === 'ModelTestError') {
                workbenchStore.setModelTestError({
                    model: data.result.model ?? 'unknown',
                    message: data.result.message ?? 'Model test failed',
                    output: data.result.output ?? '',
                });
                setError(data.result.message);
                setLoading(false);
                return;
            }

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
                const data = await e.call(props.path, { ...ctx, [firstLocalArg.name]: val }, ctx.engine);
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
                        <>
                            <div class="raw-request-details">
                                <RequestDetailView
                                    path={props.path}
                                    args={{ ...props.workbenchContext(), ...localArgs() }}
                                    elapsed={ps.elapsed()}
                                />
                            </div>
                            <RawJsonView data={resultData()} />
                        </>
                    }>
                        <ResultView
                            data={resultData()}
                            filterField={isDiscoveryView() ? ep.filterField : undefined}
                            onClickValue={isDiscoveryView() ? handleEntityClick : undefined}
                            getPreview={isDiscoveryView()
                                ? (key: string) => discoveryPreviews()[key]
                                : undefined}
                            spineInstanceTreeId={props.workbenchContext().spineInstanceTreeId}
                            apiCall={(path, args, engine) => workbenchStore.api.call(path, args, engine ?? workbenchStore.selectedEngine() ?? undefined)}
                            lib={workbenchLib}
                        />
                    </Show>
                </Show>
            </div>
        </div>
    );
}

// ── Model Instance APIs Panel (rendered inside dockview) ───────────────────

const NS_TRIM_PREFIX = '@stream44.studio~FramespaceGenesis~';
const NS_TRIM_SUFFIX = '~ModelQueryMethods';

function trimNamespace(ns: string): string {
    let result = ns;
    if (result.startsWith(NS_TRIM_PREFIX)) {
        result = result.substring(NS_TRIM_PREFIX.length);
    }
    if (result.endsWith(NS_TRIM_SUFFIX)) {
        result = result.substring(0, result.length - NS_TRIM_SUFFIX.length);
    }
    return result;
}

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
            return { namespace: ns, displayNamespace: trimNamespace(ns), ...api, methods };
        });
    };

    return (
        <div class="fapi-list">
            <For each={apis()}>
                {(api) => (
                    <div class="fapi-group">
                        <div class="fapi-group-header">
                            <span class="fapi-group-name">{api.displayNamespace}</span>
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

// ── Module-level dockview API ref for header panel launchers ─────────
const [dockApiRef, setDockApiRef] = createSignal<DockviewApi | null>(null);

// ── Panel IDs that live in the LEFT group (nav/list panels) ──────────
const LEFT_GROUP_IDS = new Set([MODELS_PANEL_ID, MODEL_APIS_PANEL_ID]);

// Open a panel as a tab in the LEFT group (same group as Models)
function openInLeftGroup(api: DockviewApi, def: { id: string; component?: string; title: string }) {
    const existing = api.getPanel(def.id);
    if (existing) { existing.api.setActive(); return; }

    // Find the Models panel to use as reference for same-group tabbing
    const modelsPanel = api.getPanel(MODELS_PANEL_ID);
    api.addPanel({
        id: def.id,
        component: def.component ?? def.id,
        title: def.title,
        position: modelsPanel ? { referencePanel: modelsPanel.id } : undefined,
    });
}

// Open a panel as a tab in the RIGHT group (~70% area)
function openInRightGroup(api: DockviewApi, def: { id: string; component?: string; title: string }, params?: Record<string, any>, initialWidth?: number) {
    const existing = api.getPanel(def.id);
    if (existing) { existing.api.setActive(); return; }

    // Find any existing right-side panel to tab into
    const rightPanel = api.panels.find(p => !LEFT_GROUP_IDS.has(p.id));
    if (rightPanel) {
        api.addPanel({
            id: def.id,
            component: def.component ?? def.id,
            title: def.title,
            params,
            position: { referencePanel: rightPanel.id },
        });
    } else {
        // No right group yet — create one to the right of the left group
        const leftPanel = api.panels.find(p => LEFT_GROUP_IDS.has(p.id));
        api.addPanel({
            id: def.id,
            component: def.component ?? def.id,
            title: def.title,
            params,
            initialWidth,
            position: leftPanel
                ? { referencePanel: leftPanel.id, direction: "right" }
                : undefined,
        });
    }
}

function openRequestLogPanel() {
    const api = dockApiRef();
    if (!api) return;
    openInRightGroup(api, requestLogPanelDef);
}

function openModelApisPanel() {
    const api = dockApiRef();
    if (!api) return;
    openInLeftGroup(api, modelApisPanelDef);
}

function WorkbenchDockview() {
    let containerRef: HTMLDivElement | undefined;
    let dockApi: DockviewApi | undefined;
    const disposers: (() => void)[] = [];

    const engine = () => {
        return workbenchStore.api;
    };

    const workbenchContext = (): Record<string, string> => {
        const ctx: Record<string, string> = {};
        const si = workbenchStore.selectedSpineInstance();
        if (si) {
            ctx.spineInstanceTreeId = si;
        }
        return ctx;
    };

    // Resolve endpoint def from schema by path
    // Overlays tag-level properties (discovery, filterField) from the ModelAPIs/Panel tag
    const MODEL_APIS_TAG = '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel';
    const getEndpoint = (path: string) => {
        const s = engine().schema();
        if (!s) return null;
        const def = s.endpoints[path];
        if (!def) return null;
        const tagOverrides = def.tags?.[MODEL_APIS_TAG] ?? {};
        return { path, name: path.split("/").pop()!, ...def, ...tagOverrides };
    };

    // Grid helper: compute column width (conceptual 20-column grid)
    const colWidth = () => containerRef ? Math.floor(containerRef.offsetWidth / 20) : 64;

    // Open a method panel in dockview (always in the right group)
    const openMethodPanel = (path: string, name: string) => {
        if (!dockApi) return;
        openInRightGroup(
            dockApi,
            { id: path, component: "framespace-api-method", title: name },
            { path, name },
            colWidth() * 5,
        );
    };

    // Open (or focus) a framespace visualization panel
    const openFramespacePanel = (link: FramespaceLink) => {
        if (!dockApi) return;
        vlog("openFramespacePanel", `path=${link.methodPath} label=${link.label}`);
        openMethodPanel(link.methodPath, link.label);
    };

    // Resolve the first framespace link from a config object
    const resolveFirstFramespace = (fs: Record<string, any>): { methodPath: string; label: string } | null => {
        const entries = Object.entries(fs);
        if (entries.length === 0) return null;
        const [uri, entry] = entries[0];
        const hashIdx = uri.indexOf('#');
        const baseUri = hashIdx >= 0 ? uri.substring(0, hashIdx) : uri;
        const ns = baseUri.replace(/\//g, '~');
        const vizMethods = entry?.visualizationMethod;
        const methodName = vizMethods ? Object.keys(vizMethods)[0] : null;
        if (!methodName) return null;
        const methodConfig = vizMethods[methodName] ?? {};
        const label = methodConfig.label ?? methodName;
        const s = engine().schema();
        const apiDef = s?.apis?.[ns];
        const basePath = apiDef?.basePath ?? `/api/${ns}`;
        return { methodPath: `${basePath}/${methodName}`, label };
    };

    // Track the auto-opened panel ID so we can clean up on switch
    let autoOpenedPanelId: string | null = null;

    // Auto-open/focus the first framespace for the current instance config.
    // Called after dockApi is ready and on every subsequent instance change.
    function autoOpenFirstFramespace() {
        if (!dockApi) return;
        const config = workbenchStore.selectedInstanceConfig();
        const fs = config?.framespaces as Record<string, any> | null | undefined;

        const first = fs ? resolveFirstFramespace(fs) : null;
        const newId = first?.methodPath ?? null;

        vlog("autoOpenFramespace", `prev=${autoOpenedPanelId} new=${newId}`);

        if (autoOpenedPanelId && autoOpenedPanelId !== newId) {
            const panel = dockApi.getPanel(autoOpenedPanelId);
            if (panel) {
                vlog("autoOpenFramespace", `closing previous panel: ${autoOpenedPanelId}`);
                panel.api.close();
            }
        }

        autoOpenedPanelId = newId;

        if (!newId || !first) return;

        const existing = dockApi.getPanel(newId);
        if (existing) {
            vlog("autoOpenFramespace", `focusing existing panel: ${newId}`);
            existing.api.setActive();
        } else {
            vlog("autoOpenFramespace", `opening new panel: ${newId} title=${first.label}`);
            openInRightGroup(
                dockApi,
                { id: newId, component: "framespace-api-method", title: first.label },
                { path: newId, name: first.label },
                colWidth() * 5,
            );
        }
    }

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
                if (options.name === "framespace-models") {
                    // Framespaces panel — config-driven visualization links
                    const el = document.createElement("div");
                    el.style.cssText = "width:100%;height:100%;overflow:auto;";
                    let disposeRender: (() => void) | undefined;
                    return {
                        element: el,
                        init() {
                            disposeRender = render(() => (
                                <FramespacesPanel
                                    schema={() => engine().schema()}
                                    framespaces={() => workbenchStore.selectedInstanceConfig()?.framespaces ?? null}
                                    onFramespaceClick={openFramespacePanel}
                                />
                            ), el);
                            disposers.push(disposeRender);
                        },
                        dispose() { disposeRender?.(); },
                    };
                }

                if (options.name === "framespace-api") {
                    // API list panel (closable, launched on demand)
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

                if (options.name === REQUEST_LOG_PANEL_ID) {
                    // Request log panel (closable, launched on demand)
                    const el = document.createElement("div");
                    el.style.cssText = "width:100%;height:100%;";
                    let disposeRender: (() => void) | undefined;
                    return {
                        element: el,
                        init() {
                            disposeRender = render(() => (
                                <RequestLogPanelContent entries={engine().requestLog} />
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
                    el.style.cssText = "padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:100%;display:flex;align-items:center;";
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

                const SKIP_PANELS = new Set([...LEFT_GROUP_IDS, REQUEST_LOG_PANEL_ID]);
                const renderToggle = (pid: string) => {
                    // Don't render header actions for non-method panels
                    if (SKIP_PANELS.has(pid)) {
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

        // Store ref for header panel launchers
        setDockApiRef(dockApi);

        // Try to restore saved layout, fall back to default panels
        const savedLayout = workbenchStore.dockviewLayout();
        let restored = false;
        if (savedLayout) {
            try {
                vlog("buildDockview", "restoring saved dockview layout");
                dockApi.fromJSON(savedLayout);
                restored = true;
                // Update panel titles to match current definitions (in case they changed)
                for (const viz of visualizations) {
                    const panel = dockApi.getPanel(viz.id);
                    if (panel) {
                        panel.api.setTitle(viz.title);
                    }
                }
            } catch (err) {
                vlog("buildDockview", "failed to restore layout, using defaults:", err);
            }
        }

        const cw = colWidth();

        // Ensure all required (non-closable) panels exist after restore
        if (restored) {
            for (const viz of visualizations) {
                if (!dockApi.getPanel(viz.id)) {
                    vlog("buildDockview", `adding missing required panel: ${viz.id}`);
                    const pos = viz.position ?? "left";
                    const panels = dockApi.panels;
                    const refPanel = pos === "left" && panels.length > 0 ? panels[0]
                        : pos === "right" && panels.length > 0 ? panels[panels.length - 1]
                            : undefined;
                    dockApi.addPanel({
                        id: viz.id,
                        component: viz.id,
                        tabComponent: viz.tabComponent ?? "default",
                        title: viz.title,
                        initialWidth: cw * (viz.initialWidthCols ?? 2),
                        position: refPanel
                            ? { referencePanel: refPanel.id, direction: pos === "left" ? "left" : "right" }
                            : undefined,
                    });
                }
            }
            // Re-apply group constraints after restore (prevents left panel expanding)
            requestAnimationFrame(() => {
                for (const viz of visualizations) {
                    if (viz.maxWidthCols || viz.minWidthCols) {
                        const panel = dockApi!.getPanel(viz.id);
                        if (panel?.group) {
                            panel.group.api.setConstraints({
                                maximumWidth: viz.maxWidthCols ? cw * viz.maxWidthCols : undefined,
                                minimumWidth: viz.minWidthCols ? cw * viz.minWidthCols : undefined,
                            });
                        }
                    }
                }
            });
        }

        if (!restored) {
            // Add visualization panels from the registry
            for (const viz of visualizations) {
                const panel = dockApi.addPanel({
                    id: viz.id,
                    component: viz.id,
                    tabComponent: viz.tabComponent ?? "default",
                    title: viz.title,
                    initialWidth: cw * (viz.initialWidthCols ?? 2),
                    maximumWidth: viz.maxWidthCols ? cw * viz.maxWidthCols : undefined,
                    minimumWidth: viz.minWidthCols ? cw * viz.minWidthCols : undefined,
                });

                // Set group constraints if specified
                if (viz.maxWidthCols || viz.minWidthCols) {
                    requestAnimationFrame(() => {
                        if (panel.group) {
                            panel.group.api.setConstraints({
                                maximumWidth: viz.maxWidthCols ? cw * viz.maxWidthCols : undefined,
                                minimumWidth: viz.minWidthCols ? cw * viz.minWidthCols : undefined,
                            });
                        }
                    });
                }
            }
        }

        // Persist layout on every change (debounced in the store)
        const layoutDisposable = dockApi.onDidLayoutChange(() => {
            if (dockApi) {
                workbenchStore.saveDockviewLayout(dockApi.toJSON());
            }
        });
        disposers.push(() => layoutDisposable.dispose());

        // Add context menu listener for tabs
        const handleTabContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Find the tab element (has class 'dv-tab')
            const tabEl = target.closest('.dv-tab') as HTMLElement | null;
            if (!tabEl) return;

            // Get the panel id from the tab's data attribute
            const panelId = tabEl.getAttribute('data-testid')?.replace('dv-tab-', '') ?? null;
            if (!panelId) return;

            // Find the panel and its group
            const panel = dockApi?.getPanel(panelId);
            if (!panel) return;

            e.preventDefault();
            setTabContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                panelId: panelId,
                groupId: panel.group.id,
            });
        };

        containerRef.addEventListener('contextmenu', handleTabContextMenu);
        disposers.push(() => containerRef?.removeEventListener('contextmenu', handleTabContextMenu));

        // Now that dockApi is ready, watch instance changes to auto-open first framespace
        createEffect(() => {
            // Subscribe to selectedInstanceConfig so this re-fires on instance change
            workbenchStore.selectedInstanceConfig();
            autoOpenFirstFramespace();
        });
    }

    onCleanup(() => {
        setDockApiRef(null);
        disposers.forEach(d => d());
        dockApi?.dispose();
    });

    return (
        <>
            <div class="wb-dockview" ref={containerRef} />
            <TabContextMenu dockApi={() => dockApi ?? null} />
        </>
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
    workbenchStore.api.openFile(cmd, file)
        .then((data: any) => {
            if (isApiError(data.result) && onError) onError(data.result);
        })
        .catch((err: any) => {
            vlog("openFile", "openFile failed:", err);
            if (onError) onError({ method: "Workbench/openFile", message: err.message ?? String(err) });
        });
}

// Resolves a capsule name to its source filepath via getCapsule.
// Uses capsuleSourceLineRef (absolute path with :line suffix) rather than
// source.moduleFilepath (which is relative and resolves incorrectly).
async function resolveCapsuleFilepath(capsuleName: string, onError?: (e: ErrorInfo) => void): Promise<string | null> {
    try {
        const data = await workbenchStore.api.getCapsule(
            capsuleName,
            workbenchStore.selectedEngine() ?? undefined,
            workbenchStore.selectedSpineInstance() ?? undefined,
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
        if (onError) onError({ method: "Encapsulate/CapsuleSpine/getCapsule", message: err.message ?? String(err) });
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
                const data = await workbenchStore.api.getReps();
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

            <WorkbenchHeader
                selected={selected}
                selectedLineSuffix={selectedLineSuffix}
                onSettingsClick={() => setShowSettings(true)}
                onCodeClick={() => {
                    const ref = selectedLineRef();
                    if (ref) openCodeFile("Open Capsule Source", ref);
                    else openCapsuleCode(selected()!);
                }}
                onClearInstance={() => workbenchStore.clearSpineInstance()}
            />

            <div class="wb-content">
                <Show when={ready()} fallback={
                    <div class="wb-loading">Connecting to engines...</div>
                }>
                    <Show when={selected()} fallback={
                        <SpineInstanceSelector onCodeClick={(filepath) => openCodeFile("Open Capsule Source", filepath)} />
                    }>
                        <WorkbenchDockview />
                    </Show>
                </Show>
                <Show when={ready() && workbenchStore.api.status() === "disconnected"}>
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
