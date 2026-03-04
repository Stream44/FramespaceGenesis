import { normalizeForSnapshot } from '../../L3-model-server/lib'

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
                makeTests: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, opts: {
                        describe: any,
                        it: any,
                        expect: any,
                        expectSnapshotMatch: (actual: any, opts?: { strict?: boolean }) => Promise<void>,
                        engine: any | (() => any),
                        spineInstanceTreeId: string,
                        packageRoot: string,
                        config?: Record<string, Record<string, any>>
                    }): void {
                        const { describe, it, expect, expectSnapshotMatch, spineInstanceTreeId, packageRoot, config } = opts
                        const getEngine = typeof opts.engine === 'function' ? opts.engine : () => opts.engine

                        const normalize = (obj: any) => normalizeForSnapshot(obj, packageRoot)

                        // Dynamically discover all public query methods from ModelQueryMethods
                        // 'this' is the selfProxy whose ownKeys enumerates the full extends chain
                        const self = this
                        const methodNames = Object.keys(self).filter(
                            (k: string) => !k.startsWith('_') && typeof self[k] === 'function' && k !== 'makeTests'
                        ).sort()

                        for (const methodName of methodNames) {
                            it(methodName, async () => {
                                const engine = getEngine()
                                const extra = config?.[methodName]
                                const extraArgs = extra ? Object.values(extra) : []
                                const result = await engine[methodName](spineInstanceTreeId, ...extraArgs)
                                await expectSnapshotMatch(normalize(result))
                            })
                        }
                    }
                },
            }
        }
    }, {
        extendsCapsule: './ModelQueryMethods',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/ModelQueryMethodTests',
    })
}
