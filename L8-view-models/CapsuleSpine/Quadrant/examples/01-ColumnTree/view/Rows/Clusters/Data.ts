/**
 * Data cluster — groups data-related services.
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

            '#../../../../../schema/Row': {
                options: {
                    '#': {
                        label: 'Data'
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/examples/01-ColumnTree/view/Rows/Clusters/Data'
