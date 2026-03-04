import { dirname, join } from 'path'
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'fs'

// ---------------------------------------------------------------------------
// Disk I/O helpers — every read goes to disk, every write flushes immediately.
// Node tables: <dataDir>/nodes/<Table>.json  →  { [pk]: record }
// Edge tables: <dataDir>/edges/<Edge>.json   →  [ { fromTable, from, toTable, to } ]
// ---------------------------------------------------------------------------

const NODE_TABLES = ['Capsule', 'CapsuleSource', 'SpineContract', 'PropertyContract', 'CapsuleProperty', 'CapsuleInstance', 'MembraneEvent'] as const
const EDGE_TABLES = ['HAS_SOURCE', 'IMPLEMENTS_SPINE', 'HAS_PROPERTY_CONTRACT', 'HAS_PROPERTY', 'MAPS_TO', 'EXTENDS', 'DELEGATES_TO', 'INSTANCE_OF', 'PARENT_INSTANCE', 'HAS_MEMBRANE_EVENT'] as const

function _readJson(filePath: string, fallback: any): any {
    if (!existsSync(filePath)) return fallback
    return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function _writeJson(filePath: string, data: any): void {
    writeFileSync(filePath, JSON.stringify(data, null, 2))
}

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
                // Data directory path (resolved once, not cached data)
                _dataDir: {
                    type: CapsulePropertyTypes.Literal,
                    value: null,
                },

                // =============================================================
                // Connection Lifecycle (internal)
                // =============================================================

                _ensureConnection: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        if (this._dataDir) return this._dataDir

                        const moduleFilepath = this['#@stream44.studio/encapsulate/structs/Capsule'].rootCapsule.moduleFilepath
                        const baseDir = dirname(moduleFilepath)
                        const dataDir = join(baseDir, '.~o/framespace.dev/data/engines/JsonFiles-v0')
                        if (!existsSync(dataDir)) {
                            mkdirSync(dataDir, { recursive: true })
                        }
                        const nodesDir = join(dataDir, 'nodes')
                        const edgesDir = join(dataDir, 'edges')
                        if (!existsSync(nodesDir)) mkdirSync(nodesDir, { recursive: true })
                        if (!existsSync(edgesDir)) mkdirSync(edgesDir, { recursive: true })

                        if (this.verbose) console.log(`[json] Data directory: ${dataDir}`)
                        this._dataDir = dataDir
                        return dataDir
                    }
                },

                // =============================================================
                // Disk I/O primitives — read fresh every time, write immediately
                // =============================================================

                _readNodeTable: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, table: string): Record<string, any> {
                        const dataDir = this._ensureConnection()
                        return _readJson(join(dataDir, 'nodes', `${table}.json`), {})
                    }
                },

                _writeNodeTable: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, table: string, data: Record<string, any>): void {
                        const dataDir = this._ensureConnection()
                        _writeJson(join(dataDir, 'nodes', `${table}.json`), data)
                    }
                },

                _readEdgeTable: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, rel: string): any[] {
                        const dataDir = this._ensureConnection()
                        return _readJson(join(dataDir, 'edges', `${rel}.json`), [])
                    }
                },

                _writeEdgeTable: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, rel: string, data: any[]): void {
                        const dataDir = this._ensureConnection()
                        _writeJson(join(dataDir, 'edges', `${rel}.json`), data)
                    }
                },

                // =============================================================
                // Schema
                // =============================================================

                _ensureSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<void> {
                        if (this._schemaCreated) return
                        const dataDir = this._ensureConnection()
                        // Clear stale data from previous runs
                        const nodesDir = join(dataDir, 'nodes')
                        const edgesDir = join(dataDir, 'edges')
                        if (existsSync(nodesDir)) rmSync(nodesDir, { recursive: true })
                        if (existsSync(edgesDir)) rmSync(edgesDir, { recursive: true })
                        mkdirSync(nodesDir, { recursive: true })
                        mkdirSync(edgesDir, { recursive: true })
                        this._schemaCreated = true
                        if (this.verbose) console.log('[json] Schema ready (directories cleared).')
                    }
                },

                // =============================================================
                // Node/Edge Helpers (used by ImportAPI)
                // =============================================================

                _mergeNode: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, table: string, pk: string, data: Record<string, any>): void {
                        const nodes = this._readNodeTable(table)
                        nodes[pk] = { ...nodes[pk], ...data }
                        this._writeNodeTable(table, nodes)
                    }
                },

                _mergeEdge: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, rel: string, fromTable: string, fromPk: string, toTable: string, toPk: string): void {
                        const edges = this._readEdgeTable(rel)
                        const existing = edges.find(
                            (e: any) => e.fromTable === fromTable && e.from === fromPk && e.toTable === toTable && e.to === toPk
                        )
                        if (!existing) {
                            edges.push({ fromTable, from: fromPk, toTable, to: toPk })
                            this._writeEdgeTable(rel, edges)
                        }
                    }
                },

                // =============================================================
                // Model Query Methods — every query reads fresh from disk
                // =============================================================

                /**
                 * List capsules, optionally filtered by spineInstanceTreeId.
                 * Returns [{ capsuleName, capsuleSourceLineRef }].
                 */
                _listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId?: string): Promise<any[]> {
                        const capsuleNodes = this._readNodeTable('Capsule')
                        const hasSourceEdges = this._readEdgeTable('HAS_SOURCE')
                        const entries = Object.entries(capsuleNodes) as [string, any][]
                        const filtered = spineInstanceTreeId
                            ? entries.filter(([, c]) => c.spineInstanceTreeId === spineInstanceTreeId)
                            : entries.filter(([pk]) => hasSourceEdges.some((e: any) => e.from === pk))
                        return filtered
                            .sort(([, a], [, b]) => (a.capsuleName || '').localeCompare(b.capsuleName || ''))
                            .map(([, c]) => ({ capsuleName: c.capsuleName, capsuleSourceLineRef: c.capsuleSourceLineRef }))
                    }
                },

                /**
                 * Get a capsule and its source by capsuleName.
                 * Returns { cap, source } raw node data, or null.
                 */
                _getCapsuleWithSource: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleName: string): Promise<any | null> {
                        const capsuleNodes = this._readNodeTable('Capsule')
                        const sourceNodes = this._readNodeTable('CapsuleSource')
                        const hasSourceEdges = this._readEdgeTable('HAS_SOURCE')
                        // Find dict key (scopedRef) and data for matching capsule
                        let capPk: string | null = null
                        let cap: any = null
                        for (const [pk, c] of Object.entries(capsuleNodes) as any[]) {
                            if (c.spineInstanceTreeId === spineInstanceTreeId && c.capsuleName === capsuleName) {
                                capPk = pk
                                cap = c
                                break
                            }
                        }
                        if (!cap || !capPk) return null
                        const edge = hasSourceEdges.find((e: any) => e.from === capPk)
                        if (!edge) return null
                        const src = sourceNodes[edge.to]
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
                        const capsuleNodes = this._readNodeTable('Capsule')
                        const spineNodes = this._readNodeTable('SpineContract')
                        const pcNodes = this._readNodeTable('PropertyContract')
                        const propNodes = this._readNodeTable('CapsuleProperty')
                        const implEdges = this._readEdgeTable('IMPLEMENTS_SPINE')
                        const hpcEdges = this._readEdgeTable('HAS_PROPERTY_CONTRACT')
                        const hpEdges = this._readEdgeTable('HAS_PROPERTY')
                        const rows: any[] = []
                        // Find the scoped dict key for this capsule
                        let scopedKey: string | null = null
                        for (const [pk, c] of Object.entries(capsuleNodes) as any[]) {
                            if (c.spineInstanceTreeId === spineInstanceTreeId && c.capsuleSourceLineRef === capsuleSourceLineRef) {
                                scopedKey = pk
                                break
                            }
                        }
                        if (!scopedKey) return rows
                        const spineEdges = implEdges.filter((e: any) => e.from === scopedKey)
                        for (const se of spineEdges) {
                            const spine = spineNodes[se.to]
                            if (!spine) continue
                            const pcEdges = hpcEdges.filter((e: any) => e.from === se.to)
                            for (const pce of pcEdges) {
                                const pc = pcNodes[pce.to]
                                if (!pc) continue
                                const propEdges = hpEdges.filter((e: any) => e.from === pce.to)
                                if (propEdges.length === 0) {
                                    rows.push({ s: spine, pc, p: null })
                                } else {
                                    for (const pe of propEdges) {
                                        const prop = propNodes[pe.to]
                                        rows.push({ s: spine, pc, p: prop || null })
                                    }
                                }
                            }
                        }
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
                        const capsuleNodes = this._readNodeTable('Capsule')
                        return (Object.values(capsuleNodes) as any[])
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

                        const capsuleNodes = this._readNodeTable('Capsule')
                        const pcNodes = this._readNodeTable('PropertyContract')
                        const propNodes = this._readNodeTable('CapsuleProperty')
                        const implEdges = this._readEdgeTable('IMPLEMENTS_SPINE')
                        const hpcEdges = this._readEdgeTable('HAS_PROPERTY_CONTRACT')
                        const hpEdges = this._readEdgeTable('HAS_PROPERTY')
                        const mapEdges = this._readEdgeTable('MAPS_TO')
                        const extEdges = this._readEdgeTable('EXTENDS')

                        const nameSet = new Set(capsuleNames)

                        // Build capsuleName -> capsuleSourceLineRef map (scoped to spineInstanceTreeId)
                        const nameToLineRef: Record<string, string> = {}
                        for (const [pk, cap] of Object.entries(capsuleNodes) as any[]) {
                            if (cap.spineInstanceTreeId === spineInstanceTreeId && nameSet.has(cap.capsuleName)) nameToLineRef[cap.capsuleName] = pk
                        }

                        // mappings: CapsuleProperty with MAPS_TO -> target Capsule
                        const mappings: Record<string, { propName: string, target: string, delegate: string }[]> = {}
                        for (const capsuleName of capsuleNames) {
                            const lineRef = nameToLineRef[capsuleName]
                            if (!lineRef) continue
                            const spineEdges = implEdges.filter((e: any) => e.from === lineRef)
                            for (const se of spineEdges) {
                                const pcEdgeList = hpcEdges.filter((e: any) => e.from === se.to)
                                for (const pce of pcEdgeList) {
                                    const propEdgeList = hpEdges.filter((e: any) => e.from === pce.to)
                                    for (const pe of propEdgeList) {
                                        const mapEdgeList = mapEdges.filter((e: any) => e.from === pe.to)
                                        for (const me of mapEdgeList) {
                                            const targetCap = capsuleNodes[me.to]
                                            if (targetCap) {
                                                const prop = propNodes[pe.to]
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
                            const extEdge = extEdges.find((e: any) => e.from === lineRef)
                            if (extEdge) {
                                const parentCap = capsuleNodes[extEdge.to]
                                if (parentCap) extendsMap[capsuleName] = parentCap.capsuleName
                            }
                        }

                        // properties
                        const properties: Record<string, { propName: string, propertyType: string, propertyContract: string, propertyContractUri: string, propertyContractDelegate: string, valueExpression: string, pcOptions: any }[]> = {}
                        for (const capsuleName of capsuleNames) {
                            const lineRef = nameToLineRef[capsuleName]
                            if (!lineRef) continue
                            const spineEdges = implEdges.filter((e: any) => e.from === lineRef)
                            for (const se of spineEdges) {
                                const pcEdgeList = hpcEdges.filter((e: any) => e.from === se.to)
                                for (const pce of pcEdgeList) {
                                    const pc = pcNodes[pce.to]
                                    const propEdgeList = hpEdges.filter((e: any) => e.from === pce.to)
                                    for (const pe of propEdgeList) {
                                        const prop = propNodes[pe.to]
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
                            const cap = capsuleNodes[lineRef]
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
                        const capsuleNodes = this._readNodeTable('Capsule')
                        if (spineInstanceTreeId) {
                            // Filter by specific tree - return all capsules in that tree
                            return (Object.values(capsuleNodes) as any[])
                                .filter((c: any) => c.spineInstanceTreeId === spineInstanceTreeId)
                                .map((c: any) => ({ spineInstanceTreeId: c.spineInstanceTreeId, capsuleName: c.capsuleName, capsuleSourceLineRef: c.capsuleSourceLineRef, capsuleSourceUriLineRef: c.capsuleSourceUriLineRef }))
                                .sort((a: any, b: any) => (a.capsuleName || '').localeCompare(b.capsuleName || ''))
                        }
                        // No filter - return distinct trees (one entry per tree, preferring root capsule)
                        const byTreeId = new Map<string, any>()
                        for (const c of Object.values(capsuleNodes) as any[]) {
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
                        const instanceNodes = this._readNodeTable('CapsuleInstance')
                        return (Object.values(instanceNodes) as any[])
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
                        const instanceNodes = this._readNodeTable('CapsuleInstance')
                        const parentEdges = this._readEdgeTable('PARENT_INSTANCE')
                        const instances = (Object.values(instanceNodes) as any[])
                            .filter((i: any) => i.spineInstanceTreeId === spineInstanceTreeId)
                        for (const inst of instances) {
                            const hasParent = parentEdges.some((e: any) => e.from === inst.instanceId)
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
                        const instanceNodes = this._readNodeTable('CapsuleInstance')
                        const parentEdges = this._readEdgeTable('PARENT_INSTANCE')
                        const childIds = parentEdges
                            .filter((e: any) => e.to === parentInstanceId)
                            .map((e: any) => e.from)
                        return childIds.map((id: string) => {
                            const inst = instanceNodes[id]
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
                        const instanceNodes = this._readNodeTable('CapsuleInstance')
                        const capsuleNodes = this._readNodeTable('Capsule')
                        const parentEdges = this._readEdgeTable('PARENT_INSTANCE')
                        const instanceOfEdges = this._readEdgeTable('INSTANCE_OF')

                        const instances: Record<string, { instanceId: string, capsuleName: string, capsuleSourceUriLineRef: string }> = {}
                        for (const [, inst] of Object.entries(instanceNodes) as [string, any][]) {
                            if (inst.spineInstanceTreeId === spineInstanceTreeId) {
                                instances[inst.instanceId] = { instanceId: inst.instanceId, capsuleName: inst.capsuleName, capsuleSourceUriLineRef: inst.capsuleSourceUriLineRef }
                            }
                        }

                        const parentMap: Record<string, string> = {}
                        for (const edge of parentEdges) {
                            if (instances[edge.from]) {
                                parentMap[edge.from] = edge.to
                            }
                        }

                        const capsuleInfo: Record<string, { capsuleName: string, capsuleSourceLineRef: string, capsuleSourceUriLineRef: string }> = {}
                        for (const edge of instanceOfEdges) {
                            if (instances[edge.from]) {
                                const cap = capsuleNodes[edge.to]
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
                        const eventNodes = this._readNodeTable('MembraneEvent')
                        return (Object.values(eventNodes) as any[])
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
                        const eventNodes = this._readNodeTable('MembraneEvent')
                        return (Object.values(eventNodes) as any[])
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
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/JsonFiles-v0/QueryAPI',
    })
}
