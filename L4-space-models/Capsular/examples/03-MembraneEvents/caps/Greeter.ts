export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: {
    encapsulate: any
    CapsulePropertyTypes: any
    makeImportStack: any
}) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                _prefix: {
                    type: CapsulePropertyTypes.String,
                    value: 'Hello',
                },
                greet: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, name: string): string {
                        return `${this._prefix}, ${name}!`
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/examples/03-MembraneEvents/caps/Greeter'
