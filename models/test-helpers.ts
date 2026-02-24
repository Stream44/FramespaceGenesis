import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { cp, mkdir, readdir, rm, writeFile } from 'fs/promises'

// Package root (FramespaceGenesis)
export const PACKAGE_ROOT = join(import.meta.dir, '..')
export const MODELS_ROOT = import.meta.dir
export const GENERATED_DATA = join(MODELS_ROOT, '.generated-data')

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
            result[key] = normalizeForSnapshot(value)
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
    rootCapsuleName: string
    files: string[]
    cstRoot: string
}

/**
 * Copy generated CST data into models/.generated-data and write a manifest.
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
}
