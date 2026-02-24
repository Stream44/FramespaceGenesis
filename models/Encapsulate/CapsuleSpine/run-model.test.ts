#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { join } from 'path'
import { readFileSync } from 'fs'
import type { ExampleResult } from './examples/01-TreeRelationships/main'
import { normalizeForSnapshot, listAllCstFiles, copyGeneratedData, GENERATED_DATA } from '../../test-helpers'

const MODEL_NAME = 'Encapsulate/CapsuleSpine'

// ---------------------------------------------------------------------------
// Top-level run() — provides test harness + capsuleSpineModel query engine
// ---------------------------------------------------------------------------
const {
    test: { describe, it, expect },
    capsuleSpineModel,
    importer,
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: { type: CapsulePropertyTypes.Mapping, value: 't44/caps/ProjectTest', options: { '#': { bunTest, env: {} } } },
                capsuleSpineModel: { type: CapsulePropertyTypes.Mapping, value: './API' },
                importer: { type: CapsulePropertyTypes.Mapping, value: '../../../engines/Capsule-Ladybug-v0/ImportCapsuleSourceTrees' },
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CapsuleSpine Model', () => {

    let exampleResults: ExampleResult[]

    it('runs 01-TreeRelationships examples and generates CST files', async () => {
        const { runExamples } = await import('./examples/01-TreeRelationships/main')
        exampleResults = await runExamples()
        expect(exampleResults.length).toBe(6)
        for (const result of exampleResults) {
            expect(result.files.length).toBeGreaterThan(0)
        }
    })

    it('generated CST file lists per example', async () => {
        for (const result of exampleResults) {
            expect({
                name: result.name,
                rootCapsuleName: result.rootCapsuleName,
                files: result.files,
            }).toMatchSnapshot()
        }
    })

    it('generated CST file contents per example', async () => {
        for (const result of exampleResults) {
            for (const relPath of result.files) {
                const absPath = join(result.cstRoot, relPath)
                const content = JSON.parse(readFileSync(absPath, 'utf-8'))
                expect(normalizeForSnapshot({ example: result.name, file: relPath, content })).toMatchSnapshot()
            }
        }
    })

    it('CapsuleSpineModel queries per example', async () => {
        for (const entry of exampleResults) {
            const _db = await importer.createDatabase()
            const _conn = await importer.createConnection(_db)
            await importer.createSchema(_conn)

            for (const relPath of entry.files) {
                const absPath = join(entry.cstRoot, relPath)
                await importer.importCstFile(_conn, absPath, entry.rootCapsuleName)
            }

            await importer.linkMappings(_conn)

            // listCapsules
            const listResult = await capsuleSpineModel.listCapsules(_conn)
            expect(normalizeForSnapshot({ example: entry.name, query: 'listCapsules', result: listResult })).toMatchSnapshot()

            // getCapsule (first capsule by $id)
            const sorted = [...listResult.list].sort((a: any, b: any) => (a.$id || '').localeCompare(b.$id || ''))
            const firstId = sorted[0].$id
            const capsuleData = await capsuleSpineModel.getCapsule(_conn, firstId)
            expect(normalizeForSnapshot({ example: entry.name, query: 'getCapsule', result: capsuleData })).toMatchSnapshot()

            // getCapsuleSpineTree
            const runnerCapsule = listResult.list.find((c: any) => c.$id === entry.rootCapsuleName) || listResult.list[listResult.list.length - 1]
            const tree = await capsuleSpineModel.getCapsuleSpineTree(_conn, runnerCapsule.$id)
            expect(normalizeForSnapshot({ example: entry.name, query: 'getCapsuleSpineTree', result: tree })).toMatchSnapshot()
        }
    })

    it('copies static analysis files to .generated-data', async () => {
        await copyGeneratedData(MODEL_NAME, exampleResults[0].cstRoot, exampleResults)

        // Verify the copy has files from all examples
        const copiedFiles = await listAllCstFiles(join(GENERATED_DATA, MODEL_NAME, '.~o', 'encapsulate.dev', 'static-analysis'))
        const totalExpected = exampleResults.reduce((sum, r) => sum + r.files.length, 0)
        expect(copiedFiles.length).toBe(totalExpected)
    })
})