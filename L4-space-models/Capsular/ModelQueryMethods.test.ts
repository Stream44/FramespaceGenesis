#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { join } from 'path'
import { readdir, stat } from 'fs/promises'
import { run } from '@stream44.studio/t44/standalone-rt'

const {
    test: { describe, it, expect, expectSnapshotMatch },
    modelEngines,
    spineInstanceTrees,
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
                modelEngines: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './ModelEngines',
                },
                spineInstanceTrees: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './SpineInstanceTrees',
                },
                modelQueryMethodTests: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './ModelQueryMethodTests',
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/ModelQueryMethods.test',
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta,
})

// Dynamically discover capsule files that export MODEL_NAME and runModel
const examplesDir = join(import.meta.dir, 'examples')
const capsuleModules: { MODEL_NAME: string, runModel: (ctx: { run: any }) => Promise<any> }[] = []

const exampleDirs = await readdir(examplesDir)
for (const dir of exampleDirs) {
    const dirPath = join(examplesDir, dir)
    const dirStat = await stat(dirPath)
    if (!dirStat.isDirectory()) continue

    const files = await readdir(dirPath)
    for (const file of files) {
        if (file.startsWith('.') || !file.endsWith('.ts') || file.endsWith('.test.ts')) continue
        const filePath = join(dirPath, file)
        try {
            const mod = await import(filePath)
            if (mod.MODEL_NAME && typeof mod.runModel === 'function') {
                capsuleModules.push({ MODEL_NAME: mod.MODEL_NAME, runModel: mod.runModel })
            }
        } catch { }
    }
}

const engineNames = modelEngines.getEngineNames()

for (const engineName of engineNames) {
    describe(`Engine: ${engineName}`, () => {
        for (const capsule of capsuleModules) {
            describe(capsule.MODEL_NAME, () => {
                it('runModel', async () => {
                    modelEngines.setActiveEngine(engineName)

                    await spineInstanceTrees.registerInstance({
                        name: capsule.MODEL_NAME,
                    }, capsule.runModel)

                    await spineInstanceTrees.importInstanceToEngine({ engine: modelEngines.getEngine(), name: capsule.MODEL_NAME })
                })

                modelQueryMethodTests.makeTests({
                    describe,
                    it,
                    expect,
                    expectSnapshotMatch,
                    engine: modelEngines.getEngine(),
                    spineInstanceTreeId: capsule.MODEL_NAME,
                    packageRoot: join(import.meta.dir, '..', '..'),
                    config: {
                        getCapsuleWithSource: { capsuleName: capsule.MODEL_NAME },
                        getCapsuleSpineTree_data: { capsuleName: capsule.MODEL_NAME },
                        fetchCapsuleRelations: { capsuleNames: [capsule.MODEL_NAME] },
                    }
                })
            })
        }
    })
}
