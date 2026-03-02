#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { join } from 'path'
import { run } from 't44/standalone-rt'

import { MODEL_NAME, runModel } from './0D-MappedNewCapsule'

const {
    test: { describe, it, expect },
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
                    value: 't44/caps/ProjectTest',
                    options: { '#': { bunTest, env: {} } }
                },
                spineInstanceTrees: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../SpineInstanceTrees',
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
}, {
    importMeta: import.meta,
    runFromSnapshot: false,
})

describe('0D-MappedNewCapsule', () => {

    it('run model', async () => {
        await spineInstanceTrees.registerInstance({
            name: MODEL_NAME,
        }, runModel)
    })

    it('imports instance to engine', async () => {
        await spineInstanceTrees.importInstanceToEngine({ engine: modelEngines.getEngine() })
    })

    modelQueryMethodTests.makeTests({
        describe,
        it,
        expect,
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
