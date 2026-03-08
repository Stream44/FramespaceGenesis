import { writeFile, readFile } from 'fs/promises'
import { join, dirname, relative } from 'path'
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
                // Map L6 CapsuleSpine — spine instance queries go through this capsule
                CapsuleSpine: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '../../Capsular/CapsuleSpine/ModelQueryMethods',
                },

                // =============================================================
                // API Schema
                // =============================================================

                apiSchema: {
                    type: CapsulePropertyTypes.Constant,
                    value: {
                        namespace: '@stream44.studio~FramespaceGenesis~L6-semantic-models~Framespace~Workbench~ModelQueryMethods',
                        description: 'Methods to facilitate the Framespace Workbench',
                        basePath: '/api/@stream44.studio~FramespaceGenesis~L6-semantic-models~Framespace~Workbench~ModelQueryMethods',
                        methods: {
                            listSpineInstanceTrees: {
                                args: [],
                                description: 'List all distinct spine instance tree IDs in the graph.',
                                graphMethod: true,
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
                            listSpineInstanceTreeCapsuleSourceFiles: {
                                args: [
                                    { name: 'spineInstanceTreeId', type: 'string' },
                                ],
                                description: 'List all capsule source files for a spine instance tree, grouped by capsule name.',
                                graphMethod: true,
                            },
                            getCapsuleSourceFile: {
                                args: [
                                    { name: 'filePath', type: 'string' },
                                    { name: 'format', type: 'string' },
                                ],
                                description: 'Read the contents of a capsule source file by its absolute path. Format: "raw" (default) or "simplified".',
                            },
                            saveCapsuleSourceFile: {
                                args: [
                                    { name: 'filePath', type: 'string' },
                                    { name: 'content', type: 'string' },
                                ],
                                description: 'Save content to a capsule source file by its absolute path.',
                            },
                        },
                    },
                },

                // =============================================================
                // Initialization
                // =============================================================

                init: {
                    type: CapsulePropertyTypes.Init,
                    value: async function (this: any): Promise<void> {
                        if (this.writeMethodSchema) {
                            const moduleFilepath = this['#@stream44.studio/encapsulate/structs/Capsule'].moduleFilepath
                            const schemaPath = join(dirname(moduleFilepath), '_ModelQueryMethodsSchema.json')
                            await writeFile(schemaPath, JSON.stringify(this.apiSchema, null, 4))
                        }
                    }
                },

                // =============================================================
                // Query API
                // =============================================================

                /**
                 * List all distinct spine instance tree IDs in the graph.
                 * This method requires a graph (engine) to query.
                 */
                listSpineInstanceTrees: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any): Promise<any> {
                        const PACKAGE_ROOT = this._getPackageRoot()
                        const generatedData = join(PACKAGE_ROOT, 'models', '.cst-data')

                        // Try to read sits.json files for ordering
                        let manifestOrder: string[] | null = null
                        try {
                            const allEntries: string[] = []
                            const scanForSits = (dir: string) => {
                                if (!existsSync(dir)) return
                                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                                    if (entry.name.startsWith('.')) continue
                                    if (entry.isDirectory()) {
                                        scanForSits(join(dir, entry.name))
                                    } else if (entry.name === 'sits.json') {
                                        try {
                                            const sits = JSON.parse(require('fs').readFileSync(join(dir, entry.name), 'utf-8'))
                                            for (const e of sits) allEntries.push(e.rootCapsuleSourceUriLineRef)
                                        } catch { }
                                    }
                                }
                            }
                            scanForSits(generatedData)
                            if (allEntries.length > 0) manifestOrder = allEntries
                        } catch { }

                        // Delegate graph query to L6 CapsuleSpine
                        const treesResult = await this.CapsuleSpine.getSpineInstanceTrees({ graph, server })
                        let list = treesResult.list

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

                        // Load models.json for engine availability per model
                        const modelsJsonCache: Record<string, any> = {}
                        try {
                            const scanForModelsJson = (dir: string) => {
                                if (!existsSync(dir)) return
                                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                                    if (entry.name.startsWith('.')) continue
                                    if (entry.isDirectory()) {
                                        scanForModelsJson(join(dir, entry.name))
                                    } else if (entry.name === 'models.json') {
                                        try {
                                            const mj = JSON.parse(require('fs').readFileSync(join(dir, entry.name), 'utf-8'))
                                            for (const [modelName, modelData] of Object.entries(mj) as [string, any][]) {
                                                modelsJsonCache[modelName] = modelData
                                            }
                                        } catch { }
                                    }
                                }
                            }
                            scanForModelsJson(generatedData)
                        } catch { }

                        // Derive short model names from server._models
                        const TRIM_PREFIX = '@stream44.studio/FramespaceGenesis/'
                        const TRIM_SUFFIX = '/ModelQueryMethods'
                        const registeredModelUris: string[] = (server?._models ?? []).map((m: any) => m.modelUri)
                        const shortModelName = (uri: string) => {
                            if (uri.startsWith(TRIM_PREFIX) && uri.endsWith(TRIM_SUFFIX)) {
                                return uri.substring(TRIM_PREFIX.length, uri.length - TRIM_SUFFIX.length)
                            }
                            return uri
                        }
                        const registeredModels = registeredModelUris.map((uri: string) => ({
                            uri,
                            shortName: shortModelName(uri),
                        }))

                        // Group by type (example vs test) > examplesPath > exampleDir
                        // Only items from @stream44.studio/FramespaceGenesis/examples/ are "example", everything else is "test"
                        const groups: any[] = []
                        // Key: type:examplesPath:exampleDir
                        const groupMap: Record<string, { type: string; examplesPath: string; modelName: string; exampleDir: string; items: any[] }> = {}
                        for (const item of list) {
                            // Use capsuleSourceLineRef (absolute path) for full filepath
                            const absRef = (item.capsuleSourceLineRef ?? '') as string
                            // Use capsuleSourceUriLineRef (npm URI) to derive model name
                            const ref = (item.capsuleSourceUriLineRef ?? item.$id) as string
                            const examplesIdx = ref.indexOf('/examples/')
                            let modelName = '(unknown)'
                            let exampleDir = '(default)'
                            let examplesPath = ''

                            // Only items directly under @stream44.studio/FramespaceGenesis/examples/ are "example"
                            // Check if the npm URI starts with the package prefix followed immediately by /examples/
                            const isPackageExample = ref.startsWith('@stream44.studio/FramespaceGenesis/examples/')
                            let type = isPackageExample ? 'example' : 'test'

                            if (examplesIdx >= 0) {
                                // npm URI: @scope/package/path.../examples/dir/file
                                let rawModelName = ref.substring(0, examplesIdx)
                                if (rawModelName.startsWith(TRIM_PREFIX)) {
                                    rawModelName = rawModelName.substring(TRIM_PREFIX.length)
                                }
                                modelName = rawModelName
                                const afterExamples = ref.substring(examplesIdx + '/examples/'.length)
                                const slashIdx = afterExamples.indexOf('/')
                                if (slashIdx >= 0) {
                                    exampleDir = afterExamples.substring(0, slashIdx)
                                }

                                // Extract full examples path from absolute ref
                                const absExamplesIdx = absRef.indexOf('/examples/')
                                if (absExamplesIdx >= 0) {
                                    const afterAbsExamples = absRef.substring(absExamplesIdx + '/examples/'.length)
                                    const absSlashIdx = afterAbsExamples.indexOf('/')
                                    if (absSlashIdx >= 0) {
                                        examplesPath = absRef.substring(0, absExamplesIdx + '/examples/'.length + absSlashIdx)
                                    } else {
                                        examplesPath = absRef.substring(0, absExamplesIdx + '/examples/'.length) + afterAbsExamples.split(':')[0]
                                    }
                                }
                            }

                            const key = `${type}:${examplesPath}:${exampleDir}`
                            if (!groupMap[key]) {
                                groupMap[key] = { type, examplesPath, modelName, exampleDir, items: [] }
                            }
                            groupMap[key].items.push(item)
                        }
                        for (const g of Object.values(groupMap)) {
                            const modelEngines = modelsJsonCache[g.modelName]?.engines ?? {}
                            groups.push({
                                '#': 'SpineInstanceGroup',
                                type: g.type,
                                modelName: g.modelName,
                                exampleDir: g.exampleDir,
                                examplesPath: g.examplesPath,
                                engines: modelEngines,
                                list: g.items,
                            })
                        }

                        return { '#': 'SpineInstances', list, groups, registeredModels }
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
                 */
                getReps: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<any> {
                        const PACKAGE_ROOT = this._getPackageRoot()
                        const vizDir = join(PACKAGE_ROOT, 'visualizations')
                        const list: any[] = []

                        const scanRepsDir = (dir: string) => {
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

                        // Scan L6/L8 model directories for reps
                        const scanModelTree = (baseDir: string) => {
                            if (!existsSync(baseDir)) return
                            const walk = (dir: string) => {
                                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                                    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
                                    const full = join(dir, entry.name)
                                    if (entry.isDirectory()) {
                                        if (entry.name === 'reps') scanRepsDir(full)
                                        else walk(full)
                                    }
                                }
                            }
                            walk(baseDir)
                        }
                        scanModelTree(join(PACKAGE_ROOT, 'L6-semantic-models'))
                        scanModelTree(join(PACKAGE_ROOT, 'L8-view-models'))

                        return { '#': 'Reps', list }
                    }
                },

                /**
                 * Open a file in an editor. Validates the file exists before launching.
                 */
                openFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (command: string, file: string): Promise<any> {
                        if (!command || typeof command !== 'string') return { '#': 'Error', method: 'openFile', message: 'No command provided' }
                        if (!file || typeof file !== 'string') return { '#': 'Error', method: 'openFile', message: 'No file provided' }
                        if (!file.startsWith('/')) return { '#': 'Error', method: 'openFile', message: `File must be an absolute path: ${file}` }

                        const lineMatch = file.match(/^(.+):(\d+)$/)
                        const filePath = lineMatch ? lineMatch[1] : file
                        const line = lineMatch ? lineMatch[2] : null

                        if (!existsSync(filePath)) return { '#': 'Error', method: 'openFile', message: `File not found: ${filePath}` }

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

                /**
                 * List all capsule source files for a spine instance tree.
                 * Resolves npm URIs to absolute filesystem paths via getCapsuleWithSource.
                 */
                listSpineInstanceTreeCapsuleSourceFiles: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { graph, server }: any, spineInstanceTreeId: string): Promise<any> {
                        if (!spineInstanceTreeId) return { '#': 'Error', method: 'listSpineInstanceTreeCapsuleSourceFiles', message: 'spineInstanceTreeId is required' }

                        // Use CapsuleSpine to list all capsules for this tree
                        const capsulesList = await this.CapsuleSpine.listCapsules({ graph, server }, spineInstanceTreeId)
                        const capsules = capsulesList?.list ?? []

                        const files: any[] = []
                        for (const cap of capsules) {
                            const capsuleName = cap.$id as string
                            if (!capsuleName) continue

                            // Resolve the actual filesystem path via getCapsuleWithSource
                            const raw = await graph.getCapsuleWithSource(spineInstanceTreeId, capsuleName)
                            if (!raw?.source) continue

                            const rawFilepath = raw.source.moduleFilepath as string | undefined
                            if (!rawFilepath) continue

                            // moduleFilepath may be relative — resolve via server's package root
                            const moduleFilepath = rawFilepath.startsWith('/')
                                ? rawFilepath
                                : server.resolvePackagePath(rawFilepath)
                            if (!existsSync(moduleFilepath)) continue

                            const line = raw.source.declarationLine as number | null ?? null
                            const shortName = capsuleName.split('/').pop() ?? capsuleName
                            const capsuleSourceLineRef = line ? `${moduleFilepath}:${line}` : moduleFilepath

                            files.push({
                                '#': 'CapsuleSourceFile',
                                capsuleName,
                                shortName,
                                filePath: moduleFilepath,
                                line,
                                capsuleSourceLineRef,
                            })
                        }

                        // Deduplicate by filePath (multiple capsules may share a file)
                        const seen = new Set<string>()
                        const dedupedFiles: any[] = []
                        for (const f of files) {
                            if (!seen.has(f.filePath)) {
                                seen.add(f.filePath)
                                dedupedFiles.push(f)
                            }
                        }

                        return { '#': 'CapsuleSourceFiles', list: dedupedFiles }
                    }
                },

                /**
                 * Read the contents of a capsule source file by absolute path.
                 */
                getCapsuleSourceFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, filePath: string, format?: string): Promise<any> {
                        if (!filePath || typeof filePath !== 'string') return { '#': 'Error', method: 'getCapsuleSourceFile', message: 'No filePath provided' }
                        if (!filePath.startsWith('/')) return { '#': 'Error', method: 'getCapsuleSourceFile', message: `filePath must be absolute: ${filePath}` }
                        if (!existsSync(filePath)) return { '#': 'Error', method: 'getCapsuleSourceFile', message: `File not found: ${filePath}` }

                        try {
                            let content = await readFile(filePath, 'utf-8')
                            const language = filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript'
                                : filePath.endsWith('.js') || filePath.endsWith('.jsx') ? 'javascript'
                                    : filePath.endsWith('.json') ? 'json'
                                        : filePath.endsWith('.css') ? 'css'
                                            : 'text'
                            if (format === 'simplified') {
                                content = this._simplifyCapsuleSource(content)
                            }
                            return { '#': 'CapsuleSourceFileContent', filePath, content, language, format: format || 'raw' }
                        } catch (err: any) {
                            return { '#': 'Error', method: 'getCapsuleSourceFile', message: err.message ?? String(err) }
                        }
                    }
                },

                /**
                 * Save content to a capsule source file by absolute path.
                 */
                saveCapsuleSourceFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (filePath: string, content: string): Promise<any> {
                        if (!filePath || typeof filePath !== 'string') return { '#': 'Error', method: 'saveCapsuleSourceFile', message: 'No filePath provided' }
                        if (!filePath.startsWith('/')) return { '#': 'Error', method: 'saveCapsuleSourceFile', message: `filePath must be absolute: ${filePath}` }
                        if (typeof content !== 'string') return { '#': 'Error', method: 'saveCapsuleSourceFile', message: 'No content provided' }

                        try {
                            await writeFile(filePath, content, 'utf-8')
                            return { '#': 'CapsuleSourceFileSaved', filePath, ok: true }
                        } catch (err: any) {
                            return { '#': 'Error', method: 'saveCapsuleSourceFile', message: err.message ?? String(err) }
                        }
                    }
                },

                // =============================================================
                // Internal helpers
                // =============================================================

                _getPackageRoot: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any): string {
                        // L6-semantic-models/Framespace/Workbench/ModelQueryMethods.ts → 4 levels up
                        const moduleFilepath = this['#@stream44.studio/encapsulate/structs/Capsule'].rootCapsule.moduleFilepath
                        return join(dirname(moduleFilepath), '..', '..', '..', '..')
                    }
                },

                /**
                 * Simplify capsule source code by stripping boilerplate header/footer.
                 * Extracts content from the spine contract block, handles both '#': {} capsules
                 * and capsules with only dimension refs (no '#': {} block).
                 */
                _simplifyCapsuleSource: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, raw: string): string {
                        let lines = raw.split('\n')

                        // Strip leading block comments (/** ... */) and empty lines
                        let startIdx = 0
                        let inBlockComment = false
                        for (let i = 0; i < lines.length; i++) {
                            const trimmed = lines[i].trim()
                            if (trimmed.length === 0) {
                                startIdx = i + 1
                                continue
                            }
                            if (trimmed.indexOf('/**') !== -1) {
                                inBlockComment = true
                                startIdx = i + 1
                                continue
                            }
                            if (inBlockComment) {
                                if (trimmed.indexOf('*/') !== -1) {
                                    inBlockComment = false
                                    startIdx = i + 1
                                    continue
                                }
                                startIdx = i + 1
                                continue
                            }
                            break
                        }
                        if (startIdx > 0) {
                            lines = lines.slice(startIdx)
                        }

                        // Helper: find matching closing brace from a given line
                        const findClosingBrace = function (fromIdx: number): number {
                            let bc = 0
                            let st = false
                            for (let i = fromIdx; i < lines.length; i++) {
                                for (let c = 0; c < lines[i].length; c++) {
                                    if (lines[i][c] === '{') { bc++; st = true }
                                    else if (lines[i][c] === '}') {
                                        bc--
                                        if (st && bc === 0) return i
                                    }
                                }
                            }
                            return -1
                        }

                        // Helper: compute leading whitespace count
                        const leadingSpaces = function (s: string): number {
                            let n = 0
                            for (let i = 0; i < s.length; i++) {
                                if (s[i] === ' ' || s[i] === '\t') n++
                                else break
                            }
                            return n
                        }

                        // Helper: dedent lines to minIndent, then re-indent with given prefix
                        const dedentAndIndent = function (bodyLines: string[], indent: string): string[] {
                            let mi = 999999
                            for (let i = 0; i < bodyLines.length; i++) {
                                if (bodyLines[i].trim().length === 0) continue
                                const ls = leadingSpaces(bodyLines[i])
                                if (ls < mi) mi = ls
                            }
                            if (mi === 999999) mi = 0
                            const out: string[] = []
                            for (let i = 0; i < bodyLines.length; i++) {
                                if (bodyLines[i].trim().length === 0) out.push('')
                                else out.push(indent + bodyLines[i].slice(mi))
                            }
                            // Remove trailing empty lines
                            while (out.length > 0 && out[out.length - 1].trim() === '') out.pop()
                            return out
                        }

                        // Find the spine contract block
                        const spineContractMarker = 'CapsuleSpineContract.v0'
                        let spineIdx = -1
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].indexOf(spineContractMarker) !== -1) {
                                spineIdx = i
                                break
                            }
                        }

                        if (spineIdx === -1) return raw

                        const spineCloseIdx = findClosingBrace(spineIdx)
                        if (spineCloseIdx === -1) return raw

                        // Extract body inside spine contract block
                        const spineBody = lines.slice(spineIdx + 1, spineCloseIdx)

                        // Remove the Capsule struct line and empty lines around it
                        const capsuleStructMarker = "structs/Capsule'"
                        const filteredBody: string[] = []
                        for (let i = 0; i < spineBody.length; i++) {
                            if (spineBody[i].indexOf(capsuleStructMarker) !== -1) continue
                            filteredBody.push(spineBody[i])
                        }

                        // Remove leading empty lines from filtered body
                        while (filteredBody.length > 0 && filteredBody[0].trim().length === 0) {
                            filteredBody.shift()
                        }

                        // Check if the filtered content is a single '#': { ... } block
                        // by looking at the first non-empty line
                        let hasHashBlock = false
                        let hashLineIdx = -1
                        for (let i = 0; i < filteredBody.length; i++) {
                            if (filteredBody[i].trim().length === 0) continue
                            if (filteredBody[i].indexOf("'#': {") !== -1 || filteredBody[i].indexOf('"#": {') !== -1) {
                                hasHashBlock = true
                                hashLineIdx = i
                            }
                            break
                        }

                        if (hasHashBlock && hashLineIdx !== -1) {
                            // Find the closing brace of '#': { within filteredBody
                            let bc = 0
                            let st = false
                            let closeIdx = -1
                            for (let i = hashLineIdx; i < filteredBody.length; i++) {
                                for (let c = 0; c < filteredBody[i].length; c++) {
                                    if (filteredBody[i][c] === '{') { bc++; st = true }
                                    else if (filteredBody[i][c] === '}') {
                                        bc--
                                        if (st && bc === 0) { closeIdx = i; break }
                                    }
                                }
                                if (closeIdx !== -1) break
                            }

                            if (closeIdx !== -1) {
                                // Extract content inside '#': { ... }
                                const hashBody = filteredBody.slice(hashLineIdx + 1, closeIdx)
                                const dedented = dedentAndIndent(hashBody, '        ')
                                const result: string[] = ['return Encapsulate({', "    '#': {"]
                                for (let i = 0; i < dedented.length; i++) result.push(dedented[i])
                                result.push('    }')
                                result.push('})')
                                return result.join('\n')
                            }
                        }

                        // No '#': { block found — use spine contract content directly
                        // (files with only dimension refs like LoginService.ts)
                        const dedented = dedentAndIndent(filteredBody, '    ')
                        const result: string[] = ['return Encapsulate({']
                        for (let i = 0; i < dedented.length; i++) result.push(dedented[i])
                        result.push('})')
                        return result.join('\n')
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/FramespaceGenesis/L6-semantic-models/Framespace/Workbench/ModelQueryMethods',
    })
}
