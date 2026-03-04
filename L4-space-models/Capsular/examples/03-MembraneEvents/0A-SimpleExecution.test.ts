#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { join } from 'path'
import { run } from '@stream44.studio/t44/standalone-rt'

import { MODEL_NAME, runModel } from './0A-SimpleExecution'

const {
    test: { describe, it, expect, expectSnapshotMatch },
    spineInstanceTrees,
    modelEngines,
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
                spineInstanceTrees: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../SpineInstanceTrees',
                },
                modelEngines: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../ModelEngines',
                },
                modelQueryMethodTests: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../ModelQueryMethodTests',
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: `${MODEL_NAME}.test`,
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

describe('0A-SimpleExecution (MembraneEvents)', () => {

    it('run model', async () => {
        await spineInstanceTrees.registerInstance({
            name: MODEL_NAME,
        }, runModel)
    })

    it('imports instance to engine', async () => {
        await spineInstanceTrees.importInstanceToEngine({ engine: modelEngines.getEngine() })
    })

    it('has membrane events', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        expect(events.length).toBeGreaterThan(0)
    })

    it('membrane events are ordered by eventIndex', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        for (let i = 1; i < events.length; i++) {
            expect(events[i].eventIndex).toBeGreaterThan(events[i - 1].eventIndex)
        }
    })

    it('membrane events contain call and call-result pairs', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        const calls = events.filter((e: any) => e.eventType === 'call')
        const results = events.filter((e: any) => e.eventType === 'call-result')
        expect(calls.length).toBeGreaterThan(0)
        expect(results.length).toBeGreaterThan(0)
    })

    it('membrane events contain expected event types', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        const eventTypes = new Set(events.map((e: any) => e.eventType))
        expect(eventTypes.has('call')).toBe(true)
        expect(eventTypes.has('call-result')).toBe(true)
    })

    it('membrane events snapshot', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        const packageRoot = join(import.meta.dir, '..', '..', '..', '..')
        // Normalize events for snapshot (strip absolute paths)
        const normalized = events.map((e: any) => ({
            eventIndex: e.eventIndex,
            eventType: e.eventType,
            propertyName: e.propertyName,
            capsuleSourceNameRef: e.capsuleSourceNameRef,
            callEventIndex: e.callEventIndex,
        }))
        expectSnapshotMatch(normalized)
    })

    modelQueryMethodTests.makeTests({
        describe,
        it,
        expect,
        expectSnapshotMatch,
        engine: modelEngines.getEngine(),
        spineInstanceTreeId: MODEL_NAME,
        packageRoot: join(import.meta.dir, '..', '..', '..', '..'),
        config: {
            getCapsuleWithSource: { capsuleName: MODEL_NAME },
            getCapsuleSpineTree_data: { capsuleName: MODEL_NAME },
            fetchCapsuleRelations: { capsuleNames: [MODEL_NAME] },
        }
    })
})
