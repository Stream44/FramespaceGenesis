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
                        namespace: 'Encapsulate/CapsuleSpine',
                        description: 'Methods to query the *Capsule Spine Model* of the selected *Spine Tree Instance*',
                        basePath: '/api/Encapsulate/CapsuleSpine',
                        methods: {
                            listCapsules: {
                                args: [
                                    { name: 'spineInstanceUri', type: 'string', optional: true },
                                    { name: 'resolveRefs', type: 'boolean', optional: true },
                                ],
                                description: 'List all capsules in the tree.',
                                discovery: 'Framespace/Workbench/listSpineInstances',
                                filterField: '$id',
                            },
                            getCapsule: {
                                args: [
                                    { name: 'capsuleName', type: 'string' },
                                ],
                                description: 'Get a capsule with full CST structure including spine contracts, property contracts, and properties.',
                                discovery: 'listCapsules',
                                filterField: '$id',
                            },
                            getCapsuleSpineTree: {
                                args: [
                                    { name: 'spineInstanceUri', type: 'string' },
                                    { name: 'includeProperties', type: 'boolean', optional: true },
                                ],
                                description: 'Get the spine tree for a spineInstanceUri.',
                                discovery: 'Framespace/Workbench/listSpineInstances',
                                filterField: '$id',
                            },
                        },
                    },
                },

                // =============================================================
                // Query API
                // =============================================================

                /**
                 * List all imported capsules.
                 * Returns { '#': 'Capsules', list: [{ $id, '#' }] }.
                 * If spineInstanceUri is provided, filters to capsules belonging to that spine instance.
                 */
                listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any, spineInstanceUri?: string, resolveRefs?: boolean): Promise<any> {
                        const query = spineInstanceUri
                            ? `MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource) WHERE cap.spineInstanceUri = '${esc(spineInstanceUri)}' RETURN cap.capsuleName, cap.capsuleSourceLineRef ORDER BY cap.capsuleName`
                            : `MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource) RETURN cap.capsuleName, cap.capsuleSourceLineRef ORDER BY cap.capsuleName`
                        const rows = await this.queryAll(conn, query)

                        if (resolveRefs) {
                            const list = []
                            for (const r of rows) {
                                const entity = await this.getCapsule(conn, r['cap.capsuleName'])
                                if (entity) list.push(entity)
                            }
                            return { '#': 'Capsules', list }
                        }

                        const list = rows.map((r: any) => ({
                            '#': 'Capsule',
                            $id: r['cap.capsuleName'],
                            capsuleSourceLineRef: r['cap.capsuleSourceLineRef'],
                        }))
                        return { '#': 'Capsules', list }
                    }
                },

                /**
                 * Get a capsule by name with full CST structure.
                 * Returns the entity with nested spine contracts, property contracts, and properties,
                 * each annotated with '#' type tags.
                 */
                getCapsule: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any, capsuleName: string): Promise<any | null> {
                        const rows = await this.queryAll(conn, `
                            MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource)
                            WHERE cap.capsuleName = '${esc(capsuleName)}'
                            RETURN cap, cs
                        `)
                        if (rows.length === 0) return null
                        return await this._buildCapsuleEntity(conn, rows[0].cap, rows[0].cs)
                    }
                },

                /**
                 * Get a recursive tree of capsule mapping and extends dependencies.
                 * Starting from a capsule $id, follows MAPS_TO and EXTENDS relationships
                 * to build a nested tree.
                 *
                 * Level-batched BFS: O(depth) database round-trips.
                 * Requires linkMappings() to have been called after import.
                 */
                getCapsuleSpineTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any, spineInstanceUri: string, includeProperties?: boolean): Promise<any | null> {
                        const inclProps = includeProperties !== false
                        // Find all capsules belonging to this spine instance
                        const capsuleRows = await this.queryAll(conn,
                            `MATCH (cap:Capsule) WHERE cap.spineInstanceUri = '${esc(spineInstanceUri)}' RETURN cap.capsuleName ORDER BY cap.capsuleName`
                        )
                        if (capsuleRows.length === 0) return null

                        const capsuleNames = capsuleRows.map((r: any) => r['cap.capsuleName'])
                        const relInfo = await this._fetchCapsuleRelations(conn, capsuleNames)
                        const visited = new Set<string>(capsuleNames)

                        const trees = []
                        for (const name of capsuleNames) {
                            if (relInfo.found.has(name)) {
                                trees.push(await this._assembleTreeNode(conn, name, relInfo, visited, inclProps))
                            }
                        }
                        return { '#': 'CapsuleSpineTree', $id: spineInstanceUri, list: trees }
                    }
                },

                /**
                 * Batch-fetch mapping children and extends parent for a set of capsule names.
                 * Returns { mappings, extends, found } keyed by capsuleName.
                 * @internal
                 */
                _fetchCapsuleRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any, capsuleNames: string[]): Promise<any> {
                        if (capsuleNames.length === 0) return { mappings: {}, extends: {}, found: new Set(), properties: {}, capsuleInfo: {} }
                        const nameList = capsuleNames.map(n => `'${esc(n)}'`).join(', ')

                        // All 5 queries are independent — run in parallel
                        const [mapRows, extRows, propRows, existRows, infoRows] = await Promise.all([
                            this.queryAll(conn, `
                                MATCH (cap:Capsule)-[:IMPLEMENTS_SPINE]->(:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(:PropertyContract)-[:HAS_PROPERTY]->(p:CapsuleProperty)-[:MAPS_TO]->(target:Capsule)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS src, p.name AS propName, p.propertyContractDelegate AS delegate, target.capsuleName AS target
                                ORDER BY cap.capsuleName, p.name
                            `),
                            this.queryAll(conn, `
                                MATCH (cap:Capsule)-[:EXTENDS]->(parent:Capsule)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS src, parent.capsuleName AS target
                            `),
                            this.queryAll(conn, `
                                MATCH (cap:Capsule)-[:IMPLEMENTS_SPINE]->(:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(pc:PropertyContract)-[:HAS_PROPERTY]->(p:CapsuleProperty)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS src, p.name AS propName, p.propertyType AS propertyType, pc.contractKey AS propertyContract, p.propertyContractDelegate AS propertyContractDelegate
                                ORDER BY cap.capsuleName, p.name
                            `),
                            this.queryAll(conn, `
                                MATCH (cap:Capsule)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS name
                            `),
                            this.queryAll(conn, `
                                MATCH (cap:Capsule)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS name, cap.capsuleSourceLineRef AS capsuleSourceLineRef, cap.capsuleSourceNameRef AS capsuleSourceNameRef
                            `),
                        ])

                        const mappings: Record<string, { propName: string, target: string, delegate: string }[]> = {}
                        for (const r of mapRows) {
                            if (!mappings[r.src]) mappings[r.src] = []
                            mappings[r.src].push({ propName: r.propName, target: r.target, delegate: r.delegate || '' })
                        }

                        const extendsMap: Record<string, string> = {}
                        for (const r of extRows) {
                            extendsMap[r.src] = r.target
                        }

                        const properties: Record<string, { propName: string, propertyType: string, propertyContract: string, propertyContractDelegate: string }[]> = {}
                        for (const r of propRows) {
                            if (!properties[r.src]) properties[r.src] = []
                            properties[r.src].push({ propName: r.propName, propertyType: r.propertyType, propertyContract: r.propertyContract || '', propertyContractDelegate: r.propertyContractDelegate || '' })
                        }

                        const found = new Set(existRows.map((r: any) => r.name))

                        const capsuleInfo: Record<string, { capsuleSourceLineRef: string, capsuleSourceNameRef: string }> = {}
                        for (const r of infoRows) {
                            capsuleInfo[r.name] = { capsuleSourceLineRef: r.capsuleSourceLineRef, capsuleSourceNameRef: r.capsuleSourceNameRef }
                        }

                        return { mappings, extends: extendsMap, found, properties, capsuleInfo }
                    }
                },

                /**
                 * Assemble a tree node from pre-fetched relations, recursively fetching
                 * the next level in a single batch query per depth level.
                 * @internal
                 */
                _assembleTreeNode: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any, capsuleName: string, relInfo: any, visited: Set<string>, includeProperties: boolean = true): Promise<any> {
                        const info = relInfo.capsuleInfo[capsuleName]
                        const node: any = {
                            '#': 'Capsule',
                            $id: capsuleName,
                            capsuleSourceLineRef: info?.capsuleSourceLineRef || '',
                        }

                        const myMappings = relInfo.mappings[capsuleName] || []
                        const myExtends = relInfo.extends[capsuleName] || null
                        const myProperties = relInfo.properties[capsuleName] || []

                        // Collect all unvisited targets (mapping targets + extends parent)
                        const allTargets = new Set<string>()
                        for (const m of myMappings) allTargets.add(m.target)
                        if (myExtends) allTargets.add(myExtends)

                        const unvisited = [...allTargets].filter(t => !visited.has(t))
                        for (const t of unvisited) visited.add(t)

                        // Batch-fetch relations for all unvisited targets
                        let nextRelInfo = { mappings: {} as any, extends: {} as any, found: new Set() as Set<string>, properties: {} as any, capsuleInfo: {} as any }
                        if (unvisited.length > 0) {
                            nextRelInfo = await this._fetchCapsuleRelations(conn, unvisited)
                        }

                        // Merge nextRelInfo into a combined view for recursive calls
                        const mergedRelInfo = {
                            mappings: { ...relInfo.mappings, ...nextRelInfo.mappings },
                            extends: { ...relInfo.extends, ...nextRelInfo.extends },
                            found: new Set([...relInfo.found, ...nextRelInfo.found]),
                            properties: { ...relInfo.properties, ...nextRelInfo.properties },
                            capsuleInfo: { ...relInfo.capsuleInfo, ...nextRelInfo.capsuleInfo },
                        }

                        // Build extends
                        if (myExtends) {
                            if (visited.has(myExtends) && !unvisited.includes(myExtends)) {
                                node.extends = {
                                    '#': 'Capsule/Extends',
                                    capsule: { '#': 'Capsule', $id: myExtends },
                                }
                            } else {
                                const extChild = await this._assembleTreeNode(conn, myExtends, mergedRelInfo, visited, includeProperties)
                                node.extends = {
                                    '#': 'Capsule/Extends',
                                    capsule: extChild,
                                }
                            }
                        }

                        // Build properties
                        if (myProperties.length > 0) {
                            if (includeProperties) {
                                const propsObj: any = { '#': 'Capsule/Properties' }
                                for (const p of myProperties) {
                                    const propEntry: any = {
                                        '#': 'Capsule/Property',
                                        propertyType: p.propertyType,
                                        propertyContract: p.propertyContract,
                                    }
                                    if (p.propertyContractDelegate) {
                                        propEntry.propertyContractDelegate = p.propertyContractDelegate
                                    }
                                    propsObj[p.propName] = propEntry
                                }
                                node.properties = propsObj
                            } else {
                                node.properties = { '#': 'Capsule/Properties' }
                            }
                        }

                        // Build mappings — distinguish PropertyMapping vs PropertyContractMapping
                        if (myMappings.length > 0) {
                            const mappingsObj: any = { '#': 'Capsule/Mappings' }
                            for (const m of myMappings) {
                                const tag = m.delegate ? 'Capsule/PropertyContractMapping' : 'Capsule/PropertyMapping'
                                const mappingEntry: any = { '#': tag }
                                if (m.delegate) mappingEntry.isPropertyContractDelegate = true
                                if (visited.has(m.target) && !unvisited.includes(m.target)) {
                                    mappingEntry.capsule = { '#': 'Capsule', $id: m.target }
                                } else {
                                    mappingEntry.capsule = await this._assembleTreeNode(conn, m.target, mergedRelInfo, visited, includeProperties)
                                }
                                mappingsObj[m.propName] = mappingEntry
                            }
                            node.mappings = mappingsObj
                        }

                        return node
                    }
                },

                /**
                 * Build a full capsule entity from Capsule + CapsuleSource nodes.
                 * Reconstructs the CST JSON structure with '#' annotations.
                 * @internal
                 */
                _buildCapsuleEntity: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any, capsuleNode: any, sourceNode: any): Promise<any> {
                        const { _label, _id, ...cap } = capsuleNode
                        const { _label: _sl2, _id: _si2, id: _srcId, capsuleSourceLineRef: _srcLineRef, ...src } = sourceNode

                        // Build source object (Capsule/Source)
                        const source: any = {
                            '#': 'Capsule/Source',
                            moduleFilepath: src.moduleFilepath,
                            moduleUri: src.moduleUri,
                            capsuleName: src.capsuleName,
                            declarationLine: src.declarationLine,
                            importStackLine: src.importStackLine,
                            definitionStartLine: src.definitionStartLine,
                            definitionEndLine: src.definitionEndLine,
                            optionsStartLine: src.optionsStartLine,
                            optionsEndLine: src.optionsEndLine,
                        }

                        // Include extendsCapsule if present
                        if (src.extendsCapsule) source.extendsCapsule = src.extendsCapsule
                        if (src.extendsCapsuleUri) source.extendsCapsuleUri = src.extendsCapsuleUri

                        // Single query: fetch the entire spine → propertyContract → property tree
                        const allRows = await this.queryAll(conn, `
                            MATCH (cap:Capsule {capsuleSourceLineRef: '${esc(cap.capsuleSourceLineRef)}'})-[:IMPLEMENTS_SPINE]->(s:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(pc:PropertyContract)
                            OPTIONAL MATCH (pc)-[:HAS_PROPERTY]->(p:CapsuleProperty)
                            RETURN s, pc, p
                            ORDER BY s.contractUri, pc.contractKey, p.name
                        `)

                        // Assemble in memory from the flat result set
                        const spineContracts: any = { '#': 'Capsule/SpineContracts' }
                        for (const row of allRows) {
                            const { _label: _sl, _id: _si, ...spine } = row.s
                            const { _label: _pcl, _id: _pci, ...pc } = row.pc
                            const spineKey = `#${spine.contractUri}`

                            if (!spineContracts[spineKey]) {
                                spineContracts[spineKey] = { '#': 'Capsule/SpineContract', propertyContracts: { '#': 'Capsule/PropertyContracts' } }
                            }
                            const spineContractObj = spineContracts[spineKey]

                            if (!spineContractObj.propertyContracts[pc.contractKey] || typeof spineContractObj.propertyContracts[pc.contractKey] !== 'object') {
                                spineContractObj.propertyContracts[pc.contractKey] = {
                                    '#': 'Capsule/PropertyContract',
                                    propertyContractUri: pc.propertyContractUri,
                                    properties: {},
                                }
                            }

                            if (row.p) {
                                const { _label: _pl, _id: _pi, id: _pid, capsuleSourceLineRef: _pcslr, propertyContractId: _ppcid, ...prop } = row.p
                                const propEntry: any = {
                                    '#': 'Capsule/Property',
                                    ...prop,
                                }
                                delete propEntry.name

                                // Remove empty mappedModuleUri
                                if (!propEntry.mappedModuleUri) {
                                    delete propEntry.mappedModuleUri
                                }

                                spineContractObj.propertyContracts[pc.contractKey].properties[prop.name] = propEntry
                            }
                        }

                        return {
                            $id: cap.capsuleName,
                            '#': 'Capsule',
                            cacheBustVersion: cap.cacheBustVersion,
                            capsuleSourceLineRef: cap.capsuleSourceLineRef,
                            capsuleSourceNameRef: cap.capsuleSourceNameRef,
                            capsuleSourceNameRefHash: cap.capsuleSourceNameRefHash,
                            capsuleSourceUriLineRef: cap.capsuleSourceUriLineRef,
                            source,
                            spineContracts,
                        }
                    }
                },
            }
        }
    }, {
        extendsCapsule: '../../../engines/Capsule-Ladybug-v0/LadybugGraph',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/models/Encapsulate/CapsuleSpine/API',
    })
}

// Shared escape utility for Cypher string literals
function esc(s: string | undefined | null): string {
    return s != null ? s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : ''
}
