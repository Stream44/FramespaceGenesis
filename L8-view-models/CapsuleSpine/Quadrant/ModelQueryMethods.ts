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
                // Map L6 CapsuleSpine/Quadrant — dimension tree queries go through this capsule
                CapsuleSpineQuadrant: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../../L6-semantic-models/CapsuleSpine/Quadrant/ModelQueryMethods',
                },
                // =============================================================
                // API Schema
                // =============================================================

                apiSchema: {
                    type: CapsulePropertyTypes.Constant,
                    value: {
                        namespace: '@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Quadrant~ModelQueryMethods',
                        description: 'Methods to query the *Quadrant Model* for a given *Spine Instance Tree*',
                        basePath: '/api/@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Quadrant~ModelQueryMethods',
                        methods: {
                            getTableView: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the Quadrant table view: column tree, row tree, and grid placement for rendering.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/Framespaces/Panel': {
                                        label: 'Quadrant Visualization',
                                        description: 'A table-rooted nested spatial layout for domain elements.'
                                    },
                                },
                            },
                            getColumnTree: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the column dimension tree for a spine instance. Proxied from L6 Quadrant.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                },
                            },
                            getRowTree: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the row dimension tree for a spine instance. Proxied from L6 Quadrant.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                },
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
                // Query API
                // =============================================================

                /**
                 * Get visualization reference for rendering the Quadrant grid.
                 */
                getTableView: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getTableView: spineInstanceTreeId is required')
                        return {
                            '#': 'TableView',
                            spineInstanceTreeId,
                        }
                    }
                },

                /**
                 * Proxy to L6 Quadrant getColumnTree.
                 */
                getColumnTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getColumnTree: spineInstanceTreeId is required')
                        return await this.CapsuleSpineQuadrant.getColumnTree({ graph, server }, spineInstanceTreeId)
                    }
                },

                /**
                 * Proxy to L6 Quadrant getRowTree.
                 */
                getRowTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getRowTree: spineInstanceTreeId is required')
                        return await this.CapsuleSpineQuadrant.getRowTree({ graph, server }, spineInstanceTreeId)
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/ModelQueryMethods',
    })
}
