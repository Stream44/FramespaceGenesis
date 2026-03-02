
export const MODEL_NAME = `@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/examples/02-TreeRelationships/0E-Structs`

export async function runModel({ run }) {

    return await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
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
