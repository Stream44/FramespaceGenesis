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
                verbose: {
                    type: CapsulePropertyTypes.Literal,
                    value: false,
                },

                lbug: {
                    type: CapsulePropertyTypes.Constant,
                    value: lbug,
                },

                // =============================================================
                // Schema Definition
                // =============================================================

                /**
                 * Create the v1 CST graph schema.
                 * Simplified model with 5 node tables and 6 relationship tables.
                 *
                 * Entity types (matching CST JSON '#' annotations):
                 *   - Capsule            '#': 'Capsule'
                 *   - CapsuleSource      '#': 'Capsule/Source'
                 *   - SpineContract      '#': 'Capsule/SpineContract'
                 *   - PropertyContract   '#': 'Capsule/PropertyContract'
                 *   - CapsuleProperty    '#': 'Capsule/Property'
                 */
                createSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any): Promise<void> {
                        if (this.verbose) console.log('[cst-v1] Creating schema...')

                        // -- Node Tables --

                        await conn.query(`
                            CREATE NODE TABLE IF NOT EXISTS Capsule(
                                capsuleSourceLineRef STRING PRIMARY KEY,
                                capsuleSourceNameRef STRING,
                                capsuleSourceNameRefHash STRING,
                                capsuleSourceUriLineRef STRING,
                                cacheBustVersion INT64,
                                capsuleName STRING,
                                cstFilepath STRING,
                                spineInstanceUri STRING
                            )
                        `)

                        await conn.query(`
                            CREATE NODE TABLE IF NOT EXISTS CapsuleSource(
                                id STRING PRIMARY KEY,
                                capsuleSourceLineRef STRING,
                                moduleFilepath STRING,
                                moduleUri STRING,
                                capsuleName STRING,
                                declarationLine INT64,
                                importStackLine INT64,
                                definitionStartLine INT64,
                                definitionEndLine INT64,
                                optionsStartLine INT64,
                                optionsEndLine INT64,
                                extendsCapsule STRING,
                                extendsCapsuleUri STRING
                            )
                        `)

                        await conn.query(`
                            CREATE NODE TABLE IF NOT EXISTS SpineContract(
                                id STRING PRIMARY KEY,
                                contractUri STRING,
                                capsuleSourceLineRef STRING
                            )
                        `)

                        await conn.query(`
                            CREATE NODE TABLE IF NOT EXISTS PropertyContract(
                                id STRING PRIMARY KEY,
                                contractKey STRING,
                                propertyContractUri STRING,
                                capsuleSourceLineRef STRING,
                                spineContractId STRING
                            )
                        `)

                        await conn.query(`
                            CREATE NODE TABLE IF NOT EXISTS CapsuleProperty(
                                id STRING PRIMARY KEY,
                                name STRING,
                                propertyType STRING,
                                valueType STRING,
                                mappedModuleUri STRING,
                                declarationLine INT64,
                                definitionStartLine INT64,
                                definitionEndLine INT64,
                                propertyContractDelegate STRING,
                                capsuleSourceLineRef STRING,
                                propertyContractId STRING
                            )
                        `)

                        // -- Relationship Tables --

                        await conn.query(`CREATE REL TABLE IF NOT EXISTS HAS_SOURCE(FROM Capsule TO CapsuleSource)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS IMPLEMENTS_SPINE(FROM Capsule TO SpineContract)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS HAS_PROPERTY_CONTRACT(FROM SpineContract TO PropertyContract)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS HAS_PROPERTY(FROM PropertyContract TO CapsuleProperty)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS MAPS_TO(FROM CapsuleProperty TO Capsule)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS EXTENDS(FROM Capsule TO Capsule)`)
                        await conn.query(`CREATE REL TABLE IF NOT EXISTS DELEGATES_TO(FROM CapsuleProperty TO PropertyContract)`)

                        if (this.verbose) console.log('[cst-v1] Schema created.')
                    }
                },

                // =============================================================
                // Database Lifecycle
                // =============================================================

                createDatabase: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, options?: { path?: string }): Promise<any> {
                        const dbPath = options?.path ?? ':memory:'
                        if (this.verbose) console.log(`[cst-v1] Creating database: ${dbPath}`)
                        const db = new lbug.Database(dbPath, 0, true, false)
                        await db.init()
                        return db
                    }
                },

                createConnection: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, database: any): Promise<any> {
                        if (this.verbose) console.log('[cst-v1] Creating connection')
                        const conn = new lbug.Connection(database)
                        await conn.init()
                        return conn
                    }
                },

                queryAll: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any, statement: string): Promise<any[]> {
                        if (this.verbose) console.log(`[cst-v1] QueryAll: ${statement}`)
                        const result = await conn.query(statement)
                        if (Array.isArray(result)) {
                            const allResults = []
                            for (const r of result) {
                                allResults.push(await r.getAll())
                            }
                            return allResults
                        }
                        return await result.getAll()
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/LadybugGraph',
    })
}
