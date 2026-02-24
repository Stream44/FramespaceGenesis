import { join, relative } from 'path'
import { readdirSync, statSync, existsSync } from 'fs'
import { exec } from 'child_process'

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
                // API Schema
                // =============================================================

                apiSchema: {
                    type: CapsulePropertyTypes.Constant,
                    value: {
                        namespace: 'Framespace/Workbench',
                        description: 'Methods to facilitate the Framespace Workbench',
                        basePath: '/api/Framespace/Workbench',
                        methods: {
                            listSpineInstances: {
                                args: [],
                                description: 'List all distinct spine instance URIs (rootCapsuleName values) in the graph.',
                            },
                            getProcessStats: {
                                args: [],
                                description: 'Get backend process memory and CPU usage.',
                            },
                            getReps: {
                                args: [],
                                description: 'List all registered reps with their source file paths.',
                            },
                            openFile: {
                                args: [
                                    { name: 'command', type: 'string' },
                                    { name: 'file', type: 'string' },
                                ],
                                description: 'Open a file in an editor. Command is the editor binary (e.g. "code"), file is an absolute path optionally with :line suffix.',
                            },
                        },
                    },
                },

                // =============================================================
                // Query API
                // =============================================================

                /**
                 * List all distinct spine instance URIs in the graph.
                 */
                listSpineInstances: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, conn: any): Promise<any> {
                        // Try to read manifests for ordering
                        // moduleFilepath = .../models/Framespace/Workbench/API.ts → 4 levels up to package root
                        const PACKAGE_ROOT = join(this['#@stream44.studio/encapsulate/structs/Capsule'].moduleFilepath, '../../../..')
                        const generatedData = join(PACKAGE_ROOT, 'models', '.generated-data')
                        let manifestOrder: string[] | null = null
                        try {
                            const { readFileSync: rfs, readdirSync: rds, existsSync: exs } = require('fs')
                            const allEntries: string[] = []
                            if (exs(generatedData)) {
                                for (const l1 of rds(generatedData, { withFileTypes: true })) {
                                    if (!l1.isDirectory() || l1.name.startsWith('.')) continue
                                    for (const l2 of rds(join(generatedData, l1.name), { withFileTypes: true })) {
                                        if (!l2.isDirectory() || l2.name.startsWith('.')) continue
                                        const mp = join(generatedData, l1.name, l2.name, 'manifest.json')
                                        if (!exs(mp)) continue
                                        const manifest = JSON.parse(rfs(mp, 'utf-8'))
                                        for (const e of manifest) allEntries.push(e.rootCapsuleName)
                                    }
                                }
                            }
                            if (allEntries.length > 0) manifestOrder = allEntries
                        } catch { }

                        const rows = await this.queryAll(conn,
                            `MATCH (cap:Capsule) WHERE cap.spineInstanceUri IS NOT NULL AND cap.spineInstanceUri <> '' RETURN DISTINCT cap.spineInstanceUri AS spineInstanceUri, cap.capsuleName AS capsuleName, cap.capsuleSourceLineRef AS capsuleSourceLineRef ORDER BY spineInstanceUri`
                        )
                        // For each spineInstanceUri, find the root capsule (where capsuleName matches spineInstanceUri)
                        const rootLineRefs: Record<string, string> = {}
                        for (const r of rows) {
                            if (r.capsuleName === r.spineInstanceUri && r.capsuleSourceLineRef) {
                                rootLineRefs[r.spineInstanceUri] = r.capsuleSourceLineRef
                            }
                        }
                        const distinctUris = [...new Set<string>(rows.filter((r: any) => r.spineInstanceUri).map((r: any) => r.spineInstanceUri))]
                        let list = distinctUris.map((uri: string) => ({
                            '#': 'SpineInstance',
                            $id: uri,
                            capsuleSourceLineRef: rootLineRefs[uri] ?? null,
                        }))

                        // Re-order to match manifest if available
                        if (manifestOrder) {
                            const orderMap: Record<string, number> = {}
                            for (let i = 0; i < manifestOrder.length; i++) orderMap[manifestOrder[i]] = i
                            const fallback = manifestOrder.length + 1
                            list.sort((a: any, b: any) => {
                                const ai = a.$id in orderMap ? orderMap[a.$id] : fallback
                                const bi = b.$id in orderMap ? orderMap[b.$id] : fallback
                                return ai - bi
                            })
                        }

                        // Group by modelName > exampleDir
                        // URI pattern: .../models/<ns>/<model>/examples/<exampleDir>/run.<name>
                        const groups: any[] = []
                        const groupMap: Record<string, Record<string, any[]>> = {}
                        for (const item of list) {
                            const uri = item.$id as string
                            const examplesIdx = uri.indexOf('/examples/')
                            let modelName = '(unknown)'
                            let exampleDir = '(default)'
                            if (examplesIdx >= 0) {
                                // Extract model path: everything from /models/ to /examples/
                                const modelsIdx = uri.indexOf('/models/')
                                if (modelsIdx >= 0) {
                                    modelName = uri.substring(modelsIdx + '/models/'.length, examplesIdx)
                                }
                                // Extract example dir name
                                const afterExamples = uri.substring(examplesIdx + '/examples/'.length)
                                const slashIdx = afterExamples.indexOf('/')
                                if (slashIdx >= 0) {
                                    exampleDir = afterExamples.substring(0, slashIdx)
                                }
                            }
                            if (!groupMap[modelName]) groupMap[modelName] = {}
                            if (!groupMap[modelName][exampleDir]) groupMap[modelName][exampleDir] = []
                            groupMap[modelName][exampleDir].push(item)
                        }
                        for (const [modelName, examples] of Object.entries(groupMap)) {
                            for (const [exampleDir, items] of Object.entries(examples)) {
                                groups.push({
                                    '#': 'SpineInstanceGroup',
                                    modelName,
                                    exampleDir,
                                    list: items,
                                })
                            }
                        }

                        return { '#': 'SpineInstances', list, groups }
                    }
                },

                /**
                 * Get backend process memory and CPU usage.
                 */
                getProcessStats: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (): Promise<any> {
                        const mem = process.memoryUsage()
                        const cpu = process.cpuUsage()
                        return {
                            '#': 'ProcessStats',
                            memoryMB: +(mem.rss / 1024 / 1024).toFixed(2),
                            heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
                            heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
                            cpuUserMs: +(cpu.user / 1000).toFixed(0),
                            cpuSystemMs: +(cpu.system / 1000).toFixed(0),
                            uptimeSeconds: +(process.uptime()).toFixed(0),
                        }
                    }
                },

                /**
                 * List all registered reps with their source file paths.
                 * Scans the visualizations directory for rep files.
                 */
                getReps: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<any> {
                        // moduleFilepath = .../models/Framespace/Workbench/API.ts → 4 levels up to package root
                        const PACKAGE_ROOT = join(this['#@stream44.studio/encapsulate/structs/Capsule'].moduleFilepath, '../../../..')
                        const vizDir = join(PACKAGE_ROOT, 'visualizations')
                        const list: any[] = []

                        // Only scan the 'reps' subdirectory of each visualization
                        function scanRepsDir(dir: string) {
                            for (const entry of readdirSync(dir)) {
                                const full = join(dir, entry)
                                const st = statSync(full)
                                if (st.isDirectory()) {
                                    scanRepsDir(full)
                                } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
                                    list.push({
                                        '#': 'Rep',
                                        name: entry.replace(/\.(tsx?)$/, ''),
                                        fullpath: full,
                                        relativePath: relative(PACKAGE_ROOT, full),
                                    })
                                }
                            }
                        }

                        for (const vizName of readdirSync(vizDir)) {
                            if (vizName === 'node_modules' || vizName.startsWith('.')) continue
                            const repsPath = join(vizDir, vizName, 'reps')
                            try { statSync(repsPath) } catch { continue }
                            scanRepsDir(repsPath)
                        }

                        return { '#': 'Reps', list }
                    }
                },

                /**
                 * Open a file in an editor. Validates the file exists before launching.
                 */
                openFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (_conn: any, command: string, file: string): Promise<any> {
                        if (!command || typeof command !== 'string') return { '#': 'Error', method: 'openFile', message: 'No command provided' }
                        if (!file || typeof file !== 'string') return { '#': 'Error', method: 'openFile', message: 'No file provided' }
                        if (!file.startsWith('/')) return { '#': 'Error', method: 'openFile', message: `File must be an absolute path: ${file}` }

                        // Strip :line suffix to check if the file exists
                        const lineMatch = file.match(/^(.+):(\d+)$/)
                        const filePath = lineMatch ? lineMatch[1] : file
                        const line = lineMatch ? lineMatch[2] : null

                        if (!existsSync(filePath)) return { '#': 'Error', method: 'openFile', message: `File not found: ${filePath}` }

                        // Build command using VS Code / Windsurf --goto format
                        const target = line ? `${filePath}:${line}` : filePath
                        const fullCmd = `${command} --goto "${target}"`
                        console.error(`[openFile] ${fullCmd}`)

                        return new Promise((resolve) => {
                            exec(fullCmd, (err) => {
                                if (err) {
                                    console.error(`[openFile] Error: ${err.message}`)
                                    resolve({ '#': 'Error', method: 'openFile', message: err.message })
                                } else {
                                    resolve({ ok: true, command: fullCmd })
                                }
                            })
                        })
                    }
                },
            }
        }
    }, {
        extendsCapsule: '../../../engines/Capsule-Ladybug-v0/LadybugGraph',
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/models/Framespace/Workbench/API',
    })
}
