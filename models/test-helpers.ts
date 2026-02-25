import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { cp, mkdir, readdir, rm, writeFile } from 'fs/promises'
export { join } from 'path'

// Package root (FramespaceGenesis)
export const PACKAGE_ROOT = join(import.meta.dir, '..')
export const MODELS_ROOT = import.meta.dir
export const GENERATED_DATA = join(MODELS_ROOT, '.cst-data')

/**
 * Normalizes snapshot data for stable comparisons across dev and installed environments.
 */
export function normalizeForSnapshot(obj: any): any {
    if (typeof obj === 'string') {
        let s = obj
        if (s.includes(PACKAGE_ROOT)) {
            s = s.replace(new RegExp(PACKAGE_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<PACKAGE_ROOT>')
        }
        const nmMarker = '/node_modules/'
        const lastIdx = s.lastIndexOf(nmMarker)
        if (lastIdx !== -1 && s.includes('node_modules/.bun/')) {
            s = s.substring(0, s.indexOf('node_modules/')) + 'node_modules/' + s.substring(lastIdx + nmMarker.length)
        }
        return s
    }
    if (Array.isArray(obj)) {
        const normalized = obj.map(normalizeForSnapshot)
        if (normalized.length > 0 && normalized[0] && typeof normalized[0] === 'object' && '$id' in normalized[0]) {
            normalized.sort((a: any, b: any) => (a.$id || '').localeCompare(b.$id || ''))
        }
        return normalized
    }
    if (obj && typeof obj === 'object') {
        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
            // TODO: Keep these after we resilve URIs better.
            if (key === 'capsuleSourceNameRefHash' || key === 'capsuleSourceLineRef' || key === 'capsuleSourceNameRef' || key === 'moduleFilepath') continue
            // Replace install-dependent capsuleSourceLineRef keys with stable capsuleSourceUriLineRef
            let normalizedKey = key
            if (value && typeof value === 'object' && (value as any).capsuleSourceUriLineRef) {
                normalizedKey = (value as any).capsuleSourceUriLineRef
            }
            result[normalizedKey] = normalizeForSnapshot(value)
        }
        return result
    }
    return obj
}

/**
 * Recursively list all .csts.json files under a directory.
 */
export async function listAllCstFiles(cstRoot: string): Promise<string[]> {
    const files: string[] = []
    async function scan(dir: string, prefix: string = '') {
        try {
            const entries = await readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
                if (entry.isDirectory()) {
                    await scan(join(dir, entry.name), relPath)
                } else if (entry.name.endsWith('.csts.json')) {
                    files.push(relPath)
                }
            }
        } catch { }
    }
    await scan(cstRoot)
    return files.sort()
}

export interface ManifestEntry {
    modelName: string
    rootCapsuleName: string
    rootCapsuleSourceUriLineRef?: string
    files: string[]
}

export interface ExampleResultForManifest {
    name: string
    rootCapsuleName: string
    files: string[]
    cstRoot: string
}

/**
 * Copy generated CST data into models/.cst-data and write a manifest.
 * @param modelName  The model directory name (e.g. "Encapsulate/CapsuleSpine")
 * @param cstRoot    The CST root directory from the first example result
 * @param results    Array of example results with rootCapsuleName and files
 */
export async function copyGeneratedData(
    modelName: string,
    cstRoot: string,
    results: ExampleResultForManifest[],
) {
    const modelDataDir = join(GENERATED_DATA, modelName)
    await rm(modelDataDir, { recursive: true, force: true }).catch(() => { })
    await mkdir(modelDataDir, { recursive: true })

    // All examples accumulate CST files in the same .~o tree (no clearing between runs).
    // Copy the entire .~o subtree from the example directory into the model data dir.
    const exampleDir = join(cstRoot, '..', '..', '..')
    const dotOPath = join(exampleDir, '.~o')
    if (existsSync(dotOPath)) {
        await cp(dotOPath, join(modelDataDir, '.~o'), { recursive: true })
    }

    // Look up capsuleSourceUriLineRef from CST files for each rootCapsuleName
    const cstCacheDir = join(modelDataDir, '.~o', 'encapsulate.dev', 'static-analysis')
    function findUriLineRef(rootCapsuleName: string, files: string[]): string | undefined {
        for (const relPath of files) {
            const absPath = join(cstCacheDir, relPath)
            if (!existsSync(absPath)) continue
            try {
                const cst = JSON.parse(readFileSync(absPath, 'utf-8'))
                for (const entry of Object.values(cst) as any[]) {
                    if (entry?.source?.capsuleName === rootCapsuleName && entry?.capsuleSourceUriLineRef) {
                        return entry.capsuleSourceUriLineRef
                    }
                }
            } catch { }
        }
        return undefined
    }

    // Write a manifest so the server knows which files belong to which spineInstanceUri
    const manifest: ManifestEntry[] = results.map(r => {
        const uriLineRef = findUriLineRef(r.rootCapsuleName, r.files)
        return {
            modelName,
            rootCapsuleName: r.rootCapsuleName,
            ...(uriLineRef ? { rootCapsuleSourceUriLineRef: uriLineRef } : {}),
            files: r.files,
        }
    })
    await writeFile(join(modelDataDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

    // Return total copied file count for assertion
    const copiedFiles = await listAllCstFiles(join(modelDataDir, '.~o', 'encapsulate.dev', 'static-analysis'))
    return copiedFiles.length
}

// ---------------------------------------------------------------------------
// Engine test helpers
// ---------------------------------------------------------------------------

export interface EngineDefinition {
    name: string
    importer: any
}

export interface EngineTestContext {
    engine: EngineDefinition
    importer: any
    recordResult: (testName: string, passed: boolean) => void
}

/**
 * Create a model test context from the rest-spread `engines` object returned
 * by `run()`. Engine importers are mounted with keys like `'engines/Capsule-Ladybug-v0'`.
 *
 * Returns helpers that share state for example results, engine results, and CST data.
 *
 * Usage:
 * ```ts
 * const { forEngine, saveCstData, saveTestResults, loadCstFile } =
 *     createModelTest({ modelName: 'Encapsulate/CapsuleSpine', engines })
 * ```
 */
// ── framespace.YAML engine config ─────────────────────────────────────
const FRAMESPACE_YAML_PATH = join(PACKAGE_ROOT, 'framespace.YAML')

function loadEngineConfig(): Record<string, { enabled: boolean }> {
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

export function createModelTest({ modelName, engines }: { modelName: string; engines: Record<string, any> }) {
    const ENGINE_PREFIX = 'engines/'
    const engineConfig = loadEngineConfig()

    // Parse engine definitions from rest-spread keys
    const engineDefs: EngineDefinition[] = []
    for (const [key, value] of Object.entries(engines)) {
        if (key.startsWith(ENGINE_PREFIX) && value) {
            engineDefs.push({ name: key.slice(ENGINE_PREFIX.length), importer: value })
        }
    }

    // Shared state
    let _exampleResults: ExampleResultForManifest[] = []
    let _cstRoot: string = ''
    const _engineResults: Record<string, { available: boolean; passed: Record<string, boolean> }> = {}
    for (const def of engineDefs) {
        _engineResults[def.name] = { available: false, passed: {} }
    }

    /**
     * Register example results so that saveCstData, loadCstFile, and
     * forEngine tests can access them. Call this after running examples.
     */
    function setExampleResults(results: ExampleResultForManifest[]) {
        _exampleResults = results
        if (results.length > 0) _cstRoot = results[0].cstRoot
    }

    /**
     * Iterate over mounted engines, calling `fn` for each one.
     * Engines disabled in framespace.YAML are skipped with a yellow warning.
     * If FRAMESPACE_ENGINE_NAME is set, only that engine is tested.
     * The callback receives `{ engine, importer, recordResult }`.
     * The test file is responsible for calling `describe` / `it` inside the callback.
     */
    function forEngine(fn: (ctx: EngineTestContext) => void): void {
        const onlyEngine = process.env.FRAMESPACE_ENGINE_NAME
        for (const def of engineDefs) {
            if (onlyEngine && def.name !== onlyEngine) {
                console.warn(`\x1b[33m⚠  Engine "${def.name}" skipped (FRAMESPACE_ENGINE_NAME=${onlyEngine})\x1b[0m`)
                continue
            }
            const cfg = engineConfig[def.name]
            if (cfg && !cfg.enabled) {
                console.warn(`\x1b[33m⚠  Engine "${def.name}" is disabled in ${FRAMESPACE_YAML_PATH} — skipping tests\x1b[0m`)
                continue
            }
            const results = _engineResults[def.name]
            fn({
                engine: def,
                importer: def.importer,
                recordResult: (testName: string, passed: boolean) => {
                    results.passed[testName] = passed
                    results.available = Object.values(results.passed).every(Boolean)
                },
            })
        }
    }

    /**
     * Copy CST data to .cst-data and write a manifest.
     * Returns the total number of copied CST files.
     */
    async function saveCstData(): Promise<number> {
        return await copyGeneratedData(modelName, _cstRoot, _exampleResults)
    }

    /**
     * Write models.json with engine availability and per-test pass/fail results.
     */
    async function saveTestResults(): Promise<void> {
        const modelsJson: Record<string, any> = {
            [modelName]: { engines: _engineResults },
        }
        const modelsJsonPath = join(GENERATED_DATA, modelName, 'models.json')
        await writeFile(modelsJsonPath, JSON.stringify(modelsJson, null, 2))
    }

    /**
     * Load and parse a CST file by relative path from the cstRoot.
     */
    async function loadCstFile(relPath: string): Promise<any> {
        const absPath = join(_cstRoot, relPath)
        return JSON.parse(readFileSync(absPath, 'utf-8'))
    }

    return {
        engines: engineDefs,
        exampleResults: () => _exampleResults,
        setExampleResults,
        forEngine,
        saveCstData,
        saveTestResults,
        loadCstFile,
    }
}
