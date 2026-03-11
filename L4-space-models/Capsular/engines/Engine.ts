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

                // =============================================================
                // URI Helpers
                // =============================================================

                _toNpmUri: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, absolutePath: string): string {
                        if (!absolutePath) return ''
                        // The capsuleName of the Engine is an npm URI like
                        // @stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Engine
                        // and its moduleFilepath is the absolute filesystem path.
                        // We derive the package root by stripping the relative suffix.
                        const capsuleStruct = this['#@stream44.studio/encapsulate/structs/Capsule']
                        const rootModuleFilepath = capsuleStruct?.rootCapsule?.moduleFilepath
                        const rootCapsuleName = capsuleStruct?.rootCapsule?.capsuleName
                        if (!rootModuleFilepath || !rootCapsuleName) return absolutePath

                        // rootCapsuleName: @stream44.studio/FramespaceGenesis/some/path/to/Module
                        // rootModuleFilepath: /abs/path/to/packages/FramespaceGenesis/some/path/to/Module.ts
                        // We need to find the package prefix: @stream44.studio/FramespaceGenesis
                        // and the filesystem package root: /abs/path/to/packages/FramespaceGenesis/
                        const atIdx = rootCapsuleName.indexOf('/')
                        if (atIdx < 0) return absolutePath
                        const secondSlash = rootCapsuleName.indexOf('/', atIdx + 1)
                        if (secondSlash < 0) return absolutePath
                        const npmPrefix = rootCapsuleName.substring(0, secondSlash) // e.g. @stream44.studio/FramespaceGenesis
                        const relativeSuffix = rootCapsuleName.substring(secondSlash) // e.g. /some/path/to/Module

                        // Find the package root by stripping the relative suffix from moduleFilepath
                        const suffixIdx = rootModuleFilepath.indexOf(relativeSuffix)
                        if (suffixIdx < 0) return absolutePath
                        const packageRoot = rootModuleFilepath.substring(0, suffixIdx) // e.g. /abs/path/to/packages/FramespaceGenesis

                        if (absolutePath.startsWith(packageRoot + '/')) {
                            return npmPrefix + absolutePath.substring(packageRoot.length)
                        }
                        if (absolutePath.startsWith(packageRoot)) {
                            return npmPrefix + absolutePath.substring(packageRoot.length)
                        }
                        return absolutePath
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
