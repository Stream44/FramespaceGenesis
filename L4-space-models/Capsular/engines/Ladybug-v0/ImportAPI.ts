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
                 * Import a parsed CST data object into the graph.
                 */
                importCstData: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, data: Record<string, any>, cstFilepath?: string, spineInstanceTreeId?: string): Promise<{ imported: number }> {
                        await this._ensureSchema()
                        let imported = 0

                        // Convert filesystem cstFilepath to npm URI for storage
                        const cstFileUri = cstFilepath ? this._toNpmUri(cstFilepath) : undefined

                        for (const [capsuleLineRef, cst] of Object.entries(data)) {
                            await this._importSingleCst(capsuleLineRef, cst, cstFilepath, spineInstanceTreeId, cstFileUri)
                            imported++
                        }

                        return { imported }
                    }
                },

                /**
                 * Import a single CST entry into the v1 graph.
                 * @internal
                 */
                _importSingleCst: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleLineRef: string, cst: any, cstFilepath?: string, spineInstanceTreeId?: string, cstFileUri?: string): Promise<void> {
                        const conn = await this._ensureConnection()
                        const source = cst.source
                        const esc = (s: string | undefined | null) => s != null ? s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : ''
                        const escLong = (s: string | undefined | null) => {
                            if (s == null) return ''
                            return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
                        }

                        // Resolve capsuleSourceLineRef to absolute path using cstFilepath.
                        // The .~o cache can live at any depth below the package root (e.g.
                        // models/Encapsulate/CapsuleSpine/.~o/... or .cst-data/Model/.~o/...).
                        // The relative capsuleLineRef is relative to the package root, so we
                        // walk up from the extracted base until the resolved path exists on disk.
                        const CACHE_MARKER = '.~o/encapsulate.dev/static-analysis/'
                        let absoluteCapsuleLineRef = capsuleLineRef
                        if (cstFilepath && !capsuleLineRef.startsWith('/')) {
                            const markerIdx = cstFilepath.indexOf(CACHE_MARKER)
                            if (markerIdx >= 0) {
                                // Strip the :line suffix for file-existence checks
                                const bareRef = capsuleLineRef.replace(/:\d+$/, '')
                                let candidate = cstFilepath.substring(0, markerIdx)
                                let resolved = join(candidate, bareRef)
                                // Walk up until the file exists or we run out of path
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

                        // 1. MERGE Capsule node (identity uses scopedId for isolation)
                        await conn.query(`
                            MERGE (cap:Capsule {scopedId: '${esc(scopedRef)}'})
                            ON CREATE SET
                                cap.capsuleSourceLineRef = '${esc(absoluteCapsuleLineRef)}',
                                cap.capsuleSourceNameRef = '${esc(cst.capsuleSourceNameRef)}',
                                cap.capsuleSourceNameRefHash = '${esc(cst.capsuleSourceNameRefHash)}',
                                cap.capsuleSourceUriLineRef = '${esc(cst.capsuleSourceUriLineRef)}',
                                cap.cacheBustVersion = ${cst.cacheBustVersion ?? 0},
                                cap.capsuleName = '${esc(source.capsuleName)}',
                                cap.moduleUri = '${esc(source.moduleUri)}',
                                cap.cstFileUri = '${esc(cstFileUri)}',
                                cap.spineInstanceTreeId = '${esc(spineInstanceTreeId)}'
                            ON MATCH SET
                                cap.capsuleSourceLineRef = '${esc(absoluteCapsuleLineRef)}',
                                cap.capsuleSourceNameRef = '${esc(cst.capsuleSourceNameRef)}',
                                cap.capsuleSourceNameRefHash = '${esc(cst.capsuleSourceNameRefHash)}',
                                cap.capsuleSourceUriLineRef = '${esc(cst.capsuleSourceUriLineRef)}',
                                cap.cacheBustVersion = ${cst.cacheBustVersion ?? 0},
                                cap.capsuleName = '${esc(source.capsuleName)}',
                                cap.moduleUri = '${esc(source.moduleUri)}',
                                cap.cstFileUri = '${esc(cstFileUri)}',
                                cap.spineInstanceTreeId = '${esc(spineInstanceTreeId)}'
                        `)

                        // 2. MERGE CapsuleSource node (source details)
                        const sourceId = `${absoluteCapsuleLineRef}::source`
                        await conn.query(`
                            MERGE (cs:CapsuleSource {id: '${esc(sourceId)}'})
                            ON CREATE SET
                                cs.capsuleSourceLineRef = '${esc(absoluteCapsuleLineRef)}',
                                cs.moduleFilepath = '${esc(source.moduleFilepath)}',
                                cs.moduleUri = '${esc(source.moduleUri)}',
                                cs.capsuleName = '${esc(source.capsuleName)}',
                                cs.declarationLine = ${source.declarationLine ?? -1},
                                cs.importStackLine = ${source.importStackLine ?? -1},
                                cs.definitionStartLine = ${source.definitionStartLine ?? -1},
                                cs.definitionEndLine = ${source.definitionEndLine ?? -1},
                                cs.optionsStartLine = ${source.optionsStartLine ?? -1},
                                cs.optionsEndLine = ${source.optionsEndLine ?? -1},
                                cs.extendsCapsule = '${esc(source.extendsCapsule)}',
                                cs.extendsCapsuleUri = '${esc(source.extendsCapsuleUri)}'
                            ON MATCH SET
                                cs.capsuleSourceLineRef = '${esc(absoluteCapsuleLineRef)}',
                                cs.moduleFilepath = '${esc(source.moduleFilepath)}',
                                cs.moduleUri = '${esc(source.moduleUri)}',
                                cs.capsuleName = '${esc(source.capsuleName)}',
                                cs.declarationLine = ${source.declarationLine ?? -1},
                                cs.importStackLine = ${source.importStackLine ?? -1},
                                cs.definitionStartLine = ${source.definitionStartLine ?? -1},
                                cs.definitionEndLine = ${source.definitionEndLine ?? -1},
                                cs.optionsStartLine = ${source.optionsStartLine ?? -1},
                                cs.optionsEndLine = ${source.optionsEndLine ?? -1},
                                cs.extendsCapsule = '${esc(source.extendsCapsule)}',
                                cs.extendsCapsuleUri = '${esc(source.extendsCapsuleUri)}'
                        `)

                        // HAS_SOURCE edge
                        await conn.query(`
                            MATCH (cap:Capsule {scopedId: '${esc(scopedRef)}'})
                            MATCH (cs:CapsuleSource {id: '${esc(sourceId)}'})
                            MERGE (cap)-[:HAS_SOURCE]->(cs)
                        `)

                        // 3. Spine contracts
                        if (cst.spineContracts) {
                            for (const [spineKey, spineContract] of Object.entries(cst.spineContracts)) {
                                const spineUri = spineKey.startsWith('#') ? spineKey.slice(1) : spineKey
                                const spineId = `${absoluteCapsuleLineRef}::spine::${spineUri}`

                                // MERGE SpineContract node
                                await conn.query(`
                                    MERGE (s:SpineContract {id: '${esc(spineId)}'})
                                    ON CREATE SET
                                        s.contractUri = '${esc(spineUri)}',
                                        s.capsuleSourceLineRef = '${esc(absoluteCapsuleLineRef)}'
                                    ON MATCH SET
                                        s.contractUri = '${esc(spineUri)}',
                                        s.capsuleSourceLineRef = '${esc(absoluteCapsuleLineRef)}'
                                `)

                                // IMPLEMENTS_SPINE edge (Capsule -> SpineContract)
                                await conn.query(`
                                    MATCH (cap:Capsule {scopedId: '${esc(scopedRef)}'})
                                    MATCH (s:SpineContract {id: '${esc(spineId)}'})
                                    MERGE (cap)-[:IMPLEMENTS_SPINE]->(s)
                                `)

                                // 3. Property contracts (groups) within spine contract
                                const properties = (spineContract as any).propertyContracts
                                if (properties) {
                                    for (const [groupKey, group] of Object.entries(properties)) {
                                        const groupData = group as any
                                        const contractKey = groupKey
                                        const propertyContractUri = groupData.propertyContractUri ?? (groupKey.startsWith('#') ? groupKey.slice(1) : groupKey)
                                        const pcId = `${absoluteCapsuleLineRef}::pc::${spineUri}::${contractKey}`

                                        // MERGE PropertyContract node
                                        const pcOptions = groupData.options ? escLong(JSON.stringify(groupData.options)) : ''
                                        await conn.query(`
                                            MERGE (pc:PropertyContract {id: '${esc(pcId)}'})
                                            ON CREATE SET
                                                pc.contractKey = '${esc(contractKey)}',
                                                pc.propertyContractUri = '${esc(propertyContractUri)}',
                                                pc.capsuleSourceLineRef = '${esc(absoluteCapsuleLineRef)}',
                                                pc.spineContractId = '${esc(spineId)}',
                                                pc.options = '${pcOptions}'
                                            ON MATCH SET
                                                pc.contractKey = '${esc(contractKey)}',
                                                pc.propertyContractUri = '${esc(propertyContractUri)}',
                                                pc.capsuleSourceLineRef = '${esc(absoluteCapsuleLineRef)}',
                                                pc.spineContractId = '${esc(spineId)}',
                                                pc.options = '${pcOptions}'
                                        `)

                                        // HAS_PROPERTY_CONTRACT edge
                                        await conn.query(`
                                            MATCH (s:SpineContract {id: '${esc(spineId)}'})
                                            MATCH (pc:PropertyContract {id: '${esc(pcId)}'})
                                            MERGE (s)-[:HAS_PROPERTY_CONTRACT]->(pc)
                                        `)

                                        // 4. Properties within this contract
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
                 * Import a single property into the graph.
                 * @internal
                 */
                _importProperty: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, scopedRef: string, capsuleSourceLineRef: string, propertyContractId: string, propName: string, prop: any): Promise<void> {
                        const conn = await this._ensureConnection()
                        const esc = (s: string | undefined | null) => s != null ? s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : ''
                        const escLong = (s: string | undefined | null) => {
                            if (s == null) return ''
                            return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
                        }

                        const propId = `${scopedRef}::prop::${propName}`
                        const delegate = prop.propertyContractDelegate || ''
                        const mappedModuleUri = prop.mappedModuleUri || ''

                        const valueExpression = prop.valueExpression || ''

                        // MERGE CapsuleProperty node
                        await conn.query(`
                            MERGE (p:CapsuleProperty {id: '${esc(propId)}'})
                            ON CREATE SET
                                p.name = '${esc(propName)}',
                                p.propertyType = '${esc(prop.type)}',
                                p.valueType = '${escLong(prop.valueType)}',
                                p.valueExpression = '${escLong(valueExpression)}',
                                p.mappedModuleUri = '${esc(mappedModuleUri)}',
                                p.declarationLine = ${prop.declarationLine ?? -1},
                                p.definitionStartLine = ${prop.definitionStartLine ?? -1},
                                p.definitionEndLine = ${prop.definitionEndLine ?? -1},
                                p.propertyContractDelegate = '${esc(delegate)}',
                                p.capsuleSourceLineRef = '${esc(capsuleSourceLineRef)}',
                                p.propertyContractId = '${esc(propertyContractId)}'
                            ON MATCH SET
                                p.name = '${esc(propName)}',
                                p.propertyType = '${esc(prop.type)}',
                                p.valueType = '${escLong(prop.valueType)}',
                                p.valueExpression = '${escLong(valueExpression)}',
                                p.mappedModuleUri = '${esc(mappedModuleUri)}',
                                p.declarationLine = ${prop.declarationLine ?? -1},
                                p.definitionStartLine = ${prop.definitionStartLine ?? -1},
                                p.definitionEndLine = ${prop.definitionEndLine ?? -1},
                                p.propertyContractDelegate = '${esc(delegate)}',
                                p.capsuleSourceLineRef = '${esc(capsuleSourceLineRef)}',
                                p.propertyContractId = '${esc(propertyContractId)}'
                        `)

                        // HAS_PROPERTY edge
                        await conn.query(`
                            MATCH (pc:PropertyContract {id: '${esc(propertyContractId)}'})
                            MATCH (p:CapsuleProperty {id: '${esc(propId)}'})
                            MERGE (pc)-[:HAS_PROPERTY]->(p)
                        `)

                        // DELEGATES_TO edge for delegate properties
                        if (delegate) {
                            const delegateUri = delegate.startsWith('#') ? delegate.slice(1) : delegate
                            // Find or reference the PropertyContract by its propertyContractUri
                            // The delegate target may be in a different spine contract, so we match by propertyContractUri
                            await conn.query(`
                                MATCH (p:CapsuleProperty {id: '${esc(propId)}'})
                                MATCH (pc:PropertyContract)
                                WHERE pc.capsuleSourceLineRef = '${esc(capsuleSourceLineRef)}'
                                AND pc.propertyContractUri = '${esc(delegateUri)}'
                                MERGE (p)-[:DELEGATES_TO]->(pc)
                            `)
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
                        if (this.verbose) console.log(`[ladybug] Importing ${events.length} membrane events for ${spineInstanceTreeId}`)
                        const conn = await this._ensureConnection()
                        const esc = this._esc.bind(this)
                        const escLong = (s: string | undefined | null) => {
                            if (s == null) return ''
                            return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
                        }
                        let imported = 0

                        for (const evt of events) {
                            const pk = `${spineInstanceTreeId}::evt::${evt.eventIndex}`
                            const capsuleSourceLineRef = evt.target?.capsuleSourceLineRef || ''
                            const valueStr = evt.value !== undefined ? JSON.stringify(evt.value) : ''
                            const resultStr = evt.result !== undefined ? JSON.stringify(evt.result) : ''

                            const rawEventStr = escLong(JSON.stringify(evt))

                            await conn.query(`
                                MERGE (e:MembraneEvent {id: '${esc(pk)}'})
                                ON CREATE SET
                                    e.eventIndex = ${evt.eventIndex},
                                    e.spineInstanceTreeId = '${esc(spineInstanceTreeId)}',
                                    e.eventType = '${esc(evt.event)}',
                                    e.membrane = '${esc(evt.membrane || 'external')}',
                                    e.capsuleSourceLineRef = '${esc(capsuleSourceLineRef)}',
                                    e.capsuleSourceNameRef = '${esc(evt.target?.capsuleSourceNameRef || '')}',
                                    e.capsuleSourceNameRefHash = '${esc(evt.target?.capsuleSourceNameRefHash || '')}',
                                    e.propertyName = '${esc(evt.target?.prop || '')}',
                                    e.value = '${escLong(valueStr)}',
                                    e.result = '${escLong(resultStr)}',
                                    e.callerFilepath = '${esc(evt.caller?.filepath || '')}',
                                    e.callerLine = ${evt.caller?.line ?? -1},
                                    e.callEventIndex = ${evt.callEventIndex ?? -1},
                                    e.rawEvent = '${rawEventStr}'
                            `)

                            // Create HAS_MEMBRANE_EVENT edge from owning Capsule (if found)
                            if (capsuleSourceLineRef) {
                                const scopedRef = `${spineInstanceTreeId}::${capsuleSourceLineRef}`
                                await conn.query(`
                                    MATCH (cap:Capsule {scopedId: '${esc(scopedRef)}'})
                                    MATCH (e:MembraneEvent {id: '${esc(pk)}'})
                                    MERGE (cap)-[:HAS_MEMBRANE_EVENT]->(e)
                                `)
                            }

                            imported++
                        }

                        if (this.verbose) console.log(`[ladybug] Imported ${imported} membrane events`)
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
                        const conn = await this._ensureConnection()
                        if (this.verbose) console.log('[cst-v1] Linking mappings and extends...')

                        // Build moduleUri→capsuleName lookup in JS (fast, avoids OR in Cypher)
                        // 1. MAPS_TO edges (same tree, by capsuleName or moduleUri)
                        const mapsResult = await conn.query(`
                            MATCH (owner:Capsule)-[:IMPLEMENTS_SPINE]->(:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(:PropertyContract)-[:HAS_PROPERTY]->(p:CapsuleProperty)
                            WHERE p.mappedModuleUri IS NOT NULL AND p.mappedModuleUri <> ''
                            MATCH (t:Capsule)-[:HAS_SOURCE]->(ts:CapsuleSource)
                            WHERE t.spineInstanceTreeId = owner.spineInstanceTreeId AND (t.capsuleName = p.mappedModuleUri OR ts.moduleUri = p.mappedModuleUri)
                            MERGE (p)-[:MAPS_TO]->(t)
                            RETURN count(*) AS linked
                        `)
                        const mapsRows = await mapsResult.getAll()
                        const linked = mapsRows[0]?.linked ?? 0

                        // 2. EXTENDS edges (same tree, by capsuleName or moduleUri)
                        const extendsResult = await conn.query(`
                            MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource)
                            WHERE cs.extendsCapsuleUri IS NOT NULL AND cs.extendsCapsuleUri <> ''
                            MATCH (parent:Capsule)-[:HAS_SOURCE]->(ps:CapsuleSource)
                            WHERE parent.spineInstanceTreeId = cap.spineInstanceTreeId AND (parent.capsuleName = cs.extendsCapsuleUri OR ps.moduleUri = cs.extendsCapsuleUri)
                            MERGE (cap)-[:EXTENDS]->(parent)
                            RETURN count(*) AS linked
                        `)
                        const extendsRows = await extendsResult.getAll()
                        const extendsCount = extendsRows[0]?.linked ?? 0

                        if (this.verbose) console.log(`[cst-v1] Linked ${linked} mapping edges, ${extendsCount} extends edges.`)
                        return { linked, extends: extendsCount }
                    }
                },

                // =============================================================
                // File Import Helpers
                // =============================================================

                /**
                 * Import a .csts.json file from disk into the graph.
                 */
                importCstFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, filePath: string, spineInstanceTreeId?: string): Promise<{ imported: number }> {
                        if (this.verbose) console.log(`[cst-v1] Importing file: ${filePath}`)
                        const content = await readFile(filePath, 'utf-8')
                        const data = JSON.parse(content)
                        return await this.importCstData(data, filePath, spineInstanceTreeId)
                    }
                },

                /**
                 * Import a spine instance tree from a .sit.json file.
                 * This reads the sit file to determine the tree structure and imports
                 * all related CST files with the correct spineInstanceTreeId.
                 */
                importSitFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, sitFilePath: string, opts?: { reset?: boolean }): Promise<{ imported: number; capsules: number; instances: number }> {
                        if (opts?.reset) {
                            const conn = await this._ensureConnection()
                            const tables = ['HAS_MEMBRANE_EVENT', 'PARENT_INSTANCE', 'INSTANCE_OF', 'DELEGATES_TO', 'EXTENDS', 'MAPS_TO', 'HAS_PROPERTY', 'HAS_PROPERTY_CONTRACT', 'IMPLEMENTS_SPINE', 'HAS_SOURCE']
                            for (const t of tables) { await conn.query(`DROP TABLE IF EXISTS ${t}`) }
                            const nodes = ['MembraneEvent', 'CapsuleInstance', 'CapsuleProperty', 'PropertyContract', 'SpineContract', 'CapsuleSource', 'Capsule']
                            for (const t of nodes) { await conn.query(`DROP TABLE IF EXISTS ${t}`) }
                            this._schemaCreated = false
                            await this._ensureSchema()
                        }
                        if (this.verbose) console.log(`[cst-v1] Importing SIT file: ${sitFilePath}`)
                        const content = await readFile(sitFilePath, 'utf-8')
                        const sit = JSON.parse(content)

                        // Use rootCapsuleName as the spineInstanceTreeId - it has no line number
                        // Get it from capsuleInstances using the root capsule's instance ID
                        const rootInstanceId = sit.rootCapsule?.capsuleSourceUriLineRefInstanceId
                        const spineInstanceTreeId = rootInstanceId && sit.capsuleInstances?.[rootInstanceId]?.capsuleName
                        if (!spineInstanceTreeId) {
                            throw new Error(`SIT file missing root capsule name: ${sitFilePath}`)
                        }

                        // Derive the static-analysis directory from the sit file path
                        // sit file: .../spine-instances/<name>/root-capsule.sit.json
                        // cst files: .../static-analysis/<path>.csts.json
                        const sitDir = dirname(sitFilePath)
                        const spineInstancesDir = dirname(sitDir)
                        const encapsulateDevDir = dirname(spineInstancesDir)
                        const staticAnalysisDir = join(encapsulateDevDir, 'static-analysis')

                        let totalImported = 0
                        const capsuleNames = Object.keys(sit.capsules || {})

                        // For each capsule in the sit, find and import its CST file
                        for (const capsuleName of capsuleNames) {
                            const capsuleInfo = sit.capsules[capsuleName]
                            const capsuleSourceUriLineRef = capsuleInfo.capsuleSourceUriLineRef
                            if (!capsuleSourceUriLineRef) continue

                            // Convert capsuleSourceUriLineRef to CST file path
                            // e.g. @stream44.studio/FramespaceGenesis/models/path/file:42 -> models/path/file.ts:42.csts.json
                            // e.g. @stream44.studio/encapsulate/structs/Capsule:18 -> o/npmjs.com/node_modules/@stream44.studio/encapsulate/structs/Capsule.ts:18.csts.json
                            const uriMatch = capsuleSourceUriLineRef.match(/^@([^:]+):(\d+)$/)
                            if (!uriMatch) continue

                            const [, uriPath, line] = uriMatch

                            // CST files are stored using npm URI paths (cache path = moduleUri)
                            // Try: 1) @<uri>:<line>.csts.json (current format)
                            //      2) <localRelPath>.ts:<line>.csts.json (legacy local format)
                            //      3) o/npmjs.com/node_modules/@<uri>.ts:<line>.csts.json (external packages)
                            const npmUriCstPath = join(staticAnalysisDir, `@${uriPath}:${line}.csts.json`)
                            const uriSegments = uriPath.split('/')
                            const localRelPath = uriSegments.length > 2 ? uriSegments.slice(2).join('/') : null
                            const localCstPath = localRelPath ? join(staticAnalysisDir, `${localRelPath}.ts:${line}.csts.json`) : null
                            const npmCstPath = join(staticAnalysisDir, `o/npmjs.com/node_modules/@${uriPath}.ts:${line}.csts.json`)

                            const cstFilePath = existsSync(npmUriCstPath) ? npmUriCstPath
                                : (localCstPath && existsSync(localCstPath)) ? localCstPath
                                    : npmCstPath
                            if (!existsSync(cstFilePath)) {
                                if (this.verbose) console.log(`[cst-v1] CST file not found: ${npmUriCstPath} for capsule: ${capsuleName}`)
                                continue
                            }

                            const result = await this.importCstFile(cstFilePath, spineInstanceTreeId)
                            totalImported += result.imported
                        }

                        // Import capsule instances
                        const instancesImported = await this._importCapsuleInstances(sit, spineInstanceTreeId)

                        return { imported: totalImported, capsules: capsuleNames.length, instances: instancesImported }
                    }
                },

                /**
                 * Import capsule instances from a sit file into the graph.
                 * Creates CapsuleInstance nodes and INSTANCE_OF/PARENT_INSTANCE relationships.
                 * @internal
                 */
                _importCapsuleInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, sit: any, spineInstanceTreeId: string): Promise<number> {
                        const conn = await this._ensureConnection()
                        const esc = (s: string | undefined | null) => s != null ? s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : ''

                        const capsuleInstances = sit.capsuleInstances || {}
                        let imported = 0

                        // First pass: create all CapsuleInstance nodes
                        for (const [instanceId, instance] of Object.entries(capsuleInstances) as [string, any][]) {
                            await conn.query(`
                                MERGE (inst:CapsuleInstance {instanceId: '${esc(instanceId)}'})
                                ON CREATE SET
                                    inst.capsuleName = '${esc(instance.capsuleName)}',
                                    inst.capsuleSourceUriLineRef = '${esc(instance.capsuleSourceUriLineRef)}',
                                    inst.spineInstanceTreeId = '${esc(spineInstanceTreeId)}'
                                ON MATCH SET
                                    inst.capsuleName = '${esc(instance.capsuleName)}',
                                    inst.capsuleSourceUriLineRef = '${esc(instance.capsuleSourceUriLineRef)}',
                                    inst.spineInstanceTreeId = '${esc(spineInstanceTreeId)}'
                            `)

                            // Create INSTANCE_OF edge to the Capsule (scoped by spineInstanceTreeId)
                            await conn.query(`
                                MATCH (inst:CapsuleInstance {instanceId: '${esc(instanceId)}'})
                                MATCH (cap:Capsule)
                                WHERE cap.spineInstanceTreeId = '${esc(spineInstanceTreeId)}' AND cap.capsuleName = '${esc(instance.capsuleName)}'
                                MERGE (inst)-[:INSTANCE_OF]->(cap)
                            `)

                            imported++
                        }

                        // Second pass: create PARENT_INSTANCE edges
                        for (const [instanceId, instance] of Object.entries(capsuleInstances) as [string, any][]) {
                            const parentId = instance.parentCapsuleSourceUriLineRefInstanceId
                            if (parentId && parentId !== '') {
                                await conn.query(`
                                    MATCH (child:CapsuleInstance {instanceId: '${esc(instanceId)}'})
                                    MATCH (parent:CapsuleInstance {instanceId: '${esc(parentId)}'})
                                    MERGE (child)-[:PARENT_INSTANCE]->(parent)
                                `)
                            }
                        }

                        if (this.verbose) console.log(`[cst-v1] Imported ${imported} capsule instances`)
                        return imported
                    }
                },

                /**
                 * Recursively scan a directory for .sit.json files and import all spine instance trees.
                 * This is the preferred import method as it uses the deterministic tree structure.
                 */
                importSitDirectory: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, dirPath: string): Promise<{ imported: number; sits: number }> {
                        if (this.verbose) console.log(`[cst-v1] Scanning directory for SIT files: ${dirPath}`)
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
                        if (this.verbose) console.log(`[cst-v1] Scanning directory: ${dirPath}`)
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
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Ladybug-v0/ImportAPI',
    })
}
