/**
 * StructDelegate spine structure: uses property contract delegates to mount struct capsules.
 * The struct capsules are resolved as capsule mappings and mounted as sub-components.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#../structs/SchemaStruct': {
                as: '$schema',
                options: {
                    '#': {
                        schemaValue: { type: 'user', version: 2 }
                    }
                }
            },
            '#': {
                useSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        return this.$schema.getSchema
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/caps/StructDelegateConsumer'
