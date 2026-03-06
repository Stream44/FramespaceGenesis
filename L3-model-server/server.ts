#!/usr/bin/env bun
/// <reference types="bun" />
/// <reference types="node" />

import { resolve } from 'path'
import { CapsuleSpineFactory } from "@stream44.studio/encapsulate/spine-factories/CapsuleSpineFactory.v0"
import { CapsuleSpineContract } from "@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0/Membrane.v0"

async function bootCapsule() {
    const { encapsulate, freeze, CapsulePropertyTypes, makeImportStack, hoistSnapshot } = await CapsuleSpineFactory({
        spineFilesystemRoot: resolve(import.meta.dir, '..'),
        capsuleModuleProjectionRoot: import.meta.dir,
        enableCallerStackInference: false,
        spineContracts: {
            ['#' + CapsuleSpineContract['#']]: CapsuleSpineContract
        },
    })

    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                modelServer: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './ModelServer',
                    options: {
                        '#': {
                            writeApiSchema: true,
                            models: {
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods': {
                                    engine: {
                                        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L6-semantic-models/Framespace/Workbench/ModelQueryMethods': {
                                    engine: {
                                        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods': {
                                    engine: {
                                        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
                                    }
                                },
                                '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Codepath/ModelQueryMethods': {
                                    engine: {
                                        '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {}
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
        capsuleName: '@stream44.studio/FramespaceGenesis/L3-model-server/server'
    })

    const snapshot = await freeze()
    const { run } = await hoistSnapshot({ snapshot })

    return { spine, run }
}

const { spine, run } = await bootCapsule()

await run({}, async ({ apis }: any) => {
    const modelServer = apis[spine.capsuleSourceLineRef].modelServer
    const uiDistDir = resolve(import.meta.dir, '../L13-workbench/vinxi-app/.output/public')
    await modelServer.startServer(undefined, { uiDistDir })
})
