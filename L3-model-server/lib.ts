/**
 * Normalize an object for snapshot testing.
 * - Replaces absolute package root paths with `<PACKAGE_ROOT>`
 * - Normalises bun node_modules paths
 * - Strips volatile fields (capsuleSourceNameRefHash, capsuleSourceLineRef, capsuleSourceNameRef, moduleFilepath, instanceId)
 * - Replaces volatile hash `$id` values with `capsuleSourceUriLineRef` when available
 * - Normalises parentMap (instanceId-keyed) into a sorted capsuleSourceUriLineRef-keyed map
 * - Sorts object keys (by *normalised* key) for deterministic ordering
 * - Sorts all arrays (strings lexicographically, objects by `$id` or `capsuleSourceUriLineRef`)
 */

const VOLATILE_KEYS = new Set([
    'capsuleSourceNameRefHash',
    'capsuleSourceLineRef',
    'moduleFilepath',
    'instanceId',
    'capsuleSourceUriLineRefInstanceId',
])

const CHANGED_FOR_CONSISTENCY = '<CHANGED_FOR_CONSISTENCY>'

function isVolatileHash(value: string): boolean {
    return /^[0-9a-f]{32,}$/.test(value)
}

/**
 * Check if a path references an external package (not a local project file).
 * External paths include:
 * - Workspace-linked: `../../../domain/packages/pkg/...`
 * - Absolute workspace: `/Users/.../spaces/genesis/domain/packages/pkg/...`
 * - Bun resolved: `node_modules/.bun/@scope+pkg@ver/...`
 * - Direct node_modules: `node_modules/@scope/pkg/...`
 */
function isExternalPath(s: string): boolean {
    if (s.startsWith('../')) return true
    if (s.startsWith('node_modules/')) return true
    if (/^\/.*\/spaces\/genesis\//.test(s)) return true
    if (/^\$\.\.\//.test(s)) return true
    if (/^\$node_modules\//.test(s)) return true
    if (/^\$\//.test(s)) return true
    return false
}

/**
 * Normalize an external package path to a canonical form.
 * Handles:
 * - Workspace-linked relative paths: `../../../encapsulate.dev/packages/encapsulate/...`
 * - Bun resolved node_modules: `node_modules/.bun/@scope+pkg@ver/.../node_modules/@scope/pkg/...`
 * - Direct node_modules: `node_modules/@scope/pkg/...`
 * - Absolute workspace paths: `/Users/.../spaces/genesis/domain/packages/pkg/...`
 * All are normalized to `node_modules/@scope/pkg/...`.
 * Note: workspace-linked domain (e.g. @encapsulate.dev) may differ from published scope
 * (e.g. @stream44.studio). Use normalizeCompoundPathValue for path:name values.
 */
function normalizeExternalPath(s: string): string {
    // Workspace-linked: ../../../<domain>/packages/<pkg>/rest → node_modules/@<domain>/<pkg>/rest
    const wsLinked = s.match(/^(\$?)((?:\.\.\/)+)([^/]+)\/packages\/([^/]+)\/(.*)$/)
    if (wsLinked) {
        const [, dollarPrefix, , domain, pkg, rest] = wsLinked
        return `${dollarPrefix}node_modules/@${domain}/${pkg}/${rest}`
    }
    // Absolute workspace path: /Users/.../spaces/genesis/<domain>/packages/<pkg>/rest
    const absWs = s.match(/^(\$?)\/.*\/spaces\/genesis\/([^/]+)\/packages\/([^/]+)\/(.*)$/)
    if (absWs) {
        const [, dollarPrefix, domain, pkg, rest] = absWs
        return `${dollarPrefix}node_modules/@${domain}/${pkg}/${rest}`
    }
    // Bun resolved: node_modules/.bun/@scope+pkg@ver/.../node_modules/@scope/pkg/rest
    const bunResolved = s.match(/^(\$?)node_modules\/\.bun\/.*\/node_modules\/(.*)$/)
    if (bunResolved) {
        return `${bunResolved[1]}node_modules/${bunResolved[2]}`
    }
    return s
}

/**
 * Normalize compound values like "filepath.ts:capsuleName" or "$filepath.ts:lineNumber".
 * When the filepath references an external package, use the capsuleName portion
 * (after .ts:) to reconstruct a canonical path, avoiding scope-mapping issues
 * between workspace-linked (e.g. @encapsulate.dev) and published (e.g. @stream44.studio) scopes.
 */
function normalizeCompoundPathValue(s: string): string {
    // Match filepath.ts:rest where filepath is external
    const tsColonIdx = s.indexOf('.ts:')
    if (tsColonIdx === -1) return normalizeExternalPath(s)

    const filepath = s.substring(0, tsColonIdx + 3) // include .ts
    const rest = s.substring(tsColonIdx + 4) // after .ts:

    // Check if filepath references an external package
    const dollarPrefix = filepath.startsWith('$') ? '$' : ''
    const cleanFilepath = dollarPrefix ? filepath.substring(1) : filepath

    if (!isExternalPath(cleanFilepath)) {
        // Local file — just normalize normally
        return normalizeExternalPath(s)
    }

    // For external paths, reconstruct filepath from the capsuleName/rest portion
    // e.g. rest = "@stream44.studio/encapsulate/structs/Capsule" → filepath = "node_modules/@stream44.studio/encapsulate/structs/Capsule.ts"
    // e.g. rest = "18" (line number for spineContractCapsuleInstanceId) — use normalizeExternalPath on the filepath part
    if (rest.startsWith('@') || rest.includes('/')) {
        // rest looks like a capsuleName — reconstruct filepath from it
        return `${dollarPrefix}node_modules/${rest.replace(/@[^/]+\//, (m) => m)}.ts:${rest}`
    }

    // rest is a line number or other non-path value — normalize filepath part
    return `${normalizeExternalPath(filepath)}:${rest}`
}

export function normalizeForSnapshot(obj: any, packageRoot?: string): any {
    if (typeof obj === 'string') {
        let s = obj
        if (packageRoot && s.includes(packageRoot)) {
            s = s.replace(new RegExp(packageRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<PACKAGE_ROOT>')
        }
        const nmMarker = '/node_modules/'
        const lastIdx = s.lastIndexOf(nmMarker)
        if (lastIdx !== -1 && s.includes('node_modules/.bun/')) {
            s = s.substring(0, s.indexOf('node_modules/')) + 'node_modules/' + s.substring(lastIdx + nmMarker.length)
        }
        // Normalize workspace-linked or absolute external paths
        s = normalizeExternalPath(s)
        return s
    }
    if (Array.isArray(obj)) {
        const normalized = obj.map(item => normalizeForSnapshot(item, packageRoot))
        // Sort arrays for deterministic output
        if (normalized.length > 1) {
            if (typeof normalized[0] === 'string') {
                // Plain string arrays — sort lexicographically
                normalized.sort()
            } else if (normalized[0] && typeof normalized[0] === 'object') {
                // Object arrays — sort by $id, then by capsuleSourceUriLineRef
                const sortKey = (o: any) => o.$id || o.capsuleSourceUriLineRef || ''
                normalized.sort((a: any, b: any) => sortKey(a).localeCompare(sortKey(b)))
            }
        }
        return normalized
    }
    if (obj && typeof obj === 'object') {
        if (obj instanceof Set) return obj

        // Normalize parentMap: replace instanceId keys/values with capsuleSourceUriLineRef
        // Must be done before general processing because it needs raw sibling data
        const parentMapRaw = obj.parentMap
        let normalizedParentMap: Record<string, string> | undefined
        if (parentMapRaw && typeof parentMapRaw === 'object') {
            const instances = obj.instances ?? obj.capsuleInfo ?? {}
            const idToRef: Record<string, string> = {}
            for (const inst of Object.values(instances) as any[]) {
                if (inst?.instanceId && inst?.capsuleSourceUriLineRef) {
                    idToRef[inst.instanceId] = inst.capsuleSourceUriLineRef
                }
            }
            const pm: Record<string, string> = {}
            for (const [childId, parentId] of Object.entries(parentMapRaw) as [string, string][]) {
                pm[idToRef[childId] ?? childId] = idToRef[parentId] ?? parentId
            }
            const sorted: Record<string, string> = {}
            for (const k of Object.keys(pm).sort()) sorted[k] = pm[k]
            normalizedParentMap = sorted
        }

        // First pass: build normalised key-value pairs
        const pairs: [string, any][] = []
        for (const [key, value] of Object.entries(obj)) {
            if (VOLATILE_KEYS.has(key)) continue
            // Sanitize rawEvent: contains embedded JSON with volatile hashes and paths
            if (key === 'rawEvent' && typeof value === 'string') {
                pairs.push([key, CHANGED_FOR_CONSISTENCY])
                continue
            }
            // Sanitize callerFilepath: absolute paths differ between local dev and installed packages
            // Normalize to just the filename for consistency across environments
            if (key === 'callerFilepath' && typeof value === 'string') {
                pairs.push([key, CHANGED_FOR_CONSISTENCY])
                continue
            }
            // Normalize filepath fields: these contain absolute or relative paths to source files
            // that differ between workspace-linked and node_modules installs
            if (key === 'filepath' && typeof value === 'string') {
                pairs.push([key, normalizeExternalPath(value)])
                continue
            }
            // Normalize spineContractCapsuleInstanceId: contains compound path references like
            // $../../../encapsulate.dev/packages/encapsulate/structs/Capsule.ts:18
            if (key === 'spineContractCapsuleInstanceId' && typeof value === 'string') {
                pairs.push([key, normalizeCompoundPathValue(value)])
                continue
            }
            // Normalize capsuleSourceNameRef: path prefix differs between local workspace and node_modules
            // Format is "<path>:<capsuleName>" - keep only the capsuleName part after ":"
            if (key === 'capsuleSourceNameRef' && typeof value === 'string') {
                const colonIdx = (value as string).indexOf(':')
                if (colonIdx !== -1) {
                    pairs.push([key, (value as string).substring(colonIdx + 1)])
                } else {
                    pairs.push([key, value])
                }
                continue
            }
            if (key === 'parentMap') {
                pairs.push([key, normalizedParentMap!])
                continue
            }
            // Replace volatile hash $id with stable capsuleSourceUriLineRef
            if (key === '$id' && typeof value === 'string' && isVolatileHash(value)) {
                const ref = obj.capsuleSourceUriLineRef
                if (ref) {
                    pairs.push([key, normalizeForSnapshot(ref, packageRoot)])
                    continue
                }
            }
            // Normalize non-hash $id that contains filepath:name compound values
            // e.g. ../../../encapsulate.dev/packages/encapsulate/structs/Capsule.ts:@stream44.studio/encapsulate/structs/Capsule
            if (key === '$id' && typeof value === 'string' && !isVolatileHash(value) && value.includes('.ts:')) {
                pairs.push([key, normalizeCompoundPathValue(value)])
                continue
            }
            let normalizedKey = key
            if (value && typeof value === 'object' && (value as any).capsuleSourceUriLineRef) {
                normalizedKey = (value as any).capsuleSourceUriLineRef
            }
            pairs.push([normalizedKey, normalizeForSnapshot(value, packageRoot)])
        }

        // Sort by the *normalised* key
        pairs.sort((a, b) => a[0].localeCompare(b[0]))

        const result: any = {}
        for (const [k, v] of pairs) result[k] = v
        return result
    }
    return obj
}
