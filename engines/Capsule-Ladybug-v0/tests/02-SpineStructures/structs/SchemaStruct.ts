/**
 * A struct capsule used as a property contract delegate.
 * Provides schema-related properties that are mounted on the consuming capsule.
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
                schemaValue: {
                    type: CapsulePropertyTypes.Literal,
                    value: undefined
                },
                schemaVersion: {
                    type: CapsulePropertyTypes.Constant,
                    value: '2.0'
                },
                getSchema: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): any {
                        return this.schemaValue
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/structs/SchemaStruct'
