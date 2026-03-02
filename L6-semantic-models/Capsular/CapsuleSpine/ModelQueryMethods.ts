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
                        namespace: '@framespace.dev~FramespaceGenesis~L6-semantic-models~Capsular~CapsuleSpine~ModelQueryMethods',
                        description: 'Methods to query the *Capsule Spine Model* of the selected *Spine Instance Tree*',
                        basePath: '/api/@framespace.dev~FramespaceGenesis~L6-semantic-models~Capsular~CapsuleSpine~ModelQueryMethods',
                        methods: {
                            listCapsules: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                    { name: 'resolveRefs', type: 'boolean', optional: true },
                                ],
                                description: 'List all capsules in the tree.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                },
                            },
                            getCapsule: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                    { name: 'capsuleName', type: 'string' },
                                ],
                                description: 'Get a capsule with full CST structure including spine contracts, property contracts, and properties.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'listCapsules',
                                        filterField: '$id',
                                    },
                                },
                            },
                            getSpineDeclarationTree: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                    { name: 'includeProperties', type: 'boolean', optional: true },
                                ],
                                description: 'Get the declaration tree (capsule definitions) for a spineInstanceTreeId.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                },
                            },
                            getSpineInstanceTree: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'Get the instance tree (runtime instances) for a spineInstanceTreeId.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {
                                        discovery: 'Framespace/Workbench/listSpineInstanceTrees',
                                        filterField: '$id',
                                    },
                                },
                            },
                            getSpineInstanceTrees: {
                                args: [],
                                description: 'List all distinct spine instance tree IDs in the graph.',
                                tags: {
                                    '@stream44.studio/FramespaceGenesis/L8-view-models/Workbench/ModelAPIs/Panel': {},
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
                        const moduleFilepath = this['#@stream44.studio/encapsulate/structs/Capsule'].rootCapsule.moduleFilepath
                        const schemaPath = join(dirname(moduleFilepath), '_ModelQueryMethodsSchema.json')
                        await writeFile(schemaPath, JSON.stringify(this.apiSchema, null, 4))
                    }
                },

                // =============================================================
                // Query API — each method receives `graph` (engine QueryAPI)
                // =============================================================

                /**
                 * List all imported capsules.
                 * Returns { '#': 'Capsules', list: [{ $id, '#' }] }.
                 */
                listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string, resolveRefs?: boolean): Promise<any> {
                        if (!spineInstanceTreeId) throw new Error('listCapsules: spineInstanceTreeId is required')
                        const rows = await graph.listCapsules(spineInstanceTreeId)

                        if (resolveRefs) {
                            const list = []
                            for (const r of rows) {
                                const entity = await this.getCapsule({ graph, server }, spineInstanceTreeId, r.capsuleName)
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
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string, capsuleName: string): Promise<any | null> {
                        if (!spineInstanceTreeId) throw new Error('getCapsule: spineInstanceTreeId is required')
                        if (!capsuleName) throw new Error('getCapsule: capsuleName is required')
                        const raw = await graph.getCapsuleWithSource(capsuleName)
                        if (!raw) return null
                        return await this._buildCapsuleEntity(graph, raw.cap, raw.source)
                    }
                },

                /**
                 * Get a recursive tree of capsule mapping and extends dependencies (declarations).
                 */
                getSpineDeclarationTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string, includeProperties?: boolean): Promise<any | null> {
                        if (!spineInstanceTreeId) throw new Error('getSpineDeclarationTree: spineInstanceTreeId is required')
                        const inclProps = includeProperties === true
                        const capsuleNames = await graph.getCapsuleNamesBySpineTree(spineInstanceTreeId)
                        if (capsuleNames.length === 0) return null

                        const relInfo = await graph.fetchCapsuleRelations(capsuleNames)
                        const visited = new Set<string>()

                        const rootName = capsuleNames[0]
                        if (!rootName || !relInfo.found.has(rootName)) return null
                        const rootCapsule = await this._assembleTreeNode(graph, rootName, relInfo, visited, inclProps)
                        return { '#': 'SpineDeclarationTree', $id: spineInstanceTreeId, rootCapsule }
                    }
                },

                /**
                 * Get a recursive tree of capsule instances (runtime instantiation hierarchy).
                 */
                getSpineInstanceTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any | null> {
                        if (!spineInstanceTreeId) throw new Error('getSpineInstanceTree: spineInstanceTreeId is required')
                        const relInfo = await graph.fetchInstanceRelations(spineInstanceTreeId)
                        if (Object.keys(relInfo.instances).length === 0) return null

                        let rootInstanceId: string | null = null
                        for (const instanceId of Object.keys(relInfo.instances)) {
                            if (!relInfo.parentMap[instanceId]) {
                                rootInstanceId = instanceId
                                break
                            }
                        }
                        if (!rootInstanceId) return null

                        const rootInstance = await this._assembleInstanceNode(graph, rootInstanceId, relInfo)
                        return { '#': 'SpineInstanceTree', $id: spineInstanceTreeId, rootInstance }
                    }
                },

                /**
                 * List all distinct spine instance tree IDs in the graph.
                 */
                getSpineInstanceTrees: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any): Promise<any> {
                        const rows = await graph.listSpineInstanceTrees()
                        const distinctTreeIds = [...new Set<string>(rows.filter((r: any) => r.spineInstanceTreeId).map((r: any) => r.spineInstanceTreeId))]
                        const list = distinctTreeIds.map((treeId: string) => {
                            const row = rows.find((r: any) => r.spineInstanceTreeId === treeId)
                            return {
                                '#': 'SpineInstanceTree',
                                $id: treeId,
                                capsuleSourceLineRef: row?.capsuleSourceLineRef ?? null,
                                capsuleSourceUriLineRef: row?.capsuleSourceUriLineRef ?? null,
                            }
                        })
                        return { '#': 'SpineInstanceTrees', list }
                    }
                },

                /**
                 * Assemble an instance tree node recursively.
                 * @internal
                 */
                _assembleInstanceNode: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, graph: any, instanceId: string, relInfo: any): Promise<any> {
                        const inst = relInfo.instances[instanceId]
                        const capsuleInfo = relInfo.capsuleInfo[instanceId] || {}

                        const node: any = {
                            '#': 'CapsuleInstance',
                            $id: instanceId,
                            capsuleName: inst.capsuleName,
                            capsuleSourceUriLineRef: inst.capsuleSourceUriLineRef,
                            capsuleSourceLineRef: capsuleInfo.capsuleSourceLineRef || null,
                        }

                        const childIds: string[] = []
                        for (const [childId, parentId] of Object.entries(relInfo.parentMap)) {
                            if (parentId === instanceId) {
                                childIds.push(childId)
                            }
                        }

                        if (childIds.length > 0) {
                            const children: any[] = []
                            for (const childId of childIds) {
                                const childNode = await this._assembleInstanceNode(graph, childId, relInfo)
                                children.push(childNode)
                            }
                            node.children = { '#': 'CapsuleInstance/Children', list: children }
                        }

                        return node
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

                        if (myExtends) {
                            if (visited.has(myExtends)) {
                                node.extends = { '#': 'Capsule/Extends', capsule: { '#': 'Capsule', $id: myExtends } }
                            } else {
                                node.extends = { '#': 'Capsule/Extends', capsule: await this._assembleTreeNode(graph, myExtends, mergedRelInfo, new Set(visited), includeProperties) }
                            }
                        }

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
        capsuleName: '@stream44.studio/FramespaceGenesis/L6-semantic-models/Capsular/CapsuleSpine/ModelQueryMethods',
    })
}
