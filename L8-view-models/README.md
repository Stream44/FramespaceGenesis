L8 View Models
===

The **L8 View Models** layer provides high-level view model query APIs that compose L6 semantic model methods into visualization-ready data structures. Each view model defines methods that return structured objects optimized for UI rendering.

## Models

- **CapsuleSpine/Quadrant** — Query API for *Quadrant Grid* visualization (column tree, row tree, grid placement)

## Layout

```
L8-view-models/
└─ CapsuleSpine/
   └─ Quadrant/
        ├─ ModelQueryMethods.ts          — View model query API capsule
        ├─ ModelQueryMethods.test.ts     — Per-instance tests across spine trees
        ├─ _ModelQueryMethodsSchema.json — Generated API schema (written by init)
        ├─ schema/
        │    ├─ Column.ts                — Column dimension schema capsule
        │    └─ Row.ts                   — Row dimension schema capsule
        └─ examples/
             └─ 01-ColumnTree/
                  ├─ model.ts            — Example model definition
                  ├─ elements/           — Element capsules (services, databases)
                  └─ view/               — View capsules (columns, rows)
```

## Integration with ModelServer

View models are mounted by `L3-model-server/ModelServer` via the `models` option:

```typescript
models: {
    '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods': {
        engine: {
            '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
        }
    }
}
```

Each method in the view model's `apiSchema` is exposed via HTTP at `/api/<namespace>/<method>`.
