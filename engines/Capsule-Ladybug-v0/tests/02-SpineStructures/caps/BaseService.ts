/**
 * Base capsule used as an extends target.
 * Provides shared properties and functions that child capsules inherit.
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
                serviceName: {
                    type: CapsulePropertyTypes.String,
                    value: 'base-service'
                },
                serviceVersion: {
                    type: CapsulePropertyTypes.Constant,
                    value: '1.0.0'
                },
                getServiceInfo: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return `${this.serviceName}@${this.serviceVersion}`
                    }
                },
                healthCheck: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `${this.serviceName}: healthy`
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/caps/BaseService'
