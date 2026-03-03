/**
 * BusinessLogic column — groups business logic services.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},

            '#../Services': {},

            '#../../../../../L8-view-models/CapsuleSpine/Quadrant/schema/Column': {
                options: {
                    '#': {
                        label: 'Business Logic',
                    }
                }
            },
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/examples/Quadrant-BackendServices/view/Columns/services/BusinessLogic'
