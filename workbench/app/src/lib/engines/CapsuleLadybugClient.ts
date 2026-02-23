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

export function createCapsuleLadybugClient(baseUrl = DEFAULT_BASE_URL): EngineClient & {
    listSpineInstances(): Promise<SpineInstance[]>;
    requestCount: () => number;
    payloadSentBytes: () => number;
    payloadReceivedBytes: () => number;
    processStats: () => ProcessStats | null;
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
    let statsInterval: ReturnType<typeof setInterval> | null = null;

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

    async function call(path: string, args?: Record<string, string>): Promise<any> {
        const s = schema();
        if (!s) throw new Error("Engine not connected");

        const ep = s.endpoints[path];
        let url = `${baseUrl}${path}`;

        if (args && ep?.args) {
            const params = new URLSearchParams();
            for (const argDef of ep.args) {
                const val = args[argDef.name];
                if (val != null && val !== "") params.set(argDef.name, val);
            }
            const qs = params.toString();
            if (qs) url += `?${qs}`;
        }

        return fetchJsonTracked(url);
    }

    async function callRaw(path: string, args?: any[]): Promise<any> {
        let url = `${baseUrl}${path}`;
        if (args && args.length > 0) {
            const params = new URLSearchParams();
            args.forEach((a, i) => params.set(String(i), String(a)));
            url += `?${params.toString()}`;
        }
        return fetchJsonTracked(url);
    }

    async function listSpineInstances(): Promise<SpineInstance[]> {
        const data = await callRaw("/api/Workbench/listSpineInstances");
        if (data.result?.list) {
            return data.result.list.map((i: any) => ({
                $id: i.$id,
                capsuleName: i.$id,
                capsuleSourceLineRef: i.capsuleSourceLineRef,
            }));
        }
        return [];
    }

    async function fetchProcessStats() {
        try {
            const data = await fetchJsonTracked(`${baseUrl}/api/Workbench/getProcessStats`);
            if (data.result) {
                setProcessStats(data.result);
                if (status() !== "connected") setStatus("connected");
            }
        } catch {
            if (status() !== "disconnected") setStatus("disconnected");
        }
    }

    function startStatsPolling() {
        if (statsInterval) return;
        fetchProcessStats();
        statsInterval = setInterval(fetchProcessStats, 5000);
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
        call,
        callRaw,
        listSpineInstances,
        requestCount,
        payloadSentBytes,
        payloadReceivedBytes,
        processStats,
        startStatsPolling,
        stopStatsPolling,
    };
}
