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
                // =============================================================
                // Shared Engine State
                // =============================================================

                verbose: {
                    type: CapsulePropertyTypes.Literal,
                    value: false,
                },

                _schemaCreated: {
                    type: CapsulePropertyTypes.Literal,
                    value: false,
                },

                // =============================================================
                // Mutation API — delegates to engine-specific _-prefixed methods
                // =============================================================

                ensureSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<void> {
                        return await this._ensureSchema()
                    }
                },

                mergeNode: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, table: string, pk: string, data: Record<string, any>): void {
                        return this._mergeNode(table, pk, data)
                    }
                },

                mergeEdge: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, rel: string, fromTable: string, fromPk: string, toTable: string, toPk: string): void {
                        return this._mergeEdge(rel, fromTable, fromPk, toTable, toPk)
                    }
                },
            }
        }
    }, {
        extendsCapsule: '../ModelQueryMethods',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Engine',
    })
}
