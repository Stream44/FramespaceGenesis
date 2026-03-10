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
                    value: '../../Capsular/CapsuleSpine/ModelQueryMethods',
                },
                // =============================================================
                // API Schema
                // =============================================================

                apiSchema: {
                    type: CapsulePropertyTypes.Constant,
                    value: {
                        namespace: '@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Codepath~ModelQueryMethods',
                        description: 'Semantic methods to query the *Codepath Model* columns and rows for a given *Spine Instance Tree*',
                        basePath: '/api/@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Codepath~ModelQueryMethods',
                        methods: {
                            getCodepathColumns: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the Codepath columns: one per capsule that has membrane events, ordered by first event.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                },
                            },
                            getCodepathRows: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the Codepath rows: one per event entry, with cells placed in the column of the event\'s owning capsule.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                },
                            },
                            getComponents: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get component data for each capsule in the spine: properties (data), actions (functions), and connections (mappings).',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                },
                            },
                            getCallPathFrames: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get a list of call-path state transitions for the full model run. Each frame contains add/remove entries describing which lines appear or disappear at that event.',
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
                // Internal helpers
                // =============================================================

                /**
                 * Internal: resolve each event entry to its column reference key.
                 * For call-result events, resolves via the original call event's capsule.
                 */
                _resolveEntryRefs: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, entries: any[]): Map<number, string> {
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
                        return entryToRef
                    }
                },

                /**
                 * Internal: build the ordered column list and column index lookup from entries + refs.
                 */
                _buildColumnData: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, entries: any[], entryToRef: Map<number, string>): { columns: any[], colIndex: Map<string, number> } {
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

                        const colIndex = new Map<string, number>()
                        columnOrder.forEach((ref, i) => colIndex.set(ref, i))

                        return { columns, colIndex }
                    }
                },

                /**
                 * Internal: build rows from entries, entryToRef, and colIndex.
                 */
                _buildRows: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, entries: any[], entryToRef: Map<number, string>, colIndex: Map<string, number>): any[] {
                        return entries.map((entry: any, rowIndex: number) => {
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
                    }
                },

                // =============================================================
                // Query API
                // =============================================================

                /**
                 * Get the Codepath columns: one per capsule that has membrane events,
                 * ordered by first event appearance.
                 */
                getCodepathColumns: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getCodepathColumns: spineInstanceTreeId is required')

                        const eventLog = await this.CapsuleSpine.getEventLog({ graph, server }, spineInstanceTreeId, 'codepath')
                        const entries = eventLog.entries || []

                        if (entries.length === 0) {
                            return { '#': 'Codepath/Columns', $id: spineInstanceTreeId, columns: [] }
                        }

                        const entryToRef = this._resolveEntryRefs(entries)
                        const { columns } = this._buildColumnData(entries, entryToRef)
                        return { '#': 'Codepath/Columns', $id: spineInstanceTreeId, columns }
                    }
                },

                /**
                 * Get the Codepath rows: one per event entry, with cells placed
                 * in the column of the event's owning capsule.
                 */
                getCodepathRows: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getCodepathRows: spineInstanceTreeId is required')

                        const eventLog = await this.CapsuleSpine.getEventLog({ graph, server }, spineInstanceTreeId, 'codepath')
                        const entries = eventLog.entries || []

                        if (entries.length === 0) {
                            return { '#': 'Codepath/Rows', $id: spineInstanceTreeId, columns: [], rows: [] }
                        }

                        const entryToRef = this._resolveEntryRefs(entries)
                        const { columns, colIndex } = this._buildColumnData(entries, entryToRef)
                        const rows = this._buildRows(entries, entryToRef, colIndex)
                        return { '#': 'Codepath/Rows', $id: spineInstanceTreeId, columns, rows }
                    }
                },

                /**
                 * Get component data for each capsule in the spine instance.
                 *
                 * For each capsule, returns:
                 * - $id: capsule identifier
                 * - label: short display name
                 * - properties: data properties (String, Literal, etc.)
                 * - actions: function properties
                 * - connections: mapping properties (with target capsule ref)
                 */
                getComponents: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getComponents: spineInstanceTreeId is required')

                        const capsuleList = await this.CapsuleSpine.listCapsules({ graph, server }, spineInstanceTreeId)
                        const capsuleNames = capsuleList.list.map((c: any) => c.$id)
                        if (capsuleNames.length === 0) {
                            return { '#': 'Components', $id: spineInstanceTreeId, components: [] }
                        }

                        const relInfo = await graph.fetchCapsuleRelations(spineInstanceTreeId, capsuleNames)

                        const components: any[] = []
                        for (const name of capsuleNames) {
                            const info = relInfo.capsuleInfo?.[name] || {}
                            const props = relInfo.properties?.[name] || []
                            const mappings = relInfo.mappings?.[name] || []

                            const properties: any[] = []
                            const actions: any[] = []
                            const connections: any[] = []

                            const normType = (t: string) => t.replace(/^CapsulePropertyTypes\./, '')

                            for (const p of props) {
                                const propName = p.propName || ''
                                const propType = normType(p.propertyType || '')
                                const pcd = p.propertyContractDelegate || ''

                                if (propName.startsWith('__')) continue
                                if (propName === 'config' || propName === 'apiSchema' || propName === 'init') continue

                                if (propType === 'Function') {
                                    actions.push({ '#': 'Action', name: propName })
                                } else if (propType === 'Mapping') {
                                    // Handled via mappings below
                                } else {
                                    properties.push({
                                        '#': 'Property',
                                        name: propName,
                                        type: propType,
                                        propertyContractDelegate: pcd,
                                    })
                                }
                            }

                            for (const m of mappings) {
                                connections.push({
                                    '#': 'Connection',
                                    propertyName: m.propName || '',
                                    target: m.target,
                                    targetLabel: (m.target || '').split('/').pop() || m.target,
                                    propertyContractDelegate: m.delegate || '',
                                })
                            }

                            const label = name.split('/').pop() || name

                            components.push({
                                '#': 'Component',
                                $id: name,
                                label,
                                capsuleSourceLineRef: info.capsuleSourceLineRef || '',
                                properties,
                                actions,
                                connections,
                            })
                        }

                        return { '#': 'Components', $id: spineInstanceTreeId, components }
                    }
                },

                /**
                 * Get call-path state transitions for the full model run.
                 *
                 * Returns a list of frames, one per event. Each frame contains:
                 * - eventIndex: which event this frame corresponds to
                 * - add: lines/highlights to add at this frame
                 * - remove: lines/highlights to remove at this frame
                 *
                 * Line types:
                 * - 'call': a call edge from one capsule to another
                 * - 'property': a property get/set highlight on a capsule
                 *
                 * Invariant: after processing all frames, no lines remain (all adds
                 * have a matching remove).
                 */
                getCallPathFrames: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('getCallPathFrames: spineInstanceTreeId is required')

                        const codepathRows = await this.getCodepathRows({ graph, server }, spineInstanceTreeId)
                        const rows = codepathRows.rows || []
                        const columns = codepathRows.columns || []

                        // Build capsuleSourceNameRef → capsuleName mapping
                        const capsuleList = await this.CapsuleSpine.listCapsules({ graph, server }, spineInstanceTreeId)
                        const capsuleNames = capsuleList.list.map((c: any) => c.$id)
                        const relInfo = capsuleNames.length > 0
                            ? await graph.fetchCapsuleRelations(spineInstanceTreeId, capsuleNames)
                            : { capsuleInfo: {} }
                        const sourceNameRefToName = new Map<string, string>()
                        for (const [capsuleName, info] of Object.entries(relInfo.capsuleInfo || {}) as [string, any][]) {
                            if ((info as any).capsuleSourceNameRef) {
                                sourceNameRefToName.set((info as any).capsuleSourceNameRef, capsuleName)
                            }
                        }

                        // Column index → capsuleName (component $id) lookup
                        const colIdByIndex = new Map<number, string>()
                        for (const col of columns) {
                            const id = col.$id || ''
                            const lastColonAt = id.lastIndexOf(':@')
                            const sourceNameRef = lastColonAt > 0 ? id.substring(0, lastColonAt) : id
                            colIdByIndex.set(col.index, sourceNameRefToName.get(sourceNameRef) || sourceNameRef)
                        }

                        // Track call stack for determining caller of each call
                        const callStack: { capsuleId: string; actionName: string; callEventIndex: number }[] = []

                        // Build frames: one per row (event)
                        // We collect deferred removals: lineId → frame index where removal should happen
                        const frameMap: Map<number, { eventIndex: number; add: any[]; remove: any[] }> = new Map()
                        const getFrame = (eventIndex: number) => {
                            if (!frameMap.has(eventIndex)) {
                                frameMap.set(eventIndex, { eventIndex, add: [], remove: [] })
                            }
                            return frameMap.get(eventIndex)!
                        }

                        // For property events, we need the "next" event index to schedule removal
                        const rowEventIndices = rows.map((r: any) => r.eventIndex as number)
                        const pendingCleanup: { lineId: string }[] = []

                        for (let ri = 0; ri < rows.length; ri++) {
                            const row = rows[ri]
                            const cell = row.cell
                            const eventIndex = row.eventIndex as number
                            const capsuleId = colIdByIndex.get(cell.columnIndex) || ''
                            const frame = getFrame(eventIndex)

                            if (cell.eventType === 'call') {
                                const caller = callStack.length > 0 ? callStack[callStack.length - 1] : null
                                const lineId = `call:${eventIndex}`
                                frame.add.push({
                                    '#': 'CallLine',
                                    lineId,
                                    fromCapsule: caller?.capsuleId || '',
                                    toCapsule: capsuleId,
                                    fromAction: caller?.actionName || '',
                                    toAction: cell.propertyName || '',
                                    callEventIndex: eventIndex,
                                })
                                callStack.push({
                                    capsuleId,
                                    actionName: cell.propertyName || '',
                                    callEventIndex: eventIndex,
                                })
                            } else if (cell.eventType === 'call-result' && cell.callEventIndex !== undefined) {
                                const lineId = `call:${cell.callEventIndex}`
                                frame.remove.push({ lineId })
                                // Pop matching call from stack
                                const idx = callStack.findIndex(s => s.callEventIndex === cell.callEventIndex)
                                if (idx >= 0) callStack.splice(idx, 1)
                            } else if (cell.eventType === 'get' || cell.eventType === 'set') {
                                const lineId = `prop:${eventIndex}`
                                const membrane = cell.membrane || 'external'

                                // Resolve caller from the cell's resolvedCaller or fall back to call stack top
                                let fromCapsule = ''
                                let fromAction = ''
                                if (cell.resolvedCaller) {
                                    const callerRef = cell.resolvedCaller.capsuleSourceNameRef || ''
                                    fromCapsule = sourceNameRefToName.get(callerRef) || callerRef
                                    fromAction = cell.resolvedCaller.propertyName || ''
                                } else if (callStack.length > 0) {
                                    const caller = callStack[callStack.length - 1]
                                    fromCapsule = caller.capsuleId
                                    fromAction = caller.actionName
                                }

                                const propLine: any = {
                                    '#': 'PropertyLine',
                                    lineId,
                                    capsuleId,
                                    propertyName: cell.propertyName || '',
                                    eventType: cell.eventType,
                                    membrane,
                                    fromCapsule,
                                    fromAction,
                                }
                                if (cell.dataSeen !== undefined) {
                                    propLine.dataSeen = cell.dataSeen
                                }
                                if (cell.isMappingRef) {
                                    propLine.isMappingRef = true
                                    propLine.mappingTargetCapsuleId = cell.mappingTargetColumnIndex !== undefined
                                        ? colIdByIndex.get(cell.mappingTargetColumnIndex) || ''
                                        : ''
                                }
                                frame.add.push(propLine)
                                // Schedule removal at the next event
                                const nextEventIndex = ri + 1 < rowEventIndices.length ? rowEventIndices[ri + 1] : null
                                if (nextEventIndex !== null) {
                                    getFrame(nextEventIndex).remove.push({ lineId })
                                } else {
                                    // Last event: schedule removal in a synthetic cleanup frame
                                    pendingCleanup.push({ lineId })
                                }
                            }
                        }

                        // If any property lines or call lines remain, add a cleanup frame
                        // Call lines remaining means unmatched calls (no call-result)
                        if (pendingCleanup.length > 0 || callStack.length > 0) {
                            const lastEventIndex = rowEventIndices.length > 0
                                ? rowEventIndices[rowEventIndices.length - 1] + 1
                                : 0
                            const cleanup = getFrame(lastEventIndex)
                            for (const entry of pendingCleanup) {
                                cleanup.remove.push(entry)
                            }
                            for (const call of callStack) {
                                cleanup.remove.push({ lineId: `call:${call.callEventIndex}` })
                            }
                        }

                        // Build sorted frames list
                        const frames = [...frameMap.values()].sort((a, b) => a.eventIndex - b.eventIndex)

                        return {
                            '#': 'CallPathFrames',
                            $id: spineInstanceTreeId,
                            frames,
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L6-semantic-models/CapsuleSpine/Codepath/ModelQueryMethods',
    })
}
