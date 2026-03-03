> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# SqLite-v0 Engine — Model Reference

> This section describes the Capsule relational schema, CST data model, import
> pipeline, and query patterns for the SQLite engine (`bun:sqlite`). It serves as a reference
> for AI assistants and developers working on model APIs that query this database.

---

## G1. Relational Schema

### Node Tables

| Table | Primary Key | Key Columns | Purpose |
|-------|-------------|-------------|---------|
| **Capsule** | `scopedId` (TEXT) — `<treeId>::<absLineRef>` | `capsuleSourceLineRef`, `capsuleName`, `spineInstanceTreeId`, `cstFilepath`, `capsuleSourceNameRef`, `capsuleSourceNameRefHash`, `capsuleSourceUriLineRef`, `cacheBustVersion` | Identity record for each capsule, scoped by spine instance tree. |
| **CapsuleInstance** | `instanceId` (TEXT) | `capsuleName`, `capsuleSourceUriLineRef`, `spineInstanceTreeId` | Runtime instance of a capsule within a spine instance tree. |
| **CapsuleSource** | `id` (TEXT) — `<lineRef>::source` | `capsuleSourceLineRef`, `moduleFilepath`, `moduleUri`, `capsuleName`, `declarationLine`, `importStackLine`, `definitionStartLine`, `definitionEndLine`, `optionsStartLine`, `optionsEndLine`, `extendsCapsule`, `extendsCapsuleUri` | Source metadata: file location, declaration lines, extends info. |
| **SpineContract** | `id` (TEXT) — `<lineRef>::spine::<uri>` | `contractUri`, `capsuleSourceLineRef` | A spine contract implemented by a capsule. |
| **PropertyContract** | `id` (TEXT) — `<lineRef>::pc::<spine>::<key>` | `contractKey`, `propertyContractUri`, `capsuleSourceLineRef`, `spineContractId`, `options` (JSON TEXT) | A property contract group within a spine contract. |
| **CapsuleProperty** | `id` (TEXT) — `<lineRef>::prop::<name>` | `name`, `propertyType`, `valueType`, `valueExpression`, `mappedModuleUri`, `declarationLine`, `definitionStartLine`, `definitionEndLine`, `propertyContractDelegate`, `capsuleSourceLineRef`, `propertyContractId` | A single property within a property contract. |

### Edge Tables (Junction Tables)

All edge tables have composite PK `(from_id TEXT, to_id TEXT)`.

| Table | from_id → to_id | Meaning |
|-------|-----------------|---------|
| **HAS_SOURCE** | Capsule.scopedId → CapsuleSource.id | Links capsule identity to its source metadata. |
| **IMPLEMENTS_SPINE** | Capsule.scopedId → SpineContract.id | Capsule implements a spine contract. |
| **HAS_PROPERTY_CONTRACT** | SpineContract.id → PropertyContract.id | Spine contract contains property contract groups. |
| **HAS_PROPERTY** | PropertyContract.id → CapsuleProperty.id | Property contract contains properties. |
| **MAPS_TO** | CapsuleProperty.id → Capsule.scopedId | A Mapping-type property resolves to a target capsule. |
| **EXTENDS** | Capsule.scopedId → Capsule.scopedId | Capsule extends (inherits from) a parent capsule. |
| **DELEGATES_TO** | CapsuleProperty.id → PropertyContract.id | A delegate property points to its source property contract. |
| **INSTANCE_OF** | CapsuleInstance.instanceId → Capsule.scopedId | Links a runtime instance to its capsule definition. |
| **PARENT_INSTANCE** | CapsuleInstance.instanceId → CapsuleInstance.instanceId | Links a child instance to its parent instance in the tree. |

### Indexes

| Index | Table | Column(s) | Purpose |
|-------|-------|-----------|---------|
| `idx_capsule_name` | Capsule | `capsuleName` | Fast lookup by capsule name |
| `idx_capsule_spine` | Capsule | `spineInstanceTreeId` | Filter capsules by spine instance tree |
| `idx_instance_spine` | CapsuleInstance | `spineInstanceTreeId` | Filter instances by spine instance tree |
| `idx_capsule_property_mapped` | CapsuleProperty | `mappedModuleUri` | Fast MAPS_TO linking |
| `idx_capsule_source_extends` | CapsuleSource | `extendsCapsuleUri` | Fast EXTENDS linking |

### Mutation Helpers

- `_mergeNode(table, pk, data)` → `INSERT OR REPLACE INTO` (full row replacement)
- `_mergeEdge(rel, fromTable, fromPk, toTable, toPk)` → `INSERT OR IGNORE INTO` (skip duplicates)
- Object values in `data` are serialized with `JSON.stringify()` before insertion.

---

## G2. Data Flow: CST → SQLite

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
- `options` on property contracts are stored as JSON TEXT when declared
  as literal objects in source (not function callbacks).
- String values inside literal options that look like relative paths
  (starting with `./` or `../`) are also resolved to npm URIs.

### Import Pipeline (ImportAPI.ts)

1. **`importSitFile(sitFilePath, opts?)`** — entry point for spine instance tree import
   - If `opts.reset` is set, clears `_schemaCreated` and re-runs `_ensureSchema()` (drops all tables)
   - Reads `.sit.json` file containing `rootCapsule`, `capsules`, and `capsuleInstances`
   - Extracts `spineInstanceTreeId` from `capsuleInstances[rootCapsule.capsuleSourceUriLineRefInstanceId].capsuleName`
   - For each capsule: resolves `.csts.json` file path (local then npm fallback) and imports via `importCstFile`
   - Calls `_importCapsuleInstances()` to create instance nodes and relationships
   - Returns `{ imported, capsules, instances }`
2. **`importSitDirectory(dirPath)`** — recursively scans for `.sit.json` files
3. **`_importCapsuleInstances(sit, spineInstanceTreeId)`** — per-sit:
   - Creates `CapsuleInstance` rows for each entry in `capsuleInstances`
   - Creates `INSTANCE_OF` edges — finds matching Capsule via SQL `WHERE spineInstanceTreeId = ? AND capsuleName = ?`
   - Creates `PARENT_INSTANCE` edges based on `parentCapsuleSourceUriLineRefInstanceId`
4. **`linkMappings()`** — post-import bulk SQL edge creation:
   - `MAPS_TO`: bulk `INSERT OR IGNORE` joining `CapsuleProperty` → `Capsule` in same tree via `COALESCE(target1.scopedId, target2.scopedId)`, matching by `capsuleName` or `CapsuleSource.moduleUri`
   - `EXTENDS`: bulk `INSERT OR IGNORE` joining `CapsuleSource.extendsCapsuleUri` → `Capsule` in same tree via same `COALESCE` pattern

### Key Invariants

- Capsule nodes are **scoped by spineInstanceTreeId** — the PK (`scopedId`) is `<treeId>::<absoluteLineRef>`.
- `_mergeNode` does full row `INSERT OR REPLACE` — not a shallow merge like Memory engine.
- `options` on `PropertyContract` is stored as **serialized JSON TEXT**.
- Edge tables use `INSERT OR IGNORE` with composite PK for deduplication.

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
| `getRootInstance(spineInstanceTreeId)` | Root instance (no `PARENT_INSTANCE` edge via `NOT EXISTS`) | `{ instanceId, capsuleName, capsuleSourceUriLineRef }` or `null` |
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
  }[]>,  // sorted by propName; pcOptions parsed from JSON TEXT
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

## G4. SQL Query Patterns

### listCapsules

```sql
SELECT capsuleName, capsuleSourceLineRef
FROM Capsule
WHERE spineInstanceTreeId = ?1
ORDER BY capsuleName;
```

### getCapsuleWithSource

```sql
SELECT cap.*, cs.*
FROM Capsule cap
JOIN HAS_SOURCE hs ON hs.from_id = cap.scopedId
JOIN CapsuleSource cs ON cs.id = hs.to_id
WHERE cap.spineInstanceTreeId = ?1 AND cap.capsuleName = ?2;
```

### getCapsuleSpineTree_data

```sql
SELECT s.*, pc.*, p.*
FROM Capsule cap
JOIN IMPLEMENTS_SPINE isp ON isp.from_id = cap.scopedId
JOIN SpineContract s ON s.id = isp.to_id
JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
JOIN PropertyContract pc ON pc.id = hpc.to_id
LEFT JOIN HAS_PROPERTY hp ON hp.from_id = pc.id
LEFT JOIN CapsuleProperty p ON p.id = hp.to_id
WHERE cap.spineInstanceTreeId = ?1 AND cap.capsuleSourceLineRef = ?2
ORDER BY s.contractUri, pc.contractKey, p.name;
```

### fetchCapsuleRelations — mappings subquery

```sql
SELECT cap.capsuleName AS src, p.name AS propName,
       p.propertyContractDelegate AS delegate, target.capsuleName AS target
FROM Capsule cap
JOIN IMPLEMENTS_SPINE isp ON isp.from_id = cap.scopedId
JOIN SpineContract s ON s.id = isp.to_id
JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
JOIN PropertyContract pc ON pc.id = hpc.to_id
JOIN HAS_PROPERTY hp ON hp.from_id = pc.id
JOIN CapsuleProperty p ON p.id = hp.to_id
JOIN MAPS_TO mt ON mt.from_id = p.id
JOIN Capsule target ON target.scopedId = mt.to_id
WHERE cap.spineInstanceTreeId = '<treeId>' AND cap.capsuleName IN (...)
ORDER BY cap.capsuleName, p.name;
```

### getRootInstance

```sql
SELECT ci.instanceId, ci.capsuleName, ci.capsuleSourceUriLineRef
FROM CapsuleInstance ci
WHERE ci.spineInstanceTreeId = ?1
AND NOT EXISTS (SELECT 1 FROM PARENT_INSTANCE pi WHERE pi.from_id = ci.instanceId);
```

---

## G5. Relationship Patterns

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
- **Storage**: Options stored as JSON TEXT in `PropertyContract.options` column.
- **Access**: Parse with `JSON.parse()` on read (done automatically by `fetchCapsuleRelations`).

### Pattern E: Element-to-Column Tagging
```
Capsule (element) → ... → CapsuleProperty {delegate: "#<columnUri>"} → MAPS_TO → Capsule (column)
```
- **Use case**: Element capsule tags a column capsule.
- **Query**: Reverse lookup via mappings.

---

## G6. Database File Location

The SQLite database file is stored at:
```
<dirname_of_rootCapsule_moduleFilepath>/.~o/framespace.dev/data/engines/SqLite-v0/capsule-graph.sqlite
```

Where `dirname_of_rootCapsule_moduleFilepath` is obtained from:
```typescript
this['#@stream44.studio/encapsulate/structs/Capsule'].rootCapsule.moduleFilepath
```

PRAGMAs set on connection:
- `journal_mode = WAL` — Write-Ahead Logging for better concurrency
- `foreign_keys = OFF` — no FK enforcement (edges are managed by import logic)

---

## G7. Instructions for Future AI Sessions

### When modifying the schema:
1. Update `_ensureSchema` in `QueryAPI.ts` — add/modify `CREATE TABLE` and `CREATE INDEX` statements.
2. Update import logic in `ImportAPI.ts`.
3. Update query methods in `QueryAPI.ts`.
4. All four engines (Memory, JsonFiles, SqLite, Ladybug) MUST return identical data shapes — they are interchangeable.

### When adding new query capabilities:
1. Prefer adding data to `fetchCapsuleRelations` return value over new methods.
2. If a new edge type is needed, add a new junction table and update `linkMappings`.
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
