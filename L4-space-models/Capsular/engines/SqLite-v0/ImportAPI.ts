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
                 * Import a parsed CST data object into the SQLite store.
                 */
                importCstData: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, data: Record<string, any>, cstFilepath?: string, spineInstanceTreeId?: string): Promise<{ imported: number }> {
                        await this._ensureSchema()
                        let imported = 0

                        for (const [capsuleLineRef, cst] of Object.entries(data)) {
                            await this._importSingleCst(capsuleLineRef, cst, cstFilepath, spineInstanceTreeId)
                            imported++
                        }

                        return { imported }
                    }
                },

                /**
                 * Import a single CST entry into the SQLite store.
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

                        // 1. MERGE Capsule node
                        this.mergeNode('Capsule', absoluteCapsuleLineRef, {
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
                                            options: groupData.options ? JSON.stringify(groupData.options) : null,
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
                 * Import a single property into the SQLite store.
                 * @internal
                 */
                _importProperty: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleLineRef: string, propertyContractId: string, propName: string, prop: any): Promise<void> {
                        const propId = `${capsuleLineRef}::prop::${propName}`
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
                            capsuleSourceLineRef: capsuleLineRef,
                            propertyContractId,
                        })

                        this.mergeEdge('HAS_PROPERTY', 'PropertyContract', propertyContractId, 'CapsuleProperty', propId)

                        if (delegate) {
                            const db = this._ensureConnection()
                            const delegateUri = delegate.startsWith('#') ? delegate.slice(1) : delegate
                            const pcRow = db.query(
                                `SELECT id FROM PropertyContract WHERE capsuleSourceLineRef = ?1 AND propertyContractUri = ?2`
                            ).get(capsuleLineRef, delegateUri) as any
                            if (pcRow) {
                                this.mergeEdge('DELEGATES_TO', 'CapsuleProperty', propId, 'PropertyContract', pcRow.id)
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
                        const db = this._ensureConnection()
                        if (this.verbose) console.log('[sqlite] Linking mappings and extends...')

                        // 1. MAPS_TO: CapsuleProperty.mappedModuleUri → Capsule.capsuleName
                        const mapResult = db.run(`
                            INSERT OR IGNORE INTO MAPS_TO (from_id, to_id)
                            SELECT p.id, cap.capsuleSourceLineRef
                            FROM CapsuleProperty p
                            JOIN Capsule cap ON cap.capsuleName = p.mappedModuleUri
                            WHERE p.mappedModuleUri IS NOT NULL AND p.mappedModuleUri <> ''
                        `)
                        const linked = mapResult.changes

                        // 2. EXTENDS: CapsuleSource.extendsCapsuleUri → Capsule.capsuleName
                        const extResult = db.run(`
                            INSERT OR IGNORE INTO EXTENDS (from_id, to_id)
                            SELECT hs.from_id, parent.capsuleSourceLineRef
                            FROM HAS_SOURCE hs
                            JOIN CapsuleSource cs ON cs.id = hs.to_id
                            JOIN Capsule parent ON parent.capsuleName = cs.extendsCapsuleUri
                            WHERE cs.extendsCapsuleUri IS NOT NULL AND cs.extendsCapsuleUri <> ''
                        `)
                        const extendsCount = extResult.changes

                        if (this.verbose) console.log(`[sqlite] Linked ${linked} mapping edges, ${extendsCount} extends edges.`)
                        return { linked, extends: extendsCount }
                    }
                },

                // =============================================================
                // File Import Helpers
                // =============================================================

                /**
                 * Import a .csts.json file from disk into the SQLite store.
                 */
                importCstFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, filePath: string, spineInstanceTreeId?: string): Promise<{ imported: number }> {
                        if (this.verbose) console.log(`[sqlite] Importing file: ${filePath}`)
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
                    value: async function (this: any, sitFilePath: string): Promise<{ imported: number; capsules: number; instances: number }> {
                        if (this.verbose) console.log(`[sqlite] Importing SIT file: ${sitFilePath}`)
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
                            let cstRelPath: string
                            if (uriPath.includes('/models/')) {
                                const modelsIdx = uriPath.indexOf('/models/')
                                const localPath = uriPath.substring(modelsIdx + 1)
                                cstRelPath = `${localPath}.ts:${line}.csts.json`
                            } else {
                                cstRelPath = `o/npmjs.com/node_modules/@${uriPath}.ts:${line}.csts.json`
                            }

                            const cstFilePath = join(staticAnalysisDir, cstRelPath)
                            if (!existsSync(cstFilePath)) {
                                if (this.verbose) console.log(`[sqlite] CST file not found: ${cstFilePath}`)
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
                        const db = this._ensureConnection()
                        const capsuleInstances = sit.capsuleInstances || {}
                        let imported = 0

                        for (const [instanceId, instance] of Object.entries(capsuleInstances) as [string, any][]) {
                            this.mergeNode('CapsuleInstance', instanceId, {
                                instanceId,
                                capsuleName: instance.capsuleName ?? '',
                                capsuleSourceUriLineRef: instance.capsuleSourceUriLineRef ?? '',
                                spineInstanceTreeId,
                            })

                            // Find capsule by name and create INSTANCE_OF edge
                            const capRow = db.query(
                                `SELECT capsuleSourceLineRef FROM Capsule WHERE capsuleName = ?1`
                            ).get(instance.capsuleName) as any
                            if (capRow) {
                                this.mergeEdge('INSTANCE_OF', 'CapsuleInstance', instanceId, 'Capsule', capRow.capsuleSourceLineRef)
                            }
                            imported++
                        }

                        for (const [instanceId, instance] of Object.entries(capsuleInstances) as [string, any][]) {
                            const parentId = instance.parentCapsuleSourceUriLineRefInstanceId
                            if (parentId && parentId !== '') {
                                this.mergeEdge('PARENT_INSTANCE', 'CapsuleInstance', instanceId, 'CapsuleInstance', parentId)
                            }
                        }

                        if (this.verbose) console.log(`[sqlite] Imported ${imported} capsule instances`)
                        return imported
                    }
                },

                /**
                 * Recursively scan a directory for .sit.json files and import all.
                 */
                importSitDirectory: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, dirPath: string): Promise<{ imported: number; sits: number }> {
                        if (this.verbose) console.log(`[sqlite] Scanning directory for SIT files: ${dirPath}`)
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

            }
        }
    }, {
        extendsCapsule: './QueryAPI',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/SqLite-v0/ImportAPI',
    })
}
