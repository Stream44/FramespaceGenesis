> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# Ladybug-v0 Engine — Model Reference

> This section describes the Capsule graph schema, CST data model, import
> pipeline, and query patterns for the LadybugDB graph engine (`lbug`). It serves as
> a reference for AI assistants and developers working on model APIs that query this graph.

---

## G1. Graph Schema

LadybugDB is an in-memory graph database using Cypher query language. The schema is created
via `CREATE NODE TABLE` and `CREATE REL TABLE` statements in `_ensureSchema`.

### Node Tables

| Node | Primary Key | Key Fields | Purpose |
|------|-------------|------------|---------|
| **Capsule** | `scopedId` (STRING) — `<treeId>::<absLineRef>` | `capsuleSourceLineRef`, `capsuleName`, `spineInstanceTreeId`, `cstFilepath`, `capsuleSourceNameRef`, `capsuleSourceNameRefHash`, `capsuleSourceUriLineRef`, `cacheBustVersion`, `moduleUri` | Identity node for each capsule, scoped by spine instance tree. **Note:** `moduleUri` is stored on Capsule node (unique to Ladybug) but stripped from query output for cross-engine parity. |
| **CapsuleSource** | `id` (STRING) — `<lineRef>::source` | `capsuleSourceLineRef`, `moduleFilepath`, `moduleUri`, `capsuleName`, `declarationLine`, `importStackLine`, `definitionStartLine`, `definitionEndLine`, `optionsStartLine`, `optionsEndLine`, `extendsCapsule`, `extendsCapsuleUri` | Source metadata: file location, declaration lines, extends info. |
| **SpineContract** | `id` (STRING) — `<lineRef>::spine::<uri>` | `contractUri`, `capsuleSourceLineRef` | A spine contract implemented by a capsule. |
| **PropertyContract** | `id` (STRING) — `<lineRef>::pc::<spine>::<key>` | `contractKey`, `propertyContractUri`, `capsuleSourceLineRef`, `spineContractId`, `options` (STRING) | A property contract group within a spine contract. |
| **CapsuleProperty** | `id` (STRING) — `<lineRef>::prop::<name>` | `name`, `propertyType`, `valueType`, `valueExpression`, `mappedModuleUri`, `declarationLine`, `definitionStartLine`, `definitionEndLine`, `propertyContractDelegate`, `capsuleSourceLineRef`, `propertyContractId` | A single property within a property contract. |
| **CapsuleInstance** | `instanceId` (STRING) | `capsuleName`, `capsuleSourceUriLineRef`, `spineInstanceTreeId` | Runtime instance of a capsule within a spine instance tree. |
| **MembraneEvent** | `id` (STRING) — `<treeId>::evt::<index>` | `eventIndex`, `spineInstanceTreeId`, `eventType`, `membrane` (`external`/`internal`), `capsuleSourceLineRef`, `capsuleSourceNameRef`, `capsuleSourceNameRefHash`, `propertyName`, `value`, `result`, `callerFilepath`, `callerLine`, `callEventIndex` | A runtime membrane event captured during capsule execution. |

### Edge Tables (Relationships)

| Edge | From → To | Meaning |
|------|-----------|---------|
| **HAS_SOURCE** | Capsule → CapsuleSource | Links capsule identity to its source metadata. |
| **IMPLEMENTS_SPINE** | Capsule → SpineContract | Capsule implements a spine contract. |
| **HAS_PROPERTY_CONTRACT** | SpineContract → PropertyContract | Spine contract contains property contract groups. |
| **HAS_PROPERTY** | PropertyContract → CapsuleProperty | Property contract contains properties. |
| **MAPS_TO** | CapsuleProperty → Capsule | A Mapping-type property resolves to a target capsule. |
| **EXTENDS** | Capsule → Capsule | Capsule extends (inherits from) a parent capsule. |
| **DELEGATES_TO** | CapsuleProperty → PropertyContract | A delegate property points to its source property contract. |
| **INSTANCE_OF** | CapsuleInstance → Capsule | Links a runtime instance to its capsule definition. |
| **PARENT_INSTANCE** | CapsuleInstance → CapsuleInstance | Links a child instance to its parent instance in the tree. |
| **HAS_MEMBRANE_EVENT** | Capsule → MembraneEvent | Links a capsule to its captured membrane events. |

### Mutation Pattern

Unlike other engines, Ladybug does **not** use `_mergeNode`/`_mergeEdge` helpers. Instead, `ImportAPI.ts` directly constructs Cypher `MERGE` statements with `ON CREATE SET` / `ON MATCH SET` clauses. String values are escaped via `esc()` and `escLong()` utilities.

### Query Helpers

- `_esc(s)` — escapes `\` and `'` for Cypher string literals
- `_queryAll(statement)` — executes Cypher query via `conn.query()`, returns array of row objects
- LadybugDB returns internal properties (`_id`, `_label`) on node objects — these are stripped by query methods before returning results

---

## G2. Data Flow: CST → Graph

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
- `options` on property contracts are stored as serialized STRING when declared
  as literal objects in source (not function callbacks).
- String values inside literal options that look like relative paths
  (starting with `./` or `../`) are also resolved to npm URIs.

### Import Pipeline (ImportAPI.ts)

1. **`importSitFile(sitFilePath, opts?)`** — entry point for spine instance tree import
   - If `opts.reset` is set, drops all REL tables then NODE tables via `DROP TABLE IF EXISTS`, clears `_schemaCreated`, and re-runs `_ensureSchema()`
   - Reads `.sit.json` file containing `rootCapsule`, `capsules`, and `capsuleInstances`
   - Extracts `spineInstanceTreeId` from `capsuleInstances[rootCapsule.capsuleSourceUriLineRefInstanceId].capsuleName`
   - For each capsule: resolves `.csts.json` file path (local then npm fallback) and imports via `importCstFile`
   - Calls `_importCapsuleInstances()` to create instance nodes and relationships
   - Returns `{ imported, capsules, instances }`
2. **`importSitDirectory(dirPath)`** — recursively scans for `.sit.json` files
3. **`_importCapsuleInstances(sit, spineInstanceTreeId)`** — per-sit:
   - Creates `CapsuleInstance` nodes via Cypher `MERGE` for each entry in `capsuleInstances`
   - Creates `INSTANCE_OF` edges — finds matching Capsule via `MATCH ... WHERE cap.spineInstanceTreeId = ? AND cap.capsuleName = ?`
   - Creates `PARENT_INSTANCE` edges based on `parentCapsuleSourceUriLineRefInstanceId`
4. **`linkMappings()`** — post-import bulk Cypher edge creation:
   - `MAPS_TO`: `MATCH` CapsuleProperty with non-empty `mappedModuleUri` and Capsule in same tree (by `capsuleName` or `moduleUri`), then `MERGE` edge
   - `EXTENDS`: `MATCH` CapsuleSource with non-empty `extendsCapsuleUri` via HAS_SOURCE, find parent Capsule in same tree (by `capsuleName` or `moduleUri`), then `MERGE` edge
5. **`importMembraneEvents(events, spineInstanceTreeId)`** — imports captured membrane events:
   - Creates `MembraneEvent` nodes via Cypher `MERGE` with event data (eventType, capsuleSourceLineRef, propertyName, value, result, caller info)
   - Creates `HAS_MEMBRANE_EVENT` edges from owning Capsule to each event node
   - Returns `{ imported }` count
6. **`importCstDirectory(dirPath)`** — @deprecated, use `importSitDirectory` instead

### Key Invariants

- Capsule nodes are **scoped by spineInstanceTreeId** — the PK (`scopedId`) is `<treeId>::<absoluteLineRef>`.
- Import uses Cypher `MERGE` with `ON CREATE SET` / `ON MATCH SET` — equivalent to upsert.
- `options` on `PropertyContract` is stored as **serialized STRING**.
- `moduleUri` is stored directly on the Capsule node (not just on CapsuleSource) — this is unique to Ladybug and used for `linkMappings` matching.
- Query methods strip `scopedId`, `moduleUri`, `_id`, and `_label` from returned Capsule data for cross-engine parity.

---

## G3. Query Methods

All queries are implemented as `_`-prefixed methods in `QueryAPI.ts`. The public API in `ModelQueryMethods.ts` delegates to these. All methods require `spineInstanceTreeId` as the first argument.

| Method | Signature | Returns |
|--------|-----------|---------|
| `listCapsules(spineInstanceTreeId)` | Required tree filter | `[{ capsuleName, capsuleSourceLineRef }]` sorted by `capsuleName` |
| `getCapsuleWithSource(spineInstanceTreeId, capsuleName)` | By tree + capsule name | `{ cap, source }` or `null` (strips `scopedId`, `moduleUri`, `_id`, `_label`) |
| `getCapsuleSpineTree_data(spineInstanceTreeId, capsuleSourceLineRef)` | Full spine tree for a capsule | `[{ s, pc, p }]` rows sorted by `contractUri`, `contractKey`, `name` (strips `_id`, `_label`; normalizes empty options to `null`) |
| `getCapsuleNamesBySpineTree(spineInstanceTreeId)` | All capsule names in tree | `string[]` sorted |
| `fetchCapsuleRelations(spineInstanceTreeId, capsuleNames[])` | Batch relations (5 parallel Cypher queries) | `{ mappings, extends, found, properties, capsuleInfo }` |
| `listSpineInstanceTrees(spineInstanceTreeId?)` | With filter: all capsules in tree; without: distinct trees | `[{ spineInstanceTreeId, capsuleName, capsuleSourceLineRef, capsuleSourceUriLineRef }]` |
| `getInstancesBySpineTree(spineInstanceTreeId)` | All instances in tree | `[{ instanceId, capsuleName, capsuleSourceUriLineRef }]` sorted by `capsuleName` |
| `getRootInstance(spineInstanceTreeId)` | Root instance (via `NOT EXISTS { MATCH (inst)-[:PARENT_INSTANCE]->(:CapsuleInstance) }`) | `{ instanceId, capsuleName, capsuleSourceUriLineRef }` or `null` |
| `getChildInstances(parentInstanceId)` | Children of an instance | `[{ instanceId, capsuleName, capsuleSourceUriLineRef }]` sorted by `capsuleName` |
| `fetchInstanceRelations(spineInstanceTreeId)` | Batch instance data (3 parallel Cypher queries) | `{ instances, parentMap, capsuleInfo }` |
| `_getMembraneEvents(spineInstanceTreeId)` | All membrane events in tree | `MembraneEvent[]` sorted by `eventIndex` |
| `_getMembraneEventsByCapsule(spineInstanceTreeId, capsuleSourceLineRef)` | Membrane events for one capsule | `MembraneEvent[]` sorted by `eventIndex` |

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
  }[]>,  // sorted by propName; pcOptions parsed from STRING
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

## G4. Cypher Query Patterns

### listCapsules

```cypher
MATCH (cap:Capsule)
WHERE cap.spineInstanceTreeId = '<treeId>'
RETURN cap.capsuleName, cap.capsuleSourceLineRef
ORDER BY cap.capsuleName
```

### getCapsuleWithSource

```cypher
MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource)
WHERE cap.spineInstanceTreeId = '<treeId>' AND cap.capsuleName = '<name>'
RETURN cap, cs
```

### getCapsuleSpineTree_data

```cypher
MATCH (cap:Capsule)-[:IMPLEMENTS_SPINE]->(s:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(pc:PropertyContract)
WHERE cap.spineInstanceTreeId = '<treeId>' AND cap.capsuleSourceLineRef = '<lineRef>'
OPTIONAL MATCH (pc)-[:HAS_PROPERTY]->(p:CapsuleProperty)
RETURN s, pc, p
ORDER BY s.contractUri, pc.contractKey, p.name
```

### fetchCapsuleRelations — mappings subquery

```cypher
MATCH (cap:Capsule)-[:IMPLEMENTS_SPINE]->(:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(:PropertyContract)-[:HAS_PROPERTY]->(p:CapsuleProperty)-[:MAPS_TO]->(target:Capsule)
WHERE cap.spineInstanceTreeId = '<treeId>' AND cap.capsuleName IN ['<name1>', '<name2>']
RETURN cap.capsuleName AS src, p.name AS propName, p.propertyContractDelegate AS delegate, target.capsuleName AS target
ORDER BY cap.capsuleName, p.name
```

### getRootInstance

```cypher
MATCH (inst:CapsuleInstance)
WHERE inst.spineInstanceTreeId = '<treeId>'
AND NOT EXISTS { MATCH (inst)-[:PARENT_INSTANCE]->(:CapsuleInstance) }
RETURN inst.instanceId AS instanceId, inst.capsuleName AS capsuleName, inst.capsuleSourceUriLineRef AS capsuleSourceUriLineRef
```

---

## G5. Relationship Patterns

### Pattern A: Capsule Mapping (parent maps child)
```
(Root:Capsule) → IMPLEMENTS_SPINE → (Spine:SpineContract)
  → HAS_PROPERTY_CONTRACT → (PC:#) → HAS_PROPERTY → (Prop {type: Mapping})
    → MAPS_TO → (Child:Capsule)
```
- **Use case**: Root capsule maps LoginService, DataService, PaymentService.
- **Query**: `fetchCapsuleRelations` → `mappings[rootName]` gives `{ target: childName }`.

### Pattern B: Capsule Extends (inheritance)
```
(Child:Capsule) → EXTENDS → (Parent:Capsule)
```
- **Use case**: Capsule inherits properties from a parent capsule.
- **Query**: `fetchCapsuleRelations` → `extends[childName]` gives parent name.

### Pattern C: Struct Dependency (capsule declares dependency on a schema/struct)
```
(Capsule) → ... → (Prop {propertyContractDelegate: "#<schemaUri>"})
  → MAPS_TO → (Schema:Capsule)
```
- **Use case**: Column capsule declares dependency on `schema/Column`.
- **Query via mappings**: entries with `delegate` field set.

### Pattern D: Struct Options (metadata on a struct dependency)
- **Storage**: Options stored as STRING in `PropertyContract.options` field.
- **Access**: Parsed with `JSON.parse()` on read (done automatically by `fetchCapsuleRelations`).

### Pattern E: Element-to-Column Tagging
```
(Element:Capsule) → ... → (Prop {delegate: "#<columnUri>"}) → MAPS_TO → (Column:Capsule)
```
- **Use case**: Element capsule tags a column capsule.
- **Query**: Reverse lookup via mappings.

---

## G6. Characteristics

- **In-memory**: LadybugDB runs entirely in RAM (`:memory:` mode). Data is lost when process exits.
- **Cypher queries**: Native graph traversal via pattern matching — no JOINs needed.
- **Async**: All query methods are async (unlike Memory-v0 and JsonFiles-v0 which are sync under the hood).
- **Property stripping**: Query methods strip LadybugDB internal properties (`_id`, `_label`) and engine-specific fields (`scopedId`, `moduleUri`) from returned Capsule data.
- **Parallel queries**: `fetchCapsuleRelations` and `fetchInstanceRelations` use `Promise.all` for concurrent Cypher execution.

---

## G7. Instructions for Future AI Sessions

### When modifying the graph schema:
1. Update `_ensureSchema` in `QueryAPI.ts` — add/modify `CREATE NODE TABLE` and `CREATE REL TABLE` statements.
2. Update import logic in `ImportAPI.ts` — update Cypher `MERGE` statements.
3. Update query methods in `QueryAPI.ts`.
4. All four engines (Memory, JsonFiles, SqLite, Ladybug) MUST return identical data shapes — they are interchangeable.

### When adding new query capabilities:
1. Prefer adding data to `fetchCapsuleRelations` return value over new methods.
2. If a new relationship type is needed, add a `CREATE REL TABLE` and update `linkMappings`.
3. Always test with all engines to ensure parity.

### When working on model APIs:
1. APIs receive the engine instance as first argument.
2. APIs should be **engine-agnostic** — only use methods defined in ModelQueryMethods.
3. Use `fetchCapsuleRelations` for bulk data, avoid per-capsule queries in loops.
4. The API layer handles shaping/composition; the engine handles raw graph queries.

### Key file locations:
- **Memory engine**: `engines/Memory-v0/` (QueryAPI.ts, ImportAPI.ts)
- **JsonFiles engine**: `engines/JsonFiles-v0/` (QueryAPI.ts, ImportAPI.ts)
- **SQLite engine**: `engines/SqLite-v0/` (QueryAPI.ts, ImportAPI.ts)
- **Ladybug engine**: `engines/Ladybug-v0/` (QueryAPI.ts, ImportAPI.ts)

### CST regeneration:
- CSTs are cached in `.~o/encapsulate.dev/static-analysis/` directories.
- Delete cached CSTs to force regeneration after changing the static analyzer.
- The static analyzer is at `encapsulate.dev/packages/encapsulate/src/static-analyzer.v0.ts`.
