/**
 * Client row — groups client-side capsules.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#../../../../L8-view-models/CapsuleSpine/Quadrant/schema/Row': {
                options: {
                    '#': {
                        label: 'Client',
                        listPosition: 1,
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/examples/03-QuadrantCodepath-SimplePasswordLogin/view/Rows/Client'
