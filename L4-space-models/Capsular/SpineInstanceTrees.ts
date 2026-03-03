import { run } from '@stream44.studio/t44/standalone-rt'
import { join } from 'path'
import { exists } from 'fs/promises'

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
                // State
                // =============================================================

                _models: {
                    type: CapsulePropertyTypes.Literal,
                    value: [] as { name: string; result: any }[],
                },

                // =============================================================
                // Public API
                // =============================================================

                registerInstance: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, opts: { name: string }, capsuleFn: (ctx: { run: any }) => Promise<any>): Promise<any> {
                        const result = await capsuleFn({ run })
                        this._models.push({ name: opts.name, result })
                        return result
                    }
                },

                getModels: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): { name: string; result: any }[] {
                        return this._models
                    }
                },

                importInstanceToEngine: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, opts: { engine: any, name?: string, reset?: boolean }): Promise<void> {
                        const models = opts.name
                            ? this._models.filter((m: any) => m.name === opts.name)
                            : this._models

                        for (const model of models) {
                            const { sitRoot } = model.result
                            const sitDirName = model.name.replace(/\//g, '~')
                            const sitFile = join(sitRoot, '.~o/encapsulate.dev/spine-instances', sitDirName, 'root-capsule.sit.json')
                            if (await exists(sitFile)) {
                                await opts.engine.importSitFile(sitFile, { reset: opts.reset })
                            }
                        }

                        await opts.engine.linkMappings()
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/SpineInstanceTrees',
    })
}
