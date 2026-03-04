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
                // Internal memoized state — in-memory store
                _conn: {
                    type: CapsulePropertyTypes.Literal,
                    value: null,
                },

                // =============================================================
                // Connection Lifecycle (internal)
                // =============================================================

                _ensureConnection: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        if (this._conn) return this._conn
                        if (this.verbose) console.log('[memory] Creating in-memory store')
                        this._conn = {
                            nodes: { Capsule: {}, CapsuleSource: {}, SpineContract: {}, PropertyContract: {}, CapsuleProperty: {}, CapsuleInstance: {}, MembraneEvent: {} },
                            edges: { HAS_SOURCE: [], IMPLEMENTS_SPINE: [], HAS_PROPERTY_CONTRACT: [], HAS_PROPERTY: [], MAPS_TO: [], EXTENDS: [], DELEGATES_TO: [], INSTANCE_OF: [], PARENT_INSTANCE: [], HAS_MEMBRANE_EVENT: [] },
                        }
                        return this._conn
                    }
                },

                // =============================================================
                // Schema
                // =============================================================

                _ensureSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<void> {
                        if (this._schemaCreated) return
                        this._ensureConnection()
                        this._schemaCreated = true
                        if (this.verbose) console.log('[memory] Schema ready (no-op).')
                    }
                },

                // =============================================================
                // Node/Edge Helpers (used by ImportAPI)
                // =============================================================

                _mergeNode: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, table: string, pk: string, data: Record<string, any>): void {
                        const conn = this._ensureConnection()
                        conn.nodes[table][pk] = { ...conn.nodes[table][pk], ...data }
                    }
                },

                _mergeEdge: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, rel: string, fromTable: string, fromPk: string, toTable: string, toPk: string): void {
                        const conn = this._ensureConnection()
                        const existing = conn.edges[rel].find(
                            (e: any) => e.fromTable === fromTable && e.from === fromPk && e.toTable === toTable && e.to === toPk
                        )
                        if (!existing) {
                            conn.edges[rel].push({ fromTable, from: fromPk, toTable, to: toPk })
                        }
                    }
                },

                // =============================================================
                // Model Query Methods — engine-specific implementations
                // =============================================================

                /**
                 * List capsules, optionally filtered by spineInstanceTreeId.
                 * Returns [{ capsuleName, capsuleSourceLineRef }].
                 */
                _listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any[]> {
                        if (!spineInstanceTreeId) throw new Error('_listCapsules: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        return (Object.values(conn.nodes.Capsule) as any[])
                            .filter((c: any) => c.spineInstanceTreeId === spineInstanceTreeId)
                            .sort((a: any, b: any) => (a.capsuleName || '').localeCompare(b.capsuleName || ''))
                            .map((c: any) => ({ capsuleName: c.capsuleName, capsuleSourceLineRef: c.capsuleSourceLineRef }))
                    }
                },

                /**
                 * Get a capsule and its source by capsuleName.
                 * Returns { cap, source } raw node data, or null.
                 */
                _getCapsuleWithSource: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleName: string): Promise<any | null> {
                        if (!spineInstanceTreeId) throw new Error('_getCapsuleWithSource: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        // Find the dict key (scopedRef) and data for matching capsule
                        let capPk: string | null = null
                        let cap: any = null
                        for (const [pk, c] of Object.entries(conn.nodes.Capsule) as any[]) {
                            if (c.spineInstanceTreeId === spineInstanceTreeId && c.capsuleName === capsuleName) {
                                capPk = pk
                                cap = c
                                break
                            }
                        }
                        if (!cap || !capPk) return null
                        const edge = conn.edges.HAS_SOURCE.find((e: any) => e.from === capPk)
                        if (!edge) return null
                        const src = conn.nodes.CapsuleSource[edge.to]
                        if (!src) return null
                        return { cap, source: src }
                    }
                },

                /**
                 * Get the full spine → propertyContract → property tree for a capsule.
                 * Returns raw rows with { s, pc, p } matching the Ladybug format.
                 */
                _getCapsuleSpineTree_data: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleSourceLineRef: string): Promise<any[]> {
                        if (!spineInstanceTreeId) throw new Error('_getCapsuleSpineTree_data: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        const rows: any[] = []
                        // Find the scoped dict key for this capsule
                        let scopedKey: string | null = null
                        for (const [pk, c] of Object.entries(conn.nodes.Capsule) as any[]) {
                            if (c.spineInstanceTreeId === spineInstanceTreeId && c.capsuleSourceLineRef === capsuleSourceLineRef) {
                                scopedKey = pk
                                break
                            }
                        }
                        if (!scopedKey) return rows
                        // Find spine contracts for this capsule
                        const spineEdges = conn.edges.IMPLEMENTS_SPINE.filter((e: any) => e.from === scopedKey)
                        for (const se of spineEdges) {
                            const spine = conn.nodes.SpineContract[se.to]
                            if (!spine) continue
                            // Find property contracts for this spine
                            const pcEdges = conn.edges.HAS_PROPERTY_CONTRACT.filter((e: any) => e.from === se.to)
                            for (const pce of pcEdges) {
                                const pc = conn.nodes.PropertyContract[pce.to]
                                if (!pc) continue
                                // Find properties for this property contract
                                const propEdges = conn.edges.HAS_PROPERTY.filter((e: any) => e.from === pce.to)
                                if (propEdges.length === 0) {
                                    rows.push({ s: spine, pc, p: null })
                                } else {
                                    for (const pe of propEdges) {
                                        const prop = conn.nodes.CapsuleProperty[pe.to]
                                        rows.push({ s: spine, pc, p: prop || null })
                                    }
                                }
                            }
                        }
                        // Sort by contractUri, contractKey, name
                        rows.sort((a: any, b: any) => {
                            const sc = (a.s.contractUri || '').localeCompare(b.s.contractUri || '')
                            if (sc !== 0) return sc
                            const pcc = (a.pc.contractKey || '').localeCompare(b.pc.contractKey || '')
                            if (pcc !== 0) return pcc
                            return ((a.p?.name || '').localeCompare(b.p?.name || ''))
                        })
                        return rows
                    }
                },

                /**
                 * Get capsule names belonging to a spine instance tree.
                 * Returns string[].
                 */
                _getCapsuleNamesBySpineTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<string[]> {
                        if (!spineInstanceTreeId) throw new Error('_getCapsuleNamesBySpineTree: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        return (Object.values(conn.nodes.Capsule) as any[])
                            .filter((c: any) => c.spineInstanceTreeId === spineInstanceTreeId)
                            .map((c: any) => c.capsuleName)
                            .sort()
                    }
                },

                /**
                 * Batch-fetch relations for a set of capsule names.
                 * Returns { mappings, extends, found, properties, capsuleInfo }.
                 */
                _fetchCapsuleRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleNames: string[]): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('_fetchCapsuleRelations: spineInstanceTreeId is required')
                        if (capsuleNames.length === 0) return { mappings: {}, extends: {}, found: new Set(), properties: {}, capsuleInfo: {} }
                        const conn = this._ensureConnection()
                        const nameSet = new Set(capsuleNames)

                        // Build capsuleName -> capsuleSourceLineRef map (scoped to spineInstanceTreeId)
                        const nameToLineRef: Record<string, string> = {}
                        for (const [pk, cap] of Object.entries(conn.nodes.Capsule) as any[]) {
                            if (cap.spineInstanceTreeId === spineInstanceTreeId && nameSet.has(cap.capsuleName)) nameToLineRef[cap.capsuleName] = pk
                        }

                        // mappings: CapsuleProperty with MAPS_TO -> target Capsule
                        const mappings: Record<string, { propName: string, target: string, delegate: string }[]> = {}
                        for (const capsuleName of capsuleNames) {
                            const lineRef = nameToLineRef[capsuleName]
                            if (!lineRef) continue
                            // Find spine edges
                            const spineEdges = conn.edges.IMPLEMENTS_SPINE.filter((e: any) => e.from === lineRef)
                            for (const se of spineEdges) {
                                const pcEdges = conn.edges.HAS_PROPERTY_CONTRACT.filter((e: any) => e.from === se.to)
                                for (const pce of pcEdges) {
                                    const propEdges = conn.edges.HAS_PROPERTY.filter((e: any) => e.from === pce.to)
                                    for (const pe of propEdges) {
                                        const mapEdges = conn.edges.MAPS_TO.filter((e: any) => e.from === pe.to)
                                        for (const me of mapEdges) {
                                            const targetCap = conn.nodes.Capsule[me.to]
                                            if (targetCap) {
                                                const prop = conn.nodes.CapsuleProperty[pe.to]
                                                if (!mappings[capsuleName]) mappings[capsuleName] = []
                                                mappings[capsuleName].push({ propName: prop.name, target: targetCap.capsuleName, delegate: prop.propertyContractDelegate || '' })
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Sort mappings by propName for consistent ordering
                        for (const key of Object.keys(mappings)) {
                            mappings[key].sort((a, b) => a.propName.localeCompare(b.propName))
                        }

                        // extends: Capsule -> EXTENDS -> parent Capsule
                        const extendsMap: Record<string, string> = {}
                        for (const capsuleName of capsuleNames) {
                            const lineRef = nameToLineRef[capsuleName]
                            if (!lineRef) continue
                            const extEdge = conn.edges.EXTENDS.find((e: any) => e.from === lineRef)
                            if (extEdge) {
                                const parentCap = conn.nodes.Capsule[extEdge.to]
                                if (parentCap) extendsMap[capsuleName] = parentCap.capsuleName
                            }
                        }

                        // properties
                        const properties: Record<string, { propName: string, propertyType: string, propertyContract: string, propertyContractUri: string, propertyContractDelegate: string, valueExpression: string, pcOptions: any }[]> = {}
                        for (const capsuleName of capsuleNames) {
                            const lineRef = nameToLineRef[capsuleName]
                            if (!lineRef) continue
                            const spineEdges = conn.edges.IMPLEMENTS_SPINE.filter((e: any) => e.from === lineRef)
                            for (const se of spineEdges) {
                                const pcEdges = conn.edges.HAS_PROPERTY_CONTRACT.filter((e: any) => e.from === se.to)
                                for (const pce of pcEdges) {
                                    const pc = conn.nodes.PropertyContract[pce.to]
                                    const propEdges = conn.edges.HAS_PROPERTY.filter((e: any) => e.from === pce.to)
                                    for (const pe of propEdges) {
                                        const prop = conn.nodes.CapsuleProperty[pe.to]
                                        if (prop) {
                                            if (!properties[capsuleName]) properties[capsuleName] = []
                                            properties[capsuleName].push({ propName: prop.name, propertyType: prop.propertyType || '', propertyContract: pc?.contractKey || '', propertyContractUri: pc?.propertyContractUri || '', propertyContractDelegate: prop.propertyContractDelegate || '', valueExpression: prop.valueExpression || '', pcOptions: pc?.options || null })
                                        }
                                    }
                                }
                            }
                        }

                        // Sort properties by propName for consistent ordering
                        for (const key of Object.keys(properties)) {
                            properties[key].sort((a, b) => a.propName.localeCompare(b.propName))
                        }

                        // found
                        const found = new Set(capsuleNames.filter(n => nameToLineRef[n]))

                        // capsuleInfo
                        const capsuleInfo: Record<string, { capsuleSourceLineRef: string, capsuleSourceNameRef: string }> = {}
                        for (const capsuleName of capsuleNames) {
                            const lineRef = nameToLineRef[capsuleName]
                            if (!lineRef) continue
                            const cap = conn.nodes.Capsule[lineRef]
                            capsuleInfo[capsuleName] = { capsuleSourceLineRef: cap.capsuleSourceLineRef, capsuleSourceNameRef: cap.capsuleSourceNameRef || '' }
                        }

                        return { mappings, extends: extendsMap, found, properties, capsuleInfo }
                    }
                },

                /**
                 * List distinct spine instance tree IDs with associated capsule info.
                 * Returns [{ spineInstanceTreeId, capsuleName, capsuleSourceLineRef }].
                 */
                _listSpineInstanceTrees: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId?: string): Promise<any[]> {
                        const conn = this._ensureConnection()
                        if (spineInstanceTreeId) {
                            // Filter by specific tree - return all capsules in that tree
                            return (Object.values(conn.nodes.Capsule) as any[])
                                .filter((c: any) => c.spineInstanceTreeId === spineInstanceTreeId)
                                .map((c: any) => ({ spineInstanceTreeId: c.spineInstanceTreeId, capsuleName: c.capsuleName, capsuleSourceLineRef: c.capsuleSourceLineRef, capsuleSourceUriLineRef: c.capsuleSourceUriLineRef }))
                                .sort((a: any, b: any) => (a.capsuleName || '').localeCompare(b.capsuleName || ''))
                        }
                        // No filter - return distinct trees (one entry per tree, preferring root capsule)
                        const byTreeId = new Map<string, any>()
                        for (const c of Object.values(conn.nodes.Capsule) as any[]) {
                            if (!c.spineInstanceTreeId || c.spineInstanceTreeId === '') continue
                            if (c.spineInstanceTreeId === c.capsuleName) {
                                byTreeId.set(c.spineInstanceTreeId, { spineInstanceTreeId: c.spineInstanceTreeId, capsuleName: c.capsuleName, capsuleSourceLineRef: c.capsuleSourceLineRef, capsuleSourceUriLineRef: c.capsuleSourceUriLineRef })
                            } else if (!byTreeId.has(c.spineInstanceTreeId)) {
                                byTreeId.set(c.spineInstanceTreeId, { spineInstanceTreeId: c.spineInstanceTreeId, capsuleName: c.capsuleName, capsuleSourceLineRef: c.capsuleSourceLineRef, capsuleSourceUriLineRef: c.capsuleSourceUriLineRef })
                            }
                        }
                        return [...byTreeId.values()].sort((a: any, b: any) => a.spineInstanceTreeId.localeCompare(b.spineInstanceTreeId))
                    }
                },

                // =============================================================
                // Instance Query Methods
                // =============================================================

                /**
                 * Get all instances for a spine instance tree.
                 * Returns [{ instanceId, capsuleName, capsuleSourceUriLineRef }].
                 */
                _getInstancesBySpineTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any[]> {
                        if (!spineInstanceTreeId) throw new Error('_getInstancesBySpineTree: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        return (Object.values(conn.nodes.CapsuleInstance) as any[])
                            .filter((i: any) => i.spineInstanceTreeId === spineInstanceTreeId)
                            .map((i: any) => ({ instanceId: i.instanceId, capsuleName: i.capsuleName, capsuleSourceUriLineRef: i.capsuleSourceUriLineRef }))
                            .sort((a: any, b: any) => (a.capsuleName || '').localeCompare(b.capsuleName || ''))
                    }
                },

                /**
                 * Get the root instance for a spine instance tree (the one with no parent).
                 * Returns { instanceId, capsuleName, capsuleSourceUriLineRef } or null.
                 */
                _getRootInstance: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any | null> {
                        if (!spineInstanceTreeId) throw new Error('_getRootInstance: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        const instances = (Object.values(conn.nodes.CapsuleInstance) as any[])
                            .filter((i: any) => i.spineInstanceTreeId === spineInstanceTreeId)
                        for (const inst of instances) {
                            const hasParent = conn.edges.PARENT_INSTANCE.some((e: any) => e.from === inst.instanceId)
                            if (!hasParent) {
                                return { instanceId: inst.instanceId, capsuleName: inst.capsuleName, capsuleSourceUriLineRef: inst.capsuleSourceUriLineRef }
                            }
                        }
                        return null
                    }
                },

                /**
                 * Get child instances of a given instance.
                 * Returns [{ instanceId, capsuleName, capsuleSourceUriLineRef }].
                 */
                _getChildInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, parentInstanceId: string): Promise<any[]> {
                        const conn = this._ensureConnection()
                        const childIds = conn.edges.PARENT_INSTANCE
                            .filter((e: any) => e.to === parentInstanceId)
                            .map((e: any) => e.from)
                        return childIds.map((id: string) => {
                            const inst = conn.nodes.CapsuleInstance[id]
                            return inst ? { instanceId: inst.instanceId, capsuleName: inst.capsuleName, capsuleSourceUriLineRef: inst.capsuleSourceUriLineRef } : null
                        }).filter(Boolean).sort((a: any, b: any) => (a.capsuleName || '').localeCompare(b.capsuleName || ''))
                    }
                },

                /**
                 * Fetch instance relations for building the instance tree.
                 * Returns { instances, parentMap, capsuleInfo }.
                 */
                _fetchInstanceRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('_fetchInstanceRelations: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        const instances: Record<string, { instanceId: string, capsuleName: string, capsuleSourceUriLineRef: string }> = {}
                        for (const inst of Object.values(conn.nodes.CapsuleInstance) as any[]) {
                            if (inst.spineInstanceTreeId === spineInstanceTreeId) {
                                instances[inst.instanceId] = { instanceId: inst.instanceId, capsuleName: inst.capsuleName, capsuleSourceUriLineRef: inst.capsuleSourceUriLineRef }
                            }
                        }

                        const parentMap: Record<string, string> = {}
                        for (const edge of conn.edges.PARENT_INSTANCE) {
                            if (instances[edge.from]) {
                                parentMap[edge.from] = edge.to
                            }
                        }

                        const capsuleInfo: Record<string, { capsuleName: string, capsuleSourceLineRef: string, capsuleSourceUriLineRef: string }> = {}
                        for (const edge of conn.edges.INSTANCE_OF) {
                            if (instances[edge.from]) {
                                const cap = conn.nodes.Capsule[edge.to]
                                if (cap) {
                                    capsuleInfo[edge.from] = { capsuleName: cap.capsuleName, capsuleSourceLineRef: cap.capsuleSourceLineRef, capsuleSourceUriLineRef: cap.capsuleSourceUriLineRef || '' }
                                }
                            }
                        }

                        return { instances, parentMap, capsuleInfo }
                    }
                },

                // =============================================================
                // Membrane Event Query Methods
                // =============================================================

                /**
                 * Get all membrane events for a spine instance tree, ordered by eventIndex.
                 * Returns [{ eventIndex, eventType, capsuleSourceLineRef, ... }].
                 */
                _getMembraneEvents: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any[]> {
                        if (!spineInstanceTreeId) throw new Error('_getMembraneEvents: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        return (Object.values(conn.nodes.MembraneEvent) as any[])
                            .filter((e: any) => e.spineInstanceTreeId === spineInstanceTreeId)
                            .sort((a: any, b: any) => a.eventIndex - b.eventIndex)
                    }
                },

                /**
                 * Get membrane events for a specific capsule within a spine instance tree.
                 * Returns events where capsuleSourceLineRef matches, ordered by eventIndex.
                 */
                _getMembraneEventsByCapsule: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleSourceLineRef: string): Promise<any[]> {
                        if (!spineInstanceTreeId) throw new Error('_getMembraneEventsByCapsule: spineInstanceTreeId is required')
                        const conn = this._ensureConnection()
                        return (Object.values(conn.nodes.MembraneEvent) as any[])
                            .filter((e: any) => e.spineInstanceTreeId === spineInstanceTreeId && e.capsuleSourceLineRef === capsuleSourceLineRef)
                            .sort((a: any, b: any) => a.eventIndex - b.eventIndex)
                    }
                },

            }
        }
    }, {
        extendsCapsule: '../Engine',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Memory-v0/QueryAPI',
    })
}
