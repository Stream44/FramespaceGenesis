import lbug from 'lbug'

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
                // Internal memoized state — database and connection
                _db: {
                    type: CapsulePropertyTypes.Literal,
                    value: null,
                },
                _conn: {
                    type: CapsulePropertyTypes.Literal,
                    value: null,
                },

                // Escape utility for Cypher string literals
                _esc: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, s: string | undefined | null): string {
                        return s != null ? s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : ''
                    }
                },

                // =============================================================
                // Connection Lifecycle (internal)
                // =============================================================

                _ensureConnection: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<any> {
                        if (this._conn) return this._conn
                        if (this.verbose) console.log('[lbug] Creating database: :memory:')
                        const db = new lbug.Database(':memory:', 0, true, false)
                        await db.init()
                        this._db = db
                        if (this.verbose) console.log('[lbug] Creating connection')
                        const conn = new lbug.Connection(db)
                        await conn.init()
                        this._conn = conn
                        return conn
                    }
                },

                _queryAll: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, statement: string): Promise<any[]> {
                        const conn = await this._ensureConnection()
                        if (this.verbose) console.log(`[lbug] Query: ${statement.trim().substring(0, 120)}...`)
                        const result = await conn.query(statement)
                        if (Array.isArray(result)) {
                            const all = []
                            for (const r of result) all.push(await r.getAll())
                            return all
                        }
                        return await result.getAll()
                    }
                },

                // =============================================================
                // Schema
                // =============================================================

                _ensureSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<void> {
                        if (this._schemaCreated) return
                        const conn = await this._ensureConnection()
                        if (this.verbose) console.log('[lbug] Creating schema...')

                        await conn.query(`CREATE NODE TABLE IF NOT EXISTS Capsule(capsuleSourceLineRef STRING PRIMARY KEY, capsuleSourceNameRef STRING, capsuleSourceNameRefHash STRING, capsuleSourceUriLineRef STRING, cacheBustVersion INT64, capsuleName STRING, cstFilepath STRING, spineInstanceTreeId STRING)`)
                        await conn.query(`CREATE NODE TABLE IF NOT EXISTS CapsuleSource(id STRING PRIMARY KEY, capsuleSourceLineRef STRING, moduleFilepath STRING, moduleUri STRING, capsuleName STRING, declarationLine INT64, importStackLine INT64, definitionStartLine INT64, definitionEndLine INT64, optionsStartLine INT64, optionsEndLine INT64, extendsCapsule STRING, extendsCapsuleUri STRING)`)
                        await conn.query(`CREATE NODE TABLE IF NOT EXISTS SpineContract(id STRING PRIMARY KEY, contractUri STRING, capsuleSourceLineRef STRING)`)
                        await conn.query(`CREATE NODE TABLE IF NOT EXISTS PropertyContract(id STRING PRIMARY KEY, contractKey STRING, propertyContractUri STRING, capsuleSourceLineRef STRING, spineContractId STRING, options STRING)`)
                        await conn.query(`CREATE NODE TABLE IF NOT EXISTS CapsuleProperty(id STRING PRIMARY KEY, name STRING, propertyType STRING, valueType STRING, valueExpression STRING, mappedModuleUri STRING, declarationLine INT64, definitionStartLine INT64, definitionEndLine INT64, propertyContractDelegate STRING, capsuleSourceLineRef STRING, propertyContractId STRING)`)
                        await conn.query(`CREATE NODE TABLE IF NOT EXISTS CapsuleInstance(instanceId STRING PRIMARY KEY, capsuleName STRING, capsuleSourceUriLineRef STRING, spineInstanceTreeId STRING)`)

                        await conn.query(`CREATE REL TABLE IF NOT EXISTS HAS_SOURCE(FROM Capsule TO CapsuleSource)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS IMPLEMENTS_SPINE(FROM Capsule TO SpineContract)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS HAS_PROPERTY_CONTRACT(FROM SpineContract TO PropertyContract)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS HAS_PROPERTY(FROM PropertyContract TO CapsuleProperty)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS MAPS_TO(FROM CapsuleProperty TO Capsule)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS EXTENDS(FROM Capsule TO Capsule)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS DELEGATES_TO(FROM CapsuleProperty TO PropertyContract)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS INSTANCE_OF(FROM CapsuleInstance TO Capsule)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS PARENT_INSTANCE(FROM CapsuleInstance TO CapsuleInstance)`)

                        this._schemaCreated = true
                        if (this.verbose) console.log('[lbug] Schema created.')
                    }
                },

                // =============================================================
                // Model Query Methods — engine-specific implementations
                // =============================================================

                /**
                 * List capsules, optionally filtered by spineInstanceTreeId.
                 * Returns [{ capsuleName, capsuleSourceLineRef }].
                 */
                _listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId?: string): Promise<any[]> {
                        const query = spineInstanceTreeId
                            ? `MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource) WHERE cap.spineInstanceTreeId = '${this._esc(spineInstanceTreeId)}' RETURN cap.capsuleName, cap.capsuleSourceLineRef ORDER BY cap.capsuleName`
                            : `MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource) RETURN cap.capsuleName, cap.capsuleSourceLineRef ORDER BY cap.capsuleName`
                        const rows = await this._queryAll(query)
                        return rows.map((r: any) => ({
                            capsuleName: r['cap.capsuleName'],
                            capsuleSourceLineRef: r['cap.capsuleSourceLineRef'],
                        }))
                    }
                },

                /**
                 * Get a capsule and its source by capsuleName.
                 * Returns { cap, source } raw node data, or null.
                 */
                _getCapsuleWithSource: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleName: string): Promise<any | null> {
                        const rows = await this._queryAll(`
                            MATCH (cap:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource)
                            WHERE cap.capsuleName = '${this._esc(capsuleName)}'
                            RETURN cap, cs
                        `)
                        if (rows.length === 0) return null
                        return { cap: rows[0].cap, source: rows[0].cs }
                    }
                },

                /**
                 * Get the full spine → propertyContract → property tree for a capsule.
                 * Returns raw rows with { s, pc, p } (spine, propertyContract, property).
                 */
                _getCapsuleSpineTree_data: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleSourceLineRef: string): Promise<any[]> {
                        return await this._queryAll(`
                            MATCH (cap:Capsule {capsuleSourceLineRef: '${this._esc(capsuleSourceLineRef)}'})-[:IMPLEMENTS_SPINE]->(s:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(pc:PropertyContract)
                            OPTIONAL MATCH (pc)-[:HAS_PROPERTY]->(p:CapsuleProperty)
                            RETURN s, pc, p
                            ORDER BY s.contractUri, pc.contractKey, p.name
                        `)
                    }
                },

                /**
                 * Get capsule names belonging to a spine instance tree.
                 * Returns string[].
                 */
                _getCapsuleNamesBySpineTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<string[]> {
                        const rows = await this._queryAll(
                            `MATCH (cap:Capsule) WHERE cap.spineInstanceTreeId = '${this._esc(spineInstanceTreeId)}' RETURN cap.capsuleName ORDER BY cap.capsuleName`
                        )
                        return rows.map((r: any) => r['cap.capsuleName'])
                    }
                },

                /**
                 * Batch-fetch relations for a set of capsule names.
                 * Returns { mappings, extends, found, properties, capsuleInfo }.
                 */
                _fetchCapsuleRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, capsuleNames: string[]): Promise<any> {
                        if (capsuleNames.length === 0) return { mappings: {}, extends: {}, found: new Set(), properties: {}, capsuleInfo: {} }
                        const nameList = capsuleNames.map(n => `'${this._esc(n)}'`).join(', ')

                        const [mapRows, extRows, propRows, existRows, infoRows] = await Promise.all([
                            this._queryAll(`
                                MATCH (cap:Capsule)-[:IMPLEMENTS_SPINE]->(:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(:PropertyContract)-[:HAS_PROPERTY]->(p:CapsuleProperty)-[:MAPS_TO]->(target:Capsule)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS src, p.name AS propName, p.propertyContractDelegate AS delegate, target.capsuleName AS target
                                ORDER BY cap.capsuleName, p.name
                            `),
                            this._queryAll(`
                                MATCH (cap:Capsule)-[:EXTENDS]->(parent:Capsule)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS src, parent.capsuleName AS target
                            `),
                            this._queryAll(`
                                MATCH (cap:Capsule)-[:IMPLEMENTS_SPINE]->(:SpineContract)-[:HAS_PROPERTY_CONTRACT]->(pc:PropertyContract)-[:HAS_PROPERTY]->(p:CapsuleProperty)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS src, p.name AS propName, p.propertyType AS propertyType, pc.contractKey AS propertyContract, pc.propertyContractUri AS propertyContractUri, p.propertyContractDelegate AS propertyContractDelegate, p.valueExpression AS valueExpression, pc.options AS pcOptions
                                ORDER BY cap.capsuleName, p.name
                            `),
                            this._queryAll(`
                                MATCH (cap:Capsule)
                                WHERE cap.capsuleName IN [${nameList}]
                                RETURN cap.capsuleName AS name
                            `),
                            this._queryAll(`
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
                        for (const r of extRows) extendsMap[r.src] = r.target
                        const properties: Record<string, { propName: string, propertyType: string, propertyContract: string, propertyContractUri: string, propertyContractDelegate: string, valueExpression: string, pcOptions: any }[]> = {}
                        for (const r of propRows) {
                            if (!properties[r.src]) properties[r.src] = []
                            let pcOptions: any = null
                            try { if (r.pcOptions) pcOptions = JSON.parse(r.pcOptions) } catch { }
                            properties[r.src].push({ propName: r.propName, propertyType: r.propertyType, propertyContract: r.propertyContract || '', propertyContractUri: r.propertyContractUri || '', propertyContractDelegate: r.propertyContractDelegate || '', valueExpression: r.valueExpression || '', pcOptions })
                        }
                        const found = new Set(existRows.map((r: any) => r.name))
                        const capsuleInfo: Record<string, { capsuleSourceLineRef: string, capsuleSourceNameRef: string }> = {}
                        for (const r of infoRows) capsuleInfo[r.name] = { capsuleSourceLineRef: r.capsuleSourceLineRef, capsuleSourceNameRef: r.capsuleSourceNameRef }

                        return { mappings, extends: extendsMap, found, properties, capsuleInfo }
                    }
                },

                /**
                 * List distinct spine instance tree IDs with associated capsule info.
                 * Returns [{ spineInstanceTreeId, capsuleName, capsuleSourceLineRef }].
                 */
                _listSpineInstanceTrees: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<any[]> {
                        return await this._queryAll(
                            `MATCH (cap:Capsule) WHERE cap.spineInstanceTreeId IS NOT NULL AND cap.spineInstanceTreeId <> '' RETURN DISTINCT cap.spineInstanceTreeId AS spineInstanceTreeId, cap.capsuleName AS capsuleName, cap.capsuleSourceLineRef AS capsuleSourceLineRef, cap.capsuleSourceUriLineRef AS capsuleSourceUriLineRef ORDER BY spineInstanceTreeId`
                        )
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
                        const rows = await this._queryAll(
                            `MATCH (inst:CapsuleInstance) WHERE inst.spineInstanceTreeId = '${this._esc(spineInstanceTreeId)}' RETURN inst.instanceId AS instanceId, inst.capsuleName AS capsuleName, inst.capsuleSourceUriLineRef AS capsuleSourceUriLineRef ORDER BY inst.capsuleName`
                        )
                        return rows
                    }
                },

                /**
                 * Get the root instance for a spine instance tree (the one with no parent).
                 * Returns { instanceId, capsuleName, capsuleSourceUriLineRef } or null.
                 */
                _getRootInstance: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any | null> {
                        const rows = await this._queryAll(`
                            MATCH (inst:CapsuleInstance)
                            WHERE inst.spineInstanceTreeId = '${this._esc(spineInstanceTreeId)}'
                            AND NOT EXISTS { MATCH (inst)-[:PARENT_INSTANCE]->(:CapsuleInstance) }
                            RETURN inst.instanceId AS instanceId, inst.capsuleName AS capsuleName, inst.capsuleSourceUriLineRef AS capsuleSourceUriLineRef
                        `)
                        return rows.length > 0 ? rows[0] : null
                    }
                },

                /**
                 * Get child instances of a given instance.
                 * Returns [{ instanceId, capsuleName, capsuleSourceUriLineRef }].
                 */
                _getChildInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, parentInstanceId: string): Promise<any[]> {
                        const rows = await this._queryAll(`
                            MATCH (child:CapsuleInstance)-[:PARENT_INSTANCE]->(parent:CapsuleInstance {instanceId: '${this._esc(parentInstanceId)}'})
                            RETURN child.instanceId AS instanceId, child.capsuleName AS capsuleName, child.capsuleSourceUriLineRef AS capsuleSourceUriLineRef
                            ORDER BY child.capsuleName
                        `)
                        return rows
                    }
                },

                /**
                 * Fetch instance relations for building the instance tree.
                 * Returns { instances, parentMap, capsuleInfo }.
                 */
                _fetchInstanceRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any> {
                        const [instRows, parentRows, capsuleRows] = await Promise.all([
                            this._queryAll(`
                                MATCH (inst:CapsuleInstance)
                                WHERE inst.spineInstanceTreeId = '${this._esc(spineInstanceTreeId)}'
                                RETURN inst.instanceId AS instanceId, inst.capsuleName AS capsuleName, inst.capsuleSourceUriLineRef AS capsuleSourceUriLineRef
                            `),
                            this._queryAll(`
                                MATCH (child:CapsuleInstance)-[:PARENT_INSTANCE]->(parent:CapsuleInstance)
                                WHERE child.spineInstanceTreeId = '${this._esc(spineInstanceTreeId)}'
                                RETURN child.instanceId AS childId, parent.instanceId AS parentId
                            `),
                            this._queryAll(`
                                MATCH (inst:CapsuleInstance)-[:INSTANCE_OF]->(cap:Capsule)
                                WHERE inst.spineInstanceTreeId = '${this._esc(spineInstanceTreeId)}'
                                RETURN inst.instanceId AS instanceId, cap.capsuleName AS capsuleName, cap.capsuleSourceLineRef AS capsuleSourceLineRef, cap.capsuleSourceUriLineRef AS capsuleSourceUriLineRef
                            `),
                        ])

                        const instances: Record<string, { instanceId: string, capsuleName: string, capsuleSourceUriLineRef: string }> = {}
                        for (const r of instRows) {
                            instances[r.instanceId] = { instanceId: r.instanceId, capsuleName: r.capsuleName, capsuleSourceUriLineRef: r.capsuleSourceUriLineRef }
                        }

                        const parentMap: Record<string, string> = {}
                        for (const r of parentRows) {
                            parentMap[r.childId] = r.parentId
                        }

                        const capsuleInfo: Record<string, { capsuleName: string, capsuleSourceLineRef: string, capsuleSourceUriLineRef: string }> = {}
                        for (const r of capsuleRows) {
                            capsuleInfo[r.instanceId] = { capsuleName: r.capsuleName, capsuleSourceLineRef: r.capsuleSourceLineRef, capsuleSourceUriLineRef: r.capsuleSourceUriLineRef }
                        }

                        return { instances, parentMap, capsuleInfo }
                    }
                },

            }
        }
    }, {
        extendsCapsule: '../Engine',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/Ladybug-v0/QueryAPI',
    })
}
