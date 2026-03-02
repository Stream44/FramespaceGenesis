> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# Capsule SQLite Engine — Model Reference

> This section describes the Capsule relational schema, CST data model, import
> pipeline, and query patterns for the SQLite engine. It serves as a reference
> for AI assistants and developers working on model APIs that query this database.

---

## G1. Relational Schema

### Node Tables

| Table | Primary Key | Key Columns | Purpose |
|-------|-------------|-------------|---------|
| **Capsule** | `capsuleSourceLineRef` (TEXT) | `capsuleName`, `spineInstanceTreeId`, `cstFilepath` | Identity record for each capsule. One per `encapsulate()` call site. |
| **CapsuleInstance** | `instanceId` (TEXT) | `capsuleName`, `capsuleSourceUriLineRef`, `spineInstanceTreeId` | Runtime instance of a capsule within a spine instance tree. |
| **CapsuleSource** | `id` (TEXT) | `moduleFilepath`, `moduleUri`, `capsuleName`, `extendsCapsule`, `extendsCapsuleUri` | Source metadata: file location, declaration lines, extends info. |
| **SpineContract** | `id` (TEXT) | `contractUri`, `capsuleSourceLineRef` | A spine contract implemented by a capsule (e.g., `CapsuleSpineContract.v0`). |
| **PropertyContract** | `id` (TEXT) | `contractKey`, `propertyContractUri`, `capsuleSourceLineRef`, `spineContractId`, `options` | A property contract group within a spine contract. Key starts with `#`. |
| **CapsuleProperty** | `id` (TEXT) | `name`, `propertyType`, `valueType`, `valueExpression`, `mappedModuleUri`, `propertyContractDelegate` | A single property within a property contract. |

### Edge Tables (Junction Tables)

| Table | from_id → to_id | Meaning |
|-------|-----------------|---------|
| **HAS_SOURCE** | Capsule.capsuleSourceLineRef → CapsuleSource.id | Links capsule identity to its source metadata. |
| **IMPLEMENTS_SPINE** | Capsule.capsuleSourceLineRef → SpineContract.id | Capsule implements a spine contract. |
| **HAS_PROPERTY_CONTRACT** | SpineContract.id → PropertyContract.id | Spine contract contains property contract groups. |
| **HAS_PROPERTY** | PropertyContract.id → CapsuleProperty.id | Property contract contains properties. |
| **MAPS_TO** | CapsuleProperty.id → Capsule.capsuleSourceLineRef | A Mapping-type property resolves to a target capsule. |
| **EXTENDS** | Capsule.capsuleSourceLineRef → Capsule.capsuleSourceLineRef | Capsule extends (inherits from) a parent capsule. |
| **DELEGATES_TO** | CapsuleProperty.id → PropertyContract.id | A delegate property points to its source property contract. |
| **INSTANCE_OF** | CapsuleInstance.instanceId → Capsule.capsuleSourceLineRef | Links a runtime instance to its capsule definition. |
| **PARENT_INSTANCE** | CapsuleInstance.instanceId → CapsuleInstance.instanceId | Links a child instance to its parent instance in the tree. |

### Indexes

| Index | Table | Column(s) | Purpose |
|-------|-------|-----------|---------|
| `idx_capsule_name` | Capsule | `capsuleName` | Fast lookup by capsule name |
| `idx_capsule_spine` | Capsule | `spineInstanceTreeId` | Filter capsules by spine instance tree |
| `idx_instance_spine` | CapsuleInstance | `spineInstanceTreeId` | Filter instances by spine instance tree |
| `idx_capsule_property_mapped` | CapsuleProperty | `mappedModuleUri` | Fast MAPS_TO linking |
| `idx_capsule_source_extends` | CapsuleSource | `extendsCapsuleUri` | Fast EXTENDS linking |

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

### Import Pipeline (ImportCapsuleSourceTrees)

1. **`importSitFile(sitFilePath)`** — entry point for spine instance tree import
   - Reads `.sit.json` file containing `rootCapsule`, `capsules`, and `capsuleInstances`
   - Extracts `spineInstanceTreeId` from `rootCapsule.capsuleSourceUriLineRef`
   - For each capsule: finds corresponding `.csts.json` file and imports via `importCstFile`
   - Calls `_importCapsuleInstances()` to create instance nodes and relationships
2. **`importSitDirectory(dirPath)`** — recursively scans for `.sit.json` files
3. **`_importCapsuleInstances(sit, spineInstanceTreeId)`** — per-sit:
   - Creates `CapsuleInstance` rows for each entry in `capsuleInstances`
   - Creates `INSTANCE_OF` edges linking instances to their capsule definitions
   - Creates `PARENT_INSTANCE` edges based on `parentCapsuleSourceUriLineRefInstanceId`
4. **`linkMappings()`** — post-import bulk edge creation:
   - `MAPS_TO`: matches `CapsuleProperty.mappedModuleUri` → `Capsule.capsuleName`
   - `EXTENDS`: matches `CapsuleSource.extendsCapsuleUri` → `Capsule.capsuleName`

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

## G4. SQL Query Patterns (mapped from Cypher)

### listCapsules

```sql
-- With spineInstanceUri filter
SELECT cap.capsuleName, cap.capsuleSourceLineRef
FROM Capsule cap
JOIN HAS_SOURCE hs ON hs.from_id = cap.capsuleSourceLineRef
WHERE cap.spineInstanceTreeId = ?1
ORDER BY cap.capsuleName;

-- Without filter
SELECT cap.capsuleName, cap.capsuleSourceLineRef
FROM Capsule cap
JOIN HAS_SOURCE hs ON hs.from_id = cap.capsuleSourceLineRef
ORDER BY cap.capsuleName;
```

### getCapsuleWithSource

```sql
SELECT cap.*, cs.*
FROM Capsule cap
JOIN HAS_SOURCE hs ON hs.from_id = cap.capsuleSourceLineRef
JOIN CapsuleSource cs ON cs.id = hs.to_id
WHERE cap.capsuleName = ?1;
```

### getCapsuleSpineTree_data

```sql
SELECT s.*, pc.*, p.*
FROM Capsule cap
JOIN IMPLEMENTS_SPINE isp ON isp.from_id = cap.capsuleSourceLineRef
JOIN SpineContract s ON s.id = isp.to_id
JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
JOIN PropertyContract pc ON pc.id = hpc.to_id
LEFT JOIN HAS_PROPERTY hp ON hp.from_id = pc.id
LEFT JOIN CapsuleProperty p ON p.id = hp.to_id
WHERE cap.capsuleSourceLineRef = ?1
ORDER BY s.contractUri, pc.contractKey, p.name;
```

### fetchCapsuleRelations — mappings subquery

```sql
SELECT cap.capsuleName AS src, p.name AS propName,
       p.propertyContractDelegate AS delegate, target.capsuleName AS target
FROM Capsule cap
JOIN IMPLEMENTS_SPINE isp ON isp.from_id = cap.capsuleSourceLineRef
JOIN SpineContract s ON s.id = isp.to_id
JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
JOIN PropertyContract pc ON pc.id = hpc.to_id
JOIN HAS_PROPERTY hp ON hp.from_id = pc.id
JOIN CapsuleProperty p ON p.id = hp.to_id
JOIN MAPS_TO mt ON mt.from_id = p.id
JOIN Capsule target ON target.capsuleSourceLineRef = mt.to_id
WHERE cap.capsuleName IN (...)
ORDER BY cap.capsuleName, p.name;
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
- **Access**: Parse with `JSON.parse()` on read.

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
<dirname_of_rootCapsule_moduleFilepath>/.~o/framespace.dev/data/engines/Capsule-SqLite-v0/capsule-graph.sqlite
```

Where `dirname_of_rootCapsule_moduleFilepath` is obtained from:
```typescript
this['#@stream44.studio/encapsulate/structs/Capsule'].rootCapsule.moduleFilepath
```

This ensures the DB file lives alongside the capsule source tree in the `.~o` cache directory.

---

## G7. Instructions for Future AI Sessions

### When modifying the schema:
1. Update `ensureSchema` in `EngineAPI.ts`.
2. Update import logic in `ImportCapsuleSourceTrees.ts`.
3. Update query methods in `EngineAPI.ts`.
4. All three engines (Ladybug, JsonFiles, SqLite) MUST return identical data shapes — they are interchangeable.

### When adding new query capabilities:
1. Prefer adding data to `fetchCapsuleRelations` return value over new methods.
2. If a new edge type is needed, add a new junction table and update `linkMappings`.
3. Always test with all engines to ensure parity.

### When working on model APIs (like Quadrant/API.ts):
1. APIs receive `graph` (the engine EngineAPI instance) as first argument.
2. APIs should be **engine-agnostic** — only use methods defined in EngineAPI.
3. Use `fetchCapsuleRelations` for bulk data, avoid per-capsule queries in loops.
4. The API layer handles shaping/composition; the engine handles raw queries.

### Key file locations:
- **SQLite engine**: `engines/Capsule-SqLite-v0/` (EngineAPI.ts, ImportCapsuleSourceTrees.ts)
- **Ladybug engine**: `engines/Capsule-Ladybug-v0/` (same structure)
- **JsonFiles engine**: `engines/Capsule-JsonFiles-v0/` (same structure)
- **Quadrant API**: `models/Framespace/Visualization/Quadrant/API.ts`
- **Quadrant test**: `models/Framespace/Visualization/Quadrant/run-model.test.ts`
