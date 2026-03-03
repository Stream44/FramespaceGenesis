import { writeFile } from 'fs/promises'
import { join, dirname } from 'path'

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
                // API Schema
                // =============================================================

                apiSchema: {
                    type: CapsulePropertyTypes.Constant,
                    value: {
                        namespace: 'Capsular/ModelQueryMethods',
                        description: 'Low-level query methods for Capsular model engines — delegates to engine-specific implementations.',
                        basePath: '/api/Capsular/ModelQueryMethods',
                        methods: {
                            listCapsules: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'List all capsules in the given spine instance tree.',
                                graphMethod: true,
                            },
                            getCapsuleWithSource: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                    { name: 'capsuleName', type: 'string' },
                                ],
                                description: 'Get a capsule with its full source node.',
                                graphMethod: true,
                            },
                            getCapsuleSpineTree_data: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                    { name: 'capsuleName', type: 'string' },
                                ],
                                description: 'Get spine tree data rows for a capsule.',
                                graphMethod: true,
                            },
                            getCapsuleNamesBySpineTree: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get capsule names belonging to a spine tree.',
                                graphMethod: true,
                            },
                            fetchCapsuleRelations: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                    { name: 'capsuleNames', type: 'string[]' },
                                ],
                                description: 'Fetch mapping and extends relations for a set of capsules.',
                                graphMethod: true,
                            },
                            listSpineInstanceTrees: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'List all spine instance trees.',
                                graphMethod: true,
                            },
                            getInstancesBySpineTree: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get all instances in a spine tree.',
                                graphMethod: true,
                            },
                            getRootInstance: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the root instance of a spine tree.',
                                graphMethod: true,
                            },
                            getChildInstances: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get child instances of the root instance in a spine tree.',
                                graphMethod: true,
                            },
                            fetchInstanceRelations: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Fetch instance relations for a spine tree.',
                                graphMethod: true,
                            },
                        },
                    },
                },

                // =============================================================
                // Initialization
                // =============================================================

                init: {
                    type: CapsulePropertyTypes.Init,
                    value: async function (this: any): Promise<void> {
                        if (this.writeMethodSchema) {
                            const moduleFilepath = this['#@stream44.studio/encapsulate/structs/Capsule'].moduleFilepath
                            const schemaPath = join(dirname(moduleFilepath), '_ModelQueryMethodsSchema.json')
                            await writeFile(schemaPath, JSON.stringify(this.apiSchema, null, 4))
                        }
                    }
                },

                // =============================================================
                // Public Query API — delegates to engine-specific _-prefixed methods
                // =============================================================

                listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any[]> {
                        return await this._listCapsules(spineInstanceTreeId)
                    }
                },

                getCapsuleWithSource: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleName: string): Promise<any | null> {
                        return await this._getCapsuleWithSource(spineInstanceTreeId, capsuleName)
                    }
                },

                getCapsuleSpineTree_data: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleName: string): Promise<any[]> {
                        const cap = await this._getCapsuleWithSource(spineInstanceTreeId, capsuleName)
                        if (!cap) return []
                        return await this._getCapsuleSpineTree_data(spineInstanceTreeId, cap.cap.capsuleSourceLineRef)
                    }
                },

                getCapsuleNamesBySpineTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<string[]> {
                        return await this._getCapsuleNamesBySpineTree(spineInstanceTreeId)
                    }
                },

                fetchCapsuleRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleNames: string[]): Promise<any> {
                        return await this._fetchCapsuleRelations(spineInstanceTreeId, capsuleNames)
                    }
                },

                listSpineInstanceTrees: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any[]> {
                        return await this._listSpineInstanceTrees(spineInstanceTreeId)
                    }
                },

                getInstancesBySpineTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any[]> {
                        return await this._getInstancesBySpineTree(spineInstanceTreeId)
                    }
                },

                getRootInstance: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any | null> {
                        return await this._getRootInstance(spineInstanceTreeId)
                    }
                },

                getChildInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any[]> {
                        const root = await this._getRootInstance(spineInstanceTreeId)
                        if (!root) return []
                        return await this._getChildInstances(root.instanceId)
                    }
                },

                fetchInstanceRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any> {
                        return await this._fetchInstanceRelations(spineInstanceTreeId)
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/ModelQueryMethods',
    })
}
