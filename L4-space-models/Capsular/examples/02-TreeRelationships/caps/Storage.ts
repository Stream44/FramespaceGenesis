/**
 * Storage capsule — provides key-value storage with an optional prefix.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                prefix: {
                    type: CapsulePropertyTypes.String,
                    value: ''
                },
                get: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, key: string): string {
                        return `${this.prefix}${key}`
                    }
                },
                set: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, key: string, value: string): string {
                        return `stored:${this.prefix}${key}=${value}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/models/Encapsulate/CapsuleSpine/examples/01-TreeRelationships/caps/Storage'
