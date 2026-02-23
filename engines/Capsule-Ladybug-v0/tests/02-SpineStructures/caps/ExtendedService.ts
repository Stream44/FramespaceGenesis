/**
 * Extends spine structure: inherits from BaseService via extendsCapsule.
 * Child properties take precedence; parent functions see child values via shared self.
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
                    value: 'extended-service'
                },
                endpoint: {
                    type: CapsulePropertyTypes.Literal,
                    value: '/api/v1'
                },
                getEndpointInfo: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return `${this.serviceName}:${this.endpoint}`
                    }
                }
            }
        }
    }, {
        extendsCapsule: './BaseService',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/caps/ExtendedService'
