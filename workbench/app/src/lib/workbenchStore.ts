// ── Workbench Store ──────────────────────────────────────────────────
// Central state for the workbench: engine connections, selected spine
// instance, and persistence via localStorage.

import { createSignal } from "solid-js";
import type { EngineClient, SpineInstance } from "./engines";
import { createCapsuleLadybugClient } from "./engines";

function vlog(context: string, ...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) console.log(`[WorkbenchStore/${context}]`, ...args);
}

const STORAGE_KEY = "framespace-workbench-state";

type Persisted = {
    selectedSpineInstance: string | null;
};

function load(): Persisted {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { selectedSpineInstance: null, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { selectedSpineInstance: null };
}

function persist(p: Persisted) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// ── Engine instances ─────────────────────────────────────────────────
const ladybugClient = createCapsuleLadybugClient();

const engines: EngineClient[] = [ladybugClient];

// ── Signals ──────────────────────────────────────────────────────────
const init = load();
const [selectedSpineInstance, setSelectedSpineInstance] = createSignal<string | null>(init.selectedSpineInstance);
const [spineInstances, setSpineInstances] = createSignal<SpineInstance[]>([]);

// ── Connect all engines on init ──────────────────────────────────────
async function connectAll(): Promise<void> {
    vlog("connectAll", "connecting engines...");
    await Promise.allSettled(engines.map(e => e.connect()));
    vlog("connectAll", "engine status:", ladybugClient.status(), "methods:", ladybugClient.methodCount());

    // After connecting, fetch spine instances and start stats polling
    if (ladybugClient.status() === "connected") {
        try {
            const instances = await ladybugClient.listSpineInstances();
            vlog("connectAll", "spine instances loaded:", instances.length, instances.map(i => i.$id));
            setSpineInstances(instances);
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

function clearSpineInstance() {
    setSelectedSpineInstance(null);
    persist({ selectedSpineInstance: null });
}

export const workbenchStore = {
    // ── Engines ──────────────────────────────────────────────────────
    engines,
    ladybugClient,

    // ── Spine instances ──────────────────────────────────────────────
    spineInstances,
    selectedSpineInstance,
    selectSpineInstance,
    clearSpineInstance,

    // ── Lifecycle ────────────────────────────────────────────────────
    connectAll,
};
