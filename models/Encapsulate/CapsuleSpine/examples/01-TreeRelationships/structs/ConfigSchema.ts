/**
 * ConfigSchema struct — extends ConfigStore (which extends Storage).
 * Used as a property contract delegate providing config access.
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
                schemaVersion: {
                    type: CapsulePropertyTypes.Constant,
                    value: '1.0'
                },
                currentConfig: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return `schema:${this.schemaVersion}|${this.configPrefix}${this.prefix}`
                    }
                }
            }
        }
    }, {
        extendsCapsule: '../caps/ConfigStore',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/models/Encapsulate/CapsuleSpine/examples/01-TreeRelationships/structs/ConfigSchema'
