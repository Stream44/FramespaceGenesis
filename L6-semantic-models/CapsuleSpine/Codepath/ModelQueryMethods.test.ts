#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../../L3-model-server/lib'
import { dirname } from 'path'

const MOUNT_KEY = '@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Codepath~ModelQueryMethods'
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
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/CapsuleSpine/Codepath/ModelQueryMethods': {
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
        capsuleName: '@stream44.studio/FramespaceGenesis/L6-semantic-models/CapsuleSpine/Codepath/ModelQueryMethods.test',
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
const engine = modelServer.modelEngines[ENGINE_KEY]
// Ensure instances are imported (lazy import is deferred)
const registeredModels = modelServer.spineInstanceTrees?.getModels ?? []
for (const m of registeredModels) {
    await modelServer._ensureImported(m.name, engine)
}
const trees = await engine._listSpineInstanceTrees()

// ── Per-instance tests ───────────────────────────────────────────────
for (const { spineInstanceTreeId } of trees) {
    const normalize = (obj: any) => normalizeForSnapshot(obj, PACKAGE_ROOT)
    describe(`Instance: ${spineInstanceTreeId}`, () => {

        it('getCodepathColumns', async () => {
            const result = await api.getCodepathColumns(spineInstanceTreeId)
            await expectSnapshotMatch(normalize(result))
        })

        it('getCodepathRows', async () => {
            const result = await api.getCodepathRows(spineInstanceTreeId)
            await expectSnapshotMatch(normalize(result))
        })

        it('getComponents', async () => {
            const result = await api.getComponents(spineInstanceTreeId)
            expect(result['#']).toBe('Components')
            expect(result.components.length).toBeGreaterThan(0)
            // Each component has required fields
            for (const comp of result.components) {
                expect(comp['#']).toBe('Component')
                expect(comp.$id).toBeDefined()
                expect(comp.label).toBeDefined()
                expect(Array.isArray(comp.properties)).toBe(true)
                expect(Array.isArray(comp.actions)).toBe(true)
                expect(Array.isArray(comp.connections)).toBe(true)
            }
            await expectSnapshotMatch(normalize(result))
        })

        it('getCallPathFrames', async () => {
            const result = await api.getCallPathFrames(spineInstanceTreeId)
            expect(result['#']).toBe('CallPathFrames')
            expect(Array.isArray(result.frames)).toBe(true)

            // Validate add/remove invariant: after all frames, no lines remain
            const activeLines = new Set<string>()
            for (const frame of result.frames) {
                expect(typeof frame.eventIndex).toBe('number')
                expect(Array.isArray(frame.add)).toBe(true)
                expect(Array.isArray(frame.remove)).toBe(true)
                for (const entry of frame.add) {
                    expect(entry.lineId).toBeDefined()
                    activeLines.add(entry.lineId)
                }
                for (const entry of frame.remove) {
                    expect(entry.lineId).toBeDefined()
                    activeLines.delete(entry.lineId)
                }
            }
            expect(activeLines.size).toBe(0)

            // Validate line types
            for (const frame of result.frames) {
                for (const entry of frame.add) {
                    if (entry['#'] === 'CallLine') {
                        expect(entry.toCapsule).toBeDefined()
                        expect(entry.toAction).toBeDefined()
                        expect(entry.callEventIndex).toBeDefined()
                    } else if (entry['#'] === 'PropertyLine') {
                        expect(entry.capsuleId).toBeDefined()
                        expect(entry.propertyName).toBeDefined()
                        expect(['get', 'set']).toContain(entry.eventType)
                    }
                }
            }

            await expectSnapshotMatch(normalize(result))
        })

        it('getCallPathFrames frames are sorted by eventIndex', async () => {
            const result = await api.getCallPathFrames(spineInstanceTreeId)
            for (let i = 1; i < result.frames.length; i++) {
                expect(result.frames[i].eventIndex).toBeGreaterThanOrEqual(result.frames[i - 1].eventIndex)
            }
        })
    })
}
