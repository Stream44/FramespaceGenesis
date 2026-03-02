> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the engine, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# Capsule Graph Engine — Model Reference

> This section describes the Capsule graph schema, CST data model, import
> pipeline, and query patterns. It serves as a reference for AI assistants
> and developers working on model APIs that query this graph.

---

## G1. Graph Schema

### Node Tables

| Node | Primary Key | Key Fields | Purpose |
|------|-------------|------------|---------|
| **Capsule** | `capsuleSourceLineRef` (STRING) | `capsuleName`, `spineInstanceTreeId`, `cstFilepath` | Identity node for each capsule. One per `encapsulate()` call site. |
| **CapsuleSource** | `id` (STRING) | `moduleFilepath`, `moduleUri`, `capsuleName`, `extendsCapsule`, `extendsCapsuleUri` | Source metadata: file location, declaration lines, extends info. |
| **SpineContract** | `id` (STRING) | `contractUri`, `capsuleSourceLineRef` | A spine contract implemented by a capsule (e.g., `CapsuleSpineContract.v0`). |
| **PropertyContract** | `id` (STRING) | `contractKey`, `propertyContractUri`, `capsuleSourceLineRef`, `spineContractId` | A property contract group within a spine contract. Key starts with `#`. |
| **CapsuleProperty** | `id` (STRING) | `name`, `propertyType`, `valueType`, `valueExpression`, `mappedModuleUri`, `propertyContractDelegate` | A single property within a property contract. |
| **CapsuleInstance** | `instanceId` (STRING) | `capsuleName`, `capsuleSourceUriLineRef`, `spineInstanceTreeId` | Runtime instance of a capsule within a spine instance tree. |

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
- `options` on property contracts are stored as JSON objects when declared
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
   - Creates `CapsuleInstance` nodes for each entry in `capsuleInstances`
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
    propertyContractDelegate, valueExpression
  }[]>,
  capsuleInfo: Record<string, {
    capsuleSourceLineRef, capsuleSourceNameRef
  }>
}
```

---

## G4. Relationship Patterns

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
- **Identifying**: Property has `propertyContractDelegate` starting with `#` and
  `MAPS_TO` edge pointing to the schema capsule.
- **Query via mappings**: `mappings[capsuleName]` includes entries with `delegate`
  field set, representing struct dependencies.
- **Query via properties**: `properties[capsuleName]` array, find entries where
  `propertyContractDelegate === '#<schemaUri>'`.

### Pattern D: Struct Options (metadata on a struct dependency)
- **Use case**: Column declares `label`, `parentColumn` as options on schema dependency.
- **Storage**: Options are stored in the CST on the `PropertyContract` entry.
- **TODO**: Add `options` (JSON) field to `PropertyContract` node table and import it.
  Then the API can query options directly from the graph.

### Pattern E: Element-to-Column Tagging
```
(Element:Capsule) → ... → (Prop {delegate: "#<columnUri>"}) → MAPS_TO → (Column:Capsule)
```
- **Use case**: Element capsule (LoginService) tags a column capsule (Authentication).
- **Query**: Reverse lookup — find all capsules whose `mappings` contain a delegate
  pointing to a specific column capsule name.

---

## G5. Quadrant ColumnTree API — Query Strategy

The `getColumnTree` method needs to:

1. **Get all capsules** in the spine via `getCapsuleNamesBySpine(uri)`.
2. **Fetch relations** via `fetchCapsuleRelations(allNames)`.
3. **Identify columns**: Capsules whose `properties` include a delegate to `COLUMN_SCHEMA_NAME`.
   ```
   properties[name].some(p => p.propertyContractDelegate === '#' + COLUMN_SCHEMA_NAME)
   ```
4. **Get column options** (label, parentColumn): From `PropertyContract.options` field
   (once imported into graph) or from CST data.
5. **Build tree from parentColumn**: Group columns by their `parentColumn` value.
   Root columns have no `parentColumn`. Child columns reference parent by capsuleName.
6. **Collect elements per column**: For each column, find capsules whose `mappings`
   contain a delegate pointing to that column's capsuleName.
   ```
   mappings[elementName].some(m => m.delegate && m.target === columnCapsuleName)
   ```
7. **Construct response**: `{ columns: [{ column: { label }, capsules: [...], columns: [...] }] }`

---

## G6. Instructions for Future AI Sessions

### When modifying the graph schema:
1. Update `ensureSchema` in **both** `Capsule-Ladybug-v0/EngineAPI.ts` AND
   `Capsule-JsonFiles-v0/EngineAPI.ts` (schema is defined in EngineAPI).
2. Update import logic in **both** `ImportCapsuleSourceTrees.ts` files.
3. Update query methods in **both** `EngineAPI.ts` files.
4. Both engines MUST return identical data shapes — they are interchangeable.

### When adding new query capabilities:
1. Prefer adding data to `fetchCapsuleRelations` return value over new methods.
   This keeps the batch-query pattern efficient.
2. If a new relationship type is needed, add a new edge table and update `linkMappings`.
3. Always test with both engines to ensure parity.

### When working on model APIs (like Quadrant/API.ts):
1. APIs receive `graph` (the engine EngineAPI instance) as first argument.
2. APIs should be **engine-agnostic** — only use methods defined in EngineAPI.
3. Use `fetchCapsuleRelations` for bulk data, avoid per-capsule queries in loops.
4. The API layer handles shaping/composition; the engine handles raw graph queries.

### Key file locations:
- **Ladybug engine**: `engines/Capsule-Ladybug-v0/` (EngineAPI.ts, ImportCapsuleSourceTrees.ts)
- **JsonFiles engine**: `engines/Capsule-JsonFiles-v0/` (same structure)
- **Quadrant API**: `models/Framespace/Visualization/Quadrant/API.ts`
- **Quadrant test**: `models/Framespace/Visualization/Quadrant/run-model.test.ts`
- **Column schema**: `models/Framespace/Visualization/Quadrant/schema/Column.ts`
- **Example capsules**: `models/Framespace/Visualization/Quadrant/examples/01-ColumnTree/`

### CST regeneration:
- CSTs are cached in `.~o/encapsulate.dev/static-analysis/` directories.
- Delete cached CSTs to force regeneration after changing the static analyzer.
- The static analyzer is at `encapsulate.dev/packages/encapsulate/src/static-analyzer.v0.ts`.
