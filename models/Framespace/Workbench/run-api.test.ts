#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

const {
    test: { describe, it, expect },
    workbenchApi,
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: { type: CapsulePropertyTypes.Mapping, value: 't44/caps/ProjectTest', options: { '#': { bunTest, env: {} } } },
                workbenchApi: { type: CapsulePropertyTypes.Mapping, value: './API' },
            }
        }
    }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: '@stream44.studio/FramespaceGenesis/models/Framespace/Workbench/run-api.test' })
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
describe('Framespace/Workbench API', () => {

    it('has apiSchema with correct namespace and basePath', () => {
        const schema = workbenchApi.apiSchema
        expect(schema).toBeDefined()
        expect(schema.namespace).toBe('Framespace/Workbench')
        expect(schema.basePath).toBe('/api/Framespace/Workbench')
        expect(schema.description).toBeDefined()
    })

    it('apiSchema declares expected methods', () => {
        const methods = workbenchApi.apiSchema.methods
        expect(methods.listSpineInstances).toBeDefined()
        expect(methods.getProcessStats).toBeDefined()
        expect(methods.getReps).toBeDefined()
        expect(methods.openFile).toBeDefined()
    })

    it('getProcessStats returns process stats', async () => {
        const result = await workbenchApi.getProcessStats()
        expect(result['#']).toBe('ProcessStats')
        expect(typeof result.memoryMB).toBe('number')
        expect(typeof result.heapUsedMB).toBe('number')
        expect(typeof result.heapTotalMB).toBe('number')
        expect(typeof result.cpuUserMs).toBe('number')
        expect(typeof result.cpuSystemMs).toBe('number')
        expect(typeof result.uptimeSeconds).toBe('number')
    })

    it('getReps returns reps list', async () => {
        const result = await workbenchApi.getReps()
        expect(result['#']).toBe('Reps')
        expect(Array.isArray(result.list)).toBe(true)
        // Should find at least one rep in the visualizations directory
        expect(result.list.length).toBeGreaterThan(0)
        // Each rep should have name and fullpath
        for (const rep of result.list) {
            expect(rep['#']).toBe('Rep')
            expect(typeof rep.name).toBe('string')
            expect(typeof rep.fullpath).toBe('string')
            expect(typeof rep.relativePath).toBe('string')
        }
    })

    it('openFile returns error for missing command', async () => {
        const result = await workbenchApi.openFile('', '')
        expect(result['#']).toBe('Error')
        expect(result.method).toBe('openFile')
    })

    it('openFile returns error for missing file', async () => {
        const result = await workbenchApi.openFile('code', '')
        expect(result['#']).toBe('Error')
        expect(result.method).toBe('openFile')
    })

    it('openFile returns error for non-absolute path', async () => {
        const result = await workbenchApi.openFile('code', 'relative/path.ts')
        expect(result['#']).toBe('Error')
        expect(result.message).toContain('absolute path')
    })

    it('openFile returns error for non-existent file', async () => {
        const result = await workbenchApi.openFile('code', '/tmp/nonexistent-file-12345.ts')
        expect(result['#']).toBe('Error')
        expect(result.message).toContain('not found')
    })
})
