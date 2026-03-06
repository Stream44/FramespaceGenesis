import { readFile } from 'fs/promises'
import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
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
                // Import Logic
                // =============================================================

                /**
                 * Import a parsed CST data object into the in-memory store.
                 */
                importCstData: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, data: Record<string, any>, cstFilepath?: string, spineInstanceTreeId?: string): Promise<{ imported: number }> {
                        let imported = 0

                        for (const [capsuleLineRef, cst] of Object.entries(data)) {
                            await this._importSingleCst(capsuleLineRef, cst, cstFilepath, spineInstanceTreeId)
                            imported++
                        }

                        return { imported }
                    }
                },

                /**
                 * Import a single CST entry into the in-memory store.
                 * @internal
                 */
                _importSingleCst: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleLineRef: string, cst: any, cstFilepath?: string, spineInstanceTreeId?: string): Promise<void> {
                        const source = cst.source

                        // Resolve capsuleSourceLineRef to absolute path using cstFilepath.
                        const CACHE_MARKER = '.~o/encapsulate.dev/static-analysis/'
                        let absoluteCapsuleLineRef = capsuleLineRef
                        if (cstFilepath && !capsuleLineRef.startsWith('/')) {
                            const markerIdx = cstFilepath.indexOf(CACHE_MARKER)
                            if (markerIdx >= 0) {
                                const bareRef = capsuleLineRef.replace(/:\d+$/, '')
                                let candidate = cstFilepath.substring(0, markerIdx)
                                let resolved = join(candidate, bareRef)
                                while (!existsSync(resolved) && candidate.includes('/')) {
                                    candidate = candidate.replace(/\/[^/]+\/?$/, '')
                                    resolved = join(candidate, bareRef)
                                }
                                absoluteCapsuleLineRef = join(candidate, capsuleLineRef)
                            }
                        }

                        // Scope all node keys by spineInstanceTreeId so each tree
                        // gets its own copy of shared capsules (e.g. structs/Capsule).
                        const scopedRef = spineInstanceTreeId
                            ? `${spineInstanceTreeId}::${absoluteCapsuleLineRef}`
                            : absoluteCapsuleLineRef

                        // 1. MERGE Capsule node
                        this.mergeNode('Capsule', scopedRef, {
                            capsuleSourceLineRef: absoluteCapsuleLineRef,
                            capsuleSourceNameRef: cst.capsuleSourceNameRef ?? '',
                            capsuleSourceNameRefHash: cst.capsuleSourceNameRefHash ?? '',
                            capsuleSourceUriLineRef: cst.capsuleSourceUriLineRef ?? '',
                            cacheBustVersion: cst.cacheBustVersion ?? 0,
                            capsuleName: source.capsuleName ?? '',
                            cstFilepath: cstFilepath ?? '',
                            spineInstanceTreeId: spineInstanceTreeId ?? '',
                        })

                        // 2. MERGE CapsuleSource node
                        const sourceId = `${absoluteCapsuleLineRef}::source`
                        this.mergeNode('CapsuleSource', sourceId, {
                            id: sourceId,
                            capsuleSourceLineRef: absoluteCapsuleLineRef,
                            moduleFilepath: source.moduleFilepath ?? '',
                            moduleUri: source.moduleUri ?? '',
                            capsuleName: source.capsuleName ?? '',
                            declarationLine: source.declarationLine ?? -1,
                            importStackLine: source.importStackLine ?? -1,
                            definitionStartLine: source.definitionStartLine ?? -1,
                            definitionEndLine: source.definitionEndLine ?? -1,
                            optionsStartLine: source.optionsStartLine ?? -1,
                            optionsEndLine: source.optionsEndLine ?? -1,
                            extendsCapsule: source.extendsCapsule ?? '',
                            extendsCapsuleUri: source.extendsCapsuleUri ?? '',
                        })

                        // HAS_SOURCE edge
                        this.mergeEdge('HAS_SOURCE', 'Capsule', scopedRef, 'CapsuleSource', sourceId)

                        // 3. Spine contracts
                        if (cst.spineContracts) {
                            for (const [spineKey, spineContract] of Object.entries(cst.spineContracts)) {
                                const spineUri = spineKey.startsWith('#') ? spineKey.slice(1) : spineKey
                                const spineId = `${absoluteCapsuleLineRef}::spine::${spineUri}`

                                this.mergeNode('SpineContract', spineId, {
                                    id: spineId,
                                    contractUri: spineUri,
                                    capsuleSourceLineRef: absoluteCapsuleLineRef,
                                })

                                this.mergeEdge('IMPLEMENTS_SPINE', 'Capsule', scopedRef, 'SpineContract', spineId)

                                const properties = (spineContract as any).propertyContracts
                                if (properties) {
                                    for (const [groupKey, group] of Object.entries(properties)) {
                                        const groupData = group as any
                                        const contractKey = groupKey
                                        const propertyContractUri = groupData.propertyContractUri ?? (groupKey.startsWith('#') ? groupKey.slice(1) : groupKey)
                                        const pcId = `${absoluteCapsuleLineRef}::pc::${spineUri}::${contractKey}`

                                        this.mergeNode('PropertyContract', pcId, {
                                            id: pcId,
                                            contractKey,
                                            propertyContractUri,
                                            capsuleSourceLineRef: absoluteCapsuleLineRef,
                                            spineContractId: spineId,
                                            options: groupData.options || null,
                                        })

                                        this.mergeEdge('HAS_PROPERTY_CONTRACT', 'SpineContract', spineId, 'PropertyContract', pcId)

                                        if (groupData.properties) {
                                            for (const [propName, prop] of Object.entries(groupData.properties)) {
                                                if (propName.endsWith('Expression')) continue
                                                await this._importProperty(absoluteCapsuleLineRef, absoluteCapsuleLineRef, pcId, propName, prop as any)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },

                /**
                 * Import a single property into the in-memory store.
                 * @internal
                 */
                _importProperty: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, scopedRef: string, capsuleSourceLineRef: string, propertyContractId: string, propName: string, prop: any): Promise<void> {
                        const propId = `${scopedRef}::prop::${propName}`
                        const delegate = prop.propertyContractDelegate || ''
                        const mappedModuleUri = prop.mappedModuleUri || ''

                        const valueExpression = prop.valueExpression || ''

                        this.mergeNode('CapsuleProperty', propId, {
                            id: propId,
                            name: propName,
                            propertyType: prop.type ?? '',
                            valueType: prop.valueType ?? '',
                            valueExpression,
                            mappedModuleUri,
                            declarationLine: prop.declarationLine ?? -1,
                            definitionStartLine: prop.definitionStartLine ?? -1,
                            definitionEndLine: prop.definitionEndLine ?? -1,
                            propertyContractDelegate: delegate,
                            capsuleSourceLineRef,
                            propertyContractId,
                        })

                        this.mergeEdge('HAS_PROPERTY', 'PropertyContract', propertyContractId, 'CapsuleProperty', propId)

                        if (delegate) {
                            const conn = this._ensureConnection()
                            const delegateUri = delegate.startsWith('#') ? delegate.slice(1) : delegate
                            for (const [pcPk, pc] of Object.entries(conn.nodes.PropertyContract) as any[]) {
                                if (pc.capsuleSourceLineRef === capsuleSourceLineRef && pc.propertyContractUri === delegateUri) {
                                    this.mergeEdge('DELEGATES_TO', 'CapsuleProperty', propId, 'PropertyContract', pcPk)
                                    break
                                }
                            }
                        }
                    }
                },

                /**
                 * Import membrane events from a captured events array.
                 * Each event is stored as a MembraneEvent node with HAS_MEMBRANE_EVENT edge from the owning Capsule.
                 */
                importMembraneEvents: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, events: any[], spineInstanceTreeId: string): Promise<{ imported: number }> {
                        if (!spineInstanceTreeId) throw new Error('importMembraneEvents: spineInstanceTreeId is required')
                        if (this.verbose) console.log(`[memory] Importing ${events.length} membrane events for ${spineInstanceTreeId}`)
                        const conn = this._ensureConnection()
                        let imported = 0

                        for (const evt of events) {
                            const pk = `${spineInstanceTreeId}::evt::${evt.eventIndex}`
                            const capsuleSourceLineRef = evt.target?.capsuleSourceLineRef || ''

                            this.mergeNode('MembraneEvent', pk, {
                                eventIndex: evt.eventIndex,
                                spineInstanceTreeId,
                                eventType: evt.event,
                                membrane: evt.membrane || 'external',
                                capsuleSourceLineRef,
                                capsuleSourceNameRef: evt.target?.capsuleSourceNameRef || '',
                                capsuleSourceNameRefHash: evt.target?.capsuleSourceNameRefHash || '',
                                propertyName: evt.target?.prop || '',
                                value: evt.value !== undefined ? JSON.stringify(evt.value) : '',
                                result: evt.result !== undefined ? JSON.stringify(evt.result) : '',
                                callerFilepath: evt.caller?.filepath || '',
                                callerLine: evt.caller?.line ?? -1,
                                callEventIndex: evt.callEventIndex ?? -1,
                                rawEvent: JSON.stringify(evt),
                            })

                            // Create HAS_MEMBRANE_EVENT edge from owning Capsule (if found)
                            if (capsuleSourceLineRef) {
                                const scopedRef = `${spineInstanceTreeId}::${capsuleSourceLineRef}`
                                if (conn.nodes.Capsule[scopedRef]) {
                                    this.mergeEdge('HAS_MEMBRANE_EVENT', 'Capsule', scopedRef, 'MembraneEvent', pk)
                                }
                            }

                            imported++
                        }

                        if (this.verbose) console.log(`[memory] Imported ${imported} membrane events`)
                        return { imported }
                    }
                },

                /**
                 * Create all MAPS_TO and EXTENDS edges in bulk.
                 * Call once after all CST files have been imported.
                 */
                linkMappings: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<{ linked: number, extends: number }> {
                        const conn = this._ensureConnection()
                        if (this.verbose) console.log('[memory] Linking mappings and extends...')
                        let linked = 0
                        let extendsCount = 0

                        // Build lookups: capsuleName+tree → capPk, moduleUri+tree → capPk
                        const capByNameAndTree = new Map<string, string>()
                        const capByModuleUriAndTree = new Map<string, string>()
                        for (const [capPk, cap] of Object.entries(conn.nodes.Capsule) as any[]) {
                            capByNameAndTree.set(`${cap.spineInstanceTreeId}::${cap.capsuleName}`, capPk)
                        }
                        // CapsuleSource.moduleUri may differ from capsuleName for imported capsules
                        for (const edge of conn.edges.HAS_SOURCE) {
                            const src = conn.nodes.CapsuleSource[edge.to]
                            const cap = conn.nodes.Capsule[edge.from]
                            if (src?.moduleUri && cap) {
                                capByModuleUriAndTree.set(`${cap.spineInstanceTreeId}::${src.moduleUri}`, edge.from)
                            }
                        }

                        // Resolve a uri to a capsule key within a tree (try capsuleName first, then moduleUri)
                        const resolveCapKey = (treeId: string, uri: string): string | undefined => {
                            return capByNameAndTree.get(`${treeId}::${uri}`) ?? capByModuleUriAndTree.get(`${treeId}::${uri}`)
                        }

                        // Helper: find owning capsule's spineInstanceTreeId for a property
                        const getTreeForProp = (prop: any): string => {
                            // Walk up: prop → PropertyContract → SpineContract → Capsule
                            const pc = conn.nodes.PropertyContract[prop.propertyContractId]
                            if (pc) {
                                const ownerCap = Object.values(conn.nodes.Capsule).find(
                                    (c: any) => c.capsuleSourceLineRef === pc.capsuleSourceLineRef
                                        && capByNameAndTree.has(`${c.spineInstanceTreeId}::${c.capsuleName}`)
                                ) as any
                                if (ownerCap) return ownerCap.spineInstanceTreeId
                            }
                            return ''
                        }

                        // 1. MAPS_TO: CapsuleProperty.mappedModuleUri → Capsule (same tree, by capsuleName or moduleUri)
                        for (const [propPk, prop] of Object.entries(conn.nodes.CapsuleProperty) as any[]) {
                            if (!prop.mappedModuleUri) continue
                            const treeId = getTreeForProp(prop)
                            const targetKey = resolveCapKey(treeId, prop.mappedModuleUri)
                            if (targetKey) {
                                this.mergeEdge('MAPS_TO', 'CapsuleProperty', propPk, 'Capsule', targetKey)
                                linked++
                            }
                        }

                        // 2. EXTENDS: CapsuleSource.extendsCapsuleUri → Capsule (same tree, by capsuleName or moduleUri)
                        for (const edge of conn.edges.HAS_SOURCE) {
                            const src = conn.nodes.CapsuleSource[edge.to]
                            if (!src?.extendsCapsuleUri) continue
                            // edge.from is the scoped Capsule key
                            const ownerCap = conn.nodes.Capsule[edge.from]
                            if (!ownerCap) continue
                            const targetKey = resolveCapKey(ownerCap.spineInstanceTreeId, src.extendsCapsuleUri)
                            if (targetKey) {
                                this.mergeEdge('EXTENDS', 'Capsule', edge.from, 'Capsule', targetKey)
                                extendsCount++
                            }
                        }

                        if (this.verbose) console.log(`[memory] Linked ${linked} mapping edges, ${extendsCount} extends edges.`)
                        return { linked, extends: extendsCount }
                    }
                },

                // =============================================================
                // File Import Helpers
                // =============================================================

                /**
                 * Import a .csts.json file from disk into the in-memory store.
                 */
                importCstFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, filePath: string, spineInstanceTreeId?: string): Promise<{ imported: number }> {
                        if (this.verbose) console.log(`[memory] Importing file: ${filePath}`)
                        const content = await readFile(filePath, 'utf-8')
                        const data = JSON.parse(content)
                        return await this.importCstData(data, filePath, spineInstanceTreeId)
                    }
                },

                /**
                 * Import a spine instance tree from a .sit.json file.
                 */
                importSitFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, sitFilePath: string, opts?: { reset?: boolean }): Promise<{ imported: number; capsules: number; instances: number }> {
                        if (opts?.reset) { this._conn = null; this._schemaCreated = false; this._ensureConnection() }
                        if (this.verbose) console.log(`[memory] Importing SIT file: ${sitFilePath}`)
                        const content = await readFile(sitFilePath, 'utf-8')
                        const sit = JSON.parse(content)

                        // Use rootCapsuleName as the spineInstanceTreeId - it has no line number
                        // Get it from capsuleInstances using the root capsule's instance ID
                        const rootInstanceId = sit.rootCapsule?.capsuleSourceUriLineRefInstanceId
                        const spineInstanceTreeId = rootInstanceId && sit.capsuleInstances?.[rootInstanceId]?.capsuleName
                        if (!spineInstanceTreeId) {
                            throw new Error(`SIT file missing root capsule name: ${sitFilePath}`)
                        }

                        const sitDir = dirname(sitFilePath)
                        const spineInstancesDir = dirname(sitDir)
                        const encapsulateDevDir = dirname(spineInstancesDir)
                        const staticAnalysisDir = join(encapsulateDevDir, 'static-analysis')

                        let totalImported = 0
                        const capsuleNames = Object.keys(sit.capsules || {})

                        for (const capsuleName of capsuleNames) {
                            const capsuleInfo = sit.capsules[capsuleName]
                            const capsuleSourceUriLineRef = capsuleInfo.capsuleSourceUriLineRef
                            if (!capsuleSourceUriLineRef) continue

                            const uriMatch = capsuleSourceUriLineRef.match(/^@([^:]+):(\d+)$/)
                            if (!uriMatch) continue

                            const [, uriPath, line] = uriMatch

                            // CST files are stored using npm URI paths (cache path = moduleUri)
                            // Try: 1) @<uri>:<line>.csts.json (current format)
                            //      2) <localRelPath>.ts:<line>.csts.json (legacy local format)
                            //      3) o/npmjs.com/node_modules/@<uri>.ts:<line>.csts.json (external packages)
                            const npmUriCstPath = join(staticAnalysisDir, `@${uriPath}:${line}.csts.json`)
                            const segments = uriPath.split('/')
                            const localPath = segments.slice(2).join('/')
                            const localCstFilePath = join(staticAnalysisDir, `${localPath}.ts:${line}.csts.json`)
                            const npmCstFilePath = join(staticAnalysisDir, `o/npmjs.com/node_modules/@${uriPath}.ts:${line}.csts.json`)

                            const cstFilePath = existsSync(npmUriCstPath) ? npmUriCstPath
                                : existsSync(localCstFilePath) ? localCstFilePath
                                    : npmCstFilePath
                            if (!existsSync(cstFilePath)) {
                                if (this.verbose) console.log(`[memory] CST file not found: ${npmUriCstPath} for capsule: ${capsuleName}`)
                                continue
                            }

                            const result = await this.importCstFile(cstFilePath, spineInstanceTreeId)
                            totalImported += result.imported
                        }

                        const instancesImported = await this._importCapsuleInstances(sit, spineInstanceTreeId)
                        return { imported: totalImported, capsules: capsuleNames.length, instances: instancesImported }
                    }
                },

                /**
                 * Import capsule instances from a sit file.
                 * @internal
                 */
                _importCapsuleInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, sit: any, spineInstanceTreeId: string): Promise<number> {
                        const capsuleInstances = sit.capsuleInstances || {}
                        let imported = 0

                        for (const [instanceId, instance] of Object.entries(capsuleInstances) as [string, any][]) {
                            this.mergeNode('CapsuleInstance', instanceId, {
                                instanceId,
                                capsuleName: instance.capsuleName ?? '',
                                capsuleSourceUriLineRef: instance.capsuleSourceUriLineRef ?? '',
                                spineInstanceTreeId,
                            })

                            // Find capsule by spineInstanceTreeId + capsuleName and create INSTANCE_OF edge
                            const conn = this._ensureConnection()
                            for (const [capPk, cap] of Object.entries(conn.nodes.Capsule) as any[]) {
                                if (cap.spineInstanceTreeId === spineInstanceTreeId && cap.capsuleName === instance.capsuleName) {
                                    this.mergeEdge('INSTANCE_OF', 'CapsuleInstance', instanceId, 'Capsule', capPk)
                                    break
                                }
                            }
                            imported++
                        }

                        for (const [instanceId, instance] of Object.entries(capsuleInstances) as [string, any][]) {
                            const parentId = instance.parentCapsuleSourceUriLineRefInstanceId
                            if (parentId && parentId !== '') {
                                this.mergeEdge('PARENT_INSTANCE', 'CapsuleInstance', instanceId, 'CapsuleInstance', parentId)
                            }
                        }

                        if (this.verbose) console.log(`[memory] Imported ${imported} capsule instances`)
                        return imported
                    }
                },

                /**
                 * Recursively scan a directory for .sit.json files and import all.
                 */
                importSitDirectory: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, dirPath: string): Promise<{ imported: number; sits: number }> {
                        if (this.verbose) console.log(`[memory] Scanning directory for SIT files: ${dirPath}`)
                        let totalImported = 0
                        let totalSits = 0

                        const entries = await readdir(dirPath, { withFileTypes: true })
                        for (const entry of entries) {
                            const fullPath = join(dirPath, entry.name)
                            if (entry.isDirectory()) {
                                const sub = await this.importSitDirectory(fullPath)
                                totalImported += sub.imported
                                totalSits += sub.sits
                            } else if (entry.name.endsWith('.sit.json')) {
                                const result = await this.importSitFile(fullPath)
                                totalImported += result.imported
                                totalSits++
                            }
                        }

                        return { imported: totalImported, sits: totalSits }
                    }
                },

                /**
                 * Recursively scan a directory for .csts.json files and import all.
                 * @deprecated Use importSitDirectory for deterministic tree imports
                 */
                importCstDirectory: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, dirPath: string): Promise<{ imported: number; files: number }> {
                        if (this.verbose) console.log(`[memory] Scanning directory: ${dirPath}`)
                        let totalImported = 0
                        let totalFiles = 0

                        const entries = await readdir(dirPath, { withFileTypes: true })
                        for (const entry of entries) {
                            const fullPath = join(dirPath, entry.name)
                            if (entry.isDirectory()) {
                                const sub = await this.importCstDirectory(fullPath)
                                totalImported += sub.imported
                                totalFiles += sub.files
                            } else if (entry.name.endsWith('.csts.json')) {
                                const result = await this.importCstFile(fullPath)
                                totalImported += result.imported
                                totalFiles++
                            }
                        }

                        return { imported: totalImported, files: totalFiles }
                    }
                },

            }
        }
    }, {
        extendsCapsule: './QueryAPI',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Memory-v0/ImportAPI',
    })
}
