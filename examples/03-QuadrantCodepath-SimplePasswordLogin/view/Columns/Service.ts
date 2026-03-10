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
            '#../../../../L8-view-models/CapsuleSpine/Quadrant/schema/Column': {
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/examples/03-QuadrantCodepath-SimplePasswordLogin/view/Columns/Service'
