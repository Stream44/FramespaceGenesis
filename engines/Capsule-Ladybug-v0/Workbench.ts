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
                /**
                 * The v1 CST importer — provides schema creation, import, and low-level query.
                 */
                importer: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './ImportCapsuleSourceTrees',
                },

                // =============================================================
                // API Schema
                // =============================================================

                apiSchema: {
                    type: CapsulePropertyTypes.Constant,
                    value: {
                        namespace: 'Workbench',
                        description: 'Methods to faciliate the Framespace Workbench',
                        basePath: '/api/Workbench',
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
                        const rows = await this.importer.queryAll(conn,
                            `MATCH (cap:Capsule) WHERE cap.spineInstanceUri = cap.capsuleName RETURN cap.spineInstanceUri AS spineInstanceUri, cap.capsuleSourceLineRef AS capsuleSourceLineRef ORDER BY spineInstanceUri`
                        )
                        return {
                            '#': 'SpineInstances',
                            list: rows.filter((r: any) => r.spineInstanceUri).map((r: any) => ({
                                '#': 'SpineInstance',
                                $id: r.spineInstanceUri,
                                capsuleSourceLineRef: r.capsuleSourceLineRef,
                            })),
                        }
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
                        // moduleFilepath = .../engines/Capsule-Ladybug-v0/Workbench.ts → 3 levels up to package root
                        const PACKAGE_ROOT = join(this['#@stream44.studio/encapsulate/structs/Capsule'].moduleFilepath, '../../..')
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
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/engines/Capsule-Ladybug-v0/Workbench',
    })
}
