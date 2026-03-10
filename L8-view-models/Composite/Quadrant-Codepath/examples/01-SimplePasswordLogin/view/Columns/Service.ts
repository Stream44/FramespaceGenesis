/**
 * Service column — groups backend service capsules.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#../../../../../../CapsuleSpine/Quadrant/schema/Column': {
                options: {
                    '#': {
                        label: 'Service',
                        listPosition: 4,
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/L8-view-models/Composite/Quadrant-Codepath/examples/01-SimplePasswordLogin/view/Columns/Service'
