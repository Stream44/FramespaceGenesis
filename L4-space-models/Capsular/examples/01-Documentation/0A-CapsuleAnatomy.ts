
export const MODEL_NAME = `@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/examples/01-Documentation/0A-CapsuleAnatomy`

export async function runModel({ run }) {

    return await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#./structs/RequestSchema': {
                    as: '$#@acme/web-toolkit/Validated'
                },
                '#': {
                    property1: {
                        type: CapsulePropertyTypes.Literal,
                        value: 'val1',
                    },
                    logger: {
                        type: CapsulePropertyTypes.Mapping,
                        value: './caps/Logger',
                    },
                    handleRequest: {
                        type: CapsulePropertyTypes.Function,
                        value: function (this: any, route: string): string {
                            this.logger.log(`incoming ${route}`)
                            return this['$#@acme/web-toolkit/Validated'].validate(`/api/v1${route}`)
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
