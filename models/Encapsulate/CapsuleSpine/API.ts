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
                                graphMethod: true,
                            },
                            getCapsule: {
                                args: [
                                    { name: 'capsuleName', type: 'string' },
                                ],
                                description: 'Get a capsule with full CST structure including spine contracts, property contracts, and properties.',
                                discovery: 'listCapsules',
                                filterField: '$id',
                                graphMethod: true,
                            },
                            getCapsuleSpineTree: {
                                args: [
                                    { name: 'spineInstanceUri', type: 'string' },
                                    { name: 'includeProperties', type: 'boolean', optional: true },
                                ],
                                description: 'Get the spine tree for a spineInstanceUri.',
                                discovery: 'Framespace/Workbench/listSpineInstances',
                                filterField: '$id',
                                graphMethod: true,
                            },
                        },
                    },
                },

                // =============================================================
                // Query API — each method receives `graph` (engine EngineAPI)
                // =============================================================

                /**
                 * List all imported capsules.
                 * Returns { '#': 'Capsules', list: [{ $id, '#' }] }.
                 */
                listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, graph: any, spineInstanceUri?: string, resolveRefs?: boolean): Promise<any> {
                        const rows = await graph.listCapsules(spineInstanceUri)

                        if (resolveRefs) {
                            const list = []
                            for (const r of rows) {
                                const entity = await this.getCapsule(graph, r.capsuleName)
                                if (entity) list.push(entity)
                            }
                            return { '#': 'Capsules', list }
                        }

                        const list = rows.map((r: any) => ({
                            '#': 'Capsule',
                            $id: r.capsuleName,
                            capsuleSourceLineRef: r.capsuleSourceLineRef,
                        }))
                        return { '#': 'Capsules', list }
                    }
                },

                /**
                 * Get a capsule by name with full CST structure.
                 */
                getCapsule: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, graph: any, capsuleName: string): Promise<any | null> {
                        const raw = await graph.getCapsuleWithSource(capsuleName)
                        if (!raw) return null
                        return await this._buildCapsuleEntity(graph, raw.cap, raw.source)
                    }
                },

                /**
                 * Get a recursive tree of capsule mapping and extends dependencies.
                 */
                getCapsuleSpineTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, graph: any, spineInstanceUri: string, includeProperties?: boolean): Promise<any | null> {
                        const inclProps = includeProperties === true
                        const capsuleNames = await graph.getCapsuleNamesBySpine(spineInstanceUri)
                        if (capsuleNames.length === 0) return null

                        const relInfo = await graph.fetchCapsuleRelations(capsuleNames)
                        const visited = new Set<string>()

                        // Build tree from root capsule only (the one matching spineInstanceUri)
                        const rootName = capsuleNames.find((n: string) => n === spineInstanceUri)
                        if (!rootName || !relInfo.found.has(rootName)) return null
                        const rootCapsule = await this._assembleTreeNode(graph, rootName, relInfo, visited, inclProps)
                        return { '#': 'CapsuleSpineTree', $id: spineInstanceUri, rootCapsule }
                    }
                },

                // =============================================================
                // Internal — composition / shaping (engine-agnostic)
                // =============================================================

                /**
                 * Assemble a tree node from pre-fetched relations, recursively
                 * fetching the next level in a single batch per depth.
                 * @internal
                 */
                _assembleTreeNode: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, graph: any, capsuleName: string, relInfo: any, visited: Set<string>, includeProperties: boolean = true): Promise<any> {
                        // Mark self as visited (ancestor chain) for circular reference detection
                        visited.add(capsuleName)

                        const info = relInfo.capsuleInfo[capsuleName]
                        const node: any = {
                            '#': 'Capsule',
                            $id: capsuleName,
                            capsuleSourceLineRef: info?.capsuleSourceLineRef || '',
                        }

                        const myMappings = relInfo.mappings[capsuleName] || []
                        const myExtends = relInfo.extends[capsuleName] || null
                        const myProperties = relInfo.properties[capsuleName] || []

                        // Collect all targets that need relation data fetched
                        const allTargets = new Set<string>()
                        for (const m of myMappings) allTargets.add(m.target)
                        if (myExtends) allTargets.add(myExtends)

                        const needsFetch = [...allTargets].filter((t: string) => !relInfo.found.has(t))
                        let mergedRelInfo = relInfo
                        if (needsFetch.length > 0) {
                            const nextRelInfo = await graph.fetchCapsuleRelations(needsFetch)
                            mergedRelInfo = {
                                mappings: { ...relInfo.mappings, ...nextRelInfo.mappings },
                                extends: { ...relInfo.extends, ...nextRelInfo.extends },
                                found: new Set([...relInfo.found, ...nextRelInfo.found]),
                                properties: { ...relInfo.properties, ...nextRelInfo.properties },
                                capsuleInfo: { ...relInfo.capsuleInfo, ...nextRelInfo.capsuleInfo },
                            }
                        }

                        // Build extends — stub only for circular references
                        if (myExtends) {
                            if (visited.has(myExtends)) {
                                node.extends = { '#': 'Capsule/Extends', capsule: { '#': 'Capsule', $id: myExtends } }
                            } else {
                                node.extends = { '#': 'Capsule/Extends', capsule: await this._assembleTreeNode(graph, myExtends, mergedRelInfo, new Set(visited), includeProperties) }
                            }
                        }

                        // Build properties
                        if (myProperties.length > 0) {
                            if (includeProperties) {
                                const propsObj: any = { '#': 'Capsule/Properties' }
                                for (const p of myProperties) {
                                    const propEntry: any = { '#': 'Capsule/Property', propertyType: p.propertyType, propertyContract: p.propertyContract }
                                    if (p.propertyContractDelegate) propEntry.propertyContractDelegate = p.propertyContractDelegate
                                    propsObj[p.propName] = propEntry
                                }
                                node.properties = propsObj
                            } else {
                                node.properties = { '#': 'Capsule/Properties' }
                            }
                        }

                        // Build mappings — stub only for circular references
                        if (myMappings.length > 0) {
                            const mappingsObj: any = { '#': 'Capsule/Mappings' }
                            for (const m of myMappings) {
                                const tag = m.delegate ? 'Capsule/PropertyContractMapping' : 'Capsule/PropertyMapping'
                                const mappingEntry: any = { '#': tag }
                                if (m.delegate) mappingEntry.isPropertyContractDelegate = true
                                if (visited.has(m.target)) {
                                    mappingEntry.capsule = { '#': 'Capsule', $id: m.target }
                                } else {
                                    mappingEntry.capsule = await this._assembleTreeNode(graph, m.target, mergedRelInfo, new Set(visited), includeProperties)
                                }
                                mappingsObj[m.propName] = mappingEntry
                            }
                            node.mappings = mappingsObj
                        }

                        return node
                    }
                },

                /**
                 * Build a full capsule entity from raw cap + source nodes.
                 * @internal
                 */
                _buildCapsuleEntity: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, graph: any, capsuleNode: any, sourceNode: any): Promise<any> {
                        const { _label, _id, ...cap } = capsuleNode
                        const { _label: _sl2, _id: _si2, id: _srcId, capsuleSourceLineRef: _srcLineRef, ...src } = sourceNode

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

                        if (src.extendsCapsule) source.extendsCapsule = src.extendsCapsule
                        if (src.extendsCapsuleUri) source.extendsCapsuleUri = src.extendsCapsuleUri

                        // Fetch spine tree data from engine
                        const allRows = await graph.getCapsuleSpineTree_data(cap.capsuleSourceLineRef)

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
                                const propEntry: any = { '#': 'Capsule/Property', ...prop }
                                delete propEntry.name
                                if (!propEntry.mappedModuleUri) delete propEntry.mappedModuleUri
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
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/models/Encapsulate/CapsuleSpine/API',
    })
}
