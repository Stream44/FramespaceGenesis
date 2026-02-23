import { serve } from "bun"
import { run } from 't44/standalone-rt'
import { join } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'

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

// ── Bootstrap capsules ───────────────────────────────────────────────
const port = Number(process.env.PORT || 4000)

const capsuleApis = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                QueryCapsuleSpineModel: { type: CapsulePropertyTypes.Mapping, value: '../QueryCapsuleSpineModel' },
                Workbench: { type: CapsulePropertyTypes.Mapping, value: '../Workbench' },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/api-server/server',
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    const resolved = apis[spine.capsuleSourceLineRef]
    return resolved
}, {
    importMeta: import.meta,
    runFromSnapshot: false,
})

// ── Parse 02-SpineStructures snapshot ────────────────────────────────
interface SnapshotEntry {
    name: string
    rootCapsuleName: string
    files: string[]
}

function parseSnapshot(snapPath: string): SnapshotEntry[] {
    const content = readFileSync(snapPath, 'utf-8')
    const entries: SnapshotEntry[] = []
    const pattern = /exports\[`02-SpineStructures (.+?) clears cache, encapsulates, and verifies generated CST files 1`\] = `\n([\s\S]*?)\n`;/g
    let match
    while ((match = pattern.exec(content)) !== null) {
        const name = match[1].trim()
        const block = match[2]
        const rootMatch = block.match(/"rootCapsuleName":\s*"([^"]+)"/)
        const rootCapsuleName = rootMatch ? rootMatch[1] : ''
        const filesMatch = block.match(/"files":\s*\[([\s\S]*?)\]/)
        const files = filesMatch
            ? filesMatch[1]
                .split('\n')
                .map(line => line.trim().replace(/^"|",$|"$/g, ''))
                .filter(line => line.length > 0)
            : []
        entries.push({ name, rootCapsuleName, files })
    }
    return entries
}

// ── Load CSTs into LadybugDB from snapshot ───────────────────────────
// Use any capsule with an importer to bootstrap the DB
const importer = capsuleApis.QueryCapsuleSpineModel.importer
const _db = await importer.createDatabase()
const _conn = await importer.createConnection(_db)
await importer.createSchema(_conn)

    // Prevent _db from being GC'd by pinning it on globalThis
    ; (globalThis as any).__ladybug_db = _db

const PACKAGE_ROOT = join(import.meta.dir, '..', '..', '..')
console.log(`📂 PACKAGE_ROOT: ${PACKAGE_ROOT}`)
const SNAP_PATH = join(PACKAGE_ROOT, 'engines/Capsule-Ladybug-v0/tests/02-SpineStructures/__snapshots__/main.test.ts.snap')
const CST_CACHE = join(PACKAGE_ROOT, '.~o', 'encapsulate.dev', 'static-analysis')

if (existsSync(SNAP_PATH) && existsSync(CST_CACHE)) {
    const snapshotEntries = parseSnapshot(SNAP_PATH)
    let totalImported = 0

    for (const entry of snapshotEntries) {
        for (const relPath of entry.files) {
            const absPath = join(CST_CACHE, relPath)
            if (existsSync(absPath)) {
                const result = await importer.importCstFile(_conn, absPath, entry.rootCapsuleName)
                totalImported += result.imported
            }
        }
    }

    await importer.linkMappings(_conn)
    console.log(`📦 Imported ${totalImported} capsules from ${snapshotEntries.length} spine instances`)
    console.log(`   Snapshot: ${SNAP_PATH}`)
    console.log(`   CST cache: ${CST_CACHE}`)

    try {
        const diag = await importer.queryAll(_conn, `MATCH (c:Capsule) RETURN count(c)`)
        console.log(`✅ DB verified: ${JSON.stringify(diag)}`)
    } catch (e: any) {
        console.error(`❌ DB verification FAILED: ${e.message}`)
    }
} else {
    if (!existsSync(SNAP_PATH)) console.warn(`⚠️  Snapshot not found at ${SNAP_PATH}`)
    if (!existsSync(CST_CACHE)) console.warn(`⚠️  CST cache not found at ${CST_CACHE}`)
}

// ── Build API method registry from capsule apiSchema properties ──────
type MethodSchema = { args: { name: string; type: string; optional?: boolean }[]; description: string; discovery?: string; filterField?: string }
type ApiMethod = { name: string; namespace: string; schema: MethodSchema; fn: (conn: any, ...args: any[]) => Promise<any> }

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
        // Call method on the capsule object directly — do NOT .bind(), as the
        // encapsulate runtime wraps CapsulePropertyTypes.Function values and
        // manages `this` internally. Rebinding breaks the wrapper's this chain.
        const cap = capsule
        const entry: ApiMethod = {
            name,
            namespace: schema.namespace,
            schema: methodSchema,
            fn: (...args: any[]) => cap[name](...args),
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
        info: { title: "Ladybug CST API", version: "1.0.0" },
        apis,
        endpoints,
    }
}

// Write schema to file on startup
const schema = buildSchema()
const schemaPath = join(import.meta.dir, '_schema.json')
writeFileSync(schemaPath, JSON.stringify(schema, null, 4))
console.log(`📄 Schema written to ${schemaPath}`)

// ── Server ───────────────────────────────────────────────────────────
const server = serve({
    port,
    async fetch(req) {
        const url = new URL(req.url)

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders })
        }

        if (url.pathname === "/api/health") {
            return json({ status: "ok", timestamp: new Date().toISOString(), methods: methods.length })
        }

        if (url.pathname === "/api/schema") {
            return json(buildSchema())
        }

        // Dynamic method dispatch: /api/<namespace>/<methodName>
        const match = url.pathname.match(/^\/api\/([a-zA-Z]+)\/([a-zA-Z]+)$/)
        if (match) {
            const [, ns, methodName] = match
            const method = methodMap.get(`${ns}/${methodName}`)
            if (!method) return json({ error: `Unknown method: ${ns}/${methodName}` }, { status: 404 })

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
                    const fbResult = await fb.fn(_conn)
                    return json({ method: fb.name, namespace: fb.namespace, result: fbResult, fallbackFrom: methodName })
                }

                const result = await method.fn(_conn, ...args)
                return json({ method: methodName, namespace: method.namespace, result })
            } catch (err: any) {
                const message = err.message ?? String(err)
                const stack = err.stack ?? ''
                console.error(`❌ ${ns}/${methodName}`, `URI: ${url.pathname}${url.search}`, `args: ${JSON.stringify(args)}`, stack || message)
                return json({
                    method: methodName,
                    namespace: ns,
                    result: {
                        '#': 'Error',
                        method: `${ns}/${methodName}`,
                        message,
                        stack,
                    },
                })
            }
        }

        return json({ error: "Not Found" }, { status: 404 })
    },
})

console.log(`🚀 Ladybug API running on http://localhost:${port}`)
console.log(`📋 ${methods.length} methods available — GET /api/schema for full list`)

const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down...`)
    server.stop()
    process.exit(0)
}
process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
