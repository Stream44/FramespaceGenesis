L6 Semantic Models
===

The **L6 Semantic Models** layer provides high-level query APIs that compose L4 space model engine methods into convenient semantic operations. Each semantic model defines methods that return structured objects.

## Models

- **Capsular/CapsuleSpine** — Query API for *Spine Instance Trees*, *Capsule Source Trees* and *Membrane Events*
- **Framespace/Workbench** — Workbench API

## Layout

```
L6-semantic-models/
├─ Capsular/
│  └─ CapsuleSpine/
│       ├─ ModelQueryMethods.ts          — Semantic query API capsule
│       ├─ ModelQueryMethods.test.ts     — Per-instance tests across all spine trees
│       └─ _ModelQueryMethodsSchema.json — Generated API schema (written by init)
└─ Framespace/
   └─ Workbench/
        ├─ ModelQueryMethods.ts          — Workbench utilities capsule
        ├─ ModelQueryMethods.test.ts     — Tests for workbench methods
        └─ _ModelQueryMethodsSchema.json — Generated API schema (written by init)
```

## Integration with ModelServer

Semantic models are mounted by `L3-model-server/ModelServer` via the `models` option:

```typescript
models: {
    '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods': {
        engine: {
            '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
        }
    }
}
```

Each method in the semantic model's `apiSchema` is exposed via HTTP at `/api/<namespace>/<method>`.
