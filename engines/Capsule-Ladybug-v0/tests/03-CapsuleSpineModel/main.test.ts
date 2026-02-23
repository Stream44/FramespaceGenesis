#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { join } from 'path'
import { readFileSync } from 'fs'

// Package-root static-analysis cache (where all CST files live)
const SPINE_ROOT = join(import.meta.dir, '..', '..', '..', '..')
const CST_CACHE = join(SPINE_ROOT, '.~o', 'encapsulate.dev', 'static-analysis')

// ---------------------------------------------------------------------------
// Parse the 02-SpineStructures snapshot to get per-capsule CST file lists
// ---------------------------------------------------------------------------
const SNAP_PATH = join(import.meta.dir, '..', '02-SpineStructures', '__snapshots__', 'main.test.ts.snap')

interface SnapshotEntry {
    name: string
    rootCapsuleName: string
    files: string[]
}

function parseSnapshot(snapPath: string): SnapshotEntry[] {
    const content = readFileSync(snapPath, 'utf-8')
    const entries: SnapshotEntry[] = []

    // Match: exports[`02-SpineStructures <name> clears cache, encapsulates, and verifies generated CST files 1`] = `{...}`;
    const pattern = /exports\[`02-SpineStructures (.+?) clears cache, encapsulates, and verifies generated CST files 1`\] = `\n([\s\S]*?)\n`;/g
    let match
    while ((match = pattern.exec(content)) !== null) {
        const name = match[1].trim()
        const block = match[2]

        // Extract rootCapsuleName
        const rootMatch = block.match(/"rootCapsuleName":\s*"([^"]+)"/)
        const rootCapsuleName = rootMatch ? rootMatch[1] : ''

        // Extract files array
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

const snapshotEntries = parseSnapshot(SNAP_PATH)

// ---------------------------------------------------------------------------
// Top-level run() — provides test harness + capsuleSpineModel (v1 importer)
// ---------------------------------------------------------------------------
const {
    test: { describe, it, expect },
    capsuleSpineModel,
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: { type: CapsulePropertyTypes.Mapping, value: 't44/caps/ProjectTest', options: { '#': { bunTest, env: {} } } },
                capsuleSpineModel: { type: CapsulePropertyTypes.Mapping, value: '../../QueryCapsuleSpineModel' },
            }
        }
    }, { importMeta: import.meta, importStack: makeImportStack(), capsuleName: '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/tests/03-CapsuleSpineModel/main.test' })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta,
    runFromSnapshot: false,
})

// ---------------------------------------------------------------------------
// Dynamic describe blocks — one per snapshot entry from 02-SpineStructures
// ---------------------------------------------------------------------------
describe('03-CapsuleSpineModel', () => {

    for (let i = 0; i < snapshotEntries.length; i++) {
        const entry = snapshotEntries[i]

        describe(`${entry.name}`, () => {
            let _db: any
            let _conn: any

            it('creates database, schema, imports CST files, and links mappings', async () => {
                _db = await capsuleSpineModel.importer.createDatabase()
                _conn = await capsuleSpineModel.importer.createConnection(_db)
                await capsuleSpineModel.importer.createSchema(_conn)

                for (const relPath of entry.files) {
                    const absPath = join(CST_CACHE, relPath)
                    await capsuleSpineModel.importer.importCstFile(_conn, absPath, entry.rootCapsuleName)
                }

                await capsuleSpineModel.importer.linkMappings(_conn)
            })

            it('queryAll: listSpineInstances pattern', async () => {
                const rows = await capsuleSpineModel.importer.queryAll(_conn, `MATCH (c:Capsule) RETURN DISTINCT c.spineInstanceUri AS spineInstanceUri ORDER BY spineInstanceUri`)
                const filtered = rows.filter((r: any) => r.spineInstanceUri)
                expect(filtered.length).toBeGreaterThan(0)
            })

            it('queryAll: listCapsules pattern (no filter)', async () => {
                const rows = await capsuleSpineModel.importer.queryAll(_conn, `MATCH (c:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource) RETURN c.capsuleName ORDER BY c.capsuleName`)
                expect(rows.length).toBeGreaterThan(0)
            })

            it('queryAll: listCapsules pattern (with spineInstanceUri filter)', async () => {
                const rows = await capsuleSpineModel.importer.queryAll(_conn, `MATCH (c:Capsule)-[:HAS_SOURCE]->(cs:CapsuleSource) WHERE c.spineInstanceUri = '${entry.rootCapsuleName}' RETURN c.capsuleName ORDER BY c.capsuleName`)
                expect(rows.length).toBeGreaterThan(0)
            })

            it('listCapsules returns $id references', async () => {
                const result = await capsuleSpineModel.listCapsules(_conn)
                expect(result).toMatchSnapshot()
            })

            it('getCapsule returns full CST structure for first capsule', async () => {
                const listResult = await capsuleSpineModel.listCapsules(_conn)
                const firstId = listResult.list[0].$id
                const capsule = await capsuleSpineModel.getCapsule(_conn, firstId)
                expect(capsule).toMatchSnapshot()
            })

            it('getCapsuleSpineTree returns mapping dependency tree', async () => {
                // Use the last capsule in the list (the runner capsule which has mappings)
                const listResult = await capsuleSpineModel.listCapsules(_conn)
                const runnerCapsule = listResult.list[listResult.list.length - 1]
                const tree = await capsuleSpineModel.getCapsuleSpineTree(_conn, runnerCapsule.$id)
                expect(tree).toMatchSnapshot()
            })
        })
    }
})
