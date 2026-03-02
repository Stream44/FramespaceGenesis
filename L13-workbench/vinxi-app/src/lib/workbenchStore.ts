// ── Workbench Store ──────────────────────────────────────────────────
// Central state for the workbench: engine connections, selected spine
// instance, dockview layout, and persistence via localStorage.

import { createSignal } from "solid-js";
import type { SpineInstance } from "./modelApiClient";
import { createModelApiClient } from "./modelApiClient";

function vlog(context: string, ...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) console.log(`[WorkbenchStore/${context}]`, ...args);
}

const STORAGE_KEY = "framespace-workbench-state";

// Layout version — increment to auto-reset stale layouts
const LAYOUT_VERSION = 4;

type Persisted = {
    layoutVersion?: number;
    selectedSpineInstance: string | null;
    selectedEngine: string | null;
    dockviewLayout: any | null;
};

function load(): Persisted {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Auto-reset layout if version changed
            if (parsed.layoutVersion !== LAYOUT_VERSION) {
                vlog("load", `layout version mismatch (${parsed.layoutVersion} vs ${LAYOUT_VERSION}), resetting layout`);
                return {
                    selectedSpineInstance: parsed.selectedSpineInstance ?? null,
                    selectedEngine: parsed.selectedEngine ?? null,
                    dockviewLayout: null,
                    layoutVersion: LAYOUT_VERSION,
                };
            }
            return { selectedSpineInstance: null, selectedEngine: null, dockviewLayout: null, ...parsed };
        }
    } catch { /* ignore */ }
    return { selectedSpineInstance: null, selectedEngine: null, dockviewLayout: null, layoutVersion: LAYOUT_VERSION };
}

function persist(partial: Partial<Persisted>) {
    try {
        const current = load();
        const merged = { ...current, ...partial, layoutVersion: LAYOUT_VERSION };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch { /* ignore */ }
}

// ── API client ──────────────────────────────────────────────────────
const api = createModelApiClient();

// ── Signals ──────────────────────────────────────────────────────────
const init = load();
const [selectedSpineInstance, setSelectedSpineInstance] = createSignal<string | null>(init.selectedSpineInstance);
const [selectedEngine, setSelectedEngine] = createSignal<string | null>(init.selectedEngine);
const [spineInstances, setSpineInstances] = createSignal<SpineInstance[]>([]);
const [spineInstanceGroups, setSpineInstanceGroups] = createSignal<any[]>([]);
const [registeredModels, setRegisteredModels] = createSignal<{ uri: string; shortName: string }[]>([]);
const [dockviewLayout, setDockviewLayoutSignal] = createSignal<any | null>(init.dockviewLayout);
const [modelTestError, setModelTestError] = createSignal<{ model: string; message: string; output: string } | null>(null);

// ── Dockview layout persistence (debounced) ──────────────────────────
let layoutDebounce: ReturnType<typeof setTimeout> | undefined;

function saveDockviewLayout(layout: any) {
    setDockviewLayoutSignal(layout);
    clearTimeout(layoutDebounce);
    layoutDebounce = setTimeout(() => {
        vlog("saveDockviewLayout", "persisting layout");
        persist({ dockviewLayout: layout });
    }, 500);
}

function clearDockviewLayout() {
    setDockviewLayoutSignal(null);
    persist({ dockviewLayout: null });
}

// ── Connect all engines on init ──────────────────────────────────────
async function connectAll(): Promise<void> {
    vlog("connectAll", "connecting...");
    try {
        await api.connect();
    } catch { /* logged by client */ }
    vlog("connectAll", "status:", api.status(), "methods:", api.methodCount());

    if (api.status() === "connected") {
        try {
            const result = await api.listSpineInstances();
            vlog("connectAll", "spine instances loaded:", result.list.length, result.list.map(i => i.$id));
            setSpineInstances(result.list);
            setSpineInstanceGroups(result.groups);
            setRegisteredModels(result.registeredModels ?? []);

            if (!selectedEngine()) {
                const def = api.defaultEngineName();
                if (def) {
                    setSelectedEngine(def);
                    persist({ selectedEngine: def });
                }
            }
        } catch (err) {
            vlog("connectAll", "ERROR loading spine instances:", err);
        }
        api.startStatsPolling();
    }
}

function selectSpineInstance(id: string | null) {
    vlog("selectSpineInstance", id);
    setSelectedSpineInstance(id);
    persist({ selectedSpineInstance: id });
}

function selectEngine(engineName: string) {
    vlog("selectEngine", engineName);
    setSelectedEngine(engineName);
    persist({ selectedEngine: engineName });
}

function clearSpineInstance() {
    setSelectedSpineInstance(null);
    persist({ selectedSpineInstance: null });
}

export const workbenchStore = {
    // ── API client ──────────────────────────────────────────────────
    api,

    // ── Selected engine ──────────────────────────────────────────────
    selectedEngine,
    selectEngine,

    // ── Spine instances ──────────────────────────────────────────────
    spineInstances,
    spineInstanceGroups,
    registeredModels,
    selectedSpineInstance,
    selectSpineInstance,
    clearSpineInstance,

    // ── Dockview layout ──────────────────────────────────────────────
    dockviewLayout,
    saveDockviewLayout,
    clearDockviewLayout,

    // ── Model test errors ────────────────────────────────────────────
    modelTestError,
    setModelTestError,

    // ── Lifecycle ────────────────────────────────────────────────────
    connectAll,
};
