#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { join } from 'path'
import { run } from '@stream44.studio/t44/standalone-rt'
import { normalizeForSnapshot } from '../../../../../L3-model-server/lib'

import { MODEL_NAME, runModel } from './model'

const ENGINE_KEY = '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI'
const MOUNT_KEY_L8 = '@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Codepath~ModelQueryMethods'
const PACKAGE_ROOT = join(import.meta.dir, '..', '..', '..', '..', '..')

const {
    test: { describe, it, expect, expectSnapshotMatch },
    spineInstanceTrees,
    modelEngines,
    modelQueryMethodTests,
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
                spineInstanceTrees: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../../../../L4-space-models/Capsular/SpineInstanceTrees',
                },
                modelEngines: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../../../../L4-space-models/Capsular/ModelEngines',
                },
                modelQueryMethodTests: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../../../../L4-space-models/Capsular/ModelQueryMethodTests',
                },
                modelServer: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../../../../L3-model-server/ModelServer',
                    options: {
                        '#': {
                            models: {
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Codepath/ModelQueryMethods': {
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
        capsuleName: `${MODEL_NAME}.test`,
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

describe('01-SimplePasswordLogin', () => {

    it('run model', async () => {
        await spineInstanceTrees.registerInstance({
            name: MODEL_NAME,
        }, runModel)
    })

    it('imports instance to engine', async () => {
        await spineInstanceTrees.importInstanceToEngine({ engine: modelEngines.getEngine() })
    })

    it('has membrane events from login flow', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        expect(events.length).toBeGreaterThan(0)
    })

    it('membrane events span multiple capsules', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        const capsuleRefs = new Set(events.map((e: any) => e.capsuleSourceNameRef).filter(Boolean))
        // Should have events from User, LoginForm, HttpClient, AuthService
        expect(capsuleRefs.size).toBeGreaterThanOrEqual(3)
    })

    it('membrane events include call chain through User → LoginForm → HttpClient → AuthService', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        const callEvents = events.filter((e: any) => e.eventType === 'call')
        const calledProps = callEvents.map((e: any) => e.propertyName)
        // The call chain should include login, setEmail, setPassword, submit, post, authenticate
        expect(calledProps).toContain('login')
        expect(calledProps).toContain('setEmail')
        expect(calledProps).toContain('setPassword')
        expect(calledProps).toContain('submit')
        expect(calledProps).toContain('post')
        expect(calledProps).toContain('authenticate')
    })

    it('membrane events snapshot', async () => {
        const engine = modelEngines.getEngine()
        const events = await engine.getMembraneEvents(MODEL_NAME)
        const normalized = events.map((e: any) => ({
            eventIndex: e.eventIndex,
            eventType: e.eventType,
            membrane: e.membrane,
            propertyName: e.propertyName,
            capsuleSourceNameRef: e.capsuleSourceNameRef,
            callEventIndex: e.callEventIndex,
        }))
        expectSnapshotMatch(normalized)
    })

    it('getSwimlaneView', async () => {
        await modelServer.init()
        const apiL8 = modelServer.api[MOUNT_KEY_L8]
        const result = await apiL8.getSwimlaneView(MODEL_NAME)
        expect(result).toBeDefined()
        expect(result['#']).toBe('SwimlaneView')
        const normalize = (obj: any) => normalizeForSnapshot(obj, PACKAGE_ROOT)
        await expectSnapshotMatch(normalize(result))
    })

    modelQueryMethodTests.makeTests({
        describe,
        it,
        expect,
        expectSnapshotMatch,
        engine: modelEngines.getEngine(),
        spineInstanceTreeId: MODEL_NAME,
        packageRoot: join(import.meta.dir, '..', '..', '..', '..', '..'),
        config: {
            getCapsuleWithSource: { capsuleName: MODEL_NAME },
            getCapsuleSpineTree_data: { capsuleName: MODEL_NAME },
            fetchCapsuleRelations: { capsuleNames: [MODEL_NAME] },
        }
    })
})
