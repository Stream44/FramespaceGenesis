#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../../L3-model-server/lib'
import { dirname } from 'path'

const MOUNT_KEY = '@framespace.dev~FramespaceGenesis~L6-semantic-models~Capsular~CapsuleSpine~ModelQueryMethods'
const ENGINE_KEY = '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI'
const PACKAGE_ROOT = dirname(dirname(dirname(dirname(import.meta.path))))

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
                    value: '../../../L3-model-server/ModelServer',
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
        capsuleName: '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods.test',
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
const trees = await engine._listSpineInstanceTrees()

// ── Per-instance tests ───────────────────────────────────────────────
for (const { spineInstanceTreeId } of trees) {
    const normalize = (obj: any) => normalizeForSnapshot(obj, PACKAGE_ROOT)
    describe(`Instance: ${spineInstanceTreeId}`, () => {

        it('listCapsules', async () => {
            const result = await api.listCapsules(spineInstanceTreeId)
            expect(normalize(result)).toMatchSnapshot()
        })

        it('getCapsule (first capsule)', async () => {
            const list = await api.listCapsules(spineInstanceTreeId)
            const capsuleName = list.list[0]?.$id
            const result = await api.getCapsule(spineInstanceTreeId, capsuleName)
            expect(normalize(result)).toMatchSnapshot()
        })

        it('getSpineDeclarationTree', async () => {
            const result = await api.getSpineDeclarationTree(spineInstanceTreeId)
            expect(normalize(result)).toMatchSnapshot()
        })

        it('getSpineInstanceTree', async () => {
            const result = await api.getSpineInstanceTree(spineInstanceTreeId)
            expect(normalize(result)).toMatchSnapshot()
        })
    })
}
