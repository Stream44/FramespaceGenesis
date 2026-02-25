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
                verbose: {
                    type: CapsulePropertyTypes.Literal,
                    value: false,
                },

                // Internal memoized state — in-memory store
                _conn: {
                    type: CapsulePropertyTypes.Literal,
                    value: null,
                },
                _schemaCreated: {
                    type: CapsulePropertyTypes.Literal,
                    value: false,
                },

                // =============================================================
                // Connection Lifecycle (internal)
                // =============================================================

                _ensureConnection: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {

                        // console.error('FILEPATH', this['#@stream44.studio/encapsulate/structs/Capsule'].moduleFilepath)

                        if (this._conn) return this._conn
                        if (this.verbose) console.log('[json] Creating in-memory store')
                        this._conn = {
                            nodes: { Capsule: {}, CapsuleSource: {}, SpineContract: {}, PropertyContract: {}, CapsuleProperty: {} },
                            edges: { HAS_SOURCE: [], IMPLEMENTS_SPINE: [], HAS_PROPERTY_CONTRACT: [], HAS_PROPERTY: [], MAPS_TO: [], EXTENDS: [], DELEGATES_TO: [] },
                        }
                        return this._conn
                    }
                },

                // =============================================================
                // Schema
                // =============================================================

                ensureSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<void> {
                        if (this._schemaCreated) return
                        this._ensureConnection()
                        this._schemaCreated = true
                        if (this.verbose) console.log('[json] Schema ready (no-op).')
                    }
                },

                // =============================================================
                // Node/Edge Helpers (used by ImportCapsuleSourceTrees)
                // =============================================================

                mergeNode: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, table: string, pk: string, data: Record<string, any>): void {
                        const conn = this._ensureConnection()
                        conn.nodes[table][pk] = { ...conn.nodes[table][pk], ...data }
                    }
                },

                mergeEdge: {
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
                 * List capsules, optionally filtered by spineInstanceUri.
                 * Returns [{ capsuleName, capsuleSourceLineRef }].
                 */
                listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceUri?: string): Promise<any[]> {
                        const conn = this._ensureConnection()
                        const capsules = Object.values(conn.nodes.Capsule) as any[]
                        const filtered = spineInstanceUri
                            ? capsules.filter((c: any) => c.spineInstanceUri === spineInstanceUri)
                            : capsules.filter((c: any) => conn.edges.HAS_SOURCE.some((e: any) => e.from === c.capsuleSourceLineRef))
                        return filtered
                            .sort((a: any, b: any) => (a.capsuleName || '').localeCompare(b.capsuleName || ''))
                            .map((c: any) => ({ capsuleName: c.capsuleName, capsuleSourceLineRef: c.capsuleSourceLineRef }))
                    }
                },

                /**
                 * Get a capsule and its source by capsuleName.
                 * Returns { cap, source } raw node data, or null.
                 */
                getCapsuleWithSource: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleName: string): Promise<any | null> {
                        const conn = this._ensureConnection()
                        const cap = (Object.values(conn.nodes.Capsule) as any[]).find((c: any) => c.capsuleName === capsuleName)
                        if (!cap) return null
                        const edge = conn.edges.HAS_SOURCE.find((e: any) => e.from === cap.capsuleSourceLineRef)
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
                getCapsuleSpineTree_data: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleSourceLineRef: string): Promise<any[]> {
                        const conn = this._ensureConnection()
                        const rows: any[] = []
                        // Find spine contracts for this capsule
                        const spineEdges = conn.edges.IMPLEMENTS_SPINE.filter((e: any) => e.from === capsuleSourceLineRef)
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
                 * Get capsule names belonging to a spine instance.
                 * Returns string[].
                 */
                getCapsuleNamesBySpine: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceUri: string): Promise<string[]> {
                        const conn = this._ensureConnection()
                        return (Object.values(conn.nodes.Capsule) as any[])
                            .filter((c: any) => c.spineInstanceUri === spineInstanceUri)
                            .map((c: any) => c.capsuleName)
                            .sort()
                    }
                },

                /**
                 * Batch-fetch relations for a set of capsule names.
                 * Returns { mappings, extends, found, properties, capsuleInfo }.
                 */
                fetchCapsuleRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleNames: string[]): Promise<any> {
                        if (capsuleNames.length === 0) return { mappings: {}, extends: {}, found: new Set(), properties: {}, capsuleInfo: {} }
                        const conn = this._ensureConnection()
                        const nameSet = new Set(capsuleNames)

                        // Build capsuleName -> capsuleSourceLineRef map
                        const nameToLineRef: Record<string, string> = {}
                        for (const [pk, cap] of Object.entries(conn.nodes.Capsule) as any[]) {
                            if (nameSet.has(cap.capsuleName)) nameToLineRef[cap.capsuleName] = pk
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
                        const properties: Record<string, { propName: string, propertyType: string, propertyContract: string, propertyContractDelegate: string }[]> = {}
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
                                            properties[capsuleName].push({ propName: prop.name, propertyType: prop.propertyType || '', propertyContract: pc?.contractKey || '', propertyContractDelegate: prop.propertyContractDelegate || '' })
                                        }
                                    }
                                }
                            }
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
                 * List distinct spine instance URIs with associated capsule info.
                 * Returns [{ spineInstanceUri, capsuleName, capsuleSourceLineRef }].
                 */
                listSpineInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<any[]> {
                        const conn = this._ensureConnection()
                        return (Object.values(conn.nodes.Capsule) as any[])
                            .filter((c: any) => c.spineInstanceUri && c.spineInstanceUri !== '')
                            .map((c: any) => ({ spineInstanceUri: c.spineInstanceUri, capsuleName: c.capsuleName, capsuleSourceLineRef: c.capsuleSourceLineRef }))
                            .sort((a: any, b: any) => a.spineInstanceUri.localeCompare(b.spineInstanceUri))
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/engines/Capsule-JsonFiles-v0/EngineAPI',
    })
}
