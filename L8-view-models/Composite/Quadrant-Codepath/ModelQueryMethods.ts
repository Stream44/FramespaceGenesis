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
                        namespace: '@stream44.studio~FramespaceGenesis~L8-view-models~Composite~Quadrant-Codepath~ModelQueryMethods',
                        description: 'Supplementary methods for the Quadrant-Codepath composite view. The UI also calls L6 Quadrant and L6 Codepath APIs directly.',
                        basePath: '/api/@stream44.studio~FramespaceGenesis~L8-view-models~Composite~Quadrant-Codepath~ModelQueryMethods',
                        methods: {
                            getQuadrantCodepathView: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the combined Quadrant-Codepath view reference for rendering.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/Framespaces/Panel': {
                                        label: 'Quadrant-Codepath Visualization',
                                        description: 'A quadrant grid with component cards showing properties, actions, and execution flow lines.'
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
                 * Get the combined view reference for rendering.
                 */
                getQuadrantCodepathView: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getQuadrantCodepathView: spineInstanceTreeId is required')
                        return {
                            '#': 'QuadrantCodepathView',
                            spineInstanceTreeId,
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L8-view-models/Composite/Quadrant-Codepath/ModelQueryMethods',
    })
}
