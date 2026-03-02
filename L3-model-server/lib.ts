/**
 * Normalize an object for snapshot testing.
 * - Replaces absolute package root paths with `<PACKAGE_ROOT>`
 * - Normalises bun node_modules paths
 * - Strips volatile fields (capsuleSourceNameRefHash, capsuleSourceLineRef, capsuleSourceNameRef, moduleFilepath, instanceId)
 * - Normalises parentMap (instanceId-keyed) into a sorted capsuleSourceUriLineRef-keyed map
 * - Sorts object keys for deterministic ordering
 * - Sorts arrays of objects by `$id` for deterministic ordering
 */
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
        if (normalized.length > 0 && normalized[0] && typeof normalized[0] === 'object' && '$id' in normalized[0]) {
            normalized.sort((a: any, b: any) => (a.$id || '').localeCompare(b.$id || ''))
        }
        return normalized
    }
    if (obj && typeof obj === 'object') {
        if (obj instanceof Set) return obj
        const result: any = {}
        const entries = Object.entries(obj)
        // Sort entries by key for deterministic output
        entries.sort((a, b) => a[0].localeCompare(b[0]))
        for (const [key, value] of entries) {
            if (key === 'capsuleSourceNameRefHash' || key === 'capsuleSourceLineRef' || key === 'capsuleSourceNameRef' || key === 'moduleFilepath' || key === 'instanceId') continue
            // Normalize parentMap: replace instanceId keys/values with capsuleSourceUriLineRef
            if (key === 'parentMap' && value && typeof value === 'object') {
                // Build instanceId → capsuleSourceUriLineRef lookup from sibling 'instances' map
                const instances = obj.instances ?? obj.capsuleInfo ?? {}
                const idToRef: Record<string, string> = {}
                for (const inst of Object.values(instances) as any[]) {
                    if (inst?.instanceId && inst?.capsuleSourceUriLineRef) {
                        idToRef[inst.instanceId] = inst.capsuleSourceUriLineRef
                    }
                }
                const normalizedParentMap: Record<string, string> = {}
                for (const [childId, parentId] of Object.entries(value) as [string, string][]) {
                    const childRef = idToRef[childId] ?? childId
                    const parentRef = idToRef[parentId] ?? parentId
                    normalizedParentMap[childRef] = parentRef
                }
                // Sort the normalized parentMap by key
                const sortedParentMap: Record<string, string> = {}
                for (const k of Object.keys(normalizedParentMap).sort()) {
                    sortedParentMap[k] = normalizedParentMap[k]
                }
                result[key] = sortedParentMap
                continue
            }
            let normalizedKey = key
            if (value && typeof value === 'object' && (value as any).capsuleSourceUriLineRef) {
                normalizedKey = (value as any).capsuleSourceUriLineRef
            }
            result[normalizedKey] = normalizeForSnapshot(value, packageRoot)
        }
        return result
    }
    return obj
}
