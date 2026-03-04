#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../L3-model-server/lib'
import { dirname } from 'path'

import { MODEL_NAME } from './0A-FullStack1'

const MOUNT_KEY_L6 = '@stream44.studio~FramespaceGenesis~L6-semantic-models~Capsular~CapsuleSpine~ModelQueryMethods'
const MOUNT_KEY_L8 = '@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Codepath~ModelQueryMethods'
const ENGINE_KEY = '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI'
const PACKAGE_ROOT = dirname(dirname(dirname(import.meta.path)))

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
                    value: '../../L3-model-server/ModelServer',
                    options: {
                        '#': {
                            models: {
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods': {
                                    engine: {
                                        [ENGINE_KEY]: {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Codepath/ModelQueryMethods': {
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
        capsuleName: `${MODEL_NAME}.test`,
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
const apiL6 = modelServer.api[MOUNT_KEY_L6]
const apiL8 = modelServer.api[MOUNT_KEY_L8]
const normalize = (obj: any) => normalizeForSnapshot(obj, PACKAGE_ROOT)

describe('Codepath-SimplePasswordLogin', () => {

    it('getSpineInstanceTree', async () => {
        const result = await apiL6.getSpineInstanceTree(MODEL_NAME)
        expect(result).toBeDefined()
        await expectSnapshotMatch(normalize(result))
    })

    it('getSwimlaneView', async () => {
        const result = await apiL8.getSwimlaneView(MODEL_NAME)
        expect(result).toBeDefined()
        expect(result['#']).toBe('SwimlaneView')
        await expectSnapshotMatch(normalize(result))
    })
})
