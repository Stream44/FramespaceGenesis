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
                // Map L6 CapsuleSpine/Codepath — column/row building helpers go through this capsule
                CapsuleSpineCodepath: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../../L6-semantic-models/CapsuleSpine/Codepath/ModelQueryMethods',
                },
                // =============================================================
                // API Schema
                // =============================================================

                apiSchema: {
                    type: CapsulePropertyTypes.Constant,
                    value: {
                        namespace: '@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Codepath~ModelQueryMethods',
                        description: 'Methods to query the *Codepath Model* for a given *Spine Instance Tree*',
                        basePath: '/api/@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Codepath~ModelQueryMethods',
                        methods: {
                            getSwimlaneView: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the Codepath swimlane view: capsule columns, event rows, and grid cells for rendering the code execution path.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/Framespaces/Panel': {
                                        label: 'Codepath Visualization',
                                        description: 'A timeline view of code execution through capsule membrane events.'
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
                 * Get the full Codepath visualization data.
                 *
                 * Returns a SwimlaneView with:
                 * - columns: one per capsule that has membrane events, ordered by first event
                 * - rows: one per event, ordered by eventIndex
                 * - each row has cells placed in the column of the event's owning capsule
                 *
                 * Delegates to L6 CapsuleSpine/Codepath for column/row building.
                 */
                getSwimlaneView: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getSwimlaneView: spineInstanceTreeId is required')

                        // Delegate to L6 Codepath for the full column + row data
                        const codepathRows = await this.CapsuleSpineCodepath.getCodepathRows({ graph, server }, spineInstanceTreeId)

                        return {
                            '#': 'SwimlaneView',
                            $id: spineInstanceTreeId,
                            columns: codepathRows.columns,
                            rows: codepathRows.rows,
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Codepath/ModelQueryMethods',
    })
}
