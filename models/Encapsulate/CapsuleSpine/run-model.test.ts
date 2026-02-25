#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { join, normalizeForSnapshot, createModelTest } from '../../test-helpers'

const {
    test: { describe, it, expect },
    capsuleSpineModel,
    ...engines
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: { type: CapsulePropertyTypes.Mapping, value: 't44/caps/ProjectTest', options: { '#': { bunTest, env: {} } } },
                capsuleSpineModel: { type: CapsulePropertyTypes.Mapping, value: './API' },
                'engines/Capsule-Ladybug-v0': { type: CapsulePropertyTypes.Mapping, value: '../../../engines/Capsule-Ladybug-v0/ImportCapsuleSourceTrees' },
                'engines/Capsule-JsonFiles-v0': { type: CapsulePropertyTypes.Mapping, value: '../../../engines/Capsule-JsonFiles-v0/ImportCapsuleSourceTrees' },
            }
        }
    }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: '@stream44.studio/FramespaceGenesis/models/Encapsulate/CapsuleSpine/run-model.test' })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta,
    runFromSnapshot: false,
})

const { forEngine, saveCstData, saveTestResults, loadCstFile, setExampleResults, exampleResults } = createModelTest({
    modelName: 'Encapsulate/CapsuleSpine',
    engines
})

describe('CapsuleSpine Model', () => {

    it('Runs 01-TreeRelationships examples and generates CST files', async () => {
        const { runExamples } = await import('./examples/01-TreeRelationships/main')
        const results = await runExamples()
        setExampleResults(results)

        expect(results.length).toBe(6)
        for (const result of results) {
            expect(result.files.length).toBeGreaterThan(0)
        }

        for (const result of results) {
            expect({
                name: result.name,
                rootCapsuleName: result.rootCapsuleName,
                files: result.files,
            }).toMatchSnapshot()
        }

        for (const result of results) {
            for (const relPath of result.files) {
                const content = await loadCstFile(relPath)
                expect(normalizeForSnapshot({ example: result.name, file: relPath, content })).toMatchSnapshot()
            }
        }
    })

    // Per-engine query tests
    forEngine(({ engine, importer, recordResult }) => {

        describe(engine.name, function () {

            it('imports CST data and lists capsules', async () => {
                try {
                    await importer.ensureSchema()
                    for (const entry of exampleResults()) {
                        for (const relPath of entry.files) {
                            await importer.importCstFile(join(entry.cstRoot, relPath), entry.rootCapsuleName)
                        }
                    }
                    await importer.linkMappings()

                    const listResult = await capsuleSpineModel.listCapsules(importer)
                    for (const entry of exampleResults()) {
                        expect(normalizeForSnapshot({ engine: engine.name, example: entry.name, query: 'listCapsules', result: listResult })).toMatchSnapshot()
                    }
                    recordResult('listCapsules', true)
                } catch (e) {
                    recordResult('listCapsules', false)
                    throw e
                }
            })

            it('getCapsule returns full CST structure', async () => {
                try {
                    const listResult = await capsuleSpineModel.listCapsules(importer)
                    for (const entry of exampleResults()) {
                        const sorted = [...listResult.list].sort((a: any, b: any) => (a.$id || '').localeCompare(b.$id || ''))
                        const firstId = sorted[0].$id
                        const capsuleData = await capsuleSpineModel.getCapsule(importer, firstId)
                        expect(normalizeForSnapshot({ engine: engine.name, example: entry.name, query: 'getCapsule', result: capsuleData })).toMatchSnapshot()
                    }
                    recordResult('getCapsule', true)
                } catch (e) {
                    recordResult('getCapsule', false)
                    throw e
                }
            })

            it('getCapsuleSpineTree returns dependency tree', async () => {
                try {
                    const listResult = await capsuleSpineModel.listCapsules(importer)
                    for (const entry of exampleResults()) {
                        const runnerCapsule = listResult.list.find((c: any) => c.$id === entry.rootCapsuleName) || listResult.list[listResult.list.length - 1]
                        const tree = await capsuleSpineModel.getCapsuleSpineTree(importer, runnerCapsule.$id)
                        expect(normalizeForSnapshot({ engine: engine.name, example: entry.name, query: 'getCapsuleSpineTree', result: tree })).toMatchSnapshot()
                    }
                    recordResult('getCapsuleSpineTree', true)
                } catch (e) {
                    recordResult('getCapsuleSpineTree', false)
                    throw e
                }
            })
        })
    })

    it('copies static analysis files to .cst-data', async () => {
        const copiedCount = await saveCstData()
        expect(copiedCount).toBe(14)
    })

    it('writes models.json with engine availability', async () => {
        await saveTestResults()
    })
})