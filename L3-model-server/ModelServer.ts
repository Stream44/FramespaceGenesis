import { run } from '@stream44.studio/t44/standalone-rt'
import { join, dirname } from 'path'
import { readdir, stat } from 'fs/promises'
import { writeFile } from 'fs/promises'

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

                spineInstanceTrees: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../L4-space-models/Capsular/SpineInstanceTrees',
                },

                // =============================================================
                // State
                // =============================================================

                _server: {
                    type: CapsulePropertyTypes.Literal,
                    value: null as any,
                },

                _models: {
                    type: CapsulePropertyTypes.Literal,
                    value: [] as { modelUri: string; mountKey: string; engineUri: string; capsule: any; engine: any; schema: any }[],
                },

                _methods: {
                    type: CapsulePropertyTypes.Literal,
                    value: [] as any[],
                },

                _methodMap: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, any>(),
                },

                _fallbackMap: {
                    type: CapsulePropertyTypes.Literal,
                    value: new Map<string, string>(),
                },

                _api: {
                    type: CapsulePropertyTypes.Literal,
                    value: null as any,
                },

                api: {
                    type: CapsulePropertyTypes.GetterFunction,
                    value: function (this: any): Record<string, any> {
                        return this._api
                    }
                },

                // =============================================================
                // Initialization
                // =============================================================

                init: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<void> {
                        const self = this
                        this._api = {}
                        const models: Record<string, { engine: Record<string, any> }> = this.models ?? {}
                        const modelUris = Object.keys(models)
                        if (modelUris.length === 0) { console.warn('⚠️  No models configured'); return }

                        // Load all semantic model capsules in one run() call
                        const loadedModels = await run(async ({ encapsulate: enc, CapsulePropertyTypes: CPT, makeImportStack: mis }: any) => {
                            const mappings: Record<string, any> = {}
                            for (const uri of modelUris) {
                                const mountKey = uri.replace(/\//g, '~')
                                mappings[mountKey] = { type: CPT.Mapping, value: uri }
                            }
                            const spine = await enc({
                                '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                                    '#@stream44.studio/encapsulate/structs/Capsule': {},
                                    '#': mappings,
                                }
                            }, {
                                importMeta: import.meta,
                                importStack: mis(),
                                capsuleName: '@stream44.studio/FramespaceGenesis/L3-model-server/ModelServer/semantic-model-loader',
                            })
                            return { spine }
                        }, async ({ spine, apis }: any) => {
                            return apis[spine.capsuleSourceLineRef]
                        }, {
                            importMeta: import.meta,
                            runFromSnapshot: false,
                        })

                        for (const [modelUri, modelConfig] of Object.entries(models)) {
                            const engineUri = Object.keys(modelConfig.engine)[0]
                            if (!engineUri) { console.warn(`⚠️  No engine declared for ${modelUri}`); continue }
                            const mountKey = modelUri.replace(/\//g, '~')
                            const modelCapsule = (loadedModels as any)[mountKey]
                            if (!modelCapsule) { console.warn(`⚠️  Failed to load semantic model: ${modelUri}`); continue }

                            console.log(`📦 Loaded semantic model: ${modelUri}`)

                            // Load engine
                            console.log(`⏳ Loading engine: ${engineUri}`)
                            const engine = this.modelEngines[engineUri]
                            if (!engine) throw new Error(`Unknown engine: ${engineUri}`)
                            await engine.ensureSchema()

                            // Generate data: discover and run example models
                            // Scan both the L4 engine examples and the semantic model's own examples
                            const modelServerDir = dirname(import.meta.path)
                            // Derive the semantic model's directory from its URI
                            // modelUri looks like '@stream44.studio/FramespaceGenesis/L8-view-models/...'
                            // We need the path relative to the package root: strip the @scope/package prefix
                            const modelUriParts = modelUri.split('/')
                            const modelRelPath = modelUriParts.slice(2).join('/') // drop @scope/package
                            const packageRoot = join(modelServerDir, '..')
                            const examplesDirs = [
                                join(modelServerDir, '..', 'L4-space-models', 'Capsular', 'examples'),
                                join(packageRoot, dirname(modelRelPath), 'examples'),
                                join(packageRoot, 'examples'),
                            ]
                            const capsuleModules: { MODEL_NAME: string; runModel: (ctx: { run: any }) => Promise<any> }[] = []
                            const seenModels = new Set<string>()
                            for (const examplesDir of examplesDirs) {
                                try {
                                    const exampleDirs = await readdir(examplesDir)
                                    for (const dir of exampleDirs) {
                                        if (dir.startsWith('.')) continue
                                        const dirPath = join(examplesDir, dir)
                                        const dirStat = await stat(dirPath)
                                        if (!dirStat.isDirectory()) continue
                                        const files = await readdir(dirPath)
                                        for (const file of files) {
                                            if (file.startsWith('.') || !file.endsWith('.ts') || file.endsWith('.test.ts')) continue
                                            try {
                                                const mod = await import(join(dirPath, file))
                                                if (mod.MODEL_NAME && typeof mod.runModel === 'function' && !seenModels.has(mod.MODEL_NAME)) {
                                                    seenModels.add(mod.MODEL_NAME)
                                                    capsuleModules.push({ MODEL_NAME: mod.MODEL_NAME, runModel: mod.runModel })
                                                }
                                            } catch { }
                                        }
                                    }
                                    // Also scan top-level .ts files in the examples dir (for flat example layouts)
                                    const topFiles = await readdir(examplesDir)
                                    for (const file of topFiles) {
                                        if (file.startsWith('.') || !file.endsWith('.ts') || file.endsWith('.test.ts')) continue
                                        const filePath = join(examplesDir, file)
                                        const fileStat = await stat(filePath)
                                        if (!fileStat.isFile()) continue
                                        try {
                                            const mod = await import(filePath)
                                            if (mod.MODEL_NAME && typeof mod.runModel === 'function' && !seenModels.has(mod.MODEL_NAME)) {
                                                seenModels.add(mod.MODEL_NAME)
                                                capsuleModules.push({ MODEL_NAME: mod.MODEL_NAME, runModel: mod.runModel })
                                            }
                                        } catch { }
                                    }
                                } catch { }
                            }

                            // Run examples and import into engine
                            for (const example of capsuleModules) {
                                await this.spineInstanceTrees.registerInstance({ name: example.MODEL_NAME }, example.runModel)
                                await this.spineInstanceTrees.importInstanceToEngine({ engine, name: example.MODEL_NAME })
                            }

                            console.log(`✅ Engine ${engineUri}: data loaded from ${capsuleModules.length} examples`)

                            // Read schema from the semantic model's apiSchema
                            const schema = modelCapsule.apiSchema
                            if (!schema?.namespace || !schema?.methods) {
                                console.warn(`⚠️  No apiSchema on ${modelUri}`)
                                continue
                            }

                            const namespace = schema.namespace
                            this._models.push({ modelUri, mountKey, engineUri, capsule: modelCapsule, engine, schema })

                            // Build direct API for this model
                            const modelApi: Record<string, any> = {}

                            // Register methods — engine is passed as `graph` first arg if method has tags (graph method)
                            for (const [name, methodSchema] of Object.entries(schema.methods) as [string, any][]) {
                                if (typeof modelCapsule[name] !== 'function') continue
                                const entry = {
                                    name,
                                    namespace,
                                    schema: methodSchema,
                                    capsule: modelCapsule,
                                    engine,
                                }
                                this._methods.push(entry)
                                this._methodMap.set(`${namespace}/${name}`, entry)
                                if (methodSchema.tags || methodSchema.graphMethod) {
                                    modelApi[name] = (...args: any[]) => modelCapsule[name]({ graph: engine, server: self }, ...args)
                                } else {
                                    modelApi[name] = (...args: any[]) => modelCapsule[name](...args)
                                }
                            }

                            this._api[namespace] = modelApi
                        }

                        // Build discovery fallback map
                        // Discovery can be top-level on the method schema or inside tags
                        for (const m of this._methods) {
                            let discovery = m.schema.discovery
                            if (!discovery && m.schema.tags) {
                                for (const tagData of Object.values(m.schema.tags) as any[]) {
                                    if (tagData?.discovery) { discovery = tagData.discovery; break }
                                }
                            }
                            if (discovery) {
                                const target = discovery.includes('/') ? discovery : `${m.namespace}/${discovery}`
                                this._fallbackMap.set(`${m.namespace}/${m.name}`, target)
                            }
                        }

                        console.log(`📋 ${this._methods.length} methods registered from ${this._models.length} semantic models`)

                        if (this.writeApiSchema) {
                            const schema = this._buildSchema()
                            const modelServerDir = dirname(import.meta.path)
                            const schemaPath = join(modelServerDir, '_schema.json')
                            await writeFile(schemaPath, JSON.stringify(schema, null, 4))
                            console.log(`📝 Schema written to ${schemaPath}`)
                        }
                    }
                },

                _buildSchema: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): any {
                        const endpoints: Record<string, any> = {}
                        const apis: Record<string, any> = {}
                        const engineNames = [...new Set(this._models.map((m: any) => m.engineUri))]
                        for (const m of this._models) {
                            const ns = m.schema.namespace
                            apis[ns] = { description: m.schema.description, basePath: m.schema.basePath }
                            for (const [name, methodSchema] of Object.entries(m.schema.methods) as [string, any][]) {
                                const path = `${m.schema.basePath}/${name}`
                                const hasGraph = !!(methodSchema.tags || methodSchema.graphMethod)
                                const endpoint: any = {
                                    method: 'GET or POST',
                                    namespace: ns,
                                    description: methodSchema.description ?? '',
                                    args: methodSchema.args ?? [],
                                }
                                if (hasGraph) endpoint.engineParam = true

                                // Extract discovery and filterField from tags
                                let discovery: string | undefined
                                let filterField: string | undefined
                                if (methodSchema.tags) {
                                    for (const tagData of Object.values(methodSchema.tags) as any[]) {
                                        if (tagData?.discovery) discovery = tagData.discovery
                                        if (tagData?.filterField) filterField = tagData.filterField
                                    }
                                }
                                if (methodSchema.discovery) discovery = methodSchema.discovery
                                if (methodSchema.filterField) filterField = methodSchema.filterField
                                if (discovery) endpoint.discovery = discovery.includes('/') ? `/api/${discovery}` : `${m.schema.basePath}/${discovery}`
                                if (filterField) endpoint.filterField = filterField
                                if (methodSchema.tags) endpoint.tags = methodSchema.tags

                                // Build usage examples
                                const argDefs = methodSchema.args ?? []
                                const getParams = argDefs.map((a: any) => `${a.name}=<${a.type}>`).join('&')
                                endpoint.usage = {
                                    GET: getParams ? `${path}?${getParams}` : path,
                                    POST: { body: { args: argDefs.map((a: any) => `<${a.type}>`) } },
                                }

                                endpoints[path] = endpoint
                            }
                        }
                        return {
                            openapi: '3.0.0',
                            info: { title: 'Framespace Genesis API', version: '1.0.0' },
                            apis,
                            engines: engineNames,
                            defaultEngine: engineNames[0] ?? null,
                            endpoints,
                        }
                    }
                },

                // =============================================================
                // Server lifecycle
                // =============================================================

                startServer: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, port?: number, opts?: { skipInit?: boolean }): Promise<{ server: any; port: number }> {
                        const actualPort = port ?? Number(process.env.MODEL_SERVER_PORT || 4000)

                        if (!opts?.skipInit) await this.init()

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
                                        models: self._models.map((m: any) => ({ modelUri: m.modelUri, engineUri: m.engineUri, namespace: m.schema.namespace })),
                                        methods: self._methods.length,
                                    })
                                }

                                if (url.pathname === "/api/schema") {
                                    return _json(self._buildSchema())
                                }

                                // Dynamic method dispatch: /api/<namespace...>/<methodName>
                                const match = url.pathname.match(/^\/api\/(.+)\/([a-zA-Z_][a-zA-Z0-9_]*)$/)
                                if (match) {
                                    const [, ns, methodName] = match
                                    const method = self._methodMap.get(`${ns}/${methodName}`)
                                    if (!method) return _json({ error: `Unknown method: ${ns}/${methodName}` }, { status: 404 })

                                    let args: any[] = []
                                    try {
                                        const argDefs = method.schema.args

                                        if (req.method === "POST") {
                                            const body = await req.json()
                                            args = body.args ?? []
                                        } else {
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
                                            if (fb) {
                                                // Build args for the fallback method from query params
                                                const fbArgDefs = fb.schema.args ?? []
                                                const fbArgs: any[] = []
                                                for (const def of fbArgDefs) {
                                                    const val = url.searchParams.get(def.name)
                                                    if (val != null) fbArgs.push(val)
                                                    else if (def.optional) fbArgs.push(undefined)
                                                    else break
                                                }
                                                const result = (fb.schema.tags || fb.schema.graphMethod)
                                                    ? await fb.capsule[fb.name]({ graph: fb.engine, server: self }, ...fbArgs)
                                                    : await fb.capsule[fb.name](...fbArgs)
                                                return _json({ method: fb.name, namespace: fb.namespace, result, fallbackFrom: methodName })
                                            }
                                        }

                                        const result = (method.schema.tags || method.schema.graphMethod)
                                            ? await method.capsule[method.name]({ graph: method.engine, server: self }, ...args)
                                            : await method.capsule[method.name](...args)
                                        return _json({ method: methodName, namespace: method.namespace, result })
                                    } catch (err: any) {
                                        const message = err.message ?? String(err)
                                        const stack = err.stack ?? ''
                                        console.error(`❌ ${ns}/${methodName}`, `URI: ${url.pathname}${url.search}`, `args: ${JSON.stringify(args)}`, stack || message)
                                        return _json({
                                            method: methodName,
                                            namespace: ns,
                                            result: { '#': 'Error', method: `${ns}/${methodName}`, message, stack },
                                        })
                                    }
                                }

                                return _json({ error: "Not Found" }, { status: 404 })
                            },
                        })

                        this._server = server

                        console.log(`🚀 API server running on http://localhost:${actualPort}`)
                        console.log(`📋 ${this._methods.length} methods available`)

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
