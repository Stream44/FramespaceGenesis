#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { resolve } from 'path'
import { run } from '@stream44.studio/t44/standalone-rt'

const MOUNT_KEY = '@stream44.studio~FramespaceGenesis~L6-semantic-models~Capsular~CapsuleSpine~ModelQueryMethods'
const ENGINE_KEY = '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI'
const PACKAGE_ROOT = resolve(import.meta.dir, '..')

const {
    test: { describe, it, expect },
    modelServer,
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
                modelServer: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './ModelServer',
                    options: {
                        '#': {
                            models: {
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods': {
                                    engine: {
                                        [ENGINE_KEY]: {}
                                    }
                                }
                            }
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L3-model-server/ModelServer.test',
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: { dir: PACKAGE_ROOT } as any,
    runFromSnapshot: false,
})

// ── Discover a spineInstanceTreeId for testing ──────────────────────
await modelServer.init()
// Get the engine from the loaded model (not from modelEngines which is the raw mapping)
const loadedModel = modelServer._models.find((m: any) => m.engineUri === ENGINE_KEY)
if (!loadedModel) throw new Error(`No loaded model found for engine ${ENGINE_KEY}`)
const engine = loadedModel.engine
// Ensure at least one instance is imported into the engine (lazy import is deferred)
const registeredModels = modelServer.spineInstanceTrees?.getModels ?? []
for (const m of registeredModels) {
    await modelServer._ensureImported(m.name, engine)
}
const _trees = await engine._listSpineInstanceTrees()
if (_trees.length === 0) throw new Error('No spine instance trees found - engine may not have loaded data correctly')
const TREE_ID = _trees[0].spineInstanceTreeId

const port = 14000 + Math.floor(Math.random() * 1000)
const BASE_URL = `http://localhost:${port}`

describe('ModelServer Capsule', () => {

    bunTest.afterAll(async () => {
        modelServer.stop()
    })

    it('starts the server via capsule', async () => {
        const result = await modelServer.startServer(port, { skipInit: true })
        expect(result.port).toBe(port)
        expect(result.server).toBeDefined()

        // Wait for the server to be ready by polling /api/health
        let ready = false
        for (let i = 0; i < 60; i++) {
            try {
                const res = await fetch(`${BASE_URL}/api/health`)
                if (res.ok) { ready = true; break }
            } catch { /* not ready yet */ }
            await Bun.sleep(500)
        }
        expect(ready).toBe(true)
    }, 60_000)

    // ── Health ────────────────────────────────────────────────────────
    it('GET /api/health returns ok', async () => {
        const res = await fetch(`${BASE_URL}/api/health`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.status).toBe('ok')
        expect(data.methods).toBeGreaterThan(0)
        expect(data.models.length).toBe(1)
    })

    // ── API property ─────────────────────────────────────────────────
    it('api property exposes mounted semantic model', () => {
        const api = modelServer.api
        expect(api[MOUNT_KEY]).toBeDefined()
        expect(typeof api[MOUNT_KEY].listCapsules).toBe('function')
        expect(typeof api[MOUNT_KEY].getCapsule).toBe('function')
        expect(typeof api[MOUNT_KEY].getSpineDeclarationTree).toBe('function')
        expect(typeof api[MOUNT_KEY].getSpineInstanceTree).toBe('function')
    })

    // ── HTTP API Methods ─────────────────────────────────────────────
    it('GET listCapsules returns capsules', async () => {
        const res = await fetch(`${BASE_URL}/dev/api/${MOUNT_KEY}/listCapsules?spineInstanceTreeId=${encodeURIComponent(TREE_ID)}`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.method).toBe('listCapsules')
        expect(data.namespace).toBe(MOUNT_KEY)
        expect(data.result['#']).toBe('Capsules')
        expect(Array.isArray(data.result.list)).toBe(true)
        expect(data.result.list.length).toBeGreaterThan(0)
    })

    it('GET getCapsule with spineInstanceTreeId and capsuleName returns capsule', async () => {
        const listRes = await fetch(`${BASE_URL}/dev/api/${MOUNT_KEY}/listCapsules?spineInstanceTreeId=${encodeURIComponent(TREE_ID)}`)
        const listData = await listRes.json() as any
        const capsuleName = listData.result.list[0]?.['$id'] ?? ''
        expect(capsuleName).not.toBe('')

        const res = await fetch(`${BASE_URL}/dev/api/${MOUNT_KEY}/getCapsule?spineInstanceTreeId=${encodeURIComponent(TREE_ID)}&capsuleName=${encodeURIComponent(capsuleName)}`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.method).toBe('getCapsule')
        expect(data.namespace).toBe(MOUNT_KEY)
        expect(data.result).toBeDefined()
        expect(data.result['#']).toBe('Capsule')
    })

    it('POST getCapsule with args body', async () => {
        const listRes = await fetch(`${BASE_URL}/dev/api/${MOUNT_KEY}/listCapsules?spineInstanceTreeId=${encodeURIComponent(TREE_ID)}`)
        const listData = await listRes.json() as any
        const capsuleName = listData.result.list[0]?.['$id'] ?? ''

        const res = await fetch(`${BASE_URL}/dev/api/${MOUNT_KEY}/getCapsule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ args: [TREE_ID, capsuleName] }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.result['#']).toBe('Capsule')
    })

    // ── Error handling ───────────────────────────────────────────────
    it('GET nonExistentMethod returns 404', async () => {
        const res = await fetch(`${BASE_URL}/dev/api/${MOUNT_KEY}/nonExistentMethod`)
        expect(res.status).toBe(404)
        const data = await res.json() as any
        expect(data.error).toContain('Unknown method')
    })

    it('GET /unknown returns 404', async () => {
        const res = await fetch(`${BASE_URL}/unknown`)
        expect(res.status).toBe(404)
    })
})
