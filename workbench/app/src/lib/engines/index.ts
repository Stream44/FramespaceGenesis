// ── Engine registry ──────────────────────────────────────────────────
// Central registry of all engine clients. The workbench connects to
// each engine on startup and exposes their clients to visualizations.

export type { EngineClient, EngineSchema, EndpointDef, ApiDef, ArgDef, ConnectionStatus, SpineInstance } from "./types";
export { createCapsuleLadybugClient } from "./CapsuleLadybugClient";
