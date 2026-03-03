// ── Model API Client ─────────────────────────────────────────────────
// Single client for all model server API calls. Wraps fetch, tracks
// connection status, schema, request stats, and provides typed helpers
// for each registered model namespace.

import { createSignal } from "solid-js";

// ── Engine abstraction types (formerly in engines/types.ts) ─────────

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type ArgDef = { name: string; type: string; optional?: boolean };

export type EndpointDef = {
    method: string;
    namespace: string;
    description: string;
    args: ArgDef[];
    discovery?: string;
    filterField?: string;
    engineParam?: boolean;
    tags?: Record<string, Record<string, any>>;
};

export type ApiDef = {
    description: string;
    basePath: string;
};

export type EngineSchema = {
    openapi: string;
    info: { title: string; version: string };
    apis: Record<string, ApiDef>;
    engines: string[];
    defaultEngine: string | null;
    endpoints: Record<string, EndpointDef>;
};

export interface SpineInstance {
    $id: string;
    capsuleName?: string;
    filepath?: string;
    capsuleSourceLineRef?: string;
    capsuleSourceUriLineRef?: string;
    config?: Record<string, any> | null;
}

export type ProcessStats = {
    memoryMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    cpuUserMs: number;
    cpuSystemMs: number;
    uptimeSeconds: number;
};

export type RequestLogEntry = {
    path: string;
    args: Record<string, string> | undefined;
    engine: string | undefined;
    result: any;
    timestamp: number;
    elapsed: number;
};


// ── Known model mount keys ───────────────────────────────────────────
// Mount key = model URI with '/' replaced by '~'

const NS = {
    CapsuleSpine: '@stream44.studio~FramespaceGenesis~L6-semantic-models~Capsular~CapsuleSpine~ModelQueryMethods',
    Workbench: '@stream44.studio~FramespaceGenesis~L6-semantic-models~Framespace~Workbench~ModelQueryMethods',
    Quadrant: '@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Quadrant~ModelQueryMethods',
} as const;

const DEFAULT_BASE_URL = "http://localhost:4000";

export function createModelApiClient(baseUrl = DEFAULT_BASE_URL) {
    const [status, setStatus] = createSignal<ConnectionStatus>("disconnected");
    const [schema, setSchema] = createSignal<EngineSchema | null>(null);

    // ── Request / payload tracking ──────────────────────────────────
    const [requestCount, setRequestCount] = createSignal(0);
    const [payloadSentBytes, setPayloadSentBytes] = createSignal(0);
    const [payloadReceivedBytes, setPayloadReceivedBytes] = createSignal(0);

    // ── Process stats (polled from backend) ─────────────────────────
    const [processStats, setProcessStats] = createSignal<ProcessStats | null>(null);
    let statsInterval: ReturnType<typeof setInterval> | null = null;

    // ── Request log (last 10 non-Workbench API calls) ───────────────
    const [requestLog, setRequestLog] = createSignal<RequestLogEntry[]>([]);

    function pushRequestLog(entry: RequestLogEntry) {
        setRequestLog(prev => [entry, ...prev].slice(0, 10));
    }

    // ── Low-level fetch with tracking ───────────────────────────────
    async function fetchJson(url: string): Promise<any> {
        const sentBytes = new TextEncoder().encode(url).length;
        setPayloadSentBytes(prev => prev + sentBytes);
        setRequestCount(prev => prev + 1);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const text = await res.text();
        setPayloadReceivedBytes(prev => prev + new TextEncoder().encode(text).length);
        return JSON.parse(text);
    }

    // ── Build API URL ───────────────────────────────────────────────
    function apiUrl(namespace: string, method: string, params?: Record<string, string | undefined>): string {
        let url = `${baseUrl}/api/${namespace}/${method}`;
        if (params) {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v != null && v !== "") qs.set(k, v);
            }
            const s = qs.toString();
            if (s) url += `?${s}`;
        }
        return url;
    }

    // ── Resolve discovery path to full /api/... URL ─────────────────
    // Discovery values from models are short like 'listCapsules' (same-
    // namespace) or 'Framespace/Workbench/listSpineInstanceTrees'
    // (cross-namespace). Resolve against the loaded schema endpoints.
    function resolveDiscoveryPath(discovery: string, originNamespace: string): string | null {
        const s = schema();
        if (!s) return null;

        if (!discovery.includes('/')) {
            // Same-namespace: 'listCapsules' → '/api/{ns}/listCapsules'
            const path = `/api/${originNamespace}/${discovery}`;
            if (s.endpoints[path]) return path;
        }

        // Cross-namespace: 'Framespace/Workbench/listSpineInstanceTrees'
        // Search all endpoints for a matching method name where the
        // namespace contains the path fragments joined with '~'
        const parts = discovery.split('/');
        const methodName = parts.pop()!;
        const nsFragment = parts.join('~');

        for (const [path, ep] of Object.entries(s.endpoints)) {
            if (ep.method === methodName && ep.namespace.includes(nsFragment)) {
                return path;
            }
        }

        return null;
    }

    // ── Generic call: path-based (for schema-driven method panels) ──
    async function call(path: string, args?: Record<string, string>, engine?: string): Promise<any> {
        const s = schema();
        if (!s) throw new Error("Not connected");

        const ep = s.endpoints[path];
        let url = `${baseUrl}${path}`;

        const params = new URLSearchParams();
        if (engine) params.set("engine", engine);
        if (args && ep?.args) {
            for (const argDef of ep.args) {
                const val = args[argDef.name];
                if (val != null && val !== "") params.set(argDef.name, val);
            }
        }
        const qs = params.toString();
        if (qs) url += `?${qs}`;

        const isModelCall = !path.includes(`${NS.Workbench}/`);
        const t0 = isModelCall ? performance.now() : 0;
        const data = await fetchJson(url);
        if (isModelCall) {
            pushRequestLog({ path, args, engine, result: data.result, timestamp: Date.now(), elapsed: Math.round(performance.now() - t0) });
        }
        return data;
    }

    // ── Connect ─────────────────────────────────────────────────────
    async function connect() {
        setStatus("connecting");
        try {
            const s = await fetchJson(`${baseUrl}/api/schema`);
            setSchema(s);
            setStatus("connected");
        } catch {
            setStatus("error");
            throw new Error(`Failed to connect to model server at ${baseUrl}`);
        }
    }

    // ── Schema helpers ──────────────────────────────────────────────
    function methodCount(): number {
        const s = schema();
        return s ? Object.keys(s.endpoints).length : 0;
    }

    function apiCount(): number {
        const s = schema();
        if (!s) return 0;
        return Object.keys(s.apis ?? {}).length;
    }

    function apiNames(): string[] {
        const s = schema();
        if (!s) return [];
        return Object.keys(s.apis ?? {}).sort();
    }

    function availableEngines(): string[] {
        const s = schema();
        return s?.engines ?? [];
    }

    function defaultEngineName(): string | null {
        const s = schema();
        return s?.defaultEngine ?? null;
    }

    // ── Workbench API ───────────────────────────────────────────────

    async function listSpineInstances(engine?: string): Promise<{ list: SpineInstance[]; groups: any[]; registeredModels: any[] }> {
        const url = apiUrl(NS.Workbench, 'listSpineInstanceTrees', engine ? { engine } : undefined);
        const data = await fetchJson(url);
        const list = data.result?.list?.map((i: any) => ({
            $id: i.$id,
            capsuleName: i.$id,
            capsuleSourceLineRef: i.capsuleSourceLineRef,
            capsuleSourceUriLineRef: i.capsuleSourceUriLineRef,
            config: i.config ?? null,
        })) ?? [];
        const groups = data.result?.groups ?? [];
        const registeredModels = data.result?.registeredModels ?? [];
        return { list, groups, registeredModels };
    }

    async function getProcessStats(): Promise<void> {
        try {
            const url = apiUrl(NS.Workbench, 'getProcessStats');
            const data = await fetchJson(url);
            if (data.result) {
                setProcessStats(data.result);
                if (status() !== "connected") setStatus("connected");
            }
        } catch {
            if (status() !== "disconnected") setStatus("disconnected");
        }
    }


    async function openFile(command: string, file: string): Promise<any> {
        const url = apiUrl(NS.Workbench, 'openFile', { command, file });
        return fetchJson(url);
    }

    async function getReps(): Promise<any> {
        const url = apiUrl(NS.Workbench, 'getReps');
        return fetchJson(url);
    }

    // ── CapsuleSpine API ────────────────────────────────────────────

    async function getCapsule(capsuleName: string, engine?: string, spineInstanceTreeId?: string): Promise<any> {
        const url = apiUrl(NS.CapsuleSpine, 'getCapsule', { spineInstanceTreeId, capsuleName, ...(engine ? { engine } : {}) });
        return fetchJson(url);
    }

    // ── Stats polling ───────────────────────────────────────────────

    function startStatsPolling() {
        if (statsInterval) return;
        getProcessStats();
        statsInterval = setInterval(() => { getProcessStats(); }, 5000);
    }

    function stopStatsPolling() {
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
    }

    return {
        // ── Connection ──────────────────────────────────────────────
        connect,
        status,
        schema,
        baseUrl,

        // ── Schema info ─────────────────────────────────────────────
        methodCount,
        apiCount,
        apiNames,
        availableEngines,
        defaultEngineName,

        // ── Generic call (for schema-driven method panels) ──────────
        call,
        resolveDiscoveryPath,

        // ── Typed API methods ───────────────────────────────────────
        listSpineInstances,
        openFile,
        getReps,
        getCapsule,

        // ── Stats / monitoring ──────────────────────────────────────
        requestCount,
        payloadSentBytes,
        payloadReceivedBytes,
        processStats,
        requestLog,
        startStatsPolling,
        stopStatsPolling,

        // ── Constants ───────────────────────────────────────────────
        NS,
    };
}

export type ModelApiClient = ReturnType<typeof createModelApiClient>;
