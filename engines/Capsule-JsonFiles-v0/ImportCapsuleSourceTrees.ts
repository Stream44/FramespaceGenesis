import { readFile } from 'fs/promises'
import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

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
                 * Import a parsed CST data object into the JSON store.
                 */
                importCstData: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, data: Record<string, any>, cstFilepath?: string, spineInstanceUri?: string): Promise<{ imported: number }> {
                        let imported = 0

                        for (const [capsuleLineRef, cst] of Object.entries(data)) {
                            await this._importSingleCst(capsuleLineRef, cst, cstFilepath, spineInstanceUri)
                            imported++
                        }

                        return { imported }
                    }
                },

                /**
                 * Import a single CST entry into the JSON store.
                 * @internal
                 */
                _importSingleCst: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleLineRef: string, cst: any, cstFilepath?: string, spineInstanceUri?: string): Promise<void> {
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

                        // 1. MERGE Capsule node
                        this.mergeNode('Capsule', absoluteCapsuleLineRef, {
                            capsuleSourceLineRef: absoluteCapsuleLineRef,
                            capsuleSourceNameRef: cst.capsuleSourceNameRef ?? '',
                            capsuleSourceNameRefHash: cst.capsuleSourceNameRefHash ?? '',
                            capsuleSourceUriLineRef: cst.capsuleSourceUriLineRef ?? '',
                            cacheBustVersion: cst.cacheBustVersion ?? 0,
                            capsuleName: source.capsuleName ?? '',
                            cstFilepath: cstFilepath ?? '',
                            spineInstanceUri: spineInstanceUri ?? '',
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
                        this.mergeEdge('HAS_SOURCE', 'Capsule', absoluteCapsuleLineRef, 'CapsuleSource', sourceId)

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

                                this.mergeEdge('IMPLEMENTS_SPINE', 'Capsule', absoluteCapsuleLineRef, 'SpineContract', spineId)

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
                                        })

                                        this.mergeEdge('HAS_PROPERTY_CONTRACT', 'SpineContract', spineId, 'PropertyContract', pcId)

                                        if (groupData.properties) {
                                            for (const [propName, prop] of Object.entries(groupData.properties)) {
                                                if (propName.endsWith('Expression')) continue
                                                await this._importProperty(absoluteCapsuleLineRef, pcId, propName, prop as any)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },

                /**
                 * Import a single property into the JSON store.
                 * @internal
                 */
                _importProperty: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleLineRef: string, propertyContractId: string, propName: string, prop: any): Promise<void> {
                        const propId = `${capsuleLineRef}::prop::${propName}`
                        const delegate = prop.propertyContractDelegate || ''
                        const mappedModuleUri = prop.mappedModuleUri || ''

                        this.mergeNode('CapsuleProperty', propId, {
                            id: propId,
                            name: propName,
                            propertyType: prop.type ?? '',
                            valueType: prop.valueType ?? '',
                            mappedModuleUri,
                            declarationLine: prop.declarationLine ?? -1,
                            definitionStartLine: prop.definitionStartLine ?? -1,
                            definitionEndLine: prop.definitionEndLine ?? -1,
                            propertyContractDelegate: delegate,
                            capsuleSourceLineRef: capsuleLineRef,
                            propertyContractId,
                        })

                        this.mergeEdge('HAS_PROPERTY', 'PropertyContract', propertyContractId, 'CapsuleProperty', propId)

                        if (delegate) {
                            const conn = this._ensureConnection()
                            const delegateUri = delegate.startsWith('#') ? delegate.slice(1) : delegate
                            for (const [pcPk, pc] of Object.entries(conn.nodes.PropertyContract) as any[]) {
                                if (pc.capsuleSourceLineRef === capsuleLineRef && pc.propertyContractUri === delegateUri) {
                                    this.mergeEdge('DELEGATES_TO', 'CapsuleProperty', propId, 'PropertyContract', pcPk)
                                    break
                                }
                            }
                        }
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
                        if (this.verbose) console.log('[json] Linking mappings and extends...')
                        let linked = 0
                        let extendsCount = 0

                        // 1. MAPS_TO: CapsuleProperty.mappedModuleUri → Capsule.capsuleName
                        for (const [propPk, prop] of Object.entries(conn.nodes.CapsuleProperty) as any[]) {
                            if (!prop.mappedModuleUri) continue
                            for (const [capPk, cap] of Object.entries(conn.nodes.Capsule) as any[]) {
                                if (cap.capsuleName === prop.mappedModuleUri) {
                                    this.mergeEdge('MAPS_TO', 'CapsuleProperty', propPk, 'Capsule', capPk)
                                    linked++
                                    break
                                }
                            }
                        }

                        // 2. EXTENDS: CapsuleSource.extendsCapsuleUri → Capsule.capsuleName
                        for (const edge of conn.edges.HAS_SOURCE) {
                            const src = conn.nodes.CapsuleSource[edge.to]
                            if (!src?.extendsCapsuleUri) continue
                            for (const [capPk, cap] of Object.entries(conn.nodes.Capsule) as any[]) {
                                if (cap.capsuleName === src.extendsCapsuleUri) {
                                    this.mergeEdge('EXTENDS', 'Capsule', edge.from, 'Capsule', capPk)
                                    extendsCount++
                                    break
                                }
                            }
                        }

                        if (this.verbose) console.log(`[json] Linked ${linked} mapping edges, ${extendsCount} extends edges.`)
                        return { linked, extends: extendsCount }
                    }
                },

                // =============================================================
                // File Import Helpers
                // =============================================================

                /**
                 * Import a .csts.json file from disk into the JSON store.
                 */
                importCstFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, filePath: string, spineInstanceUri?: string): Promise<{ imported: number }> {
                        if (this.verbose) console.log(`[json] Importing file: ${filePath}`)
                        const content = await readFile(filePath, 'utf-8')
                        const data = JSON.parse(content)
                        return await this.importCstData(data, filePath, spineInstanceUri)
                    }
                },

                /**
                 * Recursively scan a directory for .csts.json files and import all.
                 */
                importCstDirectory: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, dirPath: string): Promise<{ imported: number; files: number }> {
                        if (this.verbose) console.log(`[json] Scanning directory: ${dirPath}`)
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
        extendsCapsule: './EngineAPI',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/engines/Capsule-JsonFiles-v0/ImportCapsuleSourceTrees',
    })
}
