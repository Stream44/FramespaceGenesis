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
                        namespace: '@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Quadrant~ModelQueryMethods',
                        description: 'Semantic methods to query *Quadrant* dimension trees (columns, rows) for a given *Spine Instance Tree*',
                        basePath: '/api/@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Quadrant~ModelQueryMethods',
                        methods: {
                            getColumnTree: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the column tree for a spine instance. Columns are detected via struct dependency on schema/Column. Parent-child hierarchy is derived from struct deps between columns. Each column node includes a capsules[] array of element capsules tagged with that column.',
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
                                description: 'Get the row tree for a spine instance. Rows are detected via struct dependency on schema/Row. Parent-child hierarchy is derived from struct deps between rows. Each row node includes a capsules[] array of element capsules tagged with that row.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    }
                                },
                            },
                        },
                    },
                },

                // =============================================================
                // Internal helpers
                // =============================================================

                /**
                 * Internal: build a dimension tree (column or row).
                 *
                 * Uses L6 CapsuleSpine.listCapsules to discover capsules in
                 * the spine tree, then fetches relation data from the L4
                 * graph engine to identify dimension capsules and derive
                 * parent-child + element tagging from delegate mappings.
                 */
                _getDimensionTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string, schemaUri: string, nodeType: string, dimKey: string, dimLabel: string, childKey: string): Promise<any[]> {
                        // Get capsule names via L6 CapsuleSpine
                        const capsuleList = await this.CapsuleSpine.listCapsules({ graph, server }, spineInstanceTreeId)
                        const capsuleNames = capsuleList.list.map((c: any) => c.$id)
                        if (capsuleNames.length === 0) return []

                        // Fetch relation data (mappings, extends, properties) from graph
                        const mergeRelInfo = (base: any, next: any) => ({
                            mappings: { ...base.mappings, ...next.mappings },
                            extends: { ...base.extends, ...next.extends },
                            found: new Set([...base.found, ...next.found]),
                            properties: { ...base.properties, ...next.properties },
                            capsuleInfo: { ...base.capsuleInfo, ...next.capsuleInfo },
                        })
                        let relInfo = await graph.fetchCapsuleRelations(spineInstanceTreeId, capsuleNames)
                        for (let depth = 0; depth < 4; depth++) {
                            const targets = new Set<string>()
                            for (const name of relInfo.found) {
                                for (const m of (relInfo.mappings[name] || [])) targets.add(m.target)
                            }
                            const unfetched = [...targets].filter((t: string) => !relInfo.found.has(t))
                            if (unfetched.length === 0) break
                            relInfo = mergeRelInfo(relInfo, await graph.fetchCapsuleRelations(spineInstanceTreeId, unfetched))
                        }

                        // 1. Identify dimension capsules — those with a property matching schemaUri
                        const dimCapsules = new Map<string, { label: string, listPosition: number, capsuleInfo: any }>()
                        for (const name of relInfo.found) {
                            for (const p of (relInfo.properties[name] || [])) {
                                if (p.propertyContractUri === schemaUri && p.pcOptions) {
                                    const opts = p.pcOptions['#'] || {}
                                    dimCapsules.set(name, {
                                        label: opts.label || '',
                                        listPosition: typeof opts.listPosition === 'number' ? opts.listPosition : 999999,
                                        capsuleInfo: relInfo.capsuleInfo[name] || {},
                                    })
                                    break
                                }
                            }
                        }
                        if (dimCapsules.size === 0) return []

                        // 2. Derive parent-child and element tagging from delegate mappings
                        const parentOf = new Map<string, string>()
                        const elements = new Map<string, any[]>()
                        for (const name of relInfo.found) {
                            const isDim = dimCapsules.has(name)
                            for (const m of (relInfo.mappings[name] || [])) {
                                if (!m.delegate || !dimCapsules.has(m.target)) continue
                                if (isDim) {
                                    parentOf.set(name, m.target)
                                } else {
                                    if (!elements.has(m.target)) elements.set(m.target, [])
                                    const info = relInfo.capsuleInfo[name] || {}
                                    elements.get(m.target)!.push({
                                        '#': 'Capsule',
                                        $id: name,
                                        capsuleSourceLineRef: info.capsuleSourceLineRef || '',
                                    })
                                }
                            }
                        }

                        // 3. Build tree (sorted by listPosition at each level)
                        const buildNode = (dimName: string): any => {
                            const dim = dimCapsules.get(dimName)!
                            const children: any[] = []
                            for (const [cn] of dimCapsules) {
                                if (parentOf.get(cn) === dimName) children.push(buildNode(cn))
                            }
                            children.sort((a: any, b: any) => (a._listPosition ?? 999999) - (b._listPosition ?? 999999))
                            const node: any = {
                                '#': nodeType,
                                capsule: {
                                    '#': 'Capsule',
                                    $id: dimName,
                                    capsuleSourceLineRef: dim.capsuleInfo.capsuleSourceLineRef || '',
                                },
                                [dimKey]: { '#': dimLabel, label: dim.label },
                                capsules: elements.get(dimName) || [],
                                [childKey]: children,
                                _listPosition: dim.listPosition,
                            }
                            return node
                        }

                        const roots: any[] = []
                        for (const [dimName] of dimCapsules) {
                            if (!parentOf.has(dimName)) roots.push(buildNode(dimName))
                        }
                        roots.sort((a: any, b: any) => (a._listPosition ?? 999999) - (b._listPosition ?? 999999))
                        // Strip internal _listPosition from final output
                        const stripListPosition = (node: any) => {
                            delete node._listPosition
                            for (const child of node[childKey] || []) stripListPosition(child)
                        }
                        for (const r of roots) stripListPosition(r)
                        return roots
                    }
                },

                // =============================================================
                // Query API — each method receives `graph` (L4 engine),
                // but delegates to L6 CapsuleSpine for all graph queries.
                // =============================================================

                /**
                 * Get the column tree for a spine instance.
                 */
                getColumnTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any | null> {
                        if (!spineInstanceTreeId) throw new Error('getColumnTree: spineInstanceTreeId is required')
                        const columns = await this._getDimensionTree(
                            { graph, server }, spineInstanceTreeId,
                            '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/schema/Column',
                            'QuadrantTreeColumn', 'column', 'Column', 'columns',
                        )
                        return { '#': 'Quadrant/ColumnTree', columns }
                    }
                },

                /**
                 * Get the row tree for a spine instance.
                 */
                getRowTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any | null> {
                        if (!spineInstanceTreeId) throw new Error('getRowTree: spineInstanceTreeId is required')
                        const rows = await this._getDimensionTree(
                            { graph, server }, spineInstanceTreeId,
                            '@stream44.studio/FramespaceGenesis/L8-view-models/CapsuleSpine/Quadrant/schema/Row',
                            'QuadrantTreeRow', 'row', 'Row', 'rows',
                        )
                        return { '#': 'Quadrant/RowTree', rows }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L6-semantic-models/CapsuleSpine/Quadrant/ModelQueryMethods',
    })
}
