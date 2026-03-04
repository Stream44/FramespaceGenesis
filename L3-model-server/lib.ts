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
