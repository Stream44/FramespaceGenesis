/**
 * A struct capsule that extends BaseService.
 * Demonstrates StructDelegateWithExtends: a struct that inherits from a parent capsule.
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
                validationRules: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                validate: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, input: any): string {
                        return `${this.serviceName}: validated(${JSON.stringify(input)})`
                    }
                }
            }
        }
    }, {
        extendsCapsule: '../caps/BaseService',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/structs/ValidationStruct'
