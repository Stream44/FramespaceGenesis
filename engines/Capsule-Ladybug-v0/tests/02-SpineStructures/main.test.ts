#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { join } from 'path'
import { rm, readdir } from 'fs/promises'

// Static-analysis dir local to this test directory
const CST_ROOT = join(import.meta.dir, '.~o', 'encapsulate.dev', 'static-analysis')

const N = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function clearCstCache() {
    await rm(CST_ROOT, { recursive: true, force: true }).catch(() => { })
}

async function listAllCstFiles(): Promise<string[]> {
    const files: string[] = []
    async function scan(dir: string, prefix: string = '') {
        try {
            const entries = await readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
                if (entry.isDirectory()) {
                    await scan(join(dir, entry.name), relPath)
                } else if (entry.name.endsWith('.csts.json')) {
                    files.push(relPath)
                }
            }
        } catch { }
    }
    await scan(CST_ROOT)
    return files.sort()
}

// ---------------------------------------------------------------------------
// Top-level run() — provides test harness + capsuleSpineModel query engine
// ---------------------------------------------------------------------------
const {
    test: { describe, it, expect },
    capsuleSpineModel,
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: { type: CapsulePropertyTypes.Mapping, value: 't44/caps/ProjectTest', options: { '#': { bunTest, env: {} } } },
                capsuleSpineModel: { type: CapsulePropertyTypes.Mapping, value: '../../QueryCapsuleSpineModel' },
            }
        }
    }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/main.test' })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta,
    runFromSnapshot: false,
})

describe('02-SpineStructures', () => {

    // =======================================================================
    // 1. STANDALONE — Literal, Constant, String, Function, Getter, Setter
    // =======================================================================
    describe('1 · Standalone', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { standalone: { type: CapsulePropertyTypes.Mapping, value: './caps/Standalone' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.standalone` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.standalone`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 2. BASE SERVICE — standalone with String, Constant, Getter, Function
    // =======================================================================
    describe('2 · BaseService', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { baseService: { type: CapsulePropertyTypes.Mapping, value: './caps/BaseService' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.baseService` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.baseService`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 3. EXTENDED SERVICE — extends BaseService
    // =======================================================================
    describe('3 · ExtendedService', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { extendedService: { type: CapsulePropertyTypes.Mapping, value: './caps/ExtendedService' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.extendedService` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.extendedService`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 4. MAPPING ORCHESTRATOR — maps Standalone + BaseService
    // =======================================================================
    describe('4 · MappingOrchestrator', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { mappingOrchestrator: { type: CapsulePropertyTypes.Mapping, value: './caps/MappingOrchestrator' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.mappingOrchestrator` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.mappingOrchestrator`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 5. STRUCT DELEGATE CONSUMER — delegates SchemaStruct
    // =======================================================================
    describe('5 · StructDelegateConsumer', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { structDelegateConsumer: { type: CapsulePropertyTypes.Mapping, value: './caps/StructDelegateConsumer' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.structDelegateConsumer` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.structDelegateConsumer`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 6. MAPPING WITH EXTENDS — extends BaseService + maps Standalone
    // =======================================================================
    describe('6 · MappingWithExtends', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { mappingWithExtends: { type: CapsulePropertyTypes.Mapping, value: './caps/MappingWithExtends' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.mappingWithExtends` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.mappingWithExtends`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 7. COMPOSITE SERVICE — extends + mappings + struct delegates
    // =======================================================================
    describe('7 · CompositeService', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { compositeService: { type: CapsulePropertyTypes.Mapping, value: './caps/CompositeService' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.compositeService` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.compositeService`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 8. LIFECYCLE SERVICE — StructInit + StructDispose
    // =======================================================================
    describe('8 · LifecycleService', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { lifecycleService: { type: CapsulePropertyTypes.Mapping, value: './caps/LifecycleService' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.lifecycleService` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.lifecycleService`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 9. SCHEMA STRUCT — standalone struct capsule
    // =======================================================================
    describe('9 · SchemaStruct', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { schemaStruct: { type: CapsulePropertyTypes.Mapping, value: './structs/SchemaStruct' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.schemaStruct` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.schemaStruct`, files }).toMatchSnapshot()
        })
    })

    // =======================================================================
    // 10. VALIDATION STRUCT — extends BaseService
    // =======================================================================
    describe('10 · ValidationStruct', () => {

        it('clears cache, encapsulates, and verifies generated CST files', async () => {
            await clearCstCache()
            await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
                const spine = await encapsulate({
                    '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                        '#@stream44.studio/encapsulate/structs/Capsule': {},
                        '#': { validationStruct: { type: CapsulePropertyTypes.Mapping, value: './structs/ValidationStruct' } }
                    }
                }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.validationStruct` })
                return { spine }
            }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], { importMeta: import.meta, runFromSnapshot: false })

            const files = await listAllCstFiles()
            expect({ rootCapsuleName: `${N}/run.validationStruct`, files }).toMatchSnapshot()
        })
    })
})
