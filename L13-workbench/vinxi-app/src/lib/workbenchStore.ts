// ── Workbench Store ──────────────────────────────────────────────────
// Central state for the workbench: engine connections, selected spine
// instance, dockview layout, and persistence via localStorage.

import { createSignal, createMemo } from "solid-js";
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
    instanceSelectorTab: "examples" | "tests" | null;
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
                    instanceSelectorTab: parsed.instanceSelectorTab ?? null,
                    layoutVersion: LAYOUT_VERSION,
                };
            }
            return { selectedSpineInstance: null, selectedEngine: null, dockviewLayout: null, ...parsed };
        }
    } catch { /* ignore */ }
    return { selectedSpineInstance: null, selectedEngine: null, dockviewLayout: null, instanceSelectorTab: null, layoutVersion: LAYOUT_VERSION };
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
const [instanceSelectorTab, setInstanceSelectorTabSignal] = createSignal<"examples" | "tests">(init.instanceSelectorTab ?? "examples");

// ── Timeline / time-travel state ─────────────────────────────────────
const [activeEventIndex, setActiveEventIndexRaw] = createSignal<number>(-1);
const [eventLogEntries, setEventLogEntries] = createSignal<any[]>([]);
const [isPlaying, setIsPlaying] = createSignal(false);
const PLAY_SPEEDS = [2000, 1000, 400, 150, 50] as const;
const PLAY_SPEED_LABELS = ['0.2×', '0.5×', '1×', '2×', '5×'] as const;
const [playSpeedIndex, setPlaySpeedIndex] = createSignal(2); // default 1× (400ms)
const playSpeed = () => PLAY_SPEEDS[playSpeedIndex()];
let playTimer: ReturnType<typeof setInterval> | undefined;

function setActiveEventIndex(idx: number) {
    vlog("setActiveEventIndex", `changing from ${activeEventIndex()} to ${idx}`);
    setActiveEventIndexRaw(idx);
}

function setInstanceSelectorTab(tab: "examples" | "tests") {
    setInstanceSelectorTabSignal(tab);
    persist({ instanceSelectorTab: tab });
}

// ── Timeline helpers ─────────────────────────────────────────────────

function stopPlaying() {
    clearInterval(playTimer);
    playTimer = undefined;
    setIsPlaying(false);
}

function startPlaying() {
    const entries = eventLogEntries();
    if (entries.length === 0) return;
    setIsPlaying(true);
    playTimer = setInterval(() => {
        const current = activeEventIndex();
        const total = eventLogEntries().length;
        if (current >= total - 1) {
            stopPlaying();
            return;
        }
        setActiveEventIndex(current + 1);
    }, playSpeed());
}

function togglePlayPause() {
    if (isPlaying()) {
        stopPlaying();
    } else {
        // If at end, restart from beginning
        if (activeEventIndex() >= eventLogEntries().length - 1) {
            setActiveEventIndex(-1);
        }
        startPlaying();
    }
}

async function loadEventLog(spineInstanceTreeId: string) {
    vlog("loadEventLog", `loading for ${spineInstanceTreeId}`);
    stopPlaying();
    setActiveEventIndex(-1);
    setEventLogEntries([]);
    try {
        const result = await api.call(
            "/api/@stream44.studio~FramespaceGenesis~L6-semantic-models~Capsular~CapsuleSpine~ModelQueryMethods/getEventLog",
            { spineInstanceTreeId, filter: 'codepath' }
        );
        const entries = result?.result?.entries ?? [];
        vlog("loadEventLog", `loaded ${entries.length} events`);
        setEventLogEntries(entries);
    } catch (err: any) {
        vlog("loadEventLog", `error: ${err.message}`);
        setEventLogEntries([]);
    }
}

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

        // Load event log for persisted instance (already selected before connect)
        const si = selectedSpineInstance();
        if (si) {
            loadEventLog(si);
        }
    }
}

function selectSpineInstance(id: string | null) {
    vlog("selectSpineInstance", id);
    setSelectedSpineInstance(id);
    persist({ selectedSpineInstance: id });
    // Load event log for time-travel when instance is selected
    if (id) {
        // Wait for API to be connected before loading
        if (api.status() === "connected") {
            loadEventLog(id);
        }
    } else {
        stopPlaying();
        setActiveEventIndex(-1);
        setEventLogEntries([]);
    }
}

function selectEngine(engineName: string) {
    vlog("selectEngine", engineName);
    setSelectedEngine(engineName);
    persist({ selectedEngine: engineName });
}

function clearSpineInstance() {
    setSelectedSpineInstance(null);
    persist({ selectedSpineInstance: null });
    stopPlaying();
    setActiveEventIndex(-1);
    setEventLogEntries([]);
}

const selectedInstanceConfig = createMemo(() => {
    const id = selectedSpineInstance();
    if (!id) return null;
    const inst = spineInstances().find(i => i.$id === id);
    return inst?.config ?? null;
});

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
    selectedInstanceConfig,
    selectSpineInstance,
    clearSpineInstance,

    // ── Dockview layout ──────────────────────────────────────────────
    dockviewLayout,
    saveDockviewLayout,
    clearDockviewLayout,

    // ── Model test errors ────────────────────────────────────────────
    modelTestError,
    setModelTestError,

    // ── Instance selector tab ────────────────────────────────────────
    instanceSelectorTab,
    setInstanceSelectorTab,

    // ── Timeline / time-travel ───────────────────────────────────────
    activeEventIndex,
    setActiveEventIndex,
    eventLogEntries,
    isPlaying,
    togglePlayPause,
    stopPlaying,
    loadEventLog,
    playSpeedIndex,
    setPlaySpeedIndex,
    PLAY_SPEEDS,
    PLAY_SPEED_LABELS,

    // ── Lifecycle ────────────────────────────────────────────────────
    connectAll,
};
