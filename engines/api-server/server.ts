import { serve } from "bun"
import { run } from 't44/standalone-rt'
import { join } from 'path'
import { existsSync, writeFileSync, readdirSync, readFileSync } from 'fs'
import { spawnSync } from 'child_process'

// ── CORS helper ──────────────────────────────────────────────────────
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

function json(data: unknown, init?: ResponseInit) {
    return Response.json(data, {
        ...init,
        headers: { ...corsHeaders, ...(init?.headers ?? {}) },
    })
}

// ── Auto-discover model API capsules ─────────────────────────────────
const port = Number(process.env.PORT || 4000)
const PACKAGE_ROOT = join(import.meta.dir, '..', '..')
const MODELS_DIR = join(PACKAGE_ROOT, 'models')
const ENGINES_DIR = join(PACKAGE_ROOT, 'engines')
const GENERATED_DATA = join(PACKAGE_ROOT, 'models', '.cst-data')

// Scan models/ for API.ts files at any depth (e.g. models/Encapsulate/CapsuleSpine/API.ts)
// The directory path relative to models/ becomes the mapping key (e.g. 'Encapsulate/CapsuleSpine')
function discoverApiModules(): { key: string; relativePath: string }[] {
    const apis: { key: string; relativePath: string }[] = []
    function scan(dir: string, parts: string[]) {
        try {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'examples') continue
                if (entry.isDirectory()) {
                    scan(join(dir, entry.name), [...parts, entry.name])
                } else if (entry.name === 'API.ts' && parts.length >= 2) {
                    const key = parts.join('/')
                    // Relative path from server.ts to the API file
                    const relPath = '../../models/' + key + '/API'
                    apis.push({ key, relativePath: relPath })
                }
            }
        } catch { /* skip unreadable dirs */ }
    }
    scan(MODELS_DIR, [])
    return apis.sort((a, b) => a.key.localeCompare(b.key))
}

// Discover available engines from engines/ directory
function discoverEngines(): { name: string; importerRelPath: string }[] {
    const engines: { name: string; importerRelPath: string }[] = []
    try {
        for (const entry of readdirSync(ENGINES_DIR, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) continue
            const importerPath = join(ENGINES_DIR, entry.name, 'ImportCapsuleSourceTrees.ts')
            if (existsSync(importerPath)) {
                engines.push({
                    name: entry.name,
                    importerRelPath: `../${entry.name}/ImportCapsuleSourceTrees`,
                })
            }
        }
    } catch { /* skip */ }
    return engines.sort((a, b) => a.name.localeCompare(b.name))
}

// ── Load framespace.YAML engine config ───────────────────────────────
const FRAMESPACE_YAML_PATH = join(PACKAGE_ROOT, 'framespace.YAML')

function loadEngineConfig(): Record<string, { enabled: boolean }> {
    const config: Record<string, { enabled: boolean }> = {}
    try {
        if (!existsSync(FRAMESPACE_YAML_PATH)) return config
        const text = readFileSync(FRAMESPACE_YAML_PATH, 'utf-8')
        // Simple YAML parser for flat engine config
        let inEngines = false
        let currentEngine: string | null = null
        for (const line of text.split('\n')) {
            const trimmed = line.trimEnd()
            if (trimmed === 'engines:') { inEngines = true; continue }
            if (inEngines && /^\S/.test(trimmed)) break // new top-level key
            if (!inEngines) continue
            // Engine name line: "  EngineName:"
            const engineMatch = trimmed.match(/^  ([A-Za-z0-9_-]+):$/)
            if (engineMatch) { currentEngine = engineMatch[1]; config[currentEngine] = { enabled: true }; continue }
            // Property line: "    enabled: true/false"
            if (currentEngine) {
                const propMatch = trimmed.match(/^\s+enabled:\s*(true|false)\s*$/)
                if (propMatch) config[currentEngine].enabled = propMatch[1] === 'true'
            }
        }
    } catch { /* skip */ }
    return config
}

const engineConfig = loadEngineConfig()

const discoveredApis = discoverApiModules()
const allDiscoveredEngines = discoverEngines()

// Filter engines by FRAMESPACE_ENGINE_NAME env var and framespace.YAML enabled config
const onlyEngineName = process.env.FRAMESPACE_ENGINE_NAME
const discoveredEngines = allDiscoveredEngines.filter(e => {
    if (onlyEngineName && e.name !== onlyEngineName) {
        console.log(`⚠️  Engine ${e.name} skipped (FRAMESPACE_ENGINE_NAME=${onlyEngineName})`)
        return false
    }
    const cfg = engineConfig[e.name]
    if (cfg && !cfg.enabled) {
        console.log(`⚠️  Engine ${e.name} disabled in ${FRAMESPACE_YAML_PATH}`)
        return false
    }
    return true
})

console.log(`🔍 Discovered ${discoveredApis.length} API modules:`, discoveredApis.map(a => a.key))
console.log(`🔍 Discovered ${discoveredEngines.length} engines:`, discoveredEngines.map(e => e.name))

// ── Load API capsules (no engine importer at startup) ────────────────
const capsuleApis = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const mappings: Record<string, any> = {}
    for (const api of discoveredApis) {
        mappings[api.key] = { type: CapsulePropertyTypes.Mapping, value: api.relativePath }
    }

    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': mappings,
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/engines/api-server/server',
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    const resolved = apis[spine.capsuleSourceLineRef]
    return resolved
}, {
    importMeta: import.meta,
    runFromSnapshot: false,
})

// ── Model test gate (shared, runs once) ──────────────────────────────
// Discover run-model.test.ts files alongside API modules.
// Tests run once before the first engine loads data.
function discoverModelTests(): Map<string, string> {
    const tests = new Map<string, string>()
    for (const api of discoveredApis) {
        const testPath = join(MODELS_DIR, api.key, 'run-model.test.ts')
        if (existsSync(testPath)) tests.set(api.key, testPath)
    }
    return tests
}

const modelTests = discoverModelTests()
const engineTestResults = new Map<string, { passed: boolean; error?: string }>()
const engineTestRunning = new Map<string, Promise<string | null>>()

/**
 * Run model tests for a specific engine via `bun test` subprocess.
 * Sets FRAMESPACE_ENGINE_NAME so only that engine's tests run.
 * Deduplicates concurrent requests for the same engine.
 * Returns an error string if any test failed, null if all passed.
 */
async function ensureModelTestsForEngine(engineName: string): Promise<string | null> {
    // Check cache
    const cached = engineTestResults.get(engineName)
    if (cached) return cached.passed ? null : (cached.error ?? `Model tests failed for engine ${engineName}`)

    // Deduplicate concurrent calls for the same engine
    const running = engineTestRunning.get(engineName)
    if (running) return running

    const promise = (async (): Promise<string | null> => {
        for (const [model, testPath] of modelTests) {
            console.log(`🧪 Running model tests for engine '${engineName}': ${model}...`)
            const result = spawnSync('bun', ['test', testPath], {
                cwd: PACKAGE_ROOT,
                env: { ...process.env, FRAMESPACE_ENGINE_NAME: engineName },
                stdio: 'inherit',
                timeout: 120_000,
            })

            if (result.status !== 0) {
                const errorMsg = `Model test failed for ${model} with engine '${engineName}' (exit code ${result.status})`
                console.error(`❌ ${errorMsg}`)
                engineTestResults.set(engineName, { passed: false, error: errorMsg })
                engineTestRunning.delete(engineName)
                return errorMsg
            }
            console.log(`✅ Model tests passed for engine '${engineName}': ${model}`)
        }
        engineTestResults.set(engineName, { passed: true })
        engineTestRunning.delete(engineName)
        return null
    })()

    engineTestRunning.set(engineName, promise)
    return promise
}

// ── Lazy engine cache ────────────────────────────────────────────────
// Each engine importer is loaded + data imported on first request.
const engineCache = new Map<string, any>()
const engineErrors = new Map<string, string>()
const engineLoading = new Map<string, Promise<any>>()

async function loadEngineImporter(engineName: string): Promise<any> {
    const engineDef = discoveredEngines.find(e => e.name === engineName)
    if (!engineDef) throw new Error(`Unknown engine: ${engineName}. Available: ${discoveredEngines.map(e => e.name).join(', ')}`)

    console.log(`⏳ Loading engine: ${engineName}...`)
    const engineApis = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
        const spine = await encapsulate({
            '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
                '#@stream44.studio/encapsulate/structs/Capsule': {},
                '#': {
                    importer: { type: CapsulePropertyTypes.Mapping, value: engineDef.importerRelPath },
                },
            }
        }, {
            importMeta: import.meta,
            importStack: makeImportStack(),
            capsuleName: `@stream44.studio/FramespaceGenesis/engines/api-server/engine-loader/${engineName}`,
        })
        return { spine }
    }, async ({ spine, apis }: any) => {
        return apis[spine.capsuleSourceLineRef]
    }, {
        importMeta: import.meta,
        runFromSnapshot: false,
    })

    const importer = engineApis.importer
    await importer.ensureSchema()

    // Import all CST data from .cst-data
    let totalImported = 0
    let totalInstances = 0
    if (existsSync(GENERATED_DATA)) {
        for (const l1 of readdirSync(GENERATED_DATA, { withFileTypes: true })) {
            if (!l1.isDirectory() || l1.name.startsWith('.')) continue
            for (const l2 of readdirSync(join(GENERATED_DATA, l1.name), { withFileTypes: true })) {
                if (!l2.isDirectory() || l2.name.startsWith('.')) continue
                const modelDir = join(GENERATED_DATA, l1.name, l2.name)
                const manifestPath = join(modelDir, 'manifest.json')
                const cstCache = join(modelDir, '.~o', 'encapsulate.dev', 'static-analysis')
                if (!existsSync(manifestPath) || !existsSync(cstCache)) continue

                const manifest: { modelName: string; rootCapsuleName: string; files: string[] }[] = JSON.parse(readFileSync(manifestPath, 'utf-8'))
                for (const entry of manifest) {
                    for (const relPath of entry.files) {
                        const absPath = join(cstCache, relPath)
                        if (existsSync(absPath)) {
                            const result = await importer.importCstFile(absPath, entry.rootCapsuleName)
                            totalImported += result.imported
                        }
                    }
                }
                totalInstances += manifest.length
            }
        }
        if (totalImported > 0) await importer.linkMappings()
    }

    console.log(`✅ Engine ${engineName}: ${totalImported} capsules from ${totalInstances} spine instances`)
    return importer
}

/**
 * Get or lazily load an engine importer by name.
 * Concurrent requests for the same engine share a single loading promise.
 */
async function getEngine(engineName: string): Promise<any> {
    // Ensure model tests pass for this engine before loading data
    const testError = await ensureModelTestsForEngine(engineName)
    if (testError) {
        engineErrors.set(engineName, testError)
        throw Object.assign(new Error(testError), {
            '#': 'ModelTestError',
            engine: engineName,
        })
    }

    const cached = engineCache.get(engineName)
    if (cached) return cached

    // Deduplicate concurrent loads
    let loading = engineLoading.get(engineName)
    if (!loading) {
        loading = loadEngineImporter(engineName).then(importer => {
            engineCache.set(engineName, importer)
            engineErrors.delete(engineName)
            engineLoading.delete(engineName)
            return importer
        }).catch(err => {
            engineErrors.set(engineName, err.message ?? String(err))
            engineLoading.delete(engineName)
            throw err
        })
        engineLoading.set(engineName, loading)
    }
    return loading
}

// ── Scan .generated-data for CST files ──────────────────────────────
function scanCstFiles(dir: string, prefix: string = ''): string[] {
    const files: string[] = []
    try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
            const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
            if (entry.isDirectory()) {
                files.push(...scanCstFiles(join(dir, entry.name), relPath))
            } else if (entry.name.endsWith('.csts.json')) {
                files.push(relPath)
            }
        }
    } catch { }
    return files.sort()
}

console.log(`📂 PACKAGE_ROOT: ${PACKAGE_ROOT}`)

// ── Build API method registry from capsule apiSchema properties ──────
type MethodSchema = { args: { name: string; type: string; optional?: boolean }[]; description: string; discovery?: string; filterField?: string }
type ApiMethod = { name: string; namespace: string; schema: MethodSchema; capsule: any; needsGraph: boolean }

const methods: ApiMethod[] = []
const methodMap = new Map<string, ApiMethod>()
const apiMeta = new Map<string, { description: string; basePath: string }>()

for (const [nsKey, capsule] of Object.entries(capsuleApis) as [string, any][]) {
    const schema = capsule.apiSchema
    if (!schema?.namespace || !schema?.methods) continue
    if (schema.description || schema.basePath) {
        apiMeta.set(schema.namespace, { description: schema.description ?? '', basePath: schema.basePath ?? `/api/${schema.namespace}` })
    }
    for (const [name, methodSchema] of Object.entries(schema.methods) as [string, MethodSchema][]) {
        if (typeof capsule[name] !== 'function') continue
        const needsGraph = !!(methodSchema as any).graphMethod
        const entry: ApiMethod = {
            name,
            namespace: schema.namespace,
            schema: methodSchema,
            capsule,
            needsGraph,
        }
        methods.push(entry)
        methodMap.set(`${schema.namespace}/${name}`, entry)
    }
}

// ── Build discovery fallback map from schema metadata ─────────────────
const fallbackMap = new Map<string, string>()
for (const m of methods) {
    if (m.schema.discovery) {
        const target = m.schema.discovery.includes('/') ? m.schema.discovery : `${m.namespace}/${m.schema.discovery}`
        fallbackMap.set(`${m.namespace}/${m.name}`, target)
    }
}

// ── Default engine (first available, used when no engine param provided) ──
const defaultEngine = discoveredEngines[0]?.name ?? null

// ── OpenAPI-style schema (merged from capsule apiSchemas) ────────────
function buildSchema() {
    const endpoints: Record<string, any> = {}
    for (const m of methods) {
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
    for (const [ns, meta] of apiMeta) {
        apis[ns] = meta
    }
    return {
        openapi: "3.0.0",
        info: { title: "Framespace API", version: "0.1.0" },
        apis,
        engines: discoveredEngines.map(e => e.name),
        defaultEngine,
        endpoints,
    }
}

// Write schema to file on startup
const schema = buildSchema()
const schemaPath = join(import.meta.dir, '_schema.json')
writeFileSync(schemaPath, JSON.stringify(schema, null, 4))
console.log(`📄 Schema written to ${schemaPath}`)

// ── Helper: invoke an API method, resolving engine if needed ─────────
async function invokeMethod(method: ApiMethod, args: any[], engineName: string | null): Promise<any> {
    if (method.needsGraph) {
        const eName = engineName ?? defaultEngine
        if (!eName) throw new Error(`No engine specified and no default engine available`)
        const graph = await getEngine(eName)
        return method.capsule[method.name](graph, ...args)
    }
    return method.capsule[method.name](...args)
}

// ── Server ───────────────────────────────────────────────────────────
const server = serve({
    port,
    async fetch(req) {
        const url = new URL(req.url)

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders })
        }

        if (url.pathname === "/api/health") {
            return json({
                status: "ok",
                timestamp: new Date().toISOString(),
                methods: methods.length,
                engines: discoveredEngines.map(e => e.name),
                loadedEngines: [...engineCache.keys()],
            })
        }

        if (url.pathname === "/api/schema") {
            return json(buildSchema())
        }

        if (url.pathname === "/api/engines") {
            const status: Record<string, { status: string; error?: string }> = {}
            for (const e of discoveredEngines) {
                if (engineCache.has(e.name)) status[e.name] = { status: 'loaded' }
                else if (engineErrors.has(e.name)) status[e.name] = { status: 'error', error: engineErrors.get(e.name) }
                else if (engineLoading.has(e.name)) status[e.name] = { status: 'loading' }
                else status[e.name] = { status: 'idle' }
            }
            return json({
                engines: discoveredEngines.map(e => e.name),
                defaultEngine,
                status,
            })
        }

        // Dynamic method dispatch: /api/<namespace...>/<methodName>
        // Namespace can contain slashes (e.g. Encapsulate/CapsuleSpine)
        const match = url.pathname.match(/^\/api\/(.+)\/([a-zA-Z_]+)$/)
        if (match) {
            const [, ns, methodName] = match
            const method = methodMap.get(`${ns}/${methodName}`)
            if (!method) return json({ error: `Unknown method: ${ns}/${methodName}` }, { status: 404 })

            let args: any[] = []
            let engineName: string | null = null
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
                args = args.map((a, i) => {
                    const def = argDefs[i]
                    if (def?.type === 'number' && typeof a === 'string') return Number(a)
                    if (def?.type === 'boolean' && typeof a === 'string') return a === 'true'
                    return a
                })

                // Discovery fallback: if required args missing, redirect to discovery method
                const key = `${ns}/${methodName}`
                const hasRequiredArgs = argDefs.some((d: any) => !d.optional)
                if (args.length === 0 && hasRequiredArgs && fallbackMap.has(key)) {
                    const fb = methodMap.get(fallbackMap.get(key)!)!
                    const fbResult = await invokeMethod(fb, [], engineName)
                    return json({ method: fb.name, namespace: fb.namespace, result: fbResult, fallbackFrom: methodName })
                }

                const result = await invokeMethod(method, args, engineName)
                return json({ method: methodName, namespace: method.namespace, result })
            } catch (err: any) {
                const message = err.message ?? String(err)
                const stack = err.stack ?? ''
                const isModelTestError = err['#'] === 'ModelTestError'
                console.error(`❌ ${ns}/${methodName}`, `URI: ${url.pathname}${url.search}`, `args: ${JSON.stringify(args)}`, stack || message)
                return json({
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

        return json({ error: "Not Found" }, { status: 404 })
    },
})

console.log(`🚀 API server running on http://localhost:${port}`)
console.log(`📋 ${methods.length} methods available — GET /api/schema for full list`)
console.log(`🔧 ${discoveredEngines.length} engines available: ${discoveredEngines.map(e => e.name).join(', ')}`)

const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down...`)
    server.stop()
    process.exit(0)
}
process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
