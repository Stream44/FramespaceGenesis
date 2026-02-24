import { run } from 't44/standalone-rt'
import { join } from 'path'
import { rm, readdir } from 'fs/promises'

const N = '@stream44.studio/FramespaceGenesis/models/Encapsulate/CapsuleSpine/examples/01-TreeRelationships'

// Static-analysis dir local to this example directory
const CST_ROOT = join(import.meta.dir, '.~o', 'encapsulate.dev', 'static-analysis')

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

export interface ExampleResult {
    name: string
    rootCapsuleName: string
    files: string[]
    cstRoot: string
}

// ---------------------------------------------------------------------------
// Run all examples — each with its own complete run() and unique root context
// ---------------------------------------------------------------------------
export async function runExamples(): Promise<ExampleResult[]> {
    await clearCstCache()
    const results: ExampleResult[] = []
    let previousFiles = new Set<string>()

    // Helper to capture only the new files added by the latest run()
    async function captureNewFiles(): Promise<string[]> {
        const allFiles = await listAllCstFiles()
        const newFiles = allFiles.filter(f => !previousFiles.has(f))
        previousFiles = new Set(allFiles)
        return newFiles.sort()
    }

    // ── Example 1 — SingleCapsule ────────────────────────────────────
    // A capsule with an 'alias' string property, defined inline.
    await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    alias: {
                        type: CapsulePropertyTypes.String,
                        value: 'single'
                    }
                }
            }
        }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.singleCapsule` })
        return { spine }
    }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], {
        importMeta: import.meta,
        runFromSnapshot: false,
    })
    results.push({ name: 'SingleCapsule', rootCapsuleName: `${N}/run.singleCapsule`, files: await captureNewFiles(), cstRoot: CST_ROOT })

    // ── Example 2 — ExtendCapsule ────────────────────────────────────
    // A capsule with an 'alias' string property that extends caps/ParentCapsule.
    await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    alias: {
                        type: CapsulePropertyTypes.String,
                        value: 'extended'
                    }
                }
            }
        }, { extendsCapsule: './caps/ParentCapsule', importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.extendCapsule` })
        return { spine }
    }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], {
        importMeta: import.meta,
        runFromSnapshot: false,
    })
    results.push({ name: 'ExtendCapsule', rootCapsuleName: `${N}/run.extendCapsule`, files: await captureNewFiles(), cstRoot: CST_ROOT })

    // ── Example 3 — MappedCapsule ────────────────────────────────────
    // A capsule with an 'alias' string property and a mapping 'storageApi' → caps/Storage.
    await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    alias: {
                        type: CapsulePropertyTypes.String,
                        value: 'mapped'
                    },
                    storageApi: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Storage',
                    }
                }
            }
        }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.mappedCapsule` })
        return { spine }
    }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], {
        importMeta: import.meta,
        runFromSnapshot: false,
    })
    results.push({ name: 'MappedCapsule', rootCapsuleName: `${N}/run.mappedCapsule`, files: await captureNewFiles(), cstRoot: CST_ROOT })

    // ── Example 4 — MappedNewCapsule ─────────────────────────────────
    // A capsule with an 'alias' string property and a mapping 'storageApi' → caps/Storage
    // with options specifying { prefix: '_' }.
    await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    alias: {
                        type: CapsulePropertyTypes.String,
                        value: 'mapped-with-options'
                    },
                    storageApi: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Storage',
                        options: {
                            '#': {
                                prefix: '_'
                            }
                        }
                    }
                }
            }
        }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.mappedNewCapsule` })
        return { spine }
    }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], {
        importMeta: import.meta,
        runFromSnapshot: false,
    })
    results.push({ name: 'MappedNewCapsule', rootCapsuleName: `${N}/run.mappedNewCapsule`, files: await captureNewFiles(), cstRoot: CST_ROOT })

    // ── Example 5 — Structs ──────────────────────────────────────────
    // A capsule with an 'alias' string property and a property contract delegate
    // to structs/ConfigSchema (as 'config'). ConfigSchema extends caps/ConfigStore
    // which extends caps/Storage.
    await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#./structs/ConfigSchema': {
                    as: 'config',
                },
                '#': {
                    alias: {
                        type: CapsulePropertyTypes.String,
                        value: 'with-struct'
                    }
                }
            }
        }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.structs` })
        return { spine }
    }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], {
        importMeta: import.meta,
        runFromSnapshot: false,
    })
    results.push({ name: 'Structs', rootCapsuleName: `${N}/run.structs`, files: await captureNewFiles(), cstRoot: CST_ROOT })

    // ── Example 6 — MappedInstanceSharing ────────────────────────────
    // A capsule with 'alias', 'service1' mapped to Service1, 'service2' mapped to Service2
    // (both extend Service), plus 'serviceApi' mapped to Service with options { apiKey: 'secret-key' }.
    await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    alias: {
                        type: CapsulePropertyTypes.String,
                        value: 'instance-sharing'
                    },
                    service1: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Service1',
                    },
                    service2: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Service2',
                    },
                    serviceApi: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Service',
                        options: {
                            '#': {
                                apiKey: 'secret-key'
                            }
                        }
                    }
                }
            }
        }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: `${N}/run.mappedInstanceSharing` })
        return { spine }
    }, async ({ spine, apis }: any) => apis[spine.capsuleSourceLineRef], {
        importMeta: import.meta,
        runFromSnapshot: false,
    })
    results.push({ name: 'MappedInstanceSharing', rootCapsuleName: `${N}/run.mappedInstanceSharing`, files: await captureNewFiles(), cstRoot: CST_ROOT })

    return results
}


