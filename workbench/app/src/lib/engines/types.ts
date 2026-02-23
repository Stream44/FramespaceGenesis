// ── Engine abstraction types ─────────────────────────────────────────
// Each engine exposes a typed API client that visualizations consume.
// The workbench manages engine connections and passes clients to panels.

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type ArgDef = { name: string; type: string; optional?: boolean };

export type EndpointDef = {
    method: string;
    namespace: string;
    description: string;
    args: ArgDef[];
    discovery?: string;
    filterField?: string;
};

export type ApiDef = {
    description: string;
    basePath: string;
};

export type EngineSchema = {
    openapi: string;
    info: { title: string; version: string };
    apis: Record<string, ApiDef>;
    endpoints: Record<string, EndpointDef>;
};

export interface EngineClient {
    /** Unique engine identifier, e.g. "Capsule-Ladybug-v0" */
    readonly id: string;
    /** Human-readable engine name */
    readonly name: string;
    /** Base URL of the engine API */
    readonly baseUrl: string;

    /** Connect to the engine and fetch schema */
    connect(): Promise<void>;
    /** Current connection status */
    status(): ConnectionStatus;
    /** Loaded schema (null until connected) */
    schema(): EngineSchema | null;
    /** Number of available methods */
    methodCount(): number;
    /** Number of distinct API namespaces */
    apiCount(): number;
    /** Sorted list of API namespace names */
    apiNames(): string[];

    /** Call an API method by path (e.g. "/api/QueryCapsuleSpineModel/getCapsule") */
    call(path: string, args?: Record<string, string>): Promise<any>;
    /** Call an API method with positional args */
    callRaw(path: string, args?: any[]): Promise<any>;
}

export interface SpineInstance {
    $id: string;
    capsuleName?: string;
    filepath?: string;
    capsuleSourceLineRef?: string;
}
