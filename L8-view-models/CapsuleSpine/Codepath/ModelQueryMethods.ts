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
                // Map L6 CapsuleSpine — all graph queries go through this capsule
                CapsuleSpine: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../../L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods',
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
                 * Returns a CodepathGrid with:
                 * - columns: one per capsule that has membrane events, ordered by first event
                 * - rows: one per event, ordered by eventIndex
                 * - each row has cells placed in the column of the event's owning capsule
                 */
                getSwimlaneView: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getSwimlaneView: spineInstanceTreeId is required')

                        // Get structured event log from L6
                        const eventLog = await this.CapsuleSpine.getEventLog({ graph, server }, spineInstanceTreeId)
                        const rawEntries = eventLog.entries || []

                        const entries = rawEntries

                        if (entries.length === 0) {
                            return {
                                '#': 'SwimlaneView',
                                $id: spineInstanceTreeId,
                                columns: [],
                                rows: [],
                            }
                        }

                        // Build a mapping from each event to its column key.
                        // For call-result events, resolve via the original call event's capsule.
                        const entryToRef = new Map<number, string>()
                        const callEventMap = new Map<number, any>()
                        for (const entry of entries) {
                            if (entry.eventType === 'call') {
                                callEventMap.set(entry.eventIndex, entry)
                            }
                        }
                        for (const entry of entries) {
                            let ref = entry.capsuleSourceNameRef || entry.capsuleSourceLineRef || ''
                            if (!ref && entry.eventType === 'call-result' && entry.callEventIndex !== undefined) {
                                const callEntry = callEventMap.get(entry.callEventIndex)
                                if (callEntry) {
                                    ref = callEntry.capsuleSourceNameRef || callEntry.capsuleSourceLineRef || ''
                                }
                            }
                            entryToRef.set(entry.eventIndex, ref)
                        }

                        // Build columns: one per unique ref, ordered by first appearance
                        const columnOrder: string[] = []
                        const columnSet = new Set<string>()
                        for (const entry of entries) {
                            const ref = entryToRef.get(entry.eventIndex) || ''
                            if (ref && !columnSet.has(ref)) {
                                columnSet.add(ref)
                                columnOrder.push(ref)
                            }
                        }

                        const columns = columnOrder.map((ref: string, index: number) => ({
                            '#': 'CodepathColumn',
                            $id: ref,
                            index,
                            label: ref.split('/').pop() || ref,
                        }))

                        // Build column index lookup
                        const colIndex = new Map<string, number>()
                        columnOrder.forEach((ref, i) => colIndex.set(ref, i))

                        // Build rows: one per event entry
                        const rows = entries.map((entry: any, rowIndex: number) => {
                            const ref = entryToRef.get(entry.eventIndex) || ''
                            const columnIdx = colIndex.get(ref) ?? -1

                            const cell: any = {
                                '#': 'CodepathCell',
                                columnIndex: columnIdx,
                                eventType: entry.eventType,
                                membrane: entry.membrane || 'external',
                                propertyName: entry.propertyName,
                                // Include full raw encapsulate event (with target/caller objects)
                                rawEvent: entry.rawEvent
                                    ? (typeof entry.rawEvent === 'string' ? JSON.parse(entry.rawEvent) : entry.rawEvent)
                                    : Object.fromEntries(
                                        Object.entries(entry).filter(([k]: [string, any]) => k !== 'activeInvocations')
                                    ),
                            }

                            if (entry.eventType === 'call-result' && entry.callEventIndex !== undefined) {
                                cell.callEventIndex = entry.callEventIndex
                            }

                            if (entry.resolvedCaller) {
                                cell.resolvedCaller = {
                                    capsuleSourceNameRef: entry.resolvedCaller.capsuleSourceNameRef,
                                    propertyName: entry.resolvedCaller.propertyName,
                                }
                                // For internal calls, find the caller's column index for connector line
                                const callerRef = entry.resolvedCaller.capsuleSourceNameRef
                                if (callerRef && colIndex.has(callerRef)) {
                                    cell.callerColumnIndex = colIndex.get(callerRef)
                                }
                            }

                            if (entry.isMappingRef) {
                                cell.isMappingRef = true
                                if (entry.mappingTargetRef) {
                                    cell.mappingTargetRef = entry.mappingTargetRef
                                    // Find target column index for drawing reference line
                                    if (colIndex.has(entry.mappingTargetRef)) {
                                        cell.mappingTargetColumnIndex = colIndex.get(entry.mappingTargetRef)
                                    }
                                }
                            }

                            // Always include dataSeen for set/get events so client can detect "set to empty"
                            if (entry.eventType === 'set' || entry.eventType === 'get') {
                                cell.dataSeen = entry.dataSeen ?? ''
                            }

                            // Active invocations at this point (call stack depth indicator)
                            cell.activeInvocationCount = (entry.activeInvocations || []).length

                            return {
                                '#': 'CodepathRow',
                                $id: `row-${entry.eventIndex}`,
                                index: rowIndex,
                                eventIndex: entry.eventIndex,
                                cell,
                            }
                        })

                        return {
                            '#': 'SwimlaneView',
                            $id: spineInstanceTreeId,
                            columns,
                            rows,
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
