/**
 * Account cluster — groups account-related services.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},

            '#../Clusters': {},

            '#../../../../../L8-view-models/CapsuleSpine/Quadrant/schema/Row': {
                options: {
                    '#': {
                        label: 'Account'
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/examples/Quadrant-BackendServices/view/Rows/Clusters/Account'
