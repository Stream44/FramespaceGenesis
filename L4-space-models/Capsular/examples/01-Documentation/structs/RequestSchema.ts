/**
 * RequestSchema struct — defines the shape of an incoming request.
 * Used as a struct/aspect delegate via the Validated aspect binding.
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
                validate: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, path: string): string {
                        return `validated[application/json]:${path}`
                    }
                },
                instanceMethod2: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): void {
                        // Instance method called via aspect binding
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
capsule['#'] = '@acme/web-toolkit/structs/RequestSchema'
