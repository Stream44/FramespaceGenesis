/**
 * Lifecycle spine structure: demonstrates StructInit/StructDispose lifecycle properties.
 * These are not exposed on the API but run during capsule initialization and disposal.
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
                initialized: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                disposed: {
                    type: CapsulePropertyTypes.Literal,
                    value: false
                },
                initSetup: {
                    type: CapsulePropertyTypes.StructInit,
                    value: function (this: any) {
                        this.initialized = true
                    }
                },
                disposeCleanup: {
                    type: CapsulePropertyTypes.StructDispose,
                    value: function (this: any) {
                        this.disposed = true
                    }
                },
                status: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return `init=${this.initialized}, disposed=${this.disposed}`
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/caps/LifecycleService'
