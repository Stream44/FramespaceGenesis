#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { run } from 't44/standalone-rt'

import { MODEL_NAME, runModel } from './0A-CapsuleAnatomy'

const {
    test: { describe, it, expect },
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
                    value: 't44/caps/ProjectTest',
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

describe('0A-CapsuleAnatomy', () => {

    it('run model', async () => {
        await spineInstanceTrees.registerInstance({
            name: MODEL_NAME,
        }, runModel)
    })

    it('imports instance to engine', async () => {
        await spineInstanceTrees.importInstanceToEngine({ engine: modelEngines.getEngine() })
    })

    modelQueryMethodTests.makeTests({
        describe,
        it,
        expect,
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

// ---------------------------------------------------------------------------
// Documentation snapshot — shows the resulting sit + cst structure using
// the generic names from the documentation example:
//
//   encapsulate({
//     '#@<org>/<project>/structs/StructA': { as: '$#@<org>/<project>/AspectX' }
//     '#': {
//       property1: 'val1',
//       mapping1: '@<org>/<project>/FeatureY',
//       method1: () => { ... }
//     }
//   }, { capsuleName: '@<org>/<project>/MyCapsule' })
// ---------------------------------------------------------------------------

const DOC_URI_MAP: Record<string, string> = {
    '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/examples/01-Documentation/0A-CapsuleAnatomy': '@<org>/<project>/MyCapsule',
    '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/examples/01-Documentation/structs/RequestSchema': '@<org>/<project>/structs/StructA',
    '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/examples/01-Documentation/caps/Logger': '@<org>/<project>/FeatureY',
    '@acme/web-toolkit/structs/RequestSchema': '@<org>/<project>/structs/StructA',
    '@acme/web-toolkit/Validated': '@<org>/<project>/AspectX',
    '@acme/web-toolkit/caps/Logger': '@<org>/<project>/FeatureY',
    '@stream44.studio/encapsulate/structs/Capsule': '@stream44.studio/encapsulate/structs/Capsule',
    '@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': '@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0',
    'L4-space-models/Capsular/examples/01-Documentation/0A-CapsuleAnatomy.ts': '<project>/MyCapsule.ts',
    'L4-space-models/Capsular/examples/01-Documentation/structs/RequestSchema.ts': '<project>/structs/StructA.ts',
    'L4-space-models/Capsular/examples/01-Documentation/caps/Logger.ts': '<project>/FeatureY.ts',
    '../../../encapsulate.dev/packages/encapsulate/structs/Capsule.ts': '@stream44.studio/encapsulate/structs/Capsule.ts',
}

const DOC_PROPERTY_MAP: Record<string, string> = {
    'log': 'featureMethod',
    'handleRequest': 'method1',
    'logger': 'mapping1',
    'validate': 'protoMethod1',
    'property1': 'property1',
    'instanceMethod2': 'instanceMethod2',
}

function remapUris(obj: any): any {
    if (typeof obj === 'string') {
        let s = obj
        for (const [from, to] of Object.entries(DOC_URI_MAP)) {
            s = s.split(from).join(to)
        }
        return s
    }
    if (Array.isArray(obj)) return obj.map(remapUris)
    if (obj && typeof obj === 'object') {
        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
            result[remapUris(key)] = remapUris(value)
        }
        return result
    }
    return obj
}

function remapProperties(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj
    if (Array.isArray(obj)) return obj.map(remapProperties)

    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
        const mappedKey = DOC_PROPERTY_MAP[key] ?? key
        result[mappedKey] = remapProperties(value)
    }
    return result
}

async function loadSitAndCsts(sitRoot: string) {
    const sitDirName = MODEL_NAME.replace(/\//g, '~')
    const sitFilePath = join(sitRoot, '.~o/encapsulate.dev/spine-instances', sitDirName, 'root-capsule.sit.json')
    const sit = JSON.parse(await readFile(sitFilePath, 'utf-8'))

    const encapsulateDevDir = join(sitRoot, '.~o/encapsulate.dev')
    const staticAnalysisDir = join(encapsulateDevDir, 'static-analysis')

    const csts: Record<string, any> = {}
    for (const capsuleName of Object.keys(sit.capsules || {})) {
        const capsuleInfo = sit.capsules[capsuleName]
        const ref = capsuleInfo.capsuleSourceUriLineRef
        if (!ref) continue

        const uriMatch = ref.match(/^@([^:]+):(\d+)$/)
        if (!uriMatch) continue
        const [, uriPath, line] = uriMatch

        const segments = uriPath.split('/')
        const localPath = segments.slice(2).join('/')
        const localCstPath = join(staticAnalysisDir, `${localPath}.ts:${line}.csts.json`)
        const npmCstPath = join(staticAnalysisDir, `o/npmjs.com/node_modules/@${uriPath}.ts:${line}.csts.json`)

        for (const candidate of [localCstPath, npmCstPath]) {
            try {
                csts[capsuleName] = JSON.parse(await readFile(candidate, 'utf-8'))
                break
            } catch { }
        }
    }

    return { sit, csts }
}

const VOLATILE_FIELDS = new Set([
    'capsuleSourceNameRefHash',
    'capsuleSourceLineRef',
    'capsuleSourceNameRef',
    'moduleFilepath',
    'cacheBustVersion',
    'parentCapsuleSourceUriLineRefInstanceId',
    'capsuleExpression',
    'ambientReferences',
    'moduleLocalCode',
    'declarationLine',
    'definitionStartLine',
    'definitionEndLine',
    'importStackLine',
    'optionsStartLine',
    'optionsEndLine',
    'valueType',
    'moduleUri',
    'valueExpression',
])

function stripVolatileFields(obj: any): any {
    if (typeof obj === 'string') return obj
    if (Array.isArray(obj)) return obj.map(stripVolatileFields)
    if (obj && typeof obj === 'object') {
        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
            if (VOLATILE_FIELDS.has(key)) continue
            result[key] = stripVolatileFields(value)
        }
        return result
    }
    return obj
}

function pruneEmpty(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj
    if (Array.isArray(obj)) return obj.map(pruneEmpty)

    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
        const pruned = pruneEmpty(value)
        if (key === 'properties' && typeof pruned === 'object' && Object.keys(pruned).length === 0) continue
        if (key === 'propertyContractUri' && pruned === '') continue
        if (key === 'propertyContracts' && typeof pruned === 'object' && Object.keys(pruned).length === 0) continue
        if (key === 'spineContracts' && typeof pruned === 'object' && Object.keys(pruned).length === 0) continue
        if (key === 'source' && typeof pruned === 'object' && Object.keys(pruned).length === 0) continue
        if (typeof pruned === 'object' && !Array.isArray(pruned) && Object.keys(pruned).length === 0) continue
        result[key] = pruned
    }
    return result
}

const DEFAULT_CAPSULE_STRUCT = '@stream44.studio/encapsulate/structs/Capsule'

function removeDefaultCapsuleStructEntries(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj
    if (Array.isArray(obj)) return obj.map(removeDefaultCapsuleStructEntries)

    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
        if (key === DEFAULT_CAPSULE_STRUCT) continue
        if (key === `#${DEFAULT_CAPSULE_STRUCT}`) continue
        if (key.includes(DEFAULT_CAPSULE_STRUCT)) continue
        const processed = removeDefaultCapsuleStructEntries(value)
        if (typeof processed === 'object' && processed !== null) {
            if (processed.propertyContractUri === DEFAULT_CAPSULE_STRUCT) continue
            if (processed.mappedModuleUri === DEFAULT_CAPSULE_STRUCT) continue
            if (processed.capsuleName === DEFAULT_CAPSULE_STRUCT) continue
            if (processed.capsuleSourceUriLineRef?.startsWith(DEFAULT_CAPSULE_STRUCT)) continue
        }
        result[key] = processed
    }
    return result
}

describe('0A-CapsuleAnatomy — Documentation Structure', () => {

    const removeDefaultCapsuleStruct = true

    let sitData: any
    let cstsData: any

    it('run model', async () => {
        const result = await spineInstanceTrees.registerInstance({
            name: MODEL_NAME,
        }, runModel)

        const loaded = await loadSitAndCsts(result.sitRoot)
        let sit = pruneEmpty(remapProperties(remapUris(stripVolatileFields(loaded.sit))))
        let csts = pruneEmpty(remapProperties(remapUris(stripVolatileFields(loaded.csts))))

        if (removeDefaultCapsuleStruct) {
            sit = pruneEmpty(removeDefaultCapsuleStructEntries(sit))
            csts = pruneEmpty(removeDefaultCapsuleStructEntries(csts))
        }

        sitData = sit
        cstsData = csts
    })

    it('sit structure', () => {
        expect(sitData).toMatchSnapshot()
    })

    it('cst structures', () => {
        expect(cstsData).toMatchSnapshot()
    })
})
