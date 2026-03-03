#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../../L3-model-server/lib'
import { dirname } from 'path'

const MOUNT_KEY = '@framespace.dev~FramespaceGenesis~L6-semantic-models~Framespace~Workbench~ModelQueryMethods'
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
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Framespace/Workbench/ModelQueryMethods': {
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
        capsuleName: '@stream44.studio/FramespaceGenesis/L6-semantic-models/Framespace/Workbench/ModelQueryMethods.test',
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
const normalize = (obj: any) => normalizeForSnapshot(obj, PACKAGE_ROOT)

describe('L6 Framespace/Workbench ModelQueryMethods', () => {

    it('listSpineInstanceTrees', async () => {
        const result = await api.listSpineInstanceTrees()
        await expectSnapshotMatch(normalize(result))
    })

    it('getProcessStats', async () => {
        const result = await api.getProcessStats()
        expect(result['#']).toBe('ProcessStats')
        await expectSnapshotMatch(Object.keys(result).sort())
    })

    it('getReps', async () => {
        const result = await api.getReps()
        await expectSnapshotMatch(normalize(result))
    })

    it('openFile (missing command)', async () => {
        const result = await api.openFile('', '/some/file.ts')
        await expectSnapshotMatch(normalize(result))
    })

    it('openFile (missing file)', async () => {
        const result = await api.openFile('code', '')
        await expectSnapshotMatch(normalize(result))
    })

    it('openFile (relative path)', async () => {
        const result = await api.openFile('code', 'relative/path.ts')
        await expectSnapshotMatch(normalize(result))
    })

    it('openFile (non-existent file)', async () => {
        const result = await api.openFile('code', '/nonexistent/path/file.ts')
        await expectSnapshotMatch(normalize(result))
    })
})
