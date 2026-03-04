#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { join } from 'path'
import { readdir, stat } from 'fs/promises'
import { readFileSync } from 'fs'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../L3-model-server/lib'

function readActiveEngines(): string[] | null {
    try {
        const configPath = join(import.meta.dir, '..', '..', 'framespace.yaml')
        const content = readFileSync(configPath, 'utf-8')
        const engines: string[] = []
        let inEngines = false
        for (const line of content.split('\n')) {
            const trimmed = line.trim()
            if (trimmed === 'engines:') { inEngines = true; continue }
            if (inEngines && trimmed.startsWith('- ')) {
                engines.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''))
            } else if (inEngines && trimmed && !trimmed.startsWith('#')) {
                inEngines = false
            }
        }
        if (engines.length === 0) return null
        return engines
    } catch {
        return null
    }
}

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
                    options: { '#': { writeMethodSchema: true } }
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

const allEngineNames = modelEngines.getEngineNames()
const activeEngines = readActiveEngines()
const engineNames = activeEngines ?? allEngineNames
const packageRoot = join(import.meta.dir, '..', '..')
const normalize = (obj: any) => normalizeForSnapshot(obj, packageRoot)

// Build per-model config used by both blocks
const configForCapsule = (capsule: typeof capsuleModules[0]) => ({
    getCapsuleWithSource: { capsuleName: capsule.MODEL_NAME },
    getCapsuleSpineTree_data: { capsuleName: capsule.MODEL_NAME },
    fetchCapsuleRelations: { capsuleNames: [capsule.MODEL_NAME] },
})

// Stores isolated-block results per engine+model+method for cross-validation
// Key: `${engineName}::${MODEL_NAME}::${methodName}`
const isolatedResults = new Map<string, any>()

for (const engineName of engineNames) {
    // Block 1: Isolated — reset before each model, only that model's data exists
    describe(`Engine: ${engineName}`, () => {
        modelEngines.setActiveEngine(engineName)

        for (const capsule of capsuleModules) {
            describe(capsule.MODEL_NAME, () => {
                it('runModel', async () => {
                    await spineInstanceTrees.registerInstance({
                        name: capsule.MODEL_NAME,
                    }, capsule.runModel)

                    const engine = modelEngines.getEngine()
                    await spineInstanceTrees.importInstanceToEngine({ engine, name: capsule.MODEL_NAME, reset: true })
                })

                modelQueryMethodTests.makeTests({
                    describe,
                    it,
                    expect,
                    expectSnapshotMatch,
                    engine: () => modelEngines.getEngine(),
                    spineInstanceTreeId: capsule.MODEL_NAME,
                    packageRoot,
                    config: configForCapsule(capsule),
                })

                // Capture isolated results for cross-validation with accumulated block
                it('_captureIsolatedResults', async () => {
                    const engine = modelEngines.getEngine()
                    const config = configForCapsule(capsule)
                    const methodNames = Object.keys(config) as string[]
                    // Query methods that take only spineInstanceTreeId
                    for (const m of ['listCapsules', 'getCapsuleNamesBySpineTree', 'listSpineInstanceTrees', 'getInstancesBySpineTree', 'getRootInstance', 'getChildInstances', 'fetchInstanceRelations']) {
                        const key = `${engineName}::${capsule.MODEL_NAME}::${m}`
                        try {
                            isolatedResults.set(key, normalize(await engine[m](capsule.MODEL_NAME)))
                        } catch { }
                    }
                    // Query methods that take extra args from config
                    for (const [m, extra] of Object.entries(config)) {
                        const key = `${engineName}::${capsule.MODEL_NAME}::${m}`
                        const extraArgs = Object.values(extra)
                        try {
                            isolatedResults.set(key, normalize(await engine[m](capsule.MODEL_NAME, ...extraArgs)))
                        } catch { }
                    }
                })
            })
        }
    })

    // Block 2: Accumulated — import ALL models into the same engine (reset once,
    // then accumulate), then run the same queries per model.
    //
    // Instance-level queries must match exactly (CapsuleInstance nodes are scoped
    // by spineInstanceTreeId and never shared across trees).
    //
    // Capsule-level queries may differ because shared Capsule nodes (e.g.
    // structs/Capsule) have a single spineInstanceTreeId that gets overwritten
    // by whichever SIT file imports last.  For these we verify the accumulated
    // result is a *superset* of the isolated result — every isolated item must
    // appear in the accumulated output.
    describe(`Engine (accumulated): ${engineName}`, () => {
        modelEngines.setActiveEngine(engineName)

        it('importAllModels', async () => {
            const engine = modelEngines.getEngine()
            let first = true
            for (const capsule of capsuleModules) {
                await spineInstanceTrees.registerInstance({
                    name: capsule.MODEL_NAME,
                }, capsule.runModel)
                await spineInstanceTrees.importInstanceToEngine({ engine, name: capsule.MODEL_NAME, reset: first })
                first = false
            }
        }, 30_000)

        // Instance-level methods — must match exactly (strict isolation)
        const exactMethods = ['getInstancesBySpineTree', 'getRootInstance', 'getChildInstances', 'fetchInstanceRelations']
        // Capsule-level methods — accumulated is a superset of isolated
        const supersetMethods = ['listCapsules', 'getCapsuleNamesBySpineTree', 'listSpineInstanceTrees']

        for (const capsule of capsuleModules) {
            describe(capsule.MODEL_NAME, () => {
                const config = configForCapsule(capsule)

                for (const m of exactMethods) {
                    it(m, async () => {
                        const engine = modelEngines.getEngine()
                        const key = `${engineName}::${capsule.MODEL_NAME}::${m}`
                        const isolated = isolatedResults.get(key)
                        expect(isolated).toBeDefined()
                        const accumulated = normalize(await engine[m](capsule.MODEL_NAME))
                        expect(accumulated).toEqual(isolated)
                    })
                }

                for (const m of supersetMethods) {
                    it(m, async () => {
                        const engine = modelEngines.getEngine()
                        const key = `${engineName}::${capsule.MODEL_NAME}::${m}`
                        const isolated = isolatedResults.get(key)
                        expect(isolated).toBeDefined()
                        const accumulated = normalize(await engine[m](capsule.MODEL_NAME))
                        // Every item in the isolated result must appear in the accumulated result
                        if (Array.isArray(isolated)) {
                            for (const item of isolated) {
                                if (typeof item === 'string') {
                                    expect(accumulated).toContain(item)
                                } else {
                                    expect(accumulated).toContainEqual(item)
                                }
                            }
                        }
                    })
                }

                // Methods with extra args — capsule-level, use superset check
                for (const [m, extra] of Object.entries(config)) {
                    it(m, async () => {
                        const engine = modelEngines.getEngine()
                        const key = `${engineName}::${capsule.MODEL_NAME}::${m}`
                        const isolated = isolatedResults.get(key)
                        expect(isolated).toBeDefined()
                        const extraArgs = Object.values(extra)
                        const accumulated = normalize(await engine[m](capsule.MODEL_NAME, ...extraArgs))
                        // For object results, verify every key in isolated exists in accumulated
                        if (isolated && typeof isolated === 'object' && !Array.isArray(isolated)) {
                            for (const [k, v] of Object.entries(isolated)) {
                                if (k === 'found') continue
                                expect(accumulated).toHaveProperty([k])
                            }
                        }
                    })
                }
            })
        }
    })
}

// ── Cross-engine comparison ─────────────────────────────────────────
// After all engines have run, verify that every engine produces identical
// isolated results for every model+method combination.
// Sort-order-independent: engines may return rows in different orders.
const sortForComparison = (val: any): any => {
    if (Array.isArray(val)) return [...val].map(sortForComparison).sort((a: any, b: any) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0)
    if (val && typeof val === 'object') {
        const out: any = {}
        for (const k of Object.keys(val).sort()) out[k] = sortForComparison(val[k])
        return out
    }
    return val
}

if (engineNames.length > 1) {
    const referenceEngine = engineNames[0]

    // All method keys captured during isolated runs
    const allMethods = [
        'listCapsules', 'getCapsuleNamesBySpineTree', 'listSpineInstanceTrees',
        'getInstancesBySpineTree', 'getRootInstance', 'getChildInstances', 'fetchInstanceRelations',
        ...Object.keys(configForCapsule(capsuleModules[0])),
    ]

    describe('Cross-engine comparison', () => {
        for (const capsule of capsuleModules) {
            describe(capsule.MODEL_NAME, () => {
                for (const m of allMethods) {
                    for (let i = 1; i < engineNames.length; i++) {
                        const shortRef = referenceEngine.split('/').slice(-2, -1)[0]
                        const shortOther = engineNames[i].split('/').slice(-2, -1)[0]
                        it(`${m} — ${shortRef} = ${shortOther}`, () => {
                            const refKey = `${referenceEngine}::${capsule.MODEL_NAME}::${m}`
                            const reference = isolatedResults.get(refKey)
                            if (reference === undefined) return // method not captured

                            const otherKey = `${engineNames[i]}::${capsule.MODEL_NAME}::${m}`
                            const other = isolatedResults.get(otherKey)
                            expect(sortForComparison(other)).toEqual(sortForComparison(reference))
                        })
                    }
                }
            })
        }
    })
}
