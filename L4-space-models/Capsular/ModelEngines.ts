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
                '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Memory-v0/ImportAPI': {
                    type: CapsulePropertyTypes.Mapping,
                    value: './engines/Memory-v0/ImportAPI',
                },
                '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI': {
                    type: CapsulePropertyTypes.Mapping,
                    value: './engines/JsonFiles-v0/ImportAPI',
                },
                '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/SqLite-v0/ImportAPI': {
                    type: CapsulePropertyTypes.Mapping,
                    value: './engines/SqLite-v0/ImportAPI',
                },
                '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Ladybug-v0/ImportAPI': {
                    type: CapsulePropertyTypes.Mapping,
                    value: './engines/Ladybug-v0/ImportAPI',
                },

                _activeEngine: {
                    type: CapsulePropertyTypes.String,
                    value: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Memory-v0/ImportAPI',
                },

                setActiveEngine: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, name: string): any {
                        this._activeEngine = name
                        return this[name]
                    }
                },

                getEngine: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        return this[this._activeEngine]
                    }
                },

                getEngineNames: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string[] {
                        return [
                            '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Memory-v0/ImportAPI',
                            '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/ImportAPI',
                            '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/SqLite-v0/ImportAPI',
                            '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Ladybug-v0/ImportAPI',
                        ]
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/ModelEngines',
    })
}
