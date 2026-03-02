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
