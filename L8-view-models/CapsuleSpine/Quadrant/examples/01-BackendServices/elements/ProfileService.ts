/**
 * ProfileService — handles user profile operations.
 */
export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: any) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},

            // Dimension: Column
            '#../view/Columns/services/BusinessLogic': {},

            // Dimension: Row
            '#../view/Rows/Clusters/APICluster': {},

        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/examples/01-ColumnTree/elements/ProfileService'
