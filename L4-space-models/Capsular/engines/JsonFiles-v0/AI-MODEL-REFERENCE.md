# Capsule-JsonFiles-v0 — AI Model Reference

## Overview

Disk-based JSON file engine. Every node table and edge table is stored as a separate `.json` file. Every read goes to disk — no in-memory caching. Every write flushes immediately.

## Data Directory

```
.~o/framespace.dev/data/engines/Capsule-JsonFiles-v0/
├── nodes/
│   ├── Capsule.json
│   ├── CapsuleSource.json
│   ├── SpineContract.json
│   ├── PropertyContract.json
│   └── CapsuleProperty.json
└── edges/
    ├── HAS_SOURCE.json
    ├── IMPLEMENTS_SPINE.json
    ├── HAS_PROPERTY_CONTRACT.json
    ├── HAS_PROPERTY.json
    ├── MAPS_TO.json
    ├── EXTENDS.json
    └── DELEGATES_TO.json
```

The base path is derived from `moduleFilepath` of the root capsule, matching the SQLite engine convention.

## File Formats

### Node Files (`nodes/<Table>.json`)

```json
{
  "<primaryKey>": { "field1": "value", "field2": 42, ... },
  "<primaryKey>": { ... }
}
```

A dictionary keyed by the node's primary key. For `Capsule`, the PK is `capsuleSourceLineRef`. For others, it is a composite ID string (e.g. `<lineRef>::source`, `<lineRef>::spine::<uri>`).

### Edge Files (`edges/<Rel>.json`)

```json
[
  { "fromTable": "Capsule", "from": "<pk>", "toTable": "CapsuleSource", "to": "<pk>" },
  ...
]
```

An array of directed edge objects. Duplicates are prevented by `mergeEdge`.

## Node Tables

| Table              | Primary Key                          | Key Fields                                                    |
|--------------------|--------------------------------------|---------------------------------------------------------------|
| `Capsule`          | `capsuleSourceLineRef`               | capsuleName, spineInstanceTreeId, cstFilepath                 |
| `CapsuleInstance`  | `instanceId`                         | capsuleName, capsuleSourceUriLineRef, spineInstanceTreeId     |
| `CapsuleSource`    | `<lineRef>::source`                  | moduleFilepath, moduleUri, capsuleName, extendsCapsuleUri     |
| `SpineContract`    | `<lineRef>::spine::<uri>`            | contractUri                                                   |
| `PropertyContract` | `<lineRef>::pc::<spine>::<key>`      | contractKey, propertyContractUri, options (object or null)    |
| `CapsuleProperty`  | `<lineRef>::prop::<name>`            | name, propertyType, valueExpression, mappedModuleUri          |

## Edge Tables

| Relationship            | From               | To                 |
|-------------------------|--------------------|--------------------|
| `HAS_SOURCE`            | Capsule            | CapsuleSource      |
| `IMPLEMENTS_SPINE`      | Capsule            | SpineContract      |
| `HAS_PROPERTY_CONTRACT` | SpineContract      | PropertyContract   |
| `HAS_PROPERTY`          | PropertyContract   | CapsuleProperty    |
| `MAPS_TO`               | CapsuleProperty    | Capsule            |
| `EXTENDS`               | Capsule            | Capsule            |
| `DELEGATES_TO`          | CapsuleProperty    | PropertyContract   |
| `INSTANCE_OF`           | CapsuleInstance    | Capsule            |
| `PARENT_INSTANCE`       | CapsuleInstance    | CapsuleInstance    |

## I/O Primitives

| Method             | Behaviour                                      |
|--------------------|-------------------------------------------------|
| `_readNodeTable`   | Reads `nodes/<T>.json` from disk; returns `{}`  if missing |
| `_writeNodeTable`  | Writes full table dict to `nodes/<T>.json`      |
| `_readEdgeTable`   | Reads `edges/<R>.json` from disk; returns `[]`  if missing |
| `_writeEdgeTable`  | Writes full edge array to `edges/<R>.json`      |
| `mergeNode`        | Read → merge → write (single node table file)   |
| `mergeEdge`        | Read → dedup-check → append → write             |

## Schema Lifecycle

`ensureSchema()` clears the `nodes/` and `edges/` directories to guarantee a fresh state, then recreates them. This prevents stale data from prior runs.

## Import Pipeline

1. **`importSitFile(sitFilePath)`** — entry point for spine instance tree import
   - Reads `.sit.json` file containing `rootCapsule`, `capsules`, and `capsuleInstances`
   - Extracts `spineInstanceTreeId` from `rootCapsule.capsuleSourceUriLineRef`
   - For each capsule: finds corresponding `.csts.json` file and imports via `importCstFile`
   - Calls `_importCapsuleInstances()` to create instance nodes and relationships
2. **`importSitDirectory(dirPath)`** — recursively scans for `.sit.json` files
3. **`_importCapsuleInstances(sit, spineInstanceTreeId)`** — per-sit:
   - Creates `CapsuleInstance` nodes for each entry in `capsuleInstances`
   - Creates `INSTANCE_OF` edges linking instances to their capsule definitions
   - Creates `PARENT_INSTANCE` edges based on `parentCapsuleSourceUriLineRefInstanceId`
4. **`linkMappings()`** — post-import bulk edge creation:
   - `MAPS_TO`: matches `CapsuleProperty.mappedModuleUri` → `Capsule.capsuleName`
   - `EXTENDS`: matches `CapsuleSource.extendsCapsuleUri` → `Capsule.capsuleName`

## Query Methods

All query methods read fresh from disk on every call.

| Method                    | Returns                                              |
|---------------------------|------------------------------------------------------|
| `listCapsules(spineInstanceTreeId?)`  | `[{ capsuleName, capsuleSourceLineRef }]`            |
| `getCapsuleWithSource(capsuleName)`   | `{ cap, source }` or `null`                          |
| `getCapsuleSpineTree_data(lineRef)`   | `[{ s, pc, p }]` — spine → contract → property rows |
| `getCapsuleNamesBySpineTree(treeId)`  | `string[]` — capsule names for a spine instance tree |
| `fetchCapsuleRelations(names[])`      | `{ mappings, extends, found, properties, capsuleInfo }` |
| `listSpineInstanceTrees()`            | `[{ spineInstanceTreeId, capsuleName, capsuleSourceLineRef }]` |
| `getInstancesBySpineTree(treeId)`     | `[{ instanceId, capsuleName, capsuleSourceUriLineRef }]` |
| `getRootInstance(treeId)`             | `{ instanceId, capsuleName, ... }` or `null`         |
| `getChildInstances(instanceId)`       | `[{ instanceId, capsuleName, ... }]`                 |
| `fetchInstanceRelations(treeId)`      | `{ instances, parentMap, capsuleInfo }`              |

## Key Characteristics

- **No caching**: every query performs fresh disk reads
- **Immediate writes**: `mergeNode`/`mergeEdge` flush to disk on every call
- **Human-readable**: JSON files can be inspected directly
- **Portable**: no external database dependencies
- **Trade-off**: slower than in-memory or SQLite for large datasets due to repeated disk I/O

## Differences from Capsule-Memory-v0

| Aspect      | JsonFiles                  | Memory                     |
|-------------|----------------------------|----------------------------|
| Storage     | JSON files on disk          | JS objects in memory       |
| Persistence | Survives process restart    | Ephemeral                  |
| Caching     | None — fresh reads          | Inherent (in-memory)       |
| Performance | Disk I/O bound              | Fast (RAM)                 |
| Use case    | Lightweight persistence     | Testing, transient analysis|
