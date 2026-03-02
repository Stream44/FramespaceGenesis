import { run } from '@stream44.studio/t44/standalone-rt'
import { join, dirname } from 'path'
import { existsSync, writeFileSync, readdirSync, readFileSync } from 'fs'
import { spawnSync } from 'child_process'

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
                // Mappings
                // =============================================================

                modelEngines: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../L4-space-models/Capsular/ModelEngines',
                },

                // =============================================================
                // Config
                // =============================================================

                _server: {
                    type: CapsulePropertyTypes.Literal,
                    value: null as any,
                },

                _engineCache: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, any>(),
                },

                _engineErrors: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, string>(),
                },

                _engineLoading: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, Promise<any>>(),
                },

                _engineTestResults: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, { passed: boolean; error?: string }>(),
                },

                _engineTestRunning: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, Promise<string | null>>(),
                },

                _methods: {
                    type: CapsulePropertyTypes.Literal,
                    value: [] as any[],
                },

                _methodMap: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, any>(),
                },

                _apiMeta: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, { description: string; basePath: string }>(),
                },

                _fallbackMap: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, string>(),
                },

                _discoveredApis: {
                    type: CapsulePropertyTypes.Literal,
                    value: [] as { key: string; relativePath: string }[],
                },

                _discoveredEngines: {
                    type: CapsulePropertyTypes.Literal,
                    value: [] as string[],
                },

                _defaultEngine: {
                    type: CapsulePropertyTypes.Literal,
                    value: null as string | null,
                },

                _modelTests: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, string>(),
                },

                // =============================================================
                // Path helpers
                // =============================================================

                _getPackageRoot: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        const moduleFilepath = this['#@stream44.studio/encapsulate/structs/Capsule'].rootCapsule.moduleFilepath
                        return join(dirname(moduleFilepath), '..')
                    }
                },

                _getModelsDir: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return join(this._getPackageRoot(), 'models')
                    }
                },

                _getGeneratedDataDir: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        return join(this._getModelsDir(), '.cst-data')
                    }
                },

                _getSchemaPath: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        const moduleFilepath = this['#@stream44.studio/encapsulate/structs/Capsule'].rootCapsule.moduleFilepath
                        return join(dirname(moduleFilepath), '_schema.json')
                    }
                },

                // =============================================================
                // Discovery
                // =============================================================

                _discoverApiModules: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): { key: string; relativePath: string }[] {
                        const MODELS_DIR = this._getModelsDir()
                        const apis: { key: string; relativePath: string }[] = []
                        function scan(dir: string, parts: string[]) {
                            try {
                                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                                    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'examples') continue
                                    if (entry.isDirectory()) {
                                        scan(join(dir, entry.name), [...parts, entry.name])
                                    } else if (entry.name === 'API.ts' && parts.length >= 2) {
                                        const key = parts.join('/')
                                        const relPath = '../models/' + key + '/API'
                                        apis.push({ key, relativePath: relPath })
                                    }
                                }
                            } catch { /* skip unreadable dirs */ }
                        }
                        scan(MODELS_DIR, [])
                        return apis.sort((a, b) => a.key.localeCompare(b.key))
                    }
                },

                _loadEngineConfig: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): Record<string, { enabled: boolean }> {
                        const FRAMESPACE_YAML_PATH = join(this._getPackageRoot(), 'framespace.YAML')
                        const config: Record<string, { enabled: boolean }> = {}
                        try {
                            if (!existsSync(FRAMESPACE_YAML_PATH)) return config
                            const text = readFileSync(FRAMESPACE_YAML_PATH, 'utf-8')
                            let inEngines = false
                            let currentEngine: string | null = null
                            for (const line of text.split('\n')) {
                                const trimmed = line.trimEnd()
                                if (trimmed === 'engines:') { inEngines = true; continue }
                                if (inEngines && /^\S/.test(trimmed)) break
                                if (!inEngines) continue
                                const engineMatch = trimmed.match(/^  ([A-Za-z0-9_-]+):$/)
                                if (engineMatch) { currentEngine = engineMatch[1]; config[currentEngine] = { enabled: true }; continue }
                                if (currentEngine) {
                                    const propMatch = trimmed.match(/^\s+enabled:\s*(true|false)\s*$/)
                                    if (propMatch) config[currentEngine].enabled = propMatch[1] === 'true'
                                }
                            }
                        } catch { /* skip */ }
                        return config
                    }
                },

                _discoverModelTests: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): Map<string, string> {
                        const MODELS_DIR = this._getModelsDir()
                        const tests = new Map<string, string>()
                        for (const api of this._discoveredApis) {
                            const testPath = join(MODELS_DIR, api.key, 'run-model.test.ts')
                            if (existsSync(testPath)) tests.set(api.key, testPath)
                        }
                        return tests
                    }
                },

                // =============================================================
                // Engine loading
                // =============================================================

                _ensureModelTestsForEngine: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, engineName: string): Promise<string | null> {
                        const PACKAGE_ROOT = this._getPackageRoot()
                        const cached = this._engineTestResults.get(engineName)
                        if (cached) return cached.passed ? null : (cached.error ?? `Model tests failed for engine ${engineName}`)

                        const running = this._engineTestRunning.get(engineName)
                        if (running) return running

                        const promise = (async (): Promise<string | null> => {
                            for (const [model, testPath] of this._modelTests) {
                                console.log(`🧪 Running model tests for engine '${engineName}': ${model}...`)
                                const result = spawnSync('bun', ['test', testPath], {
                                    cwd: PACKAGE_ROOT,
                                    env: { ...process.env, FRAMESPACE_ENGINE_NAME: engineName.split('/engines/').pop()?.replace(/\/ImportAPI$/, '') ?? engineName },
                                    stdio: 'inherit',
                                    timeout: 120_000,
                                })

                                if (result.status !== 0) {
                                    const errorMsg = `Model test failed for ${model} with engine '${engineName}' (exit code ${result.status})`
                                    console.error(`❌ ${errorMsg}`)
                                    this._engineTestResults.set(engineName, { passed: false, error: errorMsg })
                                    this._engineTestRunning.delete(engineName)
                                    return errorMsg
                                }
                                console.log(`✅ Model tests passed for engine '${engineName}': ${model}`)
                            }
                            this._engineTestResults.set(engineName, { passed: true })
                            this._engineTestRunning.delete(engineName)
                            return null
                        })()

                        this._engineTestRunning.set(engineName, promise)
                        return promise
                    }
                },

                _loadEngineImporter: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, engineName: string): Promise<any> {
                        const importer = this.modelEngines[engineName]
                        if (!importer) throw new Error(`Unknown engine: ${engineName}. Available: ${this._discoveredEngines.join(', ')}`)

                        const GENERATED_DATA = this._getGeneratedDataDir()

                        console.log(`⏳ Loading engine: ${engineName}...`)
                        await importer.ensureSchema()

                        // Import all SIT data from .cst-data using SIT-based import
                        let totalImported = 0
                        let totalSits = 0
                        if (existsSync(GENERATED_DATA)) {
                            const result = await importer.importSitDirectory(GENERATED_DATA)
                            totalImported = result.imported
                            totalSits = result.sits
                            if (totalImported > 0) await importer.linkMappings()
                        }

                        console.log(`✅ Engine ${engineName}: ${totalImported} capsules from ${totalSits} SIT files`)
                        return importer
                    }
                },

                _getEngine: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, engineName: string): Promise<any> {
                        const testError = await this._ensureModelTestsForEngine(engineName)
                        if (testError) {
                            this._engineErrors.set(engineName, testError)
                            throw Object.assign(new Error(testError), {
                                '#': 'ModelTestError',
                                engine: engineName,
                            })
                        }

                        const cached = this._engineCache.get(engineName)
                        if (cached) return cached

                        let loading = this._engineLoading.get(engineName)
                        if (!loading) {
                            loading = this._loadEngineImporter(engineName).then((importer: any) => {
                                this._engineCache.set(engineName, importer)
                                this._engineErrors.delete(engineName)
                                this._engineLoading.delete(engineName)
                                return importer
                            }).catch((err: any) => {
                                this._engineErrors.set(engineName, err.message ?? String(err))
                                this._engineLoading.delete(engineName)
                                throw err
                            })
                            this._engineLoading.set(engineName, loading)
                        }
                        return loading
                    }
                },

                // =============================================================
                // Schema building
                // =============================================================

                _buildSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        const endpoints: Record<string, any> = {}
                        for (const m of this._methods) {
                            const path = `/api/${m.namespace}/${m.name}`
                            endpoints[path] = {
                                method: "GET or POST",
                                namespace: m.namespace,
                                description: m.schema.description,
                                args: m.schema.args,
                                ...(m.needsGraph ? { engineParam: true } : {}),
                                ...(m.schema.discovery ? { discovery: `/api/${m.schema.discovery.includes('/') ? m.schema.discovery : `${m.namespace}/${m.schema.discovery}`}` } : {}),
                                ...(m.schema.filterField ? { filterField: m.schema.filterField } : {}),
                                usage: {
                                    GET: path + (m.schema.args.length > 0
                                        ? '?' + m.schema.args.map((a: any) => `${a.name}=<${a.type}>`).join('&')
                                        : ''),
                                    POST: { body: { args: m.schema.args.map((a: any) => `<${a.type}>`) } },
                                },
                            }
                        }
                        const apis: Record<string, { description: string; basePath: string }> = {}
                        for (const [ns, meta] of this._apiMeta) {
                            apis[ns] = meta
                        }
                        return {
                            openapi: "3.0.0",
                            info: { title: "Framespace API", version: "0.1.0" },
                            apis,
                            engines: this._discoveredEngines,
                            defaultEngine: this._defaultEngine,
                            endpoints,
                        }
                    }
                },

                // =============================================================
                // Method invocation
                // =============================================================

                _invokeMethod: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, method: any, args: any[], engineName: string | null): Promise<any> {
                        if (method.needsGraph) {
                            const eName = engineName ?? this._defaultEngine
                            if (!eName) throw new Error(`No engine specified and no default engine available`)
                            const graph = await this._getEngine(eName)
                            return method.capsule[method.name](graph, ...args)
                        }
                        return method.capsule[method.name](...args)
                    }
                },

                // =============================================================
                // Initialization
                // =============================================================

                init: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<void> {
                        const PACKAGE_ROOT = this._getPackageRoot()
                        const FRAMESPACE_YAML_PATH = join(PACKAGE_ROOT, 'framespace.YAML')

                        // Discover APIs and engines
                        this._discoveredApis = this._discoverApiModules()
                        const allEngineNames: string[] = this.modelEngines.getEngineNames()
                        const engineConfig = this._loadEngineConfig()

                        // Filter engines
                        const onlyEngineUri = this.engineUri
                        this._discoveredEngines = allEngineNames.filter((engineName: string) => {
                            if (onlyEngineUri && engineName !== onlyEngineUri) {
                                console.log(`⚠️  Engine ${engineName} skipped (engineUri=${onlyEngineUri})`)
                                return false
                            }
                            const shortName = engineName.split('/engines/').pop()?.replace(/\/ImportAPI$/, '') ?? engineName
                            const cfg = engineConfig[shortName]
                            if (cfg && !cfg.enabled) {
                                console.log(`⚠️  Engine ${engineName} disabled in ${FRAMESPACE_YAML_PATH}`)
                                return false
                            }
                            return true
                        })

                        console.log(`🔍 Discovered ${this._discoveredApis.length} API modules:`, this._discoveredApis.map((a: any) => a.key))
                        console.log(`🔍 Discovered ${this._discoveredEngines.length} engines:`, this._discoveredEngines)

                        // Load API capsules
                        const capsuleApis = await run(async ({ encapsulate: enc, CapsulePropertyTypes: CPT, makeImportStack: mis }: any) => {
                            const mappings: Record<string, any> = {}
                            for (const api of this._discoveredApis) {
                                mappings[api.key] = { type: CPT.Mapping, value: api.relativePath }
                            }

                            const spine = await enc({
                                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                                    '#': mappings,
                                }
                            }, {
                                importMeta: import.meta,
                                importStack: mis(),
                                capsuleName: '@stream44.studio/FramespaceGenesis/L3-model-server/ModelServer/api-loader',
                            })
                            return { spine }
                        }, async ({ spine, apis }: any) => {
                            return apis[spine.capsuleSourceLineRef]
                        }, {
                            importMeta: import.meta,
                            runFromSnapshot: false,
                        })

                        // Discover model tests
                        this._modelTests = this._discoverModelTests()

                        console.log(`📂 PACKAGE_ROOT: ${PACKAGE_ROOT}`)

                        // Build API method registry from capsule apiSchema properties
                        for (const [nsKey, cap] of Object.entries(capsuleApis) as [string, any][]) {
                            const schema = cap.apiSchema
                            if (!schema?.namespace || !schema?.methods) continue
                            if (schema.description || schema.basePath) {
                                this._apiMeta.set(schema.namespace, { description: schema.description ?? '', basePath: schema.basePath ?? `/api/${schema.namespace}` })
                            }
                            for (const [name, methodSchema] of Object.entries(schema.methods) as [string, any][]) {
                                if (typeof cap[name] !== 'function') continue
                                const needsGraph = !!methodSchema.graphMethod
                                const entry = {
                                    name,
                                    namespace: schema.namespace,
                                    schema: methodSchema,
                                    capsule: cap,
                                    needsGraph,
                                }
                                this._methods.push(entry)
                                this._methodMap.set(`${schema.namespace}/${name}`, entry)
                            }
                        }

                        // Build discovery fallback map
                        for (const m of this._methods) {
                            if (m.schema.discovery) {
                                const target = m.schema.discovery.includes('/') ? m.schema.discovery : `${m.namespace}/${m.schema.discovery}`
                                this._fallbackMap.set(`${m.namespace}/${m.name}`, target)
                            }
                        }

                        // Default engine
                        this._defaultEngine = this._discoveredEngines[0] ?? null

                        // Write schema to file
                        const schema = this._buildSchema()
                        const schemaPath = this._getSchemaPath()
                        writeFileSync(schemaPath, JSON.stringify(schema, null, 4))
                        console.log(`📄 Schema written to ${schemaPath}`)
                    }
                },

                // =============================================================
                // Server lifecycle
                // =============================================================

                startServer: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, port?: number): Promise<{ server: any; port: number }> {
                        const actualPort = port ?? Number(process.env.PORT || 4000)

                        await this.init()

                        const self = this
                        const _corsHeaders = {
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type",
                        }
                        const _json = (data: any, init?: any) => {
                            return Response.json(data, {
                                ...init,
                                headers: { ..._corsHeaders, ...(init?.headers ?? {}) },
                            })
                        }

                        const bunServe = require('bun').serve
                        const server = bunServe({
                            port: actualPort,
                            async fetch(req: any) {
                                const url = new URL(req.url)

                                if (req.method === "OPTIONS") {
                                    return new Response(null, { status: 204, headers: _corsHeaders })
                                }

                                if (url.pathname === "/api/health") {
                                    return _json({
                                        status: "ok",
                                        timestamp: new Date().toISOString(),
                                        methods: self._methods.length,
                                        engines: self._discoveredEngines,
                                        loadedEngines: [...self._engineCache.keys()],
                                    })
                                }

                                if (url.pathname === "/api/schema") {
                                    return _json(self._buildSchema())
                                }

                                if (url.pathname === "/api/engines") {
                                    const status: any = {}
                                    for (const engineName of self._discoveredEngines) {
                                        if (self._engineCache.has(engineName)) status[engineName] = { status: 'loaded' }
                                        else if (self._engineErrors.has(engineName)) status[engineName] = { status: 'error', error: self._engineErrors.get(engineName) }
                                        else if (self._engineLoading.has(engineName)) status[engineName] = { status: 'loading' }
                                        else status[engineName] = { status: 'idle' }
                                    }
                                    return _json({
                                        engines: self._discoveredEngines,
                                        defaultEngine: self._defaultEngine,
                                        status,
                                    })
                                }

                                // Dynamic method dispatch: /api/<namespace...>/<methodName>
                                const match = url.pathname.match(/^\/api\/(.+)\/([a-zA-Z_]+)$/)
                                if (match) {
                                    const [, ns, methodName] = match
                                    const method = self._methodMap.get(`${ns}/${methodName}`)
                                    if (!method) return _json({ error: `Unknown method: ${ns}/${methodName}` }, { status: 404 })

                                    let args: any[] = []
                                    let engineName: any = null
                                    try {
                                        const argDefs = method.schema.args

                                        if (req.method === "POST") {
                                            const body = await req.json()
                                            args = body.args ?? []
                                            engineName = body.engine ?? null
                                        } else {
                                            engineName = url.searchParams.get('engine')
                                            const params = url.searchParams
                                            if (params.has('0')) {
                                                for (let i = 0; params.has(String(i)); i++) args.push(params.get(String(i))!)
                                            } else {
                                                for (const def of argDefs) {
                                                    const val = params.get(def.name)
                                                    if (val != null) args.push(val)
                                                    else if (def.optional) args.push(undefined)
                                                    else break
                                                }
                                            }
                                        }

                                        // Coerce types based on schema
                                        args = args.map((a: any, i: any) => {
                                            const def = argDefs[i]
                                            if (def?.type === 'number' && typeof a === 'string') return Number(a)
                                            if (def?.type === 'boolean' && typeof a === 'string') return a === 'true'
                                            return a
                                        })

                                        // Discovery fallback: if required args missing, redirect to discovery method
                                        const key = `${ns}/${methodName}`
                                        const hasRequiredArgs = argDefs.some((d: any) => !d.optional)
                                        if (args.length === 0 && hasRequiredArgs && self._fallbackMap.has(key)) {
                                            const fb = self._methodMap.get(self._fallbackMap.get(key))
                                            const fbResult = await self._invokeMethod(fb, [], engineName)
                                            return _json({ method: fb.name, namespace: fb.namespace, result: fbResult, fallbackFrom: methodName })
                                        }

                                        const result = await self._invokeMethod(method, args, engineName)
                                        return _json({ method: methodName, namespace: method.namespace, result })
                                    } catch (err: any) {
                                        const message = err.message ?? String(err)
                                        const stack = err.stack ?? ''
                                        const isModelTestError = err['#'] === 'ModelTestError'
                                        console.error(`❌ ${ns}/${methodName}`, `URI: ${url.pathname}${url.search}`, `args: ${JSON.stringify(args)}`, stack || message)
                                        return _json({
                                            method: methodName,
                                            namespace: ns,
                                            result: {
                                                '#': isModelTestError ? 'ModelTestError' : 'Error',
                                                method: `${ns}/${methodName}`,
                                                message,
                                                ...(isModelTestError ? { model: err.model, output: err.output } : { stack }),
                                            },
                                        })
                                    }
                                }

                                return _json({ error: "Not Found" }, { status: 404 })
                            },
                        })

                        this._server = server

                        console.log(`🚀 API server running on http://localhost:${actualPort}`)
                        console.log(`📋 ${this._methods.length} methods available — GET /api/schema for full list`)
                        console.log(`🔧 ${this._discoveredEngines.length} engines available: ${this._discoveredEngines.join(', ')}`)

                        return { server, port: actualPort }
                    }
                },

                stop: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): void {
                        if (this._server) {
                            this._server.stop()
                            this._server = null
                        }
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L3-model-server/ModelServer',
    })
}
