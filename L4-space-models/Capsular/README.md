Capsular Space Model
===

The **Capsular** space model is a graph of [Encapsulate](https://github.com/Stream44/encapsulate) *Spine Instance Trees*, *Capsule Source Trees* and *Membrane Events*. It defines an import and query API backed by pluggable storage engines.

## Engines

- **Memory-v0** — Ephemeral in-memory JS object store. No persistence. Ideal for testing.
- **JsonFiles-v0** — Disk-based JSON files. Reads fresh from disk per query, writes flush immediately. No external dependencies.
- **SqLite-v0** — [Bun SQLite](https://bun.sh/docs/api/sqlite) database.
- **Ladybug-v0** — [LadybugDB](https://ladybugdb.com/) embedded graph database. Cypher queries against an in-memory instance.

## Layout

The space model is implemented using capsules and arranged for complexity expansion, optimization and rapid development with AI.

```
Capsular/
├─ ModelEngines.ts               — Maps all engines, provides setActiveEngine / getEngine / getEngineNames
├─ ModelQueryMethods.ts          — Public query API capsule (extends Engine)
├─ ModelQueryMethodTests.ts      — Snapshot-based test helper (extends ModelQueryMethods)
├─ ModelQueryMethods.test.ts     — Discovers all examples, runs runModel + makeTests across all engines
├─ SpineInstanceTrees.ts         — Capsule for registering model instances (registerInstance / getModels)
├─ _ModelQueryMethodsSchema.json — Generated API schema (written by init)
├─ engines/
│  └─ <engine>/
│       ├─ QueryAPI.ts           — Engine-specific _-prefixed implementations
│       └─ ImportAPI.ts          — Import/ingestion logic (extends QueryAPI)
└─ examples/
   └─ 02-TreeRelationships/
        ├─ 0x-<Name>.ts          — Source file exporting MODEL_NAME and runModel
        ├─ 0x-<Name>.test.ts     — Independent test per tree relationship pattern
        ├─ caps/                 — Shared capsule definitions used by examples
        └─ structs/              — Shared struct definitions used by examples
```

Each example has a source file (`0x-<Name>.ts`) that exports `MODEL_NAME` and `runModel`, and a corresponding test file (`0x-<Name>.test.ts`) that imports them, registers the instance, and runs `modelQueryMethodTests.makeTests`. The top-level `ModelQueryMethods.test.ts` dynamically discovers all source files and runs them across all engines.

## Engine Details

All engines implement the same capsule space model — a graph of **Capsule** nodes (identity records scoped by spine instance tree), **CapsuleSource** (file metadata), **SpineContract** / **PropertyContract** / **CapsuleProperty** (the contract tree), and **CapsuleInstance** (runtime instances). They are connected by nine edge types: `HAS_SOURCE`, `IMPLEMENTS_SPINE`, `HAS_PROPERTY_CONTRACT`, `HAS_PROPERTY`, `MAPS_TO`, `EXTENDS`, `DELEGATES_TO`, `INSTANCE_OF`, `PARENT_INSTANCE`.

Each engine provides:

- **Import pipeline** — `importSitFile` reads `.sit.json` files, resolves `.csts.json` files, creates all nodes and edges, then `linkMappings` bulk-creates `MAPS_TO` and `EXTENDS` edges by matching `capsuleName` or `moduleUri` within the same spine instance tree.
- **Query API** — 10 `_`-prefixed methods (`_listCapsules`, `_getCapsuleWithSource`, `_getCapsuleSpineTree_data`, `_getCapsuleNamesBySpineTree`, `_fetchCapsuleRelations`, `_listSpineInstanceTrees`, `_getInstancesBySpineTree`, `_getRootInstance`, `_getChildInstances`, `_fetchInstanceRelations`) that the public `ModelQueryMethods` capsule delegates to.

The engines differ only in their storage backend. All must return identical data shapes for cross-engine interchangeability.

| Engine | Storage | Mutation | Notes |
|--------|---------|----------|-------|
| **[Memory-v0](engines/Memory-v0/AI-MODEL-REFERENCE.md)** | JS object (`{ nodes, edges }`) | Shallow merge (`{ ...existing, ...data }`) | Ephemeral. Options stored as raw JS objects. |
| **[JsonFiles-v0](engines/JsonFiles-v0/AI-MODEL-REFERENCE.md)** | Disk JSON files per node/edge table | Shallow merge via read-modify-write | Persistent. Options stored as raw JS objects (serialized to JSON on disk). |
| **[SqLite-v0](engines/SqLite-v0/AI-MODEL-REFERENCE.md)** | `bun:sqlite` WAL-mode database | `INSERT OR REPLACE` (full row) | Persistent. Options stored as JSON TEXT string. |
| **[Ladybug-v0](engines/Ladybug-v0/AI-MODEL-REFERENCE.md)** | LadybugDB in-memory graph (`lbug`) | Cypher `MERGE` with `ON CREATE/MATCH SET` | Ephemeral. Cypher queries. Stores `moduleUri` on Capsule node (stripped on output). |

## Test Architecture

The test system ensures rapid per-engine development and cross-engine consistency. It is structured in three layers.

### 1. Per-Example Tests (`examples/**/0x-<Name>.test.ts`)

Each example has its own test file that:

- Registers capsule instances via `spineInstanceTrees.registerInstance`
- Imports to the active engine via `spineInstanceTrees.importInstanceToEngine`
- Calls `modelQueryMethodTests.makeTests` which auto-discovers all public query methods from `ModelQueryMethods` and runs each with snapshot matching (`expectSnapshotMatch`)
- Optionally includes documentation snapshot tests for SIT/CST data with URI remapping and volatile field stripping

These tests run against the currently active engine and are ideal for rapid development of a single engine.

### 2. Multi-Instance Accumulated Tests (`ModelQueryMethods.test.ts` — Block 2)

After the isolated block, **all** example models are imported into the same engine instance (reset once, then accumulate). The same queries are re-run per model:

- **Instance-level methods** (`getInstancesBySpineTree`, `getRootInstance`, `getChildInstances`, `fetchInstanceRelations`) — must match isolated results exactly, since instances are scoped by `spineInstanceTreeId` and never shared.
- **Capsule-level methods** (`listCapsules`, `getCapsuleNamesBySpineTree`, `listSpineInstanceTrees`, `fetchCapsuleRelations`) — verified as **superset** of isolated results, because shared capsule nodes (e.g. `structs/Capsule`) may have their `spineInstanceTreeId` overwritten by the last import.

This tests engine performance under accumulated data and validates data isolation guarantees.

### 3. Cross-Engine Comparison (`ModelQueryMethods.test.ts` — Block 3)

After all engines have completed their isolated runs, isolated results are compared across engines:

- The first engine is used as reference.
- For every model + method combination, each other engine's normalized result must `toEqual` the reference.
- This guarantees that all engines are fully interchangeable.

### Test Code Summary

| File | Purpose |
|------|---------|
| `ModelQueryMethodTests.ts` | Capsule that extends `ModelQueryMethods`. Exposes `makeTests(opts)` which auto-discovers public query methods via `Object.keys(this)`, calls each with `spineInstanceTreeId` + optional config args, and asserts via `expectSnapshotMatch(normalize(result))`. |
| `ModelQueryMethods.test.ts` | Top-level test runner. Discovers all `examples/**/0x-*.ts` modules exporting `MODEL_NAME` + `runModel`. For each engine: (1) isolated block — reset + import per model, run `makeTests`, capture results; (2) accumulated block — import all models, verify instance-exact and capsule-superset; (3) cross-engine block — compare isolated results across all engines via `toEqual`. |
| `examples/**/0x-<Name>.test.ts` | Per-example test. Registers instance, imports to engine, calls `makeTests`. May include documentation snapshot tests for raw SIT/CST data with path normalization. |
