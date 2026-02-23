/**
 * MappingWithExtends spine structure: both extends a parent and maps other capsules.
 * Demonstrates the combined pattern where inheritance and composition coexist.
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
                standalone: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './Standalone',
                },
                useExtendedAndMapped: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Extended: ${this.getServiceInfo} | Mapped: ${this.standalone.name}`
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/caps/MappingWithExtends'
