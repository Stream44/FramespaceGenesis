> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# JsonFiles-v0 Engine — Model Reference

> Disk-based JSON file engine. Every node table and edge table is stored as a separate
> `.json` file. Every read goes to disk — no in-memory caching. Every write flushes immediately.
> It serves as a reference for AI assistants and developers working on model APIs that query this store.

---

## G1. Data Directory & File Structure

```
.~o/framespace.dev/data/engines/JsonFiles-v0/
├── nodes/
│   ├── Capsule.json
│   ├── CapsuleSource.json
│   ├── CapsuleInstance.json
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
    ├── DELEGATES_TO.json
    ├── INSTANCE_OF.json
    └── PARENT_INSTANCE.json
```

The base path is derived from `moduleFilepath` of the root capsule.

### File Formats

#### Node Files (`nodes/<Table>.json`)

```json
{
  "<primaryKey>": { "field1": "value", "field2": 42, ... },
  "<primaryKey>": { ... }
}
```

A dictionary keyed by the node's primary key. For `Capsule`, the PK is a `scopedRef` (`<spineInstanceTreeId>::<absoluteCapsuleLineRef>`). For others, it is a composite ID string (e.g. `<lineRef>::source`, `<lineRef>::spine::<uri>`).

#### Edge Files (`edges/<Rel>.json`)

```json
[
  { "fromTable": "Capsule", "from": "<pk>", "toTable": "CapsuleSource", "to": "<pk>" },
  ...
]
```

An array of directed edge objects. Duplicates are prevented by `mergeEdge`.

### Node Tables

| Table              | PK / Dict Key                        | Key Fields                                                                        |
|--------------------|--------------------------------------|-----------------------------------------------------------------------------------|
| `Capsule`          | `scopedRef` (`<treeId>::<absLineRef>`) | `capsuleName`, `capsuleSourceLineRef`, `spineInstanceTreeId`, `cstFileUri`, `capsuleSourceNameRef`, `capsuleSourceNameRefHash`, `capsuleSourceUriLineRef`, `cacheBustVersion` |
| `CapsuleInstance`  | `instanceId`                         | `capsuleName`, `capsuleSourceUriLineRef`, `spineInstanceTreeId`                    |
| `CapsuleSource`    | `<lineRef>::source`                  | `capsuleSourceLineRef`, `moduleFilepath`, `moduleUri`, `capsuleName`, `declarationLine`, `importStackLine`, `definitionStartLine`, `definitionEndLine`, `optionsStartLine`, `optionsEndLine`, `extendsCapsule`, `extendsCapsuleUri` |
| `SpineContract`    | `<lineRef>::spine::<uri>`            | `contractUri`, `capsuleSourceLineRef`                                             |
| `PropertyContract` | `<lineRef>::pc::<spine>::<key>`      | `contractKey`, `propertyContractUri`, `capsuleSourceLineRef`, `spineContractId`, `options` (raw JS object, serialized to JSON on disk) |
| `CapsuleProperty`  | `<lineRef>::prop::<name>`            | `name`, `propertyType`, `valueType`, `valueExpression`, `mappedModuleUri`, `declarationLine`, `definitionStartLine`, `definitionEndLine`, `propertyContractDelegate`, `capsuleSourceLineRef`, `propertyContractId` |

### Edge Tables

| Relationship            | From               | To                 | Meaning                                               |
|-------------------------|--------------------|--------------------|-------------------------------------------------------|
| `HAS_SOURCE`            | Capsule            | CapsuleSource      | Links capsule identity to source metadata              |
| `IMPLEMENTS_SPINE`      | Capsule            | SpineContract      | Capsule implements a spine contract                    |
| `HAS_PROPERTY_CONTRACT` | SpineContract      | PropertyContract   | Spine contains property contract groups                |
| `HAS_PROPERTY`          | PropertyContract   | CapsuleProperty    | Property contract contains properties                  |
| `MAPS_TO`               | CapsuleProperty    | Capsule            | Mapping property resolves to target capsule            |
| `EXTENDS`               | Capsule            | Capsule            | Child extends parent capsule                           |
| `DELEGATES_TO`          | CapsuleProperty    | PropertyContract   | Delegate property points to source contract            |
| `INSTANCE_OF`           | CapsuleInstance    | Capsule            | Links a runtime instance to its capsule definition     |
| `PARENT_INSTANCE`       | CapsuleInstance    | CapsuleInstance    | Links a child instance to its parent instance in tree  |

### I/O Primitives

| Method             | Behaviour                                      |
|--------------------|-------------------------------------------------|
| `_readNodeTable`   | Reads `nodes/<T>.json` from disk; returns `{}`  if missing |
| `_writeNodeTable`  | Writes full table dict to `nodes/<T>.json`      |
| `_readEdgeTable`   | Reads `edges/<R>.json` from disk; returns `[]`  if missing |
| `_writeEdgeTable`  | Writes full edge array to `edges/<R>.json`      |
| `mergeNode`        | Read → merge → write (single node table file)   |
| `mergeEdge`        | Read → dedup-check → append → write             |

### Schema Lifecycle

`ensureSchema()` clears the `nodes/` and `edges/` directories via `rmSync` to guarantee a fresh state, then recreates them. This prevents stale data from prior runs.

---

## G2. Data Flow: CST → JsonFiles

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
  as literal objects in source (not function callbacks). Serialized to JSON on disk.
- String values inside literal options that look like relative paths
  (starting with `./` or `../`) are also resolved to npm URIs.

### Import Pipeline (ImportAPI.ts)

1. **`importSitFile(sitFilePath, opts?)`** — entry point for spine instance tree import
   - If `opts.reset` is set, clears data directories and `_schemaCreated` to start fresh
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
   - Reads all node and edge tables from disk
   - Builds lookup maps: `capByNameAndTree` and `capByModuleUriAndTree`
   - `MAPS_TO`: matches `CapsuleProperty.mappedModuleUri` → Capsule in same tree (by `capsuleName` or `CapsuleSource.moduleUri`)
   - `EXTENDS`: matches `CapsuleSource.extendsCapsuleUri` → Capsule in same tree (by `capsuleName` or `CapsuleSource.moduleUri`)
5. **`importCstDirectory(dirPath)`** — @deprecated, use `importSitDirectory` instead

### Key Invariants

- Node data is **shallow-merged** — later imports update existing records without removing fields.
- Edges are **deduplicated** — same (rel, from, to) is never stored twice.
- `options` on `PropertyContract` is stored as a **raw JS object** in memory (serialized to JSON on disk).
- Capsule nodes are **scoped by spineInstanceTreeId** — the dict key is `<treeId>::<absoluteLineRef>`, ensuring each tree gets its own copy of shared capsules.

---

## G3. Query Methods

All query methods read fresh from disk on every call. All methods require `spineInstanceTreeId` as the first argument.

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
- **Storage**: Options stored as raw JS object in `PropertyContract.options` field (serialized to JSON on disk).
- **Access**: Available directly after disk read/parse (no extra parsing needed).

### Pattern E: Element-to-Column Tagging
```
Capsule (element) → ... → CapsuleProperty {delegate: "#<columnUri>"} → MAPS_TO → Capsule (column)
```
- **Use case**: Element capsule tags a column capsule.
- **Query**: Reverse lookup via mappings.

---

## G5. Characteristics

- **No caching**: every query performs fresh disk reads
- **Immediate writes**: `mergeNode`/`mergeEdge` flush to disk on every call
- **Human-readable**: JSON files can be inspected directly
- **Portable**: no external database dependencies
- **Trade-off**: slower than in-memory or SQLite for large datasets due to repeated disk I/O

---

## G6. Instructions for Future AI Sessions

### When modifying the schema:
1. Update `NODE_TABLES` and `EDGE_TABLES` constants in `QueryAPI.ts`.
2. Update import logic in `ImportAPI.ts`.
3. Update query methods in `QueryAPI.ts`.
4. All four engines (Memory, JsonFiles, SqLite, Ladybug) MUST return identical data shapes.

### When adding new query capabilities:
1. Prefer adding data to `fetchCapsuleRelations` return value over new methods.
2. If a new edge type is needed, add it to `EDGE_TABLES` in `QueryAPI.ts`.
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
