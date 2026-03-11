> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# Memory-v0 Engine — Model Reference

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
    Capsule:          { [scopedRef: string]: CapsuleRecord },
    CapsuleSource:    { [id: string]: CapsuleSourceRecord },
    SpineContract:    { [id: string]: SpineContractRecord },
    PropertyContract: { [id: string]: PropertyContractRecord },
    CapsuleProperty:  { [id: string]: CapsulePropertyRecord },
    CapsuleInstance:  { [instanceId: string]: CapsuleInstanceRecord },
    MembraneEvent:    { [id: string]: MembraneEventRecord },
}
```

Each node table is a `Record<string, object>` keyed by primary key.
`mergeNode(table, pk, data)` shallow-merges into `nodes[table][pk]`.

### Node Record Shapes

| Table | PK / Dict Key | Key Fields |
|-------|---------------|------------|
| **Capsule** | `scopedRef` (`<spineInstanceTreeId>::<absoluteCapsuleLineRef>`) | `capsuleName`, `capsuleSourceLineRef`, `spineInstanceTreeId`, `cstFileUri`, `capsuleSourceNameRef`, `capsuleSourceNameRefHash`, `capsuleSourceUriLineRef`, `cacheBustVersion` |
| **CapsuleInstance** | `instanceId` | `capsuleName`, `capsuleSourceUriLineRef`, `spineInstanceTreeId` |
| **MembraneEvent** | `id` (`<treeId>::evt::<eventIndex>`) | `eventIndex`, `eventType` (`call`/`call-result`/`get`/`set`), `membrane` (`external`/`internal`), `capsuleSourceLineRef`, `capsuleSourceNameRef`, `propertyName`, `callerFilepath`, `callerLine`, `callEventIndex`, `spineInstanceTreeId` |
| **CapsuleSource** | `id` (`<lineRef>::source`) | `capsuleSourceLineRef`, `moduleFilepath`, `moduleUri`, `capsuleName`, `declarationLine`, `importStackLine`, `definitionStartLine`, `definitionEndLine`, `optionsStartLine`, `optionsEndLine`, `extendsCapsule`, `extendsCapsuleUri` |
| **SpineContract** | `id` (`<lineRef>::spine::<uri>`) | `contractUri`, `capsuleSourceLineRef` |
| **PropertyContract** | `id` (`<lineRef>::pc::<spine>::<key>`) | `contractKey`, `propertyContractUri`, `capsuleSourceLineRef`, `spineContractId`, `options` |
| **CapsuleProperty** | `id` (`<lineRef>::prop::<name>`) | `name`, `propertyType`, `valueType`, `valueExpression`, `mappedModuleUri`, `declarationLine`, `definitionStartLine`, `definitionEndLine`, `propertyContractDelegate`, `capsuleSourceLineRef`, `propertyContractId` |

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
    INSTANCE_OF:            Edge[],
    PARENT_INSTANCE:        Edge[],
    HAS_MEMBRANE_EVENT:     Edge[],
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
| **HAS_MEMBRANE_EVENT** | Capsule → MembraneEvent | Links a capsule to its runtime membrane events |

---

## G2. Data Flow: CST → Memory

### CST Structure (from static-analyzer.v0)

Each `.csts.json` file contains entries keyed by `capsuleSourceLineRef`:

```json
{
  "<capsuleSourceLineRef>": {
    "cacheBustVersion": 20,
    "capsuleSourceNameRef": "<filepath>:<capsuleName>",
    "capsuleSourceNameRefHash": "<sha256>",
    "capsuleSourceUriLineRef": "<npmUri>:<line>",
    "source": {
      "moduleFilepath": "relative/path.ts",
      "moduleUri": "@scope/pkg/path",
      "capsuleName": "@scope/pkg/path",
      "declarationLine": 9,
      "importStackLine": 19,
      "definitionStartLine": 9,
      "definitionEndLine": 17,
      "optionsStartLine": 18,
      "optionsEndLine": 20,
      "extendsCapsule": "rawValue",
      "extendsCapsuleUri": "@scope/pkg/parent",
      "capsuleExpression": "encapsulate({...})"
    },
    "spineContracts": {
      "#<spineContractUri>": {
        "propertyContracts": {
          "#<propertyContractUri>": {
            "propertyContractUri": "RESOLVED npm URI",
            "as": "optionalAlias",
            "options": { "#": { "label": "...", "parentColumn": "@scope/..." } },
            "properties": {
              "<propName>": {
                "type": "CapsulePropertyTypes.Mapping",
                "valueType": "string",
                "valueExpression": "\"@scope/pkg/target\"",
                "mappedModuleUri": "RESOLVED npm URI",
                "propertyContractDelegate": "#@scope/pkg/struct",
                "options": { "#": { "key": "value" } },
                "declarationLine": 10,
                "definitionStartLine": 10,
                "definitionEndLine": 15
              }
            }
          }
        }
      }
    }
  }
}
```

### Key CST Invariants

- All `propertyContractUri`, `mappedModuleUri`, `propertyContractDelegate` values
  are **fully resolved npm URIs** (no relative paths like `../foo`).
- Property contract keys (e.g., `#@scope/pkg/schema/Column`) are also resolved.
- `options` on property contracts are stored as raw JS objects when declared
  as literal objects in source (not function callbacks).
- String values inside literal options that look like relative paths
  (starting with `./` or `../`) are also resolved to npm URIs.

### Import Pipeline (ImportAPI.ts)

1. **`importSitFile(sitFilePath, opts?)`** — entry point for spine instance tree import
   - If `opts.reset` is set, clears `_conn` and `_schemaCreated` to start fresh
   - Reads `.sit.json` file containing `rootCapsule`, `capsules`, and `capsuleInstances`
   - Extracts `spineInstanceTreeId` from `capsuleInstances[rootCapsule.capsuleSourceUriLineRefInstanceId].capsuleName`
   - For each capsule: resolves `.csts.json` file path (local then npm fallback) and imports via `importCstFile`
   - Calls `_importCapsuleInstances()` to create instance nodes and relationships
   - Returns `{ imported, capsules, instances }`
2. **`importSitDirectory(dirPath)`** — recursively scans for `.sit.json` files
3. **`_importCapsuleInstances(sit, spineInstanceTreeId)`** — per-sit:
   - Creates `CapsuleInstance` nodes for each entry in `capsuleInstances`
   - Creates `INSTANCE_OF` edges linking instances to their capsule definitions (matched by `spineInstanceTreeId` + `capsuleName`)
   - Creates `PARENT_INSTANCE` edges based on `parentCapsuleSourceUriLineRefInstanceId`
4. **`linkMappings()`** — post-import bulk edge creation:
   - Builds two lookup maps: `capByNameAndTree` and `capByModuleUriAndTree`
   - `MAPS_TO`: matches `CapsuleProperty.mappedModuleUri` → Capsule in same tree (by `capsuleName` or `CapsuleSource.moduleUri`)
   - `EXTENDS`: matches `CapsuleSource.extendsCapsuleUri` → Capsule in same tree (by `capsuleName` or `CapsuleSource.moduleUri`)
5. **`importCstDirectory(dirPath)`** — @deprecated, use `importSitDirectory` instead

### Key Invariants

- Node data is **shallow-merged** — later imports update existing records without removing fields.
- Edges are **deduplicated** — same (rel, from, to) is never stored twice.
- `options` on `PropertyContract` is stored as the **original JS object** (not serialized).
- Capsule nodes are **scoped by spineInstanceTreeId** — the dict key is `<treeId>::<absoluteLineRef>`, ensuring each tree gets its own copy of shared capsules (e.g. `structs/Capsule`).

---

## G3. Query Methods

All queries are implemented as `_`-prefixed methods in `QueryAPI.ts`. The public API in `ModelQueryMethods.ts` delegates to these. All methods require `spineInstanceTreeId` as the first argument.

| Method | Signature | Returns |
|--------|-----------|---------|
| `listCapsules(spineInstanceTreeId)` | Required tree filter | `[{ capsuleName, capsuleSourceLineRef }]` sorted by `capsuleName` |
| `getCapsuleWithSource(spineInstanceTreeId, capsuleName)` | By tree + capsule name | `{ cap, source }` or `null` |
| `getCapsuleSpineTree_data(spineInstanceTreeId, capsuleSourceLineRef)` | Full spine tree for a capsule | `[{ s, pc, p }]` rows sorted by `contractUri`, `contractKey`, `name` |
| `getCapsuleNamesBySpineTree(spineInstanceTreeId)` | All capsule names in tree | `string[]` sorted |
| `fetchCapsuleRelations(spineInstanceTreeId, capsuleNames[])` | Batch relations | `{ mappings, extends, found, properties, capsuleInfo }` |
| `listSpineInstanceTrees(spineInstanceTreeId?)` | With filter: all capsules in tree; without: distinct trees | `[{ spineInstanceTreeId, capsuleName, capsuleSourceLineRef, capsuleSourceUriLineRef }]` |
| `getInstancesBySpineTree(spineInstanceTreeId)` | All instances in tree | `[{ instanceId, capsuleName, capsuleSourceUriLineRef }]` sorted by `capsuleName` |
| `getRootInstance(spineInstanceTreeId)` | Root instance (no `PARENT_INSTANCE` edge) | `{ instanceId, capsuleName, capsuleSourceUriLineRef }` or `null` |
| `getChildInstances(parentInstanceId)` | Children of an instance | `[{ instanceId, capsuleName, capsuleSourceUriLineRef }]` sorted by `capsuleName` |
| `fetchInstanceRelations(spineInstanceTreeId)` | Batch instance data | `{ instances, parentMap, capsuleInfo }` |
| `getMembraneEvents(spineInstanceTreeId)` | All events in tree | `MembraneEventRecord[]` sorted by `eventIndex` |
| `getMembraneEventsByCapsule(spineInstanceTreeId, capsuleName)` | Events for one capsule | `MembraneEventRecord[]` sorted by `eventIndex` |

### Query Implementation Pattern

All queries follow the same pattern:
1. Get `conn` via `this._ensureConnection()`
2. Filter/traverse `conn.nodes` and `conn.edges` using `Object.values()`, `Array.filter()`, `Array.find()`
3. Return shaped results matching the engine-agnostic interface

### `fetchCapsuleRelations` Return Shape

```typescript
{
  mappings: Record<string, { propName, target, delegate }[]>,  // sorted by propName
  extends: Record<string, string>,
  found: Set<string>,
  properties: Record<string, {
    propName, propertyType, propertyContract,
    propertyContractUri, propertyContractDelegate,
    valueExpression, pcOptions
  }[]>,  // sorted by propName
  capsuleInfo: Record<string, {
    capsuleSourceLineRef, capsuleSourceNameRef
  }>
}
```

### `fetchInstanceRelations` Return Shape

```typescript
{
  instances: Record<string, { instanceId, capsuleName, capsuleSourceUriLineRef }>,
  parentMap: Record<string, string>,  // childInstanceId → parentInstanceId
  capsuleInfo: Record<string, { capsuleName, capsuleSourceLineRef, capsuleSourceUriLineRef }>
}
```

---

## G4. Relationship Patterns

### Pattern A: Capsule Mapping (parent maps child)
```
Capsule → IMPLEMENTS_SPINE → SpineContract
  → HAS_PROPERTY_CONTRACT → PropertyContract → HAS_PROPERTY → CapsuleProperty {type: Mapping}
    → MAPS_TO → Capsule (child)
```
- **Use case**: Root capsule maps LoginService, DataService, PaymentService.
- **Query**: `fetchCapsuleRelations` → `mappings[rootName]` gives `{ target: childName }`.

### Pattern B: Capsule Extends (inheritance)
```
Capsule (child) → EXTENDS → Capsule (parent)
```
- **Use case**: Capsule inherits properties from a parent capsule.
- **Query**: `fetchCapsuleRelations` → `extends[childName]` gives parent name.

### Pattern C: Struct Dependency
```
Capsule → ... → CapsuleProperty {propertyContractDelegate: "#<schemaUri>"}
  → MAPS_TO → Capsule (schema)
```
- **Use case**: Column capsule declares dependency on `schema/Column`.
- **Query via mappings**: entries with `delegate` field set.

### Pattern D: Struct Options (metadata on a struct dependency)
- **Storage**: Options stored as raw JS object in `PropertyContract.options` field.
- **Access**: Available directly (no parsing needed, unlike SqLite/Ladybug which store serialized STRING).

### Pattern E: Membrane Event Capture
```
Capsule → HAS_MEMBRANE_EVENT → MembraneEvent {eventType: 'call', propertyName: 'submit', ...}
```
- **Use case**: Tracking runtime execution flow through capsule membranes.
- **Data flow**: `standalone-rt` captures events with `captureEvents: true` → `.events.json` written alongside `.sit.json` → `SpineInstanceTrees` imports via `engine.importMembraneEvents()`.
- **Query**: `getMembraneEvents(treeId)` returns all events sorted by `eventIndex`.
- **L6 API**: `getEventLog(treeId)` resolves call/call-result pairs and tracks active invocations.
- **L8 API**: `getSwimlaneView(treeId)` returns `SwimlaneView` with columns (capsules) and rows (events).

### Pattern F: Element-to-Column Tagging
```
Capsule (element) → ... → CapsuleProperty {delegate: "#<columnUri>"} → MAPS_TO → Capsule (column)
```
- **Use case**: Element capsule tags a column capsule.
- **Query**: Reverse lookup via mappings.

---

## G5. Characteristics

- **Ephemeral**: All data is lost when the process exits.
- **No persistence**: No disk I/O for data storage.
- **No schema enforcement**: Any key can be stored; no column constraints.
- **Fast**: All operations are direct JS object lookups/iterations.
- **No dependencies**: Pure JavaScript, no external packages.

---

## G6. Instructions for Future AI Sessions

### When modifying the schema:
1. Update `_ensureConnection` in `QueryAPI.ts` if adding new node/edge tables.
2. Update import logic in `ImportAPI.ts`.
3. Update query methods in `QueryAPI.ts`.
4. All four engines (Memory, JsonFiles, SqLite, Ladybug) MUST return identical data shapes.

### When adding new query capabilities:
1. Prefer adding data to `fetchCapsuleRelations` return value over new methods.
2. If a new edge type is needed, add it to the `_conn.edges` initialization in `_ensureConnection`.
3. Always test with all engines to ensure parity.

### When working on model APIs:
1. APIs receive the engine instance as first argument.
2. APIs should be **engine-agnostic** — only use methods defined in ModelQueryMethods.
3. Use `fetchCapsuleRelations` for bulk data, avoid per-capsule queries in loops.
4. The API layer handles shaping/composition; the engine handles raw queries.

### Key file locations:
- **Memory engine**: `engines/Memory-v0/` (QueryAPI.ts, ImportAPI.ts)
- **JsonFiles engine**: `engines/JsonFiles-v0/` (QueryAPI.ts, ImportAPI.ts)
- **SQLite engine**: `engines/SqLite-v0/` (QueryAPI.ts, ImportAPI.ts)
- **Ladybug engine**: `engines/Ladybug-v0/` (QueryAPI.ts, ImportAPI.ts)

### CST regeneration:
- CSTs are cached in `.~o/encapsulate.dev/static-analysis/` directories.
- Delete cached CSTs to force regeneration after changing the static analyzer.
- The static analyzer is at `encapsulate.dev/packages/encapsulate/src/static-analyzer.v0.ts`.
