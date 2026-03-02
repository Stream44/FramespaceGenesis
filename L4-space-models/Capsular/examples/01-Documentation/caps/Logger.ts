/**
 * Logger capsule — provides structured logging for the web toolkit.
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
                log: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, message: string): string {
                        return `[info] ${message}`
                    }
                }
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@acme/web-toolkit/caps/Logger'
