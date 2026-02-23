/**
 * Standalone spine structure: a capsule with only value and function properties.
 * No mappings, no extends, no struct delegates.
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
                name: {
                    type: CapsulePropertyTypes.Literal,
                    value: 'standalone'
                },
                version: {
                    type: CapsulePropertyTypes.Constant,
                    value: '1.0.0'
                },
                label: {
                    type: CapsulePropertyTypes.String,
                    value: undefined
                },
                greet: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, greeting: string): string {
                        return `${greeting}, ${this.name}! (v${this.version})`
                    }
                },
                fullLabel: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): string {
                        return `${this.label ?? 'no-label'} [${this.name}]`
                    }
                },
                setName: {
                    type: CapsulePropertyTypes.SetterFunction,
                    value: function (this: any, newName: string) {
                        if (!newName) throw new Error('Name cannot be empty')
                        this.name = newName.trim()
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
capsule['#'] = '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/02-SpineStructures/caps/Standalone'
