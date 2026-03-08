#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from './lib'
import { dirname } from 'path'

const PACKAGE_ROOT = dirname(import.meta.dir)

const {
    test: { describe, it, expect, expectSnapshotMatch },
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
                                        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Framespace/Workbench/ModelQueryMethods': {
                                    engine: {
                                        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods': {
                                    engine: {
                                        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Codepath/ModelQueryMethods': {
                                    engine: {
                                        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
                                    }
                                },
                            }
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L3-model-server/server.test',
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: { dir: PACKAGE_ROOT } as any,
    runFromSnapshot: false,
})

describe('L3 Model Server - Full Stack Debug', () => {

    it('init model server with all 4 semantic models', async () => {
        await modelServer.init()
    }, 60_000)

    it('schema snapshot', () => {
        const schema = modelServer._buildSchema()
        expect(schema).toBeDefined()
        expect(schema.apis).toBeDefined()
        expect(Object.keys(schema.apis).length).toBe(4)
        expectSnapshotMatch(normalizeForSnapshot(schema, PACKAGE_ROOT))
    })

    it('listSpineInstanceTrees via Workbench model', async () => {
        const workbenchNs = '@stream44.studio~FramespaceGenesis~L6-semantic-models~Framespace~Workbench~ModelQueryMethods'
        const api = modelServer.api
        expect(api[workbenchNs]).toBeDefined()
        const result = await api[workbenchNs].listSpineInstanceTrees()
        expect(result).toBeDefined()
        expect(result['#']).toBe('SpineInstances')
        expect(result.list.length).toBeGreaterThan(0)
        expectSnapshotMatch(normalizeForSnapshot(result, PACKAGE_ROOT))
    })

    it('listSpineInstanceTrees via HTTP', async () => {
        const { port } = await modelServer.startServer(0, { skipInit: true })
        const BASE_URL = `http://localhost:${port}`

        // Wait for server ready
        let ready = false
        for (let i = 0; i < 30; i++) {
            try {
                const res = await fetch(`${BASE_URL}/api/health`)
                if (res.ok) { ready = true; break }
            } catch { }
            await Bun.sleep(200)
        }
        expect(ready).toBe(true)

        // Fetch schema
        const schemaRes = await fetch(`${BASE_URL}/api/schema`)
        expect(schemaRes.status).toBe(200)
        const schemaData = await schemaRes.json() as any
        expect(Object.keys(schemaData.apis).length).toBe(4)

        // Fetch listSpineInstanceTrees
        const workbenchNs = '@stream44.studio~FramespaceGenesis~L6-semantic-models~Framespace~Workbench~ModelQueryMethods'
        const listRes = await fetch(`${BASE_URL}/api/${workbenchNs}/listSpineInstanceTrees`)
        expect(listRes.status).toBe(200)
        const listData = await listRes.json() as any
        expect(listData.result['#']).toBe('SpineInstances')
        expect(listData.result.list.length).toBeGreaterThan(0)

        // Verify /api-server/* rewrite to /api/*
        const rewriteRes = await fetch(`${BASE_URL}/api-server/health`)
        expect(rewriteRes.status).toBe(200)
        const rewriteData = await rewriteRes.json() as any
        expect(rewriteData.status).toBe('ok')

        // Verify /api-server/* rewrite for schema
        const rewriteSchemaRes = await fetch(`${BASE_URL}/api-server/schema`)
        expect(rewriteSchemaRes.status).toBe(200)

        modelServer.stop()
    }, 30_000)
})
