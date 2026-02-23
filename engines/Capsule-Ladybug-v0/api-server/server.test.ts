#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

const {
    test: { describe, it, expect },
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/ProjectTest',
                    options: { '#': { bunTest, env: {} } }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/api-server/server.test',
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta,
    runFromSnapshot: false,
})

// ── Start the server as a subprocess ─────────────────────────────────
let serverProc: any
let BASE_URL: string

const port = 14000 + Math.floor(Math.random() * 1000)
BASE_URL = `http://localhost:${port}`

describe('Ladybug API Server', () => {

    bunTest.afterAll(async () => {
        if (serverProc) {
            serverProc.kill()
            await serverProc.exited
            serverProc = undefined
        }
    })

    it('starts the server', async () => {
        serverProc = Bun.spawn(['bun', 'run', 'server.ts'], {
            cwd: import.meta.dir,
            env: { ...process.env, PORT: String(port), CST_DIR: import.meta.dir },
            stdout: 'pipe',
            stderr: 'pipe',
        })

        // Forward piped stdout/stderr to console so logs are visible
        const drain = async (stream: ReadableStream<Uint8Array> | null, writer: (s: string) => void) => {
            if (!stream) return
            const reader = stream.getReader()
            const decoder = new TextDecoder()
            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    writer(decoder.decode(value, { stream: true }))
                }
            } catch { /* stream closed */ }
        }
        drain(serverProc.stdout, (s) => process.stdout.write(s))
        drain(serverProc.stderr, (s) => process.stderr.write(s))

        // Wait for the server to be ready by polling /api/health
        let ready = false
        for (let i = 0; i < 60; i++) {
            try {
                const res = await fetch(`${BASE_URL}/api/health`)
                if (res.ok) { ready = true; break }
            } catch { /* not ready yet */ }
            await Bun.sleep(500)
        }
        expect(ready).toBe(true)
    }, 60_000)

    // ── Health ────────────────────────────────────────────────────────
    it('GET /api/health returns ok', async () => {
        const res = await fetch(`${BASE_URL}/api/health`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.status).toBe('ok')
        expect(data.methods).toBeGreaterThan(0)
    })

    // ── Schema ───────────────────────────────────────────────────────
    it('GET /api/schema returns OpenAPI-style schema with endpoints and arg definitions', async () => {
        const res = await fetch(`${BASE_URL}/api/schema`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.openapi).toBe('3.0.0')
        expect(data.info.title).toBe('Ladybug CST API')
        expect(Object.keys(data.endpoints).length).toBeGreaterThan(0)
        // Should contain known methods
        expect(data.endpoints['/api/QueryCapsuleSpineModel/listCapsules']).toBeDefined()
        expect(data.endpoints['/api/QueryCapsuleSpineModel/getCapsule']).toBeDefined()
        expect(data.endpoints['/api/QueryCapsuleSpineModel/getCapsuleSpineTree']).toBeDefined()
        // getCapsule should include arg definitions
        const getCapsuleEndpoint = data.endpoints['/api/QueryCapsuleSpineModel/getCapsule']
        expect(getCapsuleEndpoint.args.length).toBe(1)
        expect(getCapsuleEndpoint.args[0].name).toBe('capsuleName')
        expect(getCapsuleEndpoint.args[0].type).toBe('string')
        expect(getCapsuleEndpoint.description).toBeDefined()
        expect(getCapsuleEndpoint.discovery).toBe('/api/QueryCapsuleSpineModel/listCapsules')
        expect(getCapsuleEndpoint.filterField).toBe('$id')
        // Workbench endpoints
        expect(data.endpoints['/api/Workbench/listSpineInstances']).toBeDefined()
        expect(data.endpoints['/api/Workbench/getProcessStats']).toBeDefined()
        expect(data.endpoints['/api/Workbench/getReps']).toBeDefined()
        expect(data.endpoints['/api/Workbench/openFile']).toBeDefined()
        // API-level metadata with descriptions
        expect(data.apis).toBeDefined()
        expect(data.apis['Workbench']).toBeDefined()
        expect(data.apis['Workbench'].description).toBe('Methods to faciliate the Framespace Workbench')
        expect(data.apis['Workbench'].basePath).toBe('/api/Workbench')
        expect(data.apis['QueryCapsuleSpineModel']).toBeDefined()
        expect(data.apis['QueryCapsuleSpineModel'].description).toBe('Methods to query the *Capsule Spine Model* of the selected *Spine Tree Instance*')
        expect(data.apis['QueryCapsuleSpineModel'].basePath).toBe('/api/QueryCapsuleSpineModel')
    })

    // ── QueryCapsuleSpineModel Methods ───────────────────────────────
    it('GET /api/QueryCapsuleSpineModel/listCapsules returns capsules', async () => {
        const res = await fetch(`${BASE_URL}/api/QueryCapsuleSpineModel/listCapsules`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.method).toBe('listCapsules')
        expect(data.namespace).toBe('QueryCapsuleSpineModel')
        expect(data.result['#']).toBe('Capsules')
        expect(Array.isArray(data.result.list)).toBe(true)
        expect(data.result.list.length).toBeGreaterThan(0)
    })

    it('GET /api/QueryCapsuleSpineModel/getCapsule with capsuleName returns capsule', async () => {
        // First get a known capsule name
        const listRes = await fetch(`${BASE_URL}/api/QueryCapsuleSpineModel/listCapsules`)
        const listData = await listRes.json() as any
        const capsuleName = listData.result.list[0]?.['$id'] ?? ''
        expect(capsuleName).not.toBe('')

        const res = await fetch(`${BASE_URL}/api/QueryCapsuleSpineModel/getCapsule?capsuleName=${encodeURIComponent(capsuleName)}`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.method).toBe('getCapsule')
        expect(data.namespace).toBe('QueryCapsuleSpineModel')
        expect(data.result).toBeDefined()
        expect(data.result['#']).toBe('Capsule')
    })

    it('POST /api/QueryCapsuleSpineModel/getCapsule with args body', async () => {
        const listRes = await fetch(`${BASE_URL}/api/QueryCapsuleSpineModel/listCapsules`)
        const listData = await listRes.json() as any
        const capsuleName = listData.result.list[0]?.['$id'] ?? ''

        const res = await fetch(`${BASE_URL}/api/QueryCapsuleSpineModel/getCapsule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ args: [capsuleName] }),
        })
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.result['#']).toBe('Capsule')
    })

    // ── Workbench Methods ────────────────────────────────────────────
    it('GET /api/Workbench/listSpineInstances returns instances', async () => {
        const res = await fetch(`${BASE_URL}/api/Workbench/listSpineInstances`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.namespace).toBe('Workbench')
        expect(data.result['#']).toBe('SpineInstances')
        expect(Array.isArray(data.result.list)).toBe(true)
        expect(data.result.list.length).toBeGreaterThan(0)
    })

    it('GET /api/Workbench/getProcessStats returns stats', async () => {
        const res = await fetch(`${BASE_URL}/api/Workbench/getProcessStats`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.result).toBeDefined()
    })

    it('GET /api/Workbench/getReps returns reps list', async () => {
        const res = await fetch(`${BASE_URL}/api/Workbench/getReps`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.result).toBeDefined()
    })

    // ── Fallback behavior ─────────────────────────────────────────────
    it('GET /api/QueryCapsuleSpineModel/getCapsule with no args falls back to listCapsules', async () => {
        const res = await fetch(`${BASE_URL}/api/QueryCapsuleSpineModel/getCapsule`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.fallbackFrom).toBe('getCapsule')
        expect(data.method).toBe('listCapsules')
        expect(data.result['#']).toBe('Capsules')
        expect(data.result.list.length).toBeGreaterThan(0)
    })

    it('GET /api/QueryCapsuleSpineModel/getCapsuleSpineTree with no args falls back to listSpineInstances', async () => {
        const res = await fetch(`${BASE_URL}/api/QueryCapsuleSpineModel/getCapsuleSpineTree`)
        expect(res.status).toBe(200)
        const data = await res.json() as any
        expect(data.fallbackFrom).toBe('getCapsuleSpineTree')
        expect(data.method).toBe('listSpineInstances')
        expect(data.result).toBeDefined()
    })

    // ── Error handling ───────────────────────────────────────────────
    it('GET /api/QueryCapsuleSpineModel/nonExistentMethod returns 404', async () => {
        const res = await fetch(`${BASE_URL}/api/QueryCapsuleSpineModel/nonExistentMethod`)
        expect(res.status).toBe(404)
        const data = await res.json() as any
        expect(data.error).toContain('Unknown method')
    })

    it('GET /unknown returns 404', async () => {
        const res = await fetch(`${BASE_URL}/unknown`)
        expect(res.status).toBe(404)
    })
})
