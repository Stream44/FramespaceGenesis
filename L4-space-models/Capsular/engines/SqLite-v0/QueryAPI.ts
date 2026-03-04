import { Database } from 'bun:sqlite'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'

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
                // Internal memoized state — database connection
                _db: {
                    type: CapsulePropertyTypes.Literal,
                    value: null,
                },

                // =============================================================
                // Connection Lifecycle (internal)
                // =============================================================

                _ensureConnection: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        if (this._db) return this._db

                        const moduleFilepath = this['#@stream44.studio/encapsulate/structs/Capsule'].rootCapsule.moduleFilepath
                        const baseDir = dirname(moduleFilepath)
                        const dbDir = join(baseDir, '.~o/framespace.dev/data/engines/SqLite-v0')
                        if (!existsSync(dbDir)) {
                            mkdirSync(dbDir, { recursive: true })
                        }
                        const dbPath = join(dbDir, 'capsule-graph.sqlite')

                        if (this.verbose) console.log(`[sqlite] Opening database: ${dbPath}`)
                        const db = new Database(dbPath, { create: true })
                        db.run('PRAGMA journal_mode = WAL;')
                        db.run('PRAGMA foreign_keys = OFF;')
                        this._db = db
                        return db
                    }
                },

                // =============================================================
                // Schema
                // =============================================================

                _ensureSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<void> {
                        if (this._schemaCreated) return
                        const db = this._ensureConnection()
                        if (this.verbose) console.log('[sqlite] Creating schema...')

                        // Clear all existing tables to ensure fresh state
                        const tables = ['Capsule', 'CapsuleSource', 'SpineContract', 'PropertyContract', 'CapsuleProperty',
                            'CapsuleInstance', 'HAS_SOURCE', 'IMPLEMENTS_SPINE', 'HAS_PROPERTY_CONTRACT', 'HAS_PROPERTY',
                            'MAPS_TO', 'EXTENDS', 'DELEGATES_TO', 'INSTANCE_OF', 'PARENT_INSTANCE']
                        for (const table of tables) {
                            db.run(`DROP TABLE IF EXISTS ${table}`)
                        }
                        if (this.verbose) console.log('[sqlite] Cleared existing tables.')

                        // Node tables
                        db.run(`CREATE TABLE IF NOT EXISTS Capsule (
                            scopedId TEXT PRIMARY KEY,
                            capsuleSourceLineRef TEXT,
                            capsuleSourceNameRef TEXT,
                            capsuleSourceNameRefHash TEXT,
                            capsuleSourceUriLineRef TEXT,
                            cacheBustVersion INTEGER,
                            capsuleName TEXT,
                            cstFilepath TEXT,
                            spineInstanceTreeId TEXT
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS CapsuleSource (
                            id TEXT PRIMARY KEY,
                            capsuleSourceLineRef TEXT,
                            moduleFilepath TEXT,
                            moduleUri TEXT,
                            capsuleName TEXT,
                            declarationLine INTEGER,
                            importStackLine INTEGER,
                            definitionStartLine INTEGER,
                            definitionEndLine INTEGER,
                            optionsStartLine INTEGER,
                            optionsEndLine INTEGER,
                            extendsCapsule TEXT,
                            extendsCapsuleUri TEXT
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS SpineContract (
                            id TEXT PRIMARY KEY,
                            contractUri TEXT,
                            capsuleSourceLineRef TEXT
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS PropertyContract (
                            id TEXT PRIMARY KEY,
                            contractKey TEXT,
                            propertyContractUri TEXT,
                            capsuleSourceLineRef TEXT,
                            spineContractId TEXT,
                            options TEXT
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS CapsuleProperty (
                            id TEXT PRIMARY KEY,
                            name TEXT,
                            propertyType TEXT,
                            valueType TEXT,
                            valueExpression TEXT,
                            mappedModuleUri TEXT,
                            declarationLine INTEGER,
                            definitionStartLine INTEGER,
                            definitionEndLine INTEGER,
                            propertyContractDelegate TEXT,
                            capsuleSourceLineRef TEXT,
                            propertyContractId TEXT
                        )`)

                        // Edge tables (junction tables)
                        db.run(`CREATE TABLE IF NOT EXISTS HAS_SOURCE (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS IMPLEMENTS_SPINE (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS HAS_PROPERTY_CONTRACT (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS HAS_PROPERTY (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS MAPS_TO (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS EXTENDS (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS DELEGATES_TO (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS INSTANCE_OF (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS PARENT_INSTANCE (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS MembraneEvent (
                            id TEXT PRIMARY KEY,
                            eventIndex INTEGER,
                            spineInstanceTreeId TEXT,
                            eventType TEXT,
                            membrane TEXT,
                            capsuleSourceLineRef TEXT,
                            capsuleSourceNameRef TEXT,
                            capsuleSourceNameRefHash TEXT,
                            propertyName TEXT,
                            value TEXT,
                            result TEXT,
                            callerFilepath TEXT,
                            callerLine INTEGER,
                            callEventIndex INTEGER
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS HAS_MEMBRANE_EVENT (
                            from_id TEXT NOT NULL,
                            to_id TEXT NOT NULL,
                            PRIMARY KEY (from_id, to_id)
                        )`)
                        db.run(`CREATE TABLE IF NOT EXISTS CapsuleInstance (
                            instanceId TEXT PRIMARY KEY,
                            capsuleName TEXT,
                            capsuleSourceUriLineRef TEXT,
                            spineInstanceTreeId TEXT
                        )`)

                        // Indexes for fast lookups
                        db.run(`CREATE INDEX IF NOT EXISTS idx_capsule_name ON Capsule(capsuleName)`)
                        db.run(`CREATE INDEX IF NOT EXISTS idx_capsule_spine ON Capsule(spineInstanceTreeId)`)
                        db.run(`CREATE INDEX IF NOT EXISTS idx_instance_spine ON CapsuleInstance(spineInstanceTreeId)`)
                        db.run(`CREATE INDEX IF NOT EXISTS idx_capsule_property_mapped ON CapsuleProperty(mappedModuleUri)`)
                        db.run(`CREATE INDEX IF NOT EXISTS idx_capsule_source_extends ON CapsuleSource(extendsCapsuleUri)`)

                        this._schemaCreated = true
                        if (this.verbose) console.log('[sqlite] Schema created.')
                    }
                },

                // =============================================================
                // Node/Edge Helpers (used by ImportAPI)
                // =============================================================

                _mergeNode: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, table: string, pk: string, data: Record<string, any>): void {
                        const db = this._ensureConnection()
                        const keys = Object.keys(data)
                        const placeholders = keys.map((_, i) => `?${i + 1}`).join(', ')
                        const columns = keys.join(', ')
                        const values = keys.map(k => {
                            const v = data[k]
                            if (v === null || v === undefined) return null
                            if (typeof v === 'object') return JSON.stringify(v)
                            return v
                        })
                        db.run(`INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`, ...values)
                    }
                },

                _mergeEdge: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, rel: string, fromTable: string, fromPk: string, toTable: string, toPk: string): void {
                        const db = this._ensureConnection()
                        db.run(`INSERT OR IGNORE INTO ${rel} (from_id, to_id) VALUES (?1, ?2)`, fromPk, toPk)
                    }
                },

                // =============================================================
                // Model Query Methods — engine-specific implementations
                // =============================================================

                /**
                 * List capsules, optionally filtered by spineInstanceUri.
                 * Returns [{ capsuleName, capsuleSourceLineRef }].
                 */
                _listCapsules: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId?: string): Promise<any[]> {
                        const db = this._ensureConnection()
                        if (spineInstanceTreeId) {
                            return db.query(`
                                SELECT capsuleName, capsuleSourceLineRef
                                FROM Capsule
                                WHERE spineInstanceTreeId = ?1
                                ORDER BY capsuleName
                            `).all(spineInstanceTreeId)
                        }
                        return db.query(`
                            SELECT capsuleName, capsuleSourceLineRef
                            FROM Capsule
                            ORDER BY capsuleName
                        `).all()
                    }
                },

                /**
                 * Get a capsule and its source by capsuleName.
                 * Returns { cap, source } raw node data, or null.
                 */
                _getCapsuleWithSource: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleName: string): Promise<any | null> {
                        const db = this._ensureConnection()
                        const row = db.query(`
                            SELECT
                                cap.capsuleSourceLineRef AS cap_capsuleSourceLineRef,
                                cap.capsuleSourceNameRef AS cap_capsuleSourceNameRef,
                                cap.capsuleSourceNameRefHash AS cap_capsuleSourceNameRefHash,
                                cap.capsuleSourceUriLineRef AS cap_capsuleSourceUriLineRef,
                                cap.cacheBustVersion AS cap_cacheBustVersion,
                                cap.capsuleName AS cap_capsuleName,
                                cap.cstFilepath AS cap_cstFilepath,
                                cap.spineInstanceTreeId AS cap_spineInstanceTreeId,
                                cs.id AS cs_id,
                                cs.capsuleSourceLineRef AS cs_capsuleSourceLineRef,
                                cs.moduleFilepath AS cs_moduleFilepath,
                                cs.moduleUri AS cs_moduleUri,
                                cs.capsuleName AS cs_capsuleName,
                                cs.declarationLine AS cs_declarationLine,
                                cs.importStackLine AS cs_importStackLine,
                                cs.definitionStartLine AS cs_definitionStartLine,
                                cs.definitionEndLine AS cs_definitionEndLine,
                                cs.optionsStartLine AS cs_optionsStartLine,
                                cs.optionsEndLine AS cs_optionsEndLine,
                                cs.extendsCapsule AS cs_extendsCapsule,
                                cs.extendsCapsuleUri AS cs_extendsCapsuleUri
                            FROM Capsule cap
                            JOIN HAS_SOURCE hs ON hs.from_id = cap.scopedId
                            JOIN CapsuleSource cs ON cs.id = hs.to_id
                            WHERE cap.spineInstanceTreeId = ?1 AND cap.capsuleName = ?2
                        `).get(spineInstanceTreeId, capsuleName) as any
                        if (!row) return null
                        return {
                            cap: {
                                capsuleSourceLineRef: row.cap_capsuleSourceLineRef,
                                capsuleSourceNameRef: row.cap_capsuleSourceNameRef,
                                capsuleSourceNameRefHash: row.cap_capsuleSourceNameRefHash,
                                capsuleSourceUriLineRef: row.cap_capsuleSourceUriLineRef,
                                cacheBustVersion: row.cap_cacheBustVersion,
                                capsuleName: row.cap_capsuleName,
                                cstFilepath: row.cap_cstFilepath,
                                spineInstanceTreeId: row.cap_spineInstanceTreeId,
                            },
                            source: {
                                id: row.cs_id,
                                capsuleSourceLineRef: row.cs_capsuleSourceLineRef,
                                moduleFilepath: row.cs_moduleFilepath,
                                moduleUri: row.cs_moduleUri,
                                capsuleName: row.cs_capsuleName,
                                declarationLine: row.cs_declarationLine,
                                importStackLine: row.cs_importStackLine,
                                definitionStartLine: row.cs_definitionStartLine,
                                definitionEndLine: row.cs_definitionEndLine,
                                optionsStartLine: row.cs_optionsStartLine,
                                optionsEndLine: row.cs_optionsEndLine,
                                extendsCapsule: row.cs_extendsCapsule,
                                extendsCapsuleUri: row.cs_extendsCapsuleUri,
                            }
                        }
                    }
                },

                /**
                 * Get the full spine → propertyContract → property tree for a capsule.
                 * Returns raw rows with { s, pc, p } matching the Ladybug format.
                 */
                _getCapsuleSpineTree_data: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleSourceLineRef: string): Promise<any[]> {
                        const db = this._ensureConnection()
                        const rows = db.query(`
                            SELECT
                                s.id AS s_id, s.contractUri AS s_contractUri, s.capsuleSourceLineRef AS s_capsuleSourceLineRef,
                                pc.id AS pc_id, pc.contractKey AS pc_contractKey, pc.propertyContractUri AS pc_propertyContractUri,
                                pc.capsuleSourceLineRef AS pc_capsuleSourceLineRef, pc.spineContractId AS pc_spineContractId, pc.options AS pc_options,
                                p.id AS p_id, p.name AS p_name, p.propertyType AS p_propertyType, p.valueType AS p_valueType,
                                p.valueExpression AS p_valueExpression, p.mappedModuleUri AS p_mappedModuleUri,
                                p.declarationLine AS p_declarationLine, p.definitionStartLine AS p_definitionStartLine,
                                p.definitionEndLine AS p_definitionEndLine, p.propertyContractDelegate AS p_propertyContractDelegate,
                                p.capsuleSourceLineRef AS p_capsuleSourceLineRef, p.propertyContractId AS p_propertyContractId
                            FROM Capsule cap
                            JOIN IMPLEMENTS_SPINE isp ON isp.from_id = cap.scopedId
                            JOIN SpineContract s ON s.id = isp.to_id
                            JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
                            JOIN PropertyContract pc ON pc.id = hpc.to_id
                            LEFT JOIN HAS_PROPERTY hp ON hp.from_id = pc.id
                            LEFT JOIN CapsuleProperty p ON p.id = hp.to_id
                            WHERE cap.spineInstanceTreeId = ?1 AND cap.capsuleSourceLineRef = ?2
                            ORDER BY s.contractUri, pc.contractKey, p.name
                        `).all(spineInstanceTreeId, capsuleSourceLineRef) as any[]
                        return rows.map((r: any) => ({
                            s: { id: r.s_id, contractUri: r.s_contractUri, capsuleSourceLineRef: r.s_capsuleSourceLineRef },
                            pc: { id: r.pc_id, contractKey: r.pc_contractKey, propertyContractUri: r.pc_propertyContractUri, capsuleSourceLineRef: r.pc_capsuleSourceLineRef, spineContractId: r.pc_spineContractId, options: r.pc_options },
                            p: r.p_id ? { id: r.p_id, name: r.p_name, propertyType: r.p_propertyType, valueType: r.p_valueType, valueExpression: r.p_valueExpression, mappedModuleUri: r.p_mappedModuleUri, declarationLine: r.p_declarationLine, definitionStartLine: r.p_definitionStartLine, definitionEndLine: r.p_definitionEndLine, propertyContractDelegate: r.p_propertyContractDelegate, capsuleSourceLineRef: r.p_capsuleSourceLineRef, propertyContractId: r.p_propertyContractId } : null,
                        }))
                    }
                },

                /**
                 * Get capsule names belonging to a spine instance tree.
                 * Returns string[].
                 */
                _getCapsuleNamesBySpineTree: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<string[]> {
                        const db = this._ensureConnection()
                        const rows = db.query(
                            `SELECT capsuleName FROM Capsule WHERE spineInstanceTreeId = ?1 ORDER BY capsuleName`
                        ).all(spineInstanceTreeId) as any[]
                        return rows.map((r: any) => r.capsuleName)
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
                        const db = this._ensureConnection()

                        const placeholders = capsuleNames.map((_, i) => `?${i + 1}`).join(', ')

                        const mapRows = db.query(`
                            SELECT cap.capsuleName AS src, p.name AS propName,
                                   p.propertyContractDelegate AS delegate, target.capsuleName AS target
                            FROM Capsule cap
                            JOIN IMPLEMENTS_SPINE isp ON isp.from_id = cap.scopedId
                            JOIN SpineContract s ON s.id = isp.to_id
                            JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
                            JOIN PropertyContract pc ON pc.id = hpc.to_id
                            JOIN HAS_PROPERTY hp ON hp.from_id = pc.id
                            JOIN CapsuleProperty p ON p.id = hp.to_id
                            JOIN MAPS_TO mt ON mt.from_id = p.id
                            JOIN Capsule target ON target.scopedId = mt.to_id
                            WHERE cap.spineInstanceTreeId = '${spineInstanceTreeId}' AND cap.capsuleName IN (${placeholders})
                            ORDER BY cap.capsuleName, p.name
                        `).all(...capsuleNames) as any[]

                        const extRows = db.query(`
                            SELECT cap.capsuleName AS src, parent.capsuleName AS target
                            FROM Capsule cap
                            JOIN EXTENDS ext ON ext.from_id = cap.scopedId
                            JOIN Capsule parent ON parent.scopedId = ext.to_id
                            WHERE cap.spineInstanceTreeId = '${spineInstanceTreeId}' AND cap.capsuleName IN (${placeholders})
                        `).all(...capsuleNames) as any[]

                        const propRows = db.query(`
                            SELECT cap.capsuleName AS src, p.name AS propName, p.propertyType AS propertyType,
                                   pc.contractKey AS propertyContract, pc.propertyContractUri AS propertyContractUri,
                                   p.propertyContractDelegate AS propertyContractDelegate,
                                   p.valueExpression AS valueExpression, pc.options AS pcOptions
                            FROM Capsule cap
                            JOIN IMPLEMENTS_SPINE isp ON isp.from_id = cap.scopedId
                            JOIN SpineContract s ON s.id = isp.to_id
                            JOIN HAS_PROPERTY_CONTRACT hpc ON hpc.from_id = s.id
                            JOIN PropertyContract pc ON pc.id = hpc.to_id
                            JOIN HAS_PROPERTY hp ON hp.from_id = pc.id
                            JOIN CapsuleProperty p ON p.id = hp.to_id
                            WHERE cap.spineInstanceTreeId = '${spineInstanceTreeId}' AND cap.capsuleName IN (${placeholders})
                            ORDER BY cap.capsuleName, p.name
                        `).all(...capsuleNames) as any[]

                        const existRows = db.query(`
                            SELECT capsuleName AS name FROM Capsule WHERE spineInstanceTreeId = '${spineInstanceTreeId}' AND capsuleName IN (${placeholders})
                        `).all(...capsuleNames) as any[]

                        const infoRows = db.query(`
                            SELECT capsuleName AS name, capsuleSourceLineRef, capsuleSourceNameRef
                            FROM Capsule WHERE spineInstanceTreeId = '${spineInstanceTreeId}' AND capsuleName IN (${placeholders})
                        `).all(...capsuleNames) as any[]

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
                    value: async function (this: any, spineInstanceTreeId?: string): Promise<any[]> {
                        const db = this._ensureConnection()
                        if (spineInstanceTreeId) {
                            // Filter by specific tree - return all capsules in that tree
                            return db.query(`
                                SELECT spineInstanceTreeId, capsuleName, capsuleSourceLineRef, capsuleSourceUriLineRef
                                FROM Capsule
                                WHERE spineInstanceTreeId = ?1
                                ORDER BY capsuleName
                            `).all(spineInstanceTreeId)
                        }
                        // No filter - return distinct trees
                        return db.query(`
                            SELECT DISTINCT spineInstanceTreeId, capsuleName, capsuleSourceLineRef, capsuleSourceUriLineRef
                            FROM Capsule
                            WHERE spineInstanceTreeId IS NOT NULL AND spineInstanceTreeId <> ''
                            ORDER BY spineInstanceTreeId
                        `).all()
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
                        const db = this._ensureConnection()
                        return db.query(`
                            SELECT instanceId, capsuleName, capsuleSourceUriLineRef
                            FROM CapsuleInstance
                            WHERE spineInstanceTreeId = ?1
                            ORDER BY capsuleName
                        `).all(spineInstanceTreeId)
                    }
                },

                /**
                 * Get the root instance for a spine instance tree (the one with no parent).
                 * Returns { instanceId, capsuleName, capsuleSourceUriLineRef } or null.
                 */
                _getRootInstance: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any | null> {
                        const db = this._ensureConnection()
                        const row = db.query(`
                            SELECT ci.instanceId, ci.capsuleName, ci.capsuleSourceUriLineRef
                            FROM CapsuleInstance ci
                            WHERE ci.spineInstanceTreeId = ?1
                            AND NOT EXISTS (SELECT 1 FROM PARENT_INSTANCE pi WHERE pi.from_id = ci.instanceId)
                        `).get(spineInstanceTreeId)
                        return row || null
                    }
                },

                /**
                 * Get child instances of a given instance.
                 * Returns [{ instanceId, capsuleName, capsuleSourceUriLineRef }].
                 */
                _getChildInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, parentInstanceId: string): Promise<any[]> {
                        const db = this._ensureConnection()
                        return db.query(`
                            SELECT ci.instanceId, ci.capsuleName, ci.capsuleSourceUriLineRef
                            FROM CapsuleInstance ci
                            JOIN PARENT_INSTANCE pi ON pi.from_id = ci.instanceId
                            WHERE pi.to_id = ?1
                            ORDER BY ci.capsuleName
                        `).all(parentInstanceId)
                    }
                },

                /**
                 * Fetch instance relations for building the instance tree.
                 * Returns { instances, parentMap, capsuleInfo }.
                 */
                _fetchInstanceRelations: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any> {
                        const db = this._ensureConnection()

                        const instanceRows = db.query(`
                            SELECT instanceId, capsuleName, capsuleSourceUriLineRef
                            FROM CapsuleInstance
                            WHERE spineInstanceTreeId = ?1
                        `).all(spineInstanceTreeId) as any[]

                        const instances: Record<string, { instanceId: string, capsuleName: string, capsuleSourceUriLineRef: string }> = {}
                        for (const row of instanceRows) {
                            instances[row.instanceId] = { instanceId: row.instanceId, capsuleName: row.capsuleName, capsuleSourceUriLineRef: row.capsuleSourceUriLineRef }
                        }

                        const parentRows = db.query(`
                            SELECT pi.from_id, pi.to_id
                            FROM PARENT_INSTANCE pi
                            JOIN CapsuleInstance ci ON ci.instanceId = pi.from_id
                            WHERE ci.spineInstanceTreeId = ?1
                        `).all(spineInstanceTreeId) as any[]

                        const parentMap: Record<string, string> = {}
                        for (const row of parentRows) {
                            parentMap[row.from_id] = row.to_id
                        }

                        const capsuleInfoRows = db.query(`
                            SELECT io.from_id AS instanceId, cap.capsuleName, cap.capsuleSourceLineRef, cap.capsuleSourceUriLineRef
                            FROM INSTANCE_OF io
                            JOIN Capsule cap ON cap.scopedId = io.to_id
                            JOIN CapsuleInstance ci ON ci.instanceId = io.from_id
                            WHERE ci.spineInstanceTreeId = ?1
                        `).all(spineInstanceTreeId) as any[]

                        const capsuleInfo: Record<string, { capsuleName: string, capsuleSourceLineRef: string, capsuleSourceUriLineRef: string }> = {}
                        for (const row of capsuleInfoRows) {
                            capsuleInfo[row.instanceId] = { capsuleName: row.capsuleName, capsuleSourceLineRef: row.capsuleSourceLineRef, capsuleSourceUriLineRef: row.capsuleSourceUriLineRef || '' }
                        }

                        return { instances, parentMap, capsuleInfo }
                    }
                },

                // =============================================================
                // Membrane Event Query Methods
                // =============================================================

                /**
                 * Get all membrane events for a spine instance tree, ordered by eventIndex.
                 */
                _getMembraneEvents: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string): Promise<any[]> {
                        if (!spineInstanceTreeId) throw new Error('_getMembraneEvents: spineInstanceTreeId is required')
                        const db = this._ensureConnection()
                        return db.query(`
                            SELECT * FROM MembraneEvent
                            WHERE spineInstanceTreeId = ?1
                            ORDER BY eventIndex
                        `).all(spineInstanceTreeId)
                    }
                },

                /**
                 * Get membrane events for a specific capsule within a spine instance tree.
                 */
                _getMembraneEventsByCapsule: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, spineInstanceTreeId: string, capsuleSourceLineRef: string): Promise<any[]> {
                        if (!spineInstanceTreeId) throw new Error('_getMembraneEventsByCapsule: spineInstanceTreeId is required')
                        const db = this._ensureConnection()
                        return db.query(`
                            SELECT * FROM MembraneEvent
                            WHERE spineInstanceTreeId = ?1 AND capsuleSourceLineRef = ?2
                            ORDER BY eventIndex
                        `).all(spineInstanceTreeId, capsuleSourceLineRef)
                    }
                },

            }
        }
    }, {
        extendsCapsule: '../Engine',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L4-space-models/Capsular/engines/SqLite-v0/QueryAPI',
    })
}
