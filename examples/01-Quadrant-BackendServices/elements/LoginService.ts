/**
 * LoginService — handles login operations.
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
            '#../view/Columns/services/Boundary': {},

            // Dimension: Row
            '#../view/Rows/Clusters/Account': {},
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/examples/01-Quadrant-BackendServices/elements/LoginService'
