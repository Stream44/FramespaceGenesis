
export const MODEL_NAME = `@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/examples/02-TreeRelationships/0F-MappedInstanceSharing`

export async function runModel({ run }) {

    return await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
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
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: MODEL_NAME
        })
        return { spine }
    }, async ({ spine, apis }: any) => {
        return { api: apis[spine.capsuleSourceLineRef], sitRoot: import.meta.dir }
    }, {
        importMeta: import.meta,
    })
}
