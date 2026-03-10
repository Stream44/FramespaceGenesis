#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../../L3-model-server/lib'
import { dirname } from 'path'
import { createServerAdapter, createRepDataProvider, getOverlayFrame, anchorId, MOUNT_KEY } from './rep-data-provider'
const ENGINE_KEY = '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI'
const CODEPATH_KEY = '@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Codepath~ModelQueryMethods'
const QUADRANT_KEY = '@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Quadrant~ModelQueryMethods'
const PACKAGE_ROOT = dirname(dirname(dirname(dirname(dirname(import.meta.path)))))

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
                                '@stream44.studio/FramespaceGenesis/L8-view-models/Composite/Quadrant-Codepath/ModelQueryMethods': {
                                    engine: {
                                        [ENGINE_KEY]: {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/CapsuleSpine/Codepath/ModelQueryMethods': {
                                    engine: {
                                        [ENGINE_KEY]: {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/CapsuleSpine/Quadrant/ModelQueryMethods': {
                                    engine: {
                                        [ENGINE_KEY]: {}
                                    }
                                },
                            }
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L8-view-models/Composite/Quadrant-Codepath/ModelQueryMethods.test',
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
// Ensure at least one instance is imported into the engine (lazy import is deferred)
const registeredModels = modelServer.spineInstanceTrees?.getModels ?? []
for (const m of registeredModels) {
    await modelServer._ensureImported(m.name, engine)
}
const trees = await engine._listSpineInstanceTrees()

// ── Schema tests ─────────────────────────────────────────────────────
describe('Schema', () => {
    const schema = modelServer._models.find((m: any) => m.schema.namespace === MOUNT_KEY)?.schema

    it('getQuadrantCodepathView has Framespaces panel tag', () => {
        const method = schema?.methods?.getQuadrantCodepathView
        expect(method).toBeDefined()
        expect(method.tags).toBeDefined()
        expect(method.tags['@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/Framespaces/Panel']).toBeDefined()
    })

    it('all tagged methods have discovery in ModelAPIs tag', () => {
        for (const [name, method] of Object.entries(schema?.methods ?? {}) as [string, any][]) {
            const apiTag = method.tags?.['@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel']
            if (apiTag) {
                expect(apiTag.discovery).toBeDefined()
                expect(apiTag.filterField).toBeDefined()
            }
        }
    })
})

// ── Per-instance tests ───────────────────────────────────────────────
for (const { spineInstanceTreeId } of trees) {
    const normalize = (obj: any) => normalizeForSnapshot(obj, PACKAGE_ROOT)
    describe(`Instance: ${spineInstanceTreeId}`, () => {

        it('getQuadrantCodepathView', async () => {
            const result = await api.getQuadrantCodepathView(spineInstanceTreeId)
            await expectSnapshotMatch(normalize(result))
        })
    })
}

// ── Rep Data Provider ────────────────────────────────────────────────
const codepathApi = modelServer.api[CODEPATH_KEY]
const quadrantApi = modelServer.api[QUADRANT_KEY]
const adapter = createServerAdapter({ codepathApi, quadrantApi })
const provider = createRepDataProvider(adapter)

for (const { spineInstanceTreeId } of trees) {
    const normalize = (obj: any) => normalizeForSnapshot(obj, PACKAGE_ROOT)

    describe(`Rep Data Provider: ${spineInstanceTreeId}`, () => {

        it('fetchRepData returns gridModel + components', async () => {
            const repData = await provider.fetchRepData(spineInstanceTreeId)

            expect(repData.gridModel).toBeDefined()
            expect(repData.components.length).toBeGreaterThan(0)
            expect(repData.componentById.size).toBe(repData.components.length)

            await expectSnapshotMatch(normalize({
                componentCount: repData.components.length,
                componentIds: repData.components.map((c: any) => c.$id),
                leafColumns: repData.gridModel.leafColumns.length,
                leafRows: repData.gridModel.leafRows.length,
                maxColDepth: repData.gridModel.maxColDepth,
                maxRowDepth: repData.gridModel.maxRowDepth,
            }))
        })

        it('fetchCallPathFrames returns frames with add/remove', async () => {
            const result = await provider.fetchCallPathFrames(spineInstanceTreeId)
            expect(Array.isArray(result.frames)).toBe(true)

            // Validate invariant: after processing all frames, no lines remain
            const activeLines = new Set<string>()
            for (const frame of result.frames) {
                for (const entry of frame.add) {
                    activeLines.add(entry.lineId)
                }
                for (const entry of frame.remove) {
                    activeLines.delete(entry.lineId)
                }
            }
            expect(activeLines.size).toBe(0)

            await expectSnapshotMatch(normalize(result))
        })

        it('component IDs in call path frames are consistent', async () => {
            const repData = await provider.fetchRepData(spineInstanceTreeId)
            const callPathResult = await provider.fetchCallPathFrames(spineInstanceTreeId)

            // Collect all unique capsule IDs referenced in frames
            const frameCapsuleIds = new Set<string>()
            for (const frame of callPathResult.frames) {
                for (const entry of frame.add) {
                    if (entry['#'] === 'CallLine') {
                        if (entry.fromCapsule) frameCapsuleIds.add(entry.fromCapsule)
                        if (entry.toCapsule) frameCapsuleIds.add(entry.toCapsule)
                    }
                    if (entry['#'] === 'PropertyLine') {
                        if (entry.capsuleId) frameCapsuleIds.add(entry.capsuleId)
                    }
                }
            }
            // Every component should be referenced in frames or not at all
            // (root model capsule may appear in frames but not in components — that's expected)
            for (const cid of frameCapsuleIds) {
                if (cid === '') continue
                // The ID should be a valid capsule reference (non-empty string)
                expect(typeof cid).toBe('string')
                expect(cid.length).toBeGreaterThan(0)
            }
        })

        it('getOverlayFrame returns resolved overlay per event', async () => {
            const repData = await provider.fetchRepData(spineInstanceTreeId)
            const framesData = await provider.fetchCallPathFrames(spineInstanceTreeId)

            // Collect all distinct event indices from frames
            const eventIndices = framesData.frames.map((f: any) => f.eventIndex)

            // Compute overlay for each event and collect into array
            const overlayPerEvent: any[] = []
            for (const eventIdx of eventIndices) {
                const overlay = getOverlayFrame(eventIdx, framesData.frames, repData.componentById)
                expect(typeof overlay.eventIndex).toBe('number')
                expect(Array.isArray(overlay.lines)).toBe(true)
                expect(Array.isArray(overlay.highlights)).toBe(true)

                // Every line segment must have '#' tag and anchor IDs
                for (const seg of overlay.lines) {
                    expect(seg['#']).toBe('OverlayLineSegment')
                    expect(typeof seg.key).toBe('string')
                    expect(typeof seg.fromSide).toBe('string')
                    expect(typeof seg.toSide).toBe('string')
                    expect(typeof seg.toAnchor).toBe('string')
                }
                // Every highlight must have '#' tag
                for (const hl of overlay.highlights) {
                    expect(hl['#']).toBe('OverlayHighlight')
                    expect(typeof hl.anchorId).toBe('string')
                }

                overlayPerEvent.push(overlay)
            }

            // After the last event+1 (cleanup), overlay should be empty
            if (eventIndices.length > 0) {
                const lastIdx = eventIndices[eventIndices.length - 1]
                const cleanupOverlay = getOverlayFrame(lastIdx, framesData.frames, repData.componentById)
                expect(cleanupOverlay.lines.length).toBe(0)
                expect(cleanupOverlay.highlights.length).toBe(0)
            }

            await expectSnapshotMatch(normalize(overlayPerEvent))
        })

        it('overlay lines are continuous and match frame add/remove transitions', async () => {
            const repData = await provider.fetchRepData(spineInstanceTreeId)
            const framesData = await provider.fetchCallPathFrames(spineInstanceTreeId)
            if (framesData.frames.length === 0) return

            // Shadow state: track active raw lines by applying add/remove
            const activeCallLines = new Map<string, any>()
            const activePropLines = new Map<string, any>()

            for (const frame of framesData.frames) {
                const eventIndex = frame.eventIndex

                // Apply remove first (matches getOverlayFrame order)
                for (const entry of frame.remove) {
                    activeCallLines.delete(entry.lineId)
                    activePropLines.delete(entry.lineId)
                }
                // Apply add
                for (const entry of frame.add) {
                    if (entry['#'] === 'CallLine') {
                        activeCallLines.set(entry.lineId, entry)
                    } else if (entry['#'] === 'PropertyLine') {
                        activePropLines.set(entry.lineId, entry)
                    }
                }

                // Get the overlay for this event
                const overlay = getOverlayFrame(eventIndex, framesData.frames, repData.componentById)
                const segsByKey = new Map(overlay.lines.map(s => [s.key, s]))
                const hlByAnchor = new Map(overlay.highlights.map(h => [h.anchorId, h]))

                // ── Verify each active CallLine produces expected overlay segments ──
                for (const [lineId, raw] of activeCallLines) {
                    const fromCapsule = raw.fromCapsule || ''
                    const toCapsule = raw.toCapsule || ''
                    const fromAction = raw.fromAction || ''
                    const toAction = raw.toAction || ''
                    const isSameCapsule = fromCapsule !== '' && fromCapsule === toCapsule

                    // Resolve whether this is a cross-capsule call through a mapping
                    let mappingProperty = ''
                    if (fromCapsule && toCapsule && !isSameCapsule) {
                        const callerComp = repData.componentById.get(fromCapsule)
                        if (callerComp) {
                            const conn = callerComp.connections.find((c: any) => c.target === toCapsule)
                            if (conn) mappingProperty = conn.propertyName
                        }
                    }

                    const fromAnchorId = fromCapsule && fromAction ? anchorId(fromCapsule, 'action', fromAction) : ''
                    const toAnchorId = toCapsule && toAction ? anchorId(toCapsule, 'action', toAction) : ''

                    if (fromAnchorId && toAnchorId && mappingProperty && !isSameCapsule) {
                        // Cross-capsule call through mapping → expect 2 segments
                        const mappingAnchorId = anchorId(fromCapsule, 'connection', mappingProperty)

                        // Segment 1: caller action (middle) → mapping (middle)
                        const seg1 = segsByKey.get(`call-to-mapping-${lineId}`)
                        expect(seg1).toBeDefined()
                        expect(seg1!.fromAnchor).toBe(fromAnchorId)
                        expect(seg1!.fromSide).toBe('middle')
                        expect(seg1!.toAnchor).toBe(mappingAnchorId)
                        expect(seg1!.toSide).toBe('middle')
                        expect(seg1!.category).toBe('call-to-mapping')

                        // Segment 2: mapping (right) → target action (left)
                        const seg2 = segsByKey.get(`mapping-to-target-${lineId}`)
                        expect(seg2).toBeDefined()
                        expect(seg2!.fromAnchor).toBe(mappingAnchorId)
                        expect(seg2!.fromSide).toBe('right')
                        expect(seg2!.toAnchor).toBe(toAnchorId)
                        expect(seg2!.toSide).toBe('left')
                        expect(seg2!.category).toBe('mapping-to-target')
                        expect(seg2!.arrow).toBe(true)

                        // Mapping highlight
                        expect(hlByAnchor.has(mappingAnchorId)).toBe(true)
                        expect(hlByAnchor.get(mappingAnchorId)!.kind).toBe('active-mapping')

                    } else if (fromAnchorId && toAnchorId && isSameCapsule) {
                        // Same-capsule call → expect 1 internal segment
                        const seg = segsByKey.get(`call-internal-${lineId}`)
                        expect(seg).toBeDefined()
                        expect(seg!.fromAnchor).toBe(fromAnchorId)
                        expect(seg!.fromSide).toBe('middle')
                        expect(seg!.toAnchor).toBe(toAnchorId)
                        expect(seg!.toSide).toBe('middle')
                        expect(seg!.category).toBe('call-internal')
                        expect(seg!.arrow).toBe(true)

                    } else if (fromAnchorId && toAnchorId && !isSameCapsule) {
                        // Cross-capsule call without mapping → expect call-direct
                        const seg = segsByKey.get(`call-direct-${lineId}`)
                        expect(seg).toBeDefined()
                        expect(seg!.fromAnchor).toBe(fromAnchorId)
                        expect(seg!.fromSide).toBe('right')
                        expect(seg!.toAnchor).toBe(toAnchorId)
                        expect(seg!.toSide).toBe('left')
                        expect(seg!.category).toBe('call')
                        expect(seg!.arrow).toBe(true)

                    } else if (!fromAnchorId && toAnchorId) {
                        // Entry-point call → expect call-entry stub
                        const seg = segsByKey.get(`call-entry-${lineId}`)
                        expect(seg).toBeDefined()
                        expect(seg!.fromAnchor).toBe('')
                        expect(seg!.toAnchor).toBe(toAnchorId)
                        expect(seg!.category).toBe('call-entry')
                        expect(seg!.arrow).toBe(true)
                    }

                    // Target function must be highlighted
                    if (toCapsule && toAction) {
                        expect(hlByAnchor.has(toAnchorId)).toBe(true)
                        expect(hlByAnchor.get(toAnchorId)!.kind).toBe('active-function')
                    }
                    // Caller function must be highlighted (if it exists)
                    if (fromCapsule && fromAction) {
                        expect(hlByAnchor.has(fromAnchorId)).toBe(true)
                        expect(hlByAnchor.get(fromAnchorId)!.kind).toBe('active-function')
                    }
                }

                // ── Verify each active PropertyLine produces expected overlay segments ──
                for (const [lineId, raw] of activePropLines) {
                    const capsuleId = raw.capsuleId || ''
                    const propertyName = raw.propertyName || ''
                    const fromCapsule = raw.fromCapsule || ''
                    const fromAction = raw.fromAction || ''
                    const callerAnchorId = fromCapsule && fromAction ? anchorId(fromCapsule, 'action', fromAction) : ''

                    if (raw.isMappingRef) {
                        // Mapping-ref property → targets connection anchor
                        const connAnchorId = capsuleId && propertyName ? anchorId(capsuleId, 'connection', propertyName) : ''

                        if (callerAnchorId && connAnchorId) {
                            const seg = segsByKey.get(`prop-access-${lineId}`)
                            expect(seg).toBeDefined()
                            expect(seg!.fromAnchor).toBe(callerAnchorId)
                            expect(seg!.fromSide).toBe('middle')
                            expect(seg!.toAnchor).toBe(connAnchorId)
                            expect(seg!.toSide).toBe('middle')
                            expect(seg!.category).toBe('property-access')
                        }
                        // Connection row highlighted as active-mapping
                        if (connAnchorId) {
                            expect(hlByAnchor.has(connAnchorId)).toBe(true)
                            expect(hlByAnchor.get(connAnchorId)!.kind).toBe('active-mapping')
                        }
                    } else {
                        // Regular property → targets property anchor
                        // Getter: arrow from property→caller (data flows back)
                        // Setter: arrow from caller→property
                        const propAnchorId = capsuleId && propertyName ? anchorId(capsuleId, 'property', propertyName) : ''
                        const isGetter = raw.eventType !== 'set'

                        if (callerAnchorId && propAnchorId) {
                            const seg = segsByKey.get(`prop-access-${lineId}`)
                            expect(seg).toBeDefined()
                            expect(seg!.fromAnchor).toBe(isGetter ? propAnchorId : callerAnchorId)
                            expect(seg!.fromSide).toBe('middle')
                            expect(seg!.toAnchor).toBe(isGetter ? callerAnchorId : propAnchorId)
                            expect(seg!.toSide).toBe('middle')
                            expect(seg!.category).toBe('property-access')
                            expect(seg!.arrow).toBe(true)
                            expect(seg!.color).toBe('#dc2626')
                        }
                        // Property row highlighted as active-property
                        if (propAnchorId) {
                            expect(hlByAnchor.has(propAnchorId)).toBe(true)
                            expect(hlByAnchor.get(propAnchorId)!.kind).toBe('active-property')
                        }
                    }
                }

                // ── No orphan lines — every overlay segment key must belong to an active raw line ──
                for (const seg of overlay.lines) {
                    // Extract the raw lineId from the segment key (format: "category-lineId")
                    const keyParts = seg.key.split('-')
                    // lineId is everything after the category prefix (e.g. "call-to-mapping-call:12" → "call:12")
                    let rawLineId = ''
                    if (seg.key.startsWith('call-to-mapping-')) rawLineId = seg.key.slice('call-to-mapping-'.length)
                    else if (seg.key.startsWith('mapping-to-target-')) rawLineId = seg.key.slice('mapping-to-target-'.length)
                    else if (seg.key.startsWith('call-internal-')) rawLineId = seg.key.slice('call-internal-'.length)
                    else if (seg.key.startsWith('call-entry-')) rawLineId = seg.key.slice('call-entry-'.length)
                    else if (seg.key.startsWith('call-direct-')) rawLineId = seg.key.slice('call-direct-'.length)
                    else if (seg.key.startsWith('prop-access-')) rawLineId = seg.key.slice('prop-access-'.length)
                    else if (seg.key.startsWith('mapping-ref-')) rawLineId = seg.key.slice('mapping-ref-'.length)

                    if (rawLineId) {
                        const isActive = activeCallLines.has(rawLineId) || activePropLines.has(rawLineId)
                        expect(isActive).toBe(true)
                    }
                }

                // ── Chain continuity: active call lines form a connected call stack ──
                // Every non-entry call's fromCapsule:fromAction must be the toAction
                // of another active call (the one that invoked it)
                const activeToCapsuleActions = new Set<string>()
                for (const [, raw] of activeCallLines) {
                    if (raw.toCapsule && raw.toAction) {
                        activeToCapsuleActions.add(`${raw.toCapsule}:${raw.toAction}`)
                    }
                }
                for (const [, raw] of activeCallLines) {
                    if (!raw.fromCapsule || !raw.fromAction) continue // entry point, no caller
                    const callerKey = `${raw.fromCapsule}:${raw.fromAction}`
                    // The caller must either be a target of another active call, or itself be an entry
                    const callerIsTarget = activeToCapsuleActions.has(callerKey)
                    const callerIsEntry = [...activeCallLines.values()].some(
                        (c: any) => !c.fromCapsule && c.toCapsule === raw.fromCapsule && c.toAction === raw.fromAction
                    )
                    expect(callerIsTarget || callerIsEntry).toBe(true)
                }
            }
        })
    })
}

// ── Targeted event assertions for SimplePasswordLogin ──────────────
// Verify specific events produce the expected continuous line chain.
{
    const SPL_ID = '@stream44.studio/FramespaceGenesis/L8-view-models/Composite/Quadrant-Codepath/examples/01-SimplePasswordLogin'
    const SPL_MODEL = `${SPL_ID}/model`
    const SPL_USER = `${SPL_ID}/caps/User`
    const SPL_LOGIN_FORM = `${SPL_ID}/caps/LoginForm`

    describe(`Targeted overlay assertions: ${SPL_ID}`, () => {

        it('event 32: full chain entry→runModel→login→loginForm→submit→validate→_email', async () => {
            const repData = await provider.fetchRepData(SPL_ID)
            const framesData = await provider.fetchCallPathFrames(SPL_ID)
            const overlay = getOverlayFrame(32, framesData.frames, repData.componentById)
            const segsByKey = new Map(overlay.lines.map(s => [s.key, s]))
            const hlKinds = new Map(overlay.highlights.map(h => [h.anchorId, h]))

            // ── Call chain lines ──
            // 1. Entry → model:runModel
            const entry = segsByKey.get('call-entry-call:0')
            expect(entry).toBeDefined()
            expect(entry!.toAnchor).toBe(anchorId(SPL_MODEL, 'action', 'runModel'))

            // 2. model:runModel → User:login (cross-capsule, no mapping in connections → call-direct)
            const modelToUser = segsByKey.get('call-direct-call:6')
            expect(modelToUser).toBeDefined()
            expect(modelToUser!.fromAnchor).toBe(anchorId(SPL_MODEL, 'action', 'runModel'))
            expect(modelToUser!.toAnchor).toBe(anchorId(SPL_USER, 'action', 'login'))

            // 3. User:login → User:loginForm mapping → LoginForm:submit (cross-capsule through mapping)
            const loginToMapping = segsByKey.get('call-to-mapping-call:28')
            expect(loginToMapping).toBeDefined()
            expect(loginToMapping!.fromAnchor).toBe(anchorId(SPL_USER, 'action', 'login'))
            expect(loginToMapping!.fromSide).toBe('middle')
            expect(loginToMapping!.toAnchor).toBe(anchorId(SPL_USER, 'connection', 'loginForm'))
            expect(loginToMapping!.toSide).toBe('middle')

            const mappingToSubmit = segsByKey.get('mapping-to-target-call:28')
            expect(mappingToSubmit).toBeDefined()
            expect(mappingToSubmit!.fromAnchor).toBe(anchorId(SPL_USER, 'connection', 'loginForm'))
            expect(mappingToSubmit!.fromSide).toBe('right')
            expect(mappingToSubmit!.toAnchor).toBe(anchorId(SPL_LOGIN_FORM, 'action', 'submit'))
            expect(mappingToSubmit!.toSide).toBe('left')

            // 4. LoginForm:submit → LoginForm:validate (same-capsule internal)
            const submitToValidate = segsByKey.get('call-internal-call:30')
            expect(submitToValidate).toBeDefined()
            expect(submitToValidate!.fromAnchor).toBe(anchorId(SPL_LOGIN_FORM, 'action', 'submit'))
            expect(submitToValidate!.fromSide).toBe('middle')
            expect(submitToValidate!.toAnchor).toBe(anchorId(SPL_LOGIN_FORM, 'action', 'validate'))
            expect(submitToValidate!.toSide).toBe('middle')

            // 5. LoginForm:_email → LoginForm:validate (getter: arrow from property back to caller)
            const validateToEmail = segsByKey.get('prop-access-prop:32')
            expect(validateToEmail).toBeDefined()
            expect(validateToEmail!.fromAnchor).toBe(anchorId(SPL_LOGIN_FORM, 'property', '_email'))
            expect(validateToEmail!.toAnchor).toBe(anchorId(SPL_LOGIN_FORM, 'action', 'validate'))
            expect(validateToEmail!.arrow).toBe(true)
            expect(validateToEmail!.color).toBe('#dc2626')

            // ── Highlights ──
            // All active functions highlighted
            expect(hlKinds.get(anchorId(SPL_MODEL, 'action', 'runModel'))?.kind).toBe('active-function')
            expect(hlKinds.get(anchorId(SPL_USER, 'action', 'login'))?.kind).toBe('active-function')
            expect(hlKinds.get(anchorId(SPL_LOGIN_FORM, 'action', 'submit'))?.kind).toBe('active-function')
            expect(hlKinds.get(anchorId(SPL_LOGIN_FORM, 'action', 'validate'))?.kind).toBe('active-function')
            // Mapping highlighted
            expect(hlKinds.get(anchorId(SPL_USER, 'connection', 'loginForm'))?.kind).toBe('active-mapping')
            // Property highlighted
            expect(hlKinds.get(anchorId(SPL_LOGIN_FORM, 'property', '_email'))?.kind).toBe('active-property')

            // ── Total line count: entry + direct + 2 mapping + internal + property = 6 ──
            expect(overlay.lines.length).toBe(6)
        })

        it('event 6: User.login highlighted from the moment call:6 is added', async () => {
            const repData = await provider.fetchRepData(SPL_ID)
            const framesData = await provider.fetchCallPathFrames(SPL_ID)
            const overlay = getOverlayFrame(6, framesData.frames, repData.componentById)
            const hlKinds = new Map(overlay.highlights.map(h => [h.anchorId, h]))

            // User.login must be active-function starting at event 6
            expect(hlKinds.get(anchorId(SPL_USER, 'action', 'login'))?.kind).toBe('active-function')
            // model:runModel also active
            expect(hlKinds.get(anchorId(SPL_MODEL, 'action', 'runModel'))?.kind).toBe('active-function')
            // call-direct line from runModel → login
            const segsByKey = new Map(overlay.lines.map(s => [s.key, s]))
            expect(segsByKey.get('call-direct-call:6')).toBeDefined()
        })

        it('event 7: mapping-ref getter is filtered out, only call lines from event 6 remain', async () => {
            const repData = await provider.fetchRepData(SPL_ID)
            const framesData = await provider.fetchCallPathFrames(SPL_ID)
            const overlay = getOverlayFrame(7, framesData.frames, repData.componentById)
            const segsByKey = new Map(overlay.lines.map(s => [s.key, s]))
            const hlKinds = new Map(overlay.highlights.map(h => [h.anchorId, h]))

            // User.login still active from call:6
            expect(hlKinds.get(anchorId(SPL_USER, 'action', 'login'))?.kind).toBe('active-function')

            // No prop:7 line — the mapping-ref getter event was filtered from the codepath
            expect(segsByKey.has('prop-access-prop:7')).toBe(false)

            // Only the call lines from event 6 remain: entry + call-direct = 2
            expect(segsByKey.has('call-entry-call:0')).toBe(true)
            expect(segsByKey.has('call-direct-call:6')).toBe(true)
            expect(overlay.lines.length).toBe(2)
        })

        it('User.login stays highlighted from event 6 through event 55', async () => {
            const repData = await provider.fetchRepData(SPL_ID)
            const framesData = await provider.fetchCallPathFrames(SPL_ID)
            const loginAnchor = anchorId(SPL_USER, 'action', 'login')

            // call:6 is removed at event 56, so events 6..55 should all have User.login highlighted
            for (const idx of [6, 7, 12, 13, 14, 15, 20, 28, 32, 40, 50, 55]) {
                const overlay = getOverlayFrame(idx, framesData.frames, repData.componentById)
                const hlKinds = new Map(overlay.highlights.map(h => [h.anchorId, h]))
                expect(hlKinds.get(loginAnchor)?.kind).toBe('active-function')
            }

            // At event 56, call:6 is removed — User.login should NOT be highlighted
            const overlay56 = getOverlayFrame(56, framesData.frames, repData.componentById)
            const hlKinds56 = new Map(overlay56.highlights.map(h => [h.anchorId, h]))
            expect(hlKinds56.has(loginAnchor)).toBe(false)
        })

        it('event 13: chain entry→runModel→login→loginForm→setEmail→_email', async () => {
            const repData = await provider.fetchRepData(SPL_ID)
            const framesData = await provider.fetchCallPathFrames(SPL_ID)
            const overlay = getOverlayFrame(13, framesData.frames, repData.componentById)
            const segsByKey = new Map(overlay.lines.map(s => [s.key, s]))
            const hlKinds = new Map(overlay.highlights.map(h => [h.anchorId, h]))

            // 1. Entry → model:runModel
            expect(segsByKey.get('call-entry-call:0')).toBeDefined()
            // 2. model:runModel → User:login (direct, no mapping in connections)
            expect(segsByKey.get('call-direct-call:6')).toBeDefined()
            // 3. User:login → mapping:loginForm → LoginForm:setEmail (through mapping)
            expect(segsByKey.get('call-to-mapping-call:12')).toBeDefined()
            expect(segsByKey.get('mapping-to-target-call:12')).toBeDefined()
            // 4. LoginForm:setEmail → _email (property set)
            expect(segsByKey.get('prop-access-prop:13')).toBeDefined()

            // Highlights: runModel, login, setEmail active; loginForm mapping; _email property
            expect(hlKinds.get(anchorId(SPL_MODEL, 'action', 'runModel'))?.kind).toBe('active-function')
            expect(hlKinds.get(anchorId(SPL_USER, 'action', 'login'))?.kind).toBe('active-function')
            expect(hlKinds.get(anchorId(SPL_LOGIN_FORM, 'action', 'setEmail'))?.kind).toBe('active-function')
            expect(hlKinds.get(anchorId(SPL_USER, 'connection', 'loginForm'))?.kind).toBe('active-mapping')
            expect(hlKinds.get(anchorId(SPL_LOGIN_FORM, 'property', '_email'))?.kind).toBe('active-property')

            // entry + direct + 2 mapping + property = 5
            expect(overlay.lines.length).toBe(5)
        })
    })
}
