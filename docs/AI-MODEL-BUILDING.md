> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# FramespaceGenesis — Model Development Reference

Framespace Genesis is an ontology-driven structural modeling tool. You build models by writing TypeScript capsule files that declare entities, properties, relationships, and dimensional memberships. The tool imports these declarations into a graph, queries the graph through semantic layers, and renders interactive visualizations in a web workbench.

This document is everything you need to build models productively. It covers the concepts, the architecture, the capsule patterns, and the practical workflows.

> **Further reading**: [README.md](../README.md) · [L4-space-models/Capsular/README.md](../L4-space-models/Capsular/README.md) · [L6-semantic-models/README.md](../L6-semantic-models/README.md) · [L8-view-models/README.md](../L8-view-models/README.md) · Each engine has its own `AI-MODEL-REFERENCE.md` with storage-specific details.

---

## 1. Core Concepts

### What is a Model?

A model is a collection of **capsule** files that declare entities and their relationships. When you run a model, it produces:
- A **Spine Instance Tree** (`.sit.json`) — the full capsule structure with all nodes and edges
- Optionally, **Membrane Events** (`.events.json`) — runtime call/property-access traces

These artifacts are imported into a **graph engine** where they become queryable nodes and edges.

### Capsules

Everything in Framespace is a **capsule** — a TypeScript file that exports an `async function capsule()` which calls `encapsulate()` to declare its structure. Capsules are the universal building block. There are several kinds:

| Kind | Purpose | Example |
|------|---------|---------|
| **Element capsule** | A domain entity (service, component, database) | `LoginService.ts`, `Greeter.ts` |
| **View capsule** | A dimensional category (column, row) for layout | `view/Columns/Services.ts` |
| **Schema capsule** | A struct definition used by view capsules | `L8/.../schema/Column.ts` |
| **Root model** | Ties everything together, exports `MODEL_NAME` + `runModel` | `0A-InfrastructurePlan1.ts` |

### The Layer Stack

The project is organized into numbered layers, each with a specific role:

```
L3  Model Server    — HTTP API, boots models, serves workbench
L4  Space Models    — Graph engines, import pipelines, example models
L6  Semantic Models — Domain query APIs over the graph (CapsuleSpine)
L8  View Models     — Shape query results for specific visualizations (Quadrant, Codepath)
L13 Workbench       — SolidJS web UI, dockview panels, visualization reps
```

**Data flows upward**: L4 stores raw data → L6 queries it into domain objects → L8 shapes it for rendering → L13 displays it.

**Key rule**: Each layer only talks to the one below it. L8 calls L6 methods. L6 calls L4 engine methods. L13 calls L8/L6 via HTTP. Never skip layers.

---

## 2. Project Layout

```
FramespaceGenesis/
├── framespace.yaml                    # Engine config (which engine to use)
├── L3-model-server/
│   ├── server.ts                      # Boots all models, starts HTTP server (port 4000)
│   └── ModelServer.ts                 # Model loading, API dispatch
├── L4-space-models/Capsular/
│   ├── ModelQueryMethods.ts           # Public query API (delegates to engine)
│   ├── SpineInstanceTrees.ts          # Model registration + import
│   ├── ModelEngines.ts                # Engine selection
│   ├── engines/
│   │   ├── Memory-v0/                 # In-memory (ephemeral, for tests)
│   │   ├── JsonFiles-v0/              # JSON files on disk (default)
│   │   ├── SqLite-v0/                 # SQLite database
│   │   └── Ladybug-v0/               # Graph database (Cypher)
│   └── examples/                      # L4-level example models
│       ├── 01-Documentation/
│       ├── 02-TreeRelationships/
│       └── 03-MembraneEvents/
├── L6-semantic-models/
│   ├── Capsular/CapsuleSpine/         # Main semantic model (CapsuleSpine)
│   └── Framespace/Workbench/          # Workbench utility methods
├── L8-view-models/CapsuleSpine/
│   ├── Quadrant/                      # Quadrant grid visualization
│   └── Codepath/                      # Code execution path visualization
├── L13-workbench/vinxi-app/           # SolidJS workbench (port 3000)
├── examples/
│   ├── Quadrant-BackendServices/      # Full example with elements + views
│   └── Codepath-SimplePasswordLogin/  # Full example with executable code + events
└── docs/
    └── AI-MODELING.md                 # ← You are here
```

---

## 3. How to Build a Model

### 3.1 Structure-Only Model (Quadrant-style)

A structure-only model declares entities and their visual layout dimensions. No code is executed at runtime — the model is purely declarative.

**Reference example**: `examples/Quadrant-BackendServices/`

#### Directory layout
```
examples/MyModel/
├── 0A-MyModel.ts              # Root model
├── 0A-MyModel.test.ts         # Test
├── elements/                  # Domain entities
│   ├── ServiceA.ts
│   └── DatabaseB.ts
└── view/                      # Visual dimensions
    ├── Columns/
    │   ├── Infrastructure.ts  # Root column
    │   └── infra/
    │       ├── Frontend.ts    # Sub-column
    │       └── Backend.ts     # Sub-column
    └── Rows/
        ├── Tiers.ts           # Root row
        └── tiers/
            ├── Web.ts
            └── Data.ts
```

#### Element capsule
An element capsule declares what the entity **is** and which view dimensions it belongs to:

```typescript
// elements/ServiceA.ts
export async function capsule({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},

            // Tag this entity into view dimensions:
            '#../view/Columns/infra/Backend': {},    // Column placement
            '#../view/Rows/tiers/Data': {},           // Row placement
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/examples/MyModel/elements/ServiceA'
```

The `#../view/Columns/infra/Backend': {}` line is a **struct membership** — it tags this capsule as belonging to the "Backend" column. The view model reads these memberships to place entities on a grid.

#### View capsule (column or row)
View capsules define the visual hierarchy. Each one references a **schema struct** from L8 and optionally a **parent** view capsule:

```typescript
// view/Columns/infra/Backend.ts
export async function capsule({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},

            '#../Infrastructure': {},                              // parent column

            '#../../../../L8-view-models/CapsuleSpine/Quadrant/schema/Column': {
                options: { '#': { label: 'Backend' } }            // display label
            },
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/examples/MyModel/view/Columns/infra/Backend'
```

The parent reference (`#../Infrastructure`) creates a tree: `Infrastructure → Backend`. The L8 Quadrant view model walks this tree to build hierarchical column headers.

#### Root model
The root model ties everything together. It maps all element capsules and declares which visualizations are available:

```typescript
// 0A-MyModel.ts
export const MODEL_NAME = `@stream44.studio/FramespaceGenesis/examples/MyModel/0A-MyModel`

export async function runModel({ run }) {
    return await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    config: {
                        type: CapsulePropertyTypes.Constant,
                        value: {
                            framespaces: {
                                // Which visualizations this model supports:
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods': {
                                    visualizationMethod: {
                                        'getTableView': { label: 'Quadrant Table View' }
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods': {
                                    visualizationMethod: {
                                        'getSpineInstanceTree': { label: 'Spine Instance Tree' }
                                    }
                                },
                            }
                        }
                    },
                    ServiceA: { type: CapsulePropertyTypes.Mapping, value: './elements/ServiceA' },
                    DatabaseB: { type: CapsulePropertyTypes.Mapping, value: './elements/DatabaseB' },
                }
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: MODEL_NAME
        })
        return { spine }
    }, async ({ spine, apis }: any) => {
        return { api: apis[spine.capsuleSourceLineRef], sitRoot: import.meta.dir }
    }, {
        importMeta: import.meta,
    })
}
```

### 3.2 Executable Model (Codepath-style)

An executable model has the same structure but adds **runnable code** and **membrane event capture**. The events record every property access and function call across capsule boundaries at runtime.

**Reference examples**: `L8-view-models/CapsuleSpine/Codepath/examples/01-SimplePasswordLogin/` · `examples/Codepath-SimplePasswordLogin/`

#### Element capsule with executable code

```typescript
// caps/Greeter.ts
export async function capsule({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                _prefix: { type: CapsulePropertyTypes.String, value: 'Hello' },
                greet: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, name: string): string {
                        return `${this._prefix}, ${name}!`
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '...'
```

#### Root model with execution and event capture

The key differences from a structure-only model:
1. The `run` phase calls executable methods on capsules
2. `captureEvents: true` records membrane events

```typescript
export async function runModel({ run }) {
    return await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({ /* ... capsule structure ... */ })
        return { spine }
    }, async ({ spine, apis }: any) => {
        const api = apis[spine.capsuleSourceLineRef]
        const result = api.runModel()              // ← Execute code
        return { api, sitRoot: import.meta.dir, result }
    }, {
        importMeta: import.meta,
        captureEvents: true,                       // ← Record events
    })
}
```

### 3.3 Property Types Reference

| Type | Use | Example |
|------|-----|---------|
| `CapsulePropertyTypes.Mapping` | Import another capsule | `value: './caps/ServiceA'` |
| `CapsulePropertyTypes.Function` | Executable function | `value: function(this: any) { ... }` |
| `CapsulePropertyTypes.String` | String data property | `value: 'hello'` |
| `CapsulePropertyTypes.Constant` | Immutable metadata | `value: { framespaces: { ... } }` |
| `CapsulePropertyTypes.Init` | Runs once on initialization | `value: async function() { ... }` |

---

## 4. Testing Your Model

Every example model has a test file. The test framework registers the model, imports it to the engine, and auto-generates snapshot tests for all query methods.

### Test file template

```typescript
#!/usr/bin/env bun test
import * as bunTest from 'bun:test'
import { join } from 'path'
import { run } from '@stream44.studio/t44/standalone-rt'
import { MODEL_NAME, runModel } from './0A-MyModel'

const {
    test: { describe, it, expect, expectSnapshotMatch },
    spineInstanceTrees,
    modelEngines,
    modelQueryMethodTests,
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44/caps/ProjectTest',
                    options: { '#': { bunTest, env: {} } }
                },
                spineInstanceTrees: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../SpineInstanceTrees',       // relative to examples/
                },
                modelEngines: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../ModelEngines',
                },
                modelQueryMethodTests: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../ModelQueryMethodTests',
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: `${MODEL_NAME}.test`,
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, { importMeta: import.meta })

describe('0A-MyModel', () => {
    it('run model', async () => {
        await spineInstanceTrees.registerInstance({ name: MODEL_NAME }, runModel)
    })

    it('imports instance to engine', async () => {
        await spineInstanceTrees.importInstanceToEngine({ engine: modelEngines.getEngine() })
    })

    // Auto-generated snapshot tests for all standard query methods:
    modelQueryMethodTests.makeTests({
        describe, it, expect, expectSnapshotMatch,
        engine: modelEngines.getEngine(),
        spineInstanceTreeId: MODEL_NAME,
        packageRoot: join(import.meta.dir, '..', '..', '..', '..'),
        config: {
            getCapsuleWithSource: { capsuleName: MODEL_NAME },
            getCapsuleSpineTree_data: { capsuleName: MODEL_NAME },
            fetchCapsuleRelations: { capsuleNames: [MODEL_NAME] },
        }
    })
})
```

### Running tests

```bash
t <path-to-test-file>         # run
td <path-to-test-file>        # debug
bun test --update-snapshots   # update snapshots after structural changes
```

### Test architecture (details in [L4 Capsular README](../L4-space-models/Capsular/README.md))

1. **Per-example tests** (`examples/**/0x-<Name>.test.ts`) — fast, single-engine
2. **Multi-instance accumulated tests** (`ModelQueryMethods.test.ts` Block 2) — all examples in one engine
3. **Cross-engine comparison** (`ModelQueryMethods.test.ts` Block 3) — ensures all engines return identical results

---

## 5. The Graph: Nodes and Edges

When a model is imported, the engine creates these node and edge types:

### Nodes

| Node | Purpose | Primary Key |
|------|---------|-------------|
| **Capsule** | Identity record for each capsule in a tree | `<treeId>::<lineRef>` |
| **CapsuleSource** | File metadata (path, line numbers, extends) | `<lineRef>::source` |
| **SpineContract** | Spine contract a capsule implements | `<lineRef>::spine::<uri>` |
| **PropertyContract** | Property group within a spine contract | `<lineRef>::pc::<spine>::<key>` |
| **CapsuleProperty** | Individual property (Mapping, Function, String, etc.) | `<lineRef>::prop::<name>` |
| **CapsuleInstance** | Runtime instance in the instance tree | `instanceId` |
| **MembraneEvent** | Runtime event (call, get, set) | `<treeId>::evt::<eventIndex>` |

### Edges

| Edge | From → To | Meaning |
|------|-----------|---------|
| **HAS_SOURCE** | Capsule → CapsuleSource | Links capsule to its source metadata |
| **IMPLEMENTS_SPINE** | Capsule → SpineContract | Capsule implements a contract |
| **HAS_PROPERTY_CONTRACT** | SpineContract → PropertyContract | Contract contains property groups |
| **HAS_PROPERTY** | PropertyContract → CapsuleProperty | Group contains properties |
| **MAPS_TO** | CapsuleProperty → Capsule | Mapping resolves to target capsule |
| **EXTENDS** | Capsule → Capsule | Capsule extends another |
| **DELEGATES_TO** | CapsuleProperty → PropertyContract | Property delegates to a contract |
| **INSTANCE_OF** | CapsuleInstance → Capsule | Instance links to its definition |
| **PARENT_INSTANCE** | CapsuleInstance → CapsuleInstance | Instance tree parent-child |
| **HAS_MEMBRANE_EVENT** | Capsule → MembraneEvent | Capsule's runtime events |

> For complete schema details per engine, see the engine-specific docs:
> [Memory-v0](../L4-space-models/Capsular/engines/Memory-v0/AI-MODEL-REFERENCE.md) ·
> [JsonFiles-v0](../L4-space-models/Capsular/engines/JsonFiles-v0/AI-MODEL-REFERENCE.md) ·
> [SqLite-v0](../L4-space-models/Capsular/engines/SqLite-v0/AI-MODEL-REFERENCE.md) ·
> [Ladybug-v0](../L4-space-models/Capsular/engines/Ladybug-v0/AI-MODEL-REFERENCE.md)

---

## 6. Query Layers

### L4 Engine Query Methods (raw graph access)

All engines implement identical `_`-prefixed methods. These are the primitives everything else is built on.

| Method | Returns |
|--------|---------|
| `_listCapsules(treeId)` | All capsules in a tree |
| `_getCapsuleWithSource(treeId, name)` | One capsule + source metadata |
| `_getCapsuleSpineTree_data(treeId, lineRef)` | Full spine/contract/property tree for one capsule |
| `_getCapsuleNamesBySpineTree(treeId)` | All capsule names |
| `_fetchCapsuleRelations(treeId, names[])` | Batch: mappings, extends, properties |
| `_listSpineInstanceTrees(treeId?)` | All trees (or capsules in one tree) |
| `_getInstancesBySpineTree(treeId)` | Runtime instances |
| `_getRootInstance(treeId)` | Root of the instance tree |
| `_getChildInstances(parentId)` | Children of an instance |
| `_fetchInstanceRelations(treeId)` | Batch instance data |
| `_getMembraneEvents(treeId)` | All events, sorted by index |
| `_getMembraneEventsByCapsule(treeId, lineRef)` | Events for one capsule |

### L6 Semantic Model (CapsuleSpine — domain queries)

The CapsuleSpine semantic model at `L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods.ts` composes engine methods into higher-level operations:

| Method | Returns | Description |
|--------|---------|-------------|
| `listCapsules` | `{ '#': 'Capsules', list }` | All capsules, optionally with full structure |
| `getCapsule` | Capsule entity with spine tree | Full capsule with contracts and properties |
| `getSpineDeclarationTree` | `{ '#': 'SpineDeclarationTree', rootCapsule }` | Recursive capsule mapping tree (declarations) |
| `getSpineInstanceTree` | `{ '#': 'SpineInstanceTree', rootInstance }` | Recursive instance tree (runtime) |
| `getMembraneEvents` | `{ '#': 'MembraneEvents', list }` | Raw events from L4 |
| `getEventLog` | `{ '#': 'EventLog', entries }` | Interpreted events with caller resolution, active invocation tracking |

### L8 View Models (visualization shaping)

| View Model | Method | Returns | Schema Structs |
|------------|--------|---------|----------------|
| **Quadrant** | `getTableView(treeId)` | `{ '#': 'TableView', spineInstanceTreeId }` | `schema/Column.ts`, `schema/Row.ts` |
| **Codepath** | `getSwimlaneView(treeId)` | `{ '#': 'SwimlaneView', columns, rows }` | Uses membrane events for columns/rows |

L8 models always access data through an L6 mapping:
```typescript
CapsuleSpine: { type: CapsulePropertyTypes.Mapping, value: '.../L6-semantic-models/.../ModelQueryMethods' }
```

---

## 7. The Model Server and Workbench

### Starting

```bash
bun run dev    # Starts model-server (port 4000) + workbench (port 3000)
```

### Model Server (L3)

The model server at `L3-model-server/server.ts` boots all registered semantic models, imports all discovered example models, and exposes every method via HTTP.

**Registering a model** — add to the `models` config in `server.ts`:
```typescript
'@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods': {
    engine: {
        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
    }
},
```

**API call format**: `GET /api/<namespace>/<method>?arg1=value1`

Where namespace is the model URI with `/` → `~`:
```
@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods
→ @stream44.studio~FramespaceGenesis~L6-semantic-models~Capsular~CapsuleSpine~ModelQueryMethods
```

### Workbench (L13)

The workbench at `L13-workbench/vinxi-app/` is a SolidJS app using dockview panels. Key UI components:

- **Instance Selector** — pick an example model to view
- **Framespaces Panel** — shows visualizations available for the selected instance (driven by the model's `config.framespaces`)
- **Model APIs Panel** — browse all registered API methods, grouped by layer (L4, L6, L8); click methods to open panels

**State persistence** (survives reload): selected instance, selected engine, dockview layout, Examples/Tests tab. Managed in `workbenchStore.ts`.

### Visualization Reps

Reps are SolidJS components that render query results. Each rep matches a `'#'` type tag:

```typescript
// L8-view-models/CapsuleSpine/Codepath/reps/CodepathGrid.tsx
renderLib.registerRep({
    name: 'SwimlaneView',
    match: (data: any) => data?.['#'] === 'SwimlaneView',
    render: (data: any, context: any) => { /* SolidJS JSX */ },
})
```

Register in `L13-workbench/vinxi-app/src/lib/visualizations/index.ts`:
```typescript
import "~L8/CapsuleSpine/Codepath/reps/CodepathGrid";
```

---

## 8. Engines

Four pluggable storage engines implement the same interface. See [L4 Capsular README](../L4-space-models/Capsular/README.md) for full details.

| Engine | Storage | Persistence | Best For |
|--------|---------|-------------|----------|
| **Memory-v0** | JS objects | Ephemeral | Tests (fast, no disk I/O) |
| **JsonFiles-v0** | JSON files in `.~o/` | Persistent | **Development default** |
| **SqLite-v0** | SQLite via `bun:sqlite` | Persistent | SQL-familiar workflows |
| **Ladybug-v0** | LadybugDB (Cypher) | Ephemeral | Graph query experimentation |

### Configuration

`framespace.yaml` at the package root selects the active engine:
```yaml
engines:
  - JsonFiles-v0   # default for development
```

### Engine parity

**All engines MUST return identical data shapes.** The cross-engine test block in `ModelQueryMethods.test.ts` enforces this. When adding a method to one engine, add it to all four.

### Method naming across layers

| Location | Convention | Example |
|----------|-----------|---------|
| Engine QueryAPI | `_` prefix | `_getMembraneEvents` |
| Engine ImportAPI calling QueryAPI | No `_` (goes through membrane) | `this.mergeNode()` |
| L4 ModelQueryMethods (public) | No `_` | `getMembraneEvents` |
| L6/L8 Semantic/View Model | No `_` (API method) | `getEventLog`, `getSwimlaneView`, `getTableView` |

---

## 9. Membrane Events (Runtime Traces)

Membrane events capture every property access and function call across capsule boundaries during model execution. They power the Codepath visualization.

### Enabling capture

Set `captureEvents: true` in the `run()` call of your root model.

### Pipeline

```
Model execution (captureEvents: true)
  → .events.json written alongside .sit.json
    → SpineInstanceTrees.importInstanceToEngine()
      → engine.importMembraneEvents()
        → MembraneEvent nodes + HAS_MEMBRANE_EVENT edges
```

### Event types

| Type | Meaning |
|------|---------|
| `call` | Function invoked on a capsule |
| `call-result` | Function returned a result |
| `get` | Property read from a capsule |
| `set` | Property written to a capsule |

### Membrane property (internal vs external)

Each event has a `membrane` property indicating where the access originated:

| Value | Meaning |
|-------|---------|
| `external` | Access from outside the capsule (e.g., `api.username`) |
| `internal` | Access from within a function body (e.g., `this.username` inside a method) |

This distinction allows tracking both the public API surface interactions and the internal property accesses that occur during function execution.

### Querying events

- **L4**: `getMembraneEvents(treeId)` — raw events sorted by eventIndex
- **L6**: `getEventLog(treeId)` — interpreted log with caller resolution and active invocation tracking
- **L8 Codepath**: `getSwimlaneView(treeId)` — `SwimlaneView` with capsule columns and event rows

---

## 10. Common Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| `this._foo is not a function` at runtime | Engine missing the method (usually JsonFiles-v0) | Add method to all engines |
| Model methods not in workbench UI | Model not registered in `server.ts` | Add to `models` config |
| TSX lint errors for `solid-js` | Expected in L8 rep files | They compile fine via vinxi-app |
| `run` implicit any lint | Known TS lint for `standalone-rt` | Non-blocking, ignore |
| Snapshot failures after adding examples | Snapshots include counts | `bun test --update-snapshots` |
| `mergeNode` vs `_mergeNode` | ImportAPI uses `this.mergeNode()` (no `_`) through membrane | Never call `_mergeNode` directly from ImportAPI |
| `escLong` error in Ladybug-v0 | Must be defined locally in each method | Copy pattern from `_importSingleCst` |
| Stale workbench layout | Layout cached in localStorage | Increment `LAYOUT_VERSION` in `workbenchStore.ts` |
| `'#': 'SpineInstances'` not `'SpineInstanceTrees'` | Return shape naming | Use the actual `'#'` value in assertions |

---

## 11. Where to Place Examples

Examples live in different locations depending on their purpose:

| Location | Purpose |
|----------|--------|
| `L4-space-models/Capsular/examples/` | Validating low-level Capsular features (engine import, graph queries, membrane events) |
| `L6-semantic-models/.../examples/` | Examples specifically related to semantic model visualizations |
| `L8-view-models/CapsuleSpine/<ViewType>/examples/` | Examples specifically related to a view-model visualization (Quadrant, Codepath, etc.) |
| `examples/<ViewType>-<Name>/` | Top-level full-stack examples that wire a model through ModelServer; re-export from L8 examples |

**Pattern for top-level examples** (`examples/`):
- Top-level examples are self-contained with their own `MODEL_NAME` (using the `examples/` path)
- They duplicate the model + caps from the corresponding L8 view-model example
- The test file uses `ModelServer` to boot the full stack
- L8 examples remain canonical for view-model-specific testing

**Existing examples**:
- `examples/Quadrant-BackendServices/` → self-contained, based on `L8-view-models/CapsuleSpine/Quadrant/examples/01-BackendServices/model.ts`
- `examples/Codepath-SimplePasswordLogin/` → self-contained, based on `L8-view-models/CapsuleSpine/Codepath/examples/01-SimplePasswordLogin/model.ts`

---

## 12. Quick Reference: Building a New Model

```
1. Create directory:  examples/<NN-Name>/
2. Write capsules:    caps/ServiceA.ts, caps/ServiceB.ts (element capsules)
3. Write view dims:   view/Columns/..., view/Rows/... (if Quadrant-style)
4. Write root model:  0A-<Name>.ts (MODEL_NAME + runModel + framespaces config)
5. Write test:        0A-<Name>.test.ts (register + import + makeTests)
6. Run test:          t examples/<NN-Name>/0A-<Name>.test.ts
7. View in workbench: bun run dev → open http://localhost:3000
```

### Decision checklist

- **Structural only?** → No `captureEvents`, no `runModel` execution, just declare capsules and map them
- **Executable code?** → Add `captureEvents: true`, add function properties, execute in `runModel`
- **Custom visualization?** → Create L8 view model + SolidJS rep, register in `server.ts` + `visualizations/index.ts`
- **New graph data types?** → Extend all 4 engines (QueryAPI + ImportAPI), then L4/L6 methods
- **Show in Framespaces panel?** → Add `config.framespaces` to root capsule constant
