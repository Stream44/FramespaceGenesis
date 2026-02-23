/**
 * Composite spine structure: combines mappings + struct delegates + extends.
 * The most complex spine structure — uses all composition mechanisms together.
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
                        schemaValue: { type: 'composite', version: 3 }
                    }
                }
            },
            '#../structs/ValidationStruct': {
                as: '$validation',
            },
            '#': {
                standalone: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './Standalone',
                },
                runAll: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return `Composite: schema=${JSON.stringify(this.$schema.getSchema)}, service=${this.getServiceInfo}, mapped=${this.standalone.name}`
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/caps/CompositeService'
