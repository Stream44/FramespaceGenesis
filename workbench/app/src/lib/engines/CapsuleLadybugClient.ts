// ── Capsule-Ladybug-v0 engine client ─────────────────────────────────
// HTTP client for the Ladybug CST API server.

import { createSignal } from "solid-js";
import type { EngineClient, EngineSchema, ConnectionStatus, SpineInstance } from "./types";

const DEFAULT_BASE_URL = "http://localhost:4000";

export type ProcessStats = {
    memoryMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    cpuUserMs: number;
    cpuSystemMs: number;
    uptimeSeconds: number;
};

export type RequestLogEntry = { path: string; args: Record<string, string> | undefined; engine: string | undefined; result: any; timestamp: number; elapsed: number };

export type EngineLoadStatus = Record<string, { status: 'idle' | 'loading' | 'loaded' | 'error'; error?: string }>;

export function createCapsuleLadybugClient(baseUrl = DEFAULT_BASE_URL): EngineClient & {
    listSpineInstances(engine?: string): Promise<{ list: SpineInstance[]; groups: any[] }>;
    availableEngines: () => string[];
    defaultEngineName: () => string | null;
    engineStatus: () => EngineLoadStatus;
    requestCount: () => number;
    payloadSentBytes: () => number;
    payloadReceivedBytes: () => number;
    processStats: () => ProcessStats | null;
    requestLog: () => RequestLogEntry[];
    startStatsPolling: () => void;
    stopStatsPolling: () => void;
} {
    const [status, setStatus] = createSignal<ConnectionStatus>("disconnected");
    const [schema, setSchema] = createSignal<EngineSchema | null>(null);

    // ── Request / payload tracking ──────────────────────────────────
    const [requestCount, setRequestCount] = createSignal(0);
    const [payloadSentBytes, setPayloadSentBytes] = createSignal(0);
    const [payloadReceivedBytes, setPayloadReceivedBytes] = createSignal(0);

    // ── Process stats (polled from backend) ─────────────────────────
    const [processStats, setProcessStats] = createSignal<ProcessStats | null>(null);
    const [engineStatus, setEngineStatus] = createSignal<EngineLoadStatus>({});
    let statsInterval: ReturnType<typeof setInterval> | null = null;

    // ── Model request log (last 10 non-Workbench API calls) ─────────
    const [requestLog, setRequestLog] = createSignal<RequestLogEntry[]>([]);

    function pushRequestLog(entry: RequestLogEntry) {
        setRequestLog(prev => [entry, ...prev].slice(0, 10));
    }

    async function fetchJsonTracked(url: string): Promise<any> {
        // Track sent bytes (URL length as rough estimate for GET requests)
        const sentBytes = new TextEncoder().encode(url).length;
        setPayloadSentBytes(prev => prev + sentBytes);
        setRequestCount(prev => prev + 1);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const text = await res.text();

        // Track received bytes
        setPayloadReceivedBytes(prev => prev + new TextEncoder().encode(text).length);

        return JSON.parse(text);
    }

    async function connect() {
        setStatus("connecting");
        try {
            const s = await fetchJsonTracked(`${baseUrl}/api/schema`);
            setSchema(s);
            setStatus("connected");
        } catch (e) {
            setStatus("error");
            throw new Error(`Failed to connect to Capsule-Ladybug-v0 at ${baseUrl}`);
        }
    }

    function methodCount(): number {
        const s = schema();
        return s ? Object.keys(s.endpoints).length : 0;
    }

    function apiCount(): number {
        const s = schema();
        if (!s) return 0;
        const namespaces = new Set<string>();
        for (const ep of Object.values(s.endpoints)) {
            if (ep.namespace) namespaces.add(ep.namespace);
        }
        return namespaces.size;
    }

    function apiNames(): string[] {
        const s = schema();
        if (!s) return [];
        const namespaces = new Set<string>();
        for (const ep of Object.values(s.endpoints)) {
            if (ep.namespace) namespaces.add(ep.namespace);
        }
        return [...namespaces].sort();
    }

    function availableEngines(): string[] {
        const s = schema();
        return s?.engines ?? [];
    }

    function defaultEngineName(): string | null {
        const s = schema();
        return s?.defaultEngine ?? null;
    }

    async function call(path: string, args?: Record<string, string>, engine?: string): Promise<any> {
        const s = schema();
        if (!s) throw new Error("Engine not connected");

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

        const isModelCall = !path.includes("/Framespace/Workbench/");
        const t0 = isModelCall ? performance.now() : 0;
        const data = await fetchJsonTracked(url);
        if (isModelCall) {
            pushRequestLog({ path, args, engine, result: data.result, timestamp: Date.now(), elapsed: Math.round(performance.now() - t0) });
        }
        return data;
    }

    async function callRaw(path: string, args?: any[], engine?: string): Promise<any> {
        let url = `${baseUrl}${path}`;
        const params = new URLSearchParams();
        if (engine) params.set("engine", engine);
        if (args && args.length > 0) {
            args.forEach((a, i) => params.set(String(i), String(a)));
        }
        const qs = params.toString();
        if (qs) url += `?${qs}`;
        return fetchJsonTracked(url);
    }

    async function listSpineInstances(engine?: string): Promise<{ list: SpineInstance[]; groups: any[] }> {
        const data = await callRaw("/api/Framespace/Workbench/listSpineInstances", [], engine);
        const list = data.result?.list?.map((i: any) => ({
            $id: i.$id,
            capsuleName: i.$id,
            capsuleSourceLineRef: i.capsuleSourceLineRef,
        })) ?? [];
        const groups = data.result?.groups ?? [];
        return { list, groups };
    }

    async function fetchProcessStats() {
        try {
            const data = await fetchJsonTracked(`${baseUrl}/api/Framespace/Workbench/getProcessStats`);
            if (data.result) {
                setProcessStats(data.result);
                if (status() !== "connected") setStatus("connected");
            }
        } catch {
            if (status() !== "disconnected") setStatus("disconnected");
        }
    }

    async function fetchEngineStatus() {
        try {
            const data = await fetchJsonTracked(`${baseUrl}/api/engines`);
            if (data.status) setEngineStatus(data.status);
        } catch { /* ignore */ }
    }

    function startStatsPolling() {
        if (statsInterval) return;
        fetchProcessStats();
        fetchEngineStatus();
        statsInterval = setInterval(() => { fetchProcessStats(); fetchEngineStatus(); }, 5000);
    }

    function stopStatsPolling() {
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
    }

    return {
        id: "Capsule-Ladybug-v0",
        name: "Capsule Ladybug Engine - v0",
        baseUrl,
        connect,
        status,
        schema,
        methodCount,
        apiCount,
        apiNames,
        availableEngines,
        defaultEngineName,
        engineStatus,
        call,
        callRaw,
        listSpineInstances,
        requestCount,
        payloadSentBytes,
        payloadReceivedBytes,
        processStats,
        requestLog,
        startStatsPolling,
        stopStatsPolling,
    };
}
