// ── Workbench Store ──────────────────────────────────────────────────
// Central state for the workbench: engine connections, selected spine
// instance, dockview layout, and persistence via localStorage.

import { createSignal } from "solid-js";
import type { EngineClient, SpineInstance } from "./engines";
import { createCapsuleLadybugClient } from "./engines";

function vlog(context: string, ...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) console.log(`[WorkbenchStore/${context}]`, ...args);
}

const STORAGE_KEY = "framespace-workbench-state";

type Persisted = {
    selectedSpineInstance: string | null;
    selectedEngine: string | null;
    dockviewLayout: any | null;
};

function load(): Persisted {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { selectedSpineInstance: null, selectedEngine: null, dockviewLayout: null, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { selectedSpineInstance: null, selectedEngine: null, dockviewLayout: null };
}

function persist(partial: Partial<Persisted>) {
    try {
        const current = load();
        const merged = { ...current, ...partial };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch { /* ignore */ }
}

// ── Engine instances ─────────────────────────────────────────────────
const ladybugClient = createCapsuleLadybugClient();

const engines: EngineClient[] = [ladybugClient];

// ── Signals ──────────────────────────────────────────────────────────
const init = load();
const [selectedSpineInstance, setSelectedSpineInstance] = createSignal<string | null>(init.selectedSpineInstance);
const [selectedEngine, setSelectedEngine] = createSignal<string | null>(init.selectedEngine);
const [spineInstances, setSpineInstances] = createSignal<SpineInstance[]>([]);
const [spineInstanceGroups, setSpineInstanceGroups] = createSignal<any[]>([]);
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
    vlog("connectAll", "connecting engines...");
    await Promise.allSettled(engines.map(e => e.connect()));
    vlog("connectAll", "engine status:", ladybugClient.status(), "methods:", ladybugClient.methodCount());

    // After connecting, fetch spine instances and start stats polling
    if (ladybugClient.status() === "connected") {
        try {
            const result = await ladybugClient.listSpineInstances();
            vlog("connectAll", "spine instances loaded:", result.list.length, result.list.map(i => i.$id));
            setSpineInstances(result.list);
            setSpineInstanceGroups(result.groups);

            // If no engine selected yet, use default from server
            if (!selectedEngine()) {
                const def = ladybugClient.defaultEngineName();
                if (def) {
                    setSelectedEngine(def);
                    persist({ selectedEngine: def });
                }
            }
        } catch (err) {
            vlog("connectAll", "ERROR loading spine instances:", err);
        }
        ladybugClient.startStatsPolling();
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
    // ── Engines ──────────────────────────────────────────────────────
    engines,
    ladybugClient,

    // ── Selected engine ──────────────────────────────────────────────
    selectedEngine,
    selectEngine,

    // ── Spine instances ──────────────────────────────────────────────
    spineInstances,
    spineInstanceGroups,
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
