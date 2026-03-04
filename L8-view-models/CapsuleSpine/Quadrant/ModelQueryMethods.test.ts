#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../../L3-model-server/lib'
import { dirname } from 'path'

const MOUNT_KEY = '@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Quadrant~ModelQueryMethods'
const ENGINE_KEY = '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI'
const PACKAGE_ROOT = dirname(dirname(dirname(dirname(import.meta.path))))

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
                    value: '../../../L3-model-server/ModelServer',
                    options: {
                        '#': {
                            models: {
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods': {
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
        capsuleName: '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods.test',
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta,
    runFromSnapshot: false,
})

// ── Initialize (no server start) ─────────────────────────────────────
await modelServer.init()
const api = modelServer.api[MOUNT_KEY]
const engine = modelServer.modelEngines[ENGINE_KEY]
const trees = await engine._listSpineInstanceTrees({ prefix: '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/examples' })

// ── Schema tests ─────────────────────────────────────────────────────
describe('Schema', () => {
    const schema = modelServer._models.find((m: any) => m.schema.namespace === MOUNT_KEY)?.schema

    it('getTableView has Models panel tag', () => {
        const method = schema?.methods?.getTableView
        expect(method).toBeDefined()
        expect(method.tags).toBeDefined()
        expect(method.tags['@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/Framespaces/Panel']).toBeDefined()
    })

    it('all tagged methods have discovery in ModelAPIs tag', () => {
        for (const [name, method] of Object.entries(schema?.methods ?? {}) as [string, any][]) {
            const apiTag = method.tags?.['@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel']
            if (apiTag) {
                expect(apiTag.discovery).toBeDefined()
                expect(apiTag.filterField).toBeDefined()
            }
        }
    })
})

// ── Per-instance tests ───────────────────────────────────────────────
for (const { spineInstanceTreeId } of trees) {
    const normalize = (obj: any) => normalizeForSnapshot(obj, PACKAGE_ROOT)
    describe(`Instance: ${spineInstanceTreeId}`, () => {

        it('getColumnTree', async () => {
            const result = await api.getColumnTree(spineInstanceTreeId)
            await expectSnapshotMatch(normalize(result))
        })

        it('getRowTree', async () => {
            const result = await api.getRowTree(spineInstanceTreeId)
            await expectSnapshotMatch(normalize(result))
        })

        it('getTableView', async () => {
            const result = await api.getTableView(spineInstanceTreeId)
            await expectSnapshotMatch(normalize(result))
        })
    })
}
