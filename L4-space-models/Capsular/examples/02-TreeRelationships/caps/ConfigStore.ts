/**
 * ConfigStore — extends Storage with config-specific behavior.
 * Used as the parent for structs/ConfigSchema.
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
                configPrefix: {
                    type: CapsulePropertyTypes.Constant,
                    value: 'cfg:'
                },
                getConfig: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, key: string): string {
                        return `${this.configPrefix}${this.prefix}${key}`
                    }
                }
            }
        }
    }, {
        extendsCapsule: './Storage',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/models/Encapsulate/CapsuleSpine/examples/01-TreeRelationships/caps/ConfigStore'
