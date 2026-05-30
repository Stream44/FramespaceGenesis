> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# Capsule Memory Engine — Model Reference

> This section describes the Capsule in-memory data model, import pipeline,
> and query patterns for the Memory engine. It serves as a reference for AI
> assistants and developers working on model APIs that query this store.

---

## G1. In-Memory Data Structure

The Memory engine stores all data in a single plain JavaScript object (`_conn`)
with two top-level keys: `nodes` and `edges`.

### Node Store

```typescript
_conn.nodes = {
    Capsule:          { [capsuleSourceLineRef: string]: CapsuleRecord },
    CapsuleSource:    { [id: string]: CapsuleSourceRecord },
    SpineContract:    { [id: string]: SpineContractRecord },
    PropertyContract: { [id: string]: PropertyContractRecord },
    CapsuleProperty:  { [id: string]: CapsulePropertyRecord },
}
```

Each node table is a `Record<string, object>` keyed by primary key.
`mergeNode(table, pk, data)` shallow-merges into `nodes[table][pk]`.

### Node Record Shapes

| Table | PK Field | Key Fields |
|-------|----------|------------|
| **Capsule** | `capsuleSourceLineRef` | `capsuleName`, `spineInstanceTreeId`, `cstFilepath`, `capsuleSourceNameRef`, `capsuleSourceNameRefHash`, `capsuleSourceUriLineRef`, `cacheBustVersion` |
| **CapsuleInstance** | `instanceId` | `capsuleName`, `capsuleSourceUriLineRef`, `spineInstanceTreeId` |
| **CapsuleSource** | `id` (`<lineRef>::source`) | `moduleFilepath`, `moduleUri`, `capsuleName`, `declarationLine`, `importStackLine`, `definitionStartLine`, `definitionEndLine`, `extendsCapsule`, `extendsCapsuleUri` |
| **SpineContract** | `id` (`<lineRef>::spine::<uri>`) | `contractUri`, `capsuleSourceLineRef` |
| **PropertyContract** | `id` (`<lineRef>::pc::<spine>::<key>`) | `contractKey`, `propertyContractUri`, `capsuleSourceLineRef`, `spineContractId`, `options` |
| **CapsuleProperty** | `id` (`<lineRef>::prop::<name>`) | `name`, `propertyType`, `valueType`, `valueExpression`, `mappedModuleUri`, `propertyContractDelegate` |

### Edge Store

```typescript
_conn.edges = {
    HAS_SOURCE:             Edge[],
    IMPLEMENTS_SPINE:       Edge[],
    HAS_PROPERTY_CONTRACT:  Edge[],
    HAS_PROPERTY:           Edge[],
    MAPS_TO:                Edge[],
    EXTENDS:                Edge[],
    DELEGATES_TO:           Edge[],
}
```

Each edge is stored as:
```typescript
{ fromTable: string, from: string, toTable: string, to: string }
```

`mergeEdge(rel, fromTable, fromPk, toTable, toPk)` appends only if no duplicate exists
(checked by matching all four fields).

### Edge Meanings

| Edge | from → to | Meaning |
|------|-----------|---------|
| **HAS_SOURCE** | Capsule → CapsuleSource | Links capsule identity to source metadata |
| **IMPLEMENTS_SPINE** | Capsule → SpineContract | Capsule implements a spine contract |
| **HAS_PROPERTY_CONTRACT** | SpineContract → PropertyContract | Spine contains property contract groups |
| **HAS_PROPERTY** | PropertyContract → CapsuleProperty | Property contract contains properties |
| **MAPS_TO** | CapsuleProperty → Capsule | Mapping property resolves to target capsule |
| **EXTENDS** | Capsule → Capsule | Child extends parent capsule |
| **DELEGATES_TO** | CapsuleProperty → PropertyContract | Delegate property points to source contract |
| **INSTANCE_OF** | CapsuleInstance → Capsule | Links a runtime instance to its capsule definition |
| **PARENT_INSTANCE** | CapsuleInstance → CapsuleInstance | Links a child instance to its parent instance in the tree |

---

## G2. Data Flow: SIT → Memory

### Import Pipeline (ImportCapsuleSourceTrees)

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

### Key Invariants

- Node data is **shallow-merged** — later imports update existing records without removing fields.
- Edges are **deduplicated** — same (rel, from, to) is never stored twice.
- `options` on `PropertyContract` is stored as the **original JS object** (not serialized).

---

## G3. EngineAPI Query Methods

| Method | Signature | Returns |
|--------|-----------|---------|
| `listCapsules(spineInstanceTreeId?)` | Optional filter by tree | `[{ capsuleName, capsuleSourceLineRef }]` |
| `getCapsuleWithSource(capsuleName)` | By capsule name | `{ cap, source }` or `null` |
| `getCapsuleSpineTree_data(lineRef)` | Full spine tree | `[{ s, pc, p }]` rows |
| `getCapsuleNamesBySpineTree(treeId)` | All capsules in tree | `string[]` |
| `fetchCapsuleRelations(names[])` | Batch relations | `{ mappings, extends, found, properties, capsuleInfo }` |
| `listSpineInstanceTrees()` | All spine instance trees | `[{ spineInstanceTreeId, capsuleName, capsuleSourceLineRef }]` |
| `getInstancesBySpineTree(treeId)` | All instances in tree | `[{ instanceId, capsuleName, capsuleSourceUriLineRef }]` |
| `getRootInstance(treeId)` | Root instance of tree | `{ instanceId, capsuleName, ... }` or `null` |
| `getChildInstances(instanceId)` | Child instances | `[{ instanceId, capsuleName, ... }]` |
| `fetchInstanceRelations(treeId)` | Batch instance data | `{ instances, parentMap, capsuleInfo }` |

### Query Implementation Pattern

All queries follow the same pattern:
1. Get `conn` via `this._ensureConnection()`
2. Filter/traverse `conn.nodes` and `conn.edges` using `Object.values()`, `Array.filter()`, `Array.find()`
3. Return shaped results matching the engine-agnostic interface

### `fetchCapsuleRelations` Return Shape

```typescript
{
  mappings: Record<string, { propName, target, delegate }[]>,
  extends: Record<string, string>,
  found: Set<string>,
  properties: Record<string, {
    propName, propertyType, propertyContract,
    propertyContractUri, propertyContractDelegate,
    valueExpression, pcOptions
  }[]>,
  capsuleInfo: Record<string, {
    capsuleSourceLineRef, capsuleSourceNameRef
  }>
}
```

---

## G4. Characteristics

- **Ephemeral**: All data is lost when the process exits.
- **No persistence**: No disk I/O for data storage.
- **No schema enforcement**: Any key can be stored; no column constraints.
- **Fast**: All operations are direct JS object lookups/iterations.
- **No dependencies**: Pure JavaScript, no external packages.

---

## G5. Instructions for Future AI Sessions

### When modifying the schema:
1. Update `_ensureConnection` if adding new node/edge tables.
2. Update import logic in `ImportCapsuleSourceTrees.ts`.
3. Update query methods in `EngineAPI.ts`.
4. All engines (Memory, JsonFiles, Ladybug, SqLite) MUST return identical data shapes.

### When adding new query capabilities:
1. Prefer adding data to `fetchCapsuleRelations` return value over new methods.
2. If a new edge type is needed, add it to the `_conn.edges` initialization.
3. Always test with all engines to ensure parity.

### Key file locations:
- **Memory engine**: `engines/Capsule-Memory-v0/` (EngineAPI.ts, ImportCapsuleSourceTrees.ts)
- **JsonFiles engine**: `engines/Capsule-JsonFiles-v0/` (disk-based JSON)
- **SQLite engine**: `engines/Capsule-SqLite-v0/` (bun:sqlite)
- **Ladybug engine**: `engines/Capsule-Ladybug-v0/` (graph DB)
