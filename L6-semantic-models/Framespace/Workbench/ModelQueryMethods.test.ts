#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../../L3-model-server/lib'
import { dirname } from 'path'

const MOUNT_KEY = '@stream44.studio~FramespaceGenesis~L6-semantic-models~Framespace~Workbench~ModelQueryMethods'
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

    it('listSpineInstanceTreeCapsuleSourceFiles (missing id)', async () => {
        const result = await api.listSpineInstanceTreeCapsuleSourceFiles('')
        expect(result['#']).toBe('Error')
        await expectSnapshotMatch(normalize(result))
    })

    it('listSpineInstanceTreeCapsuleSourceFiles', async () => {
        const trees = await api.listSpineInstanceTrees()
        const treeId = trees.list[0]?.$id
        expect(treeId).toBeTruthy()
        const result = await api.listSpineInstanceTreeCapsuleSourceFiles(treeId)
        expect(result['#']).toBe('CapsuleSourceFiles')
        expect(Array.isArray(result.list)).toBe(true)
        expect(result.list.length).toBeGreaterThan(0)
        // Every entry must have an absolute filePath and a shortName
        for (const f of result.list) {
            expect(f['#']).toBe('CapsuleSourceFile')
            expect(f.filePath.startsWith('/')).toBe(true)
            expect(typeof f.shortName).toBe('string')
            expect(typeof f.capsuleName).toBe('string')
            expect(typeof f.capsuleSourceLineRef).toBe('string')
            expect(f.capsuleSourceLineRef.startsWith('/')).toBe(true)
        }
        await expectSnapshotMatch(normalize(result))
    })

    it('getCapsuleSourceFile (missing path)', async () => {
        const result = await api.getCapsuleSourceFile('')
        expect(result['#']).toBe('Error')
        await expectSnapshotMatch(normalize(result))
    })

    it('getCapsuleSourceFile (relative path)', async () => {
        const result = await api.getCapsuleSourceFile('relative/path.ts')
        expect(result['#']).toBe('Error')
        await expectSnapshotMatch(normalize(result))
    })

    it('getCapsuleSourceFile (non-existent file)', async () => {
        const result = await api.getCapsuleSourceFile('/nonexistent/path/file.ts')
        expect(result['#']).toBe('Error')
        await expectSnapshotMatch(normalize(result))
    })

    it('getCapsuleSourceFile (valid file from listing)', async () => {
        const trees = await api.listSpineInstanceTrees()
        const treeId = trees.list[0]?.$id
        const listing = await api.listSpineInstanceTreeCapsuleSourceFiles(treeId)
        expect(listing.list.length).toBeGreaterThan(0)
        const firstFile = listing.list[0]
        const result = await api.getCapsuleSourceFile(firstFile.filePath)
        expect(result['#']).toBe('CapsuleSourceFileContent')
        expect(result.filePath).toBe(firstFile.filePath)
        expect(typeof result.content).toBe('string')
        expect(result.content.length).toBeGreaterThan(0)
        expect(['typescript', 'javascript', 'json', 'css', 'text']).toContain(result.language)
    })

    it('getCapsuleSourceFile (simplified format - standard capsule)', async () => {
        const trees = await api.listSpineInstanceTrees()
        const treeId = trees.list[0]?.$id
        const listing = await api.listSpineInstanceTreeCapsuleSourceFiles(treeId)
        expect(listing.list.length).toBeGreaterThan(0)
        // Find a non-root capsule file (in /caps/ or /elements/ or /structs/ subdirectory)
        const capsFile = listing.list.find((f: any) =>
            f.filePath.includes('/caps/') || f.filePath.includes('/elements/') || f.filePath.includes('/structs/')
        )
        expect(capsFile).toBeTruthy()
        const result = await api.getCapsuleSourceFile(capsFile.filePath, 'simplified')
        expect(result['#']).toBe('CapsuleSourceFileContent')
        expect(result.format).toBe('simplified')
        // Should start with 'return Encapsulate({'
        expect(result.content.startsWith('return Encapsulate({')).toBe(true)
        // Should end with '})'
        expect(result.content.trimEnd().endsWith('})')).toBe(true)
        // Should contain '#' block but NOT the Capsule struct marker
        expect(result.content).toContain("'#': {")
        expect(result.content).not.toContain("'#@stream44.studio/encapsulate/structs/Capsule'")
        // Should NOT contain boilerplate
        expect(result.content).not.toContain('export async function capsule')
        expect(result.content).not.toContain('makeImportStack')
        expect(result.content).not.toContain('import.meta')
        expect(result.content).not.toContain("capsule['#']")
        expect(result.content).not.toContain('CapsuleSpineContract')
        // Should contain the actual capsule property definitions (indented)
        expect(result.content).toContain('CapsulePropertyTypes.')
        // Verify indentation: content inside '#' should be indented 4 spaces (one level)
        const lines = result.content.split('\n')
        const contentLines = lines.filter((l: string) => l.includes('CapsulePropertyTypes'))
        expect(contentLines.length).toBeGreaterThan(0)
        for (const line of contentLines) {
            expect(line.startsWith('    ')).toBe(true) // 4 spaces minimum
        }
    })

    it('getCapsuleSourceFile (simplified format - root model file)', async () => {
        const trees = await api.listSpineInstanceTrees()
        const treeId = trees.list[0]?.$id
        const listing = await api.listSpineInstanceTreeCapsuleSourceFiles(treeId)
        // Find the root model file (not in /caps/, /elements/, or /structs/ dir)
        const modelFile = listing.list.find((f: any) =>
            !f.filePath.includes('/caps/') && !f.filePath.includes('/elements/') && !f.filePath.includes('/structs/') && f.filePath.endsWith('.ts')
        )
        expect(modelFile).toBeTruthy()
        const result = await api.getCapsuleSourceFile(modelFile.filePath, 'simplified')
        expect(result['#']).toBe('CapsuleSourceFileContent')
        expect(result.format).toBe('simplified')
        expect(result.content.startsWith('return Encapsulate({')).toBe(true)
        expect(result.content.trimEnd().endsWith('})')).toBe(true)
        // Should contain '#' block but NOT the Capsule struct marker
        expect(result.content).toContain("'#': {")
        expect(result.content).not.toContain("'#@stream44.studio/encapsulate/structs/Capsule'")
        // Should NOT contain boilerplate
        expect(result.content).not.toContain('MODEL_NAME')
        expect(result.content).not.toContain('makeImportStack')
        expect(result.content).not.toContain('captureEvents')
        expect(result.content).not.toContain('CapsuleSpineContract')
    })

    it('getCapsuleSourceFile (raw format returns full content)', async () => {
        const trees = await api.listSpineInstanceTrees()
        const treeId = trees.list[0]?.$id
        const listing = await api.listSpineInstanceTreeCapsuleSourceFiles(treeId)
        const firstFile = listing.list[0]
        const result = await api.getCapsuleSourceFile(firstFile.filePath, 'raw')
        expect(result['#']).toBe('CapsuleSourceFileContent')
        expect(result.format).toBe('raw')
        // Raw should contain the boilerplate
        expect(result.content).toContain('CapsuleSpineContract')
    })

    it('getCapsuleSourceFile (simplified format - all Quadrant-BackendServices files)', async () => {
        const quadrantTreeId = '@stream44.studio/FramespaceGenesis/examples/01-Quadrant-BackendServices/0A-InfrastructurePlan1'
        const listing = await api.listSpineInstanceTreeCapsuleSourceFiles(quadrantTreeId)
        expect(listing.list.length).toBeGreaterThan(0)

        const simplifiedFiles: Record<string, string> = {}
        for (const file of listing.list) {
            const result = await api.getCapsuleSourceFile(file.filePath, 'simplified')
            expect(result['#']).toBe('CapsuleSourceFileContent')
            expect(result.format).toBe('simplified')
            expect(result.content.startsWith('return Encapsulate({')).toBe(true)
            expect(result.content.trimEnd().endsWith('})')).toBe(true)
            // Should NOT contain boilerplate
            expect(result.content).not.toContain('CapsuleSpineContract')
            expect(result.content).not.toContain("structs/Capsule'")
            expect(result.content).not.toContain('makeImportStack')
            expect(result.content).not.toContain('capsuleName:')
            simplifiedFiles[file.capsuleName] = result.content
        }
        await expectSnapshotMatch(simplifiedFiles)
    })

    it('saveCapsuleSourceFile (missing path)', async () => {
        const result = await api.saveCapsuleSourceFile('', 'content')
        expect(result['#']).toBe('Error')
        await expectSnapshotMatch(normalize(result))
    })

    it('saveCapsuleSourceFile (relative path)', async () => {
        const result = await api.saveCapsuleSourceFile('relative/path.ts', 'content')
        expect(result['#']).toBe('Error')
        await expectSnapshotMatch(normalize(result))
    })

    it('saveCapsuleSourceFile (round-trip)', async () => {
        const trees = await api.listSpineInstanceTrees()
        const treeId = trees.list[0]?.$id
        const listing = await api.listSpineInstanceTreeCapsuleSourceFiles(treeId)
        expect(listing.list.length).toBeGreaterThan(0)
        const firstFile = listing.list[0]

        // Read original content
        const original = await api.getCapsuleSourceFile(firstFile.filePath)
        expect(original['#']).toBe('CapsuleSourceFileContent')
        const originalContent = original.content

        // Save same content back (no actual change)
        const saveResult = await api.saveCapsuleSourceFile(firstFile.filePath, originalContent)
        expect(saveResult['#']).toBe('CapsuleSourceFileSaved')
        expect(saveResult.ok).toBe(true)
        expect(saveResult.filePath).toBe(firstFile.filePath)

        // Verify content unchanged
        const reread = await api.getCapsuleSourceFile(firstFile.filePath)
        expect(reread.content).toBe(originalContent)
    })
})
