// ── Rep Data Provider ─────────────────────────────────────────────────
// Merges data from L6 Quadrant, L6 Codepath APIs into a single
// structure the rep can consume directly.
//
// Works identically on server (test) and client (browser). Callers pass
// an API adapter that matches the L6 API shapes.

// ═══════════════════════════════════════════════════════════════════════
// API Mount Keys
// ═══════════════════════════════════════════════════════════════════════

export const MOUNT_KEY = '@stream44.studio~FramespaceGenesis~L8-view-models~Composite~Quadrant-Codepath~ModelQueryMethods';
export const CODEPATH_KEY = '@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Codepath~ModelQueryMethods';
export const QUADRANT_KEY = '@stream44.studio~FramespaceGenesis~L6-semantic-models~CapsuleSpine~Quadrant~ModelQueryMethods';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export type ColumnNode = {
    '#': 'QuadrantTreeColumn';
    capsule: { '#': 'Capsule'; $id: string; capsuleSourceLineRef: string };
    column: { '#': 'Column'; label: string };
    capsules: { '#': 'Capsule'; $id: string; capsuleSourceLineRef: string }[];
    columns: ColumnNode[];
};

export type RowNode = {
    '#': 'QuadrantTreeRow';
    capsule: { '#': 'Capsule'; $id: string; capsuleSourceLineRef: string };
    row: { '#': 'Row'; label: string };
    capsules: { '#': 'Capsule'; $id: string; capsuleSourceLineRef: string }[];
    rows: RowNode[];
};

export type Component = {
    '#': 'Component';
    $id: string;
    label: string;
    capsuleSourceLineRef: string;
    properties: { '#': 'Property'; name: string; type: string; propertyContractDelegate?: string }[];
    actions: { '#': 'Action'; name: string }[];
    connections: { '#': 'Connection'; propertyName: string; target: string; targetLabel: string; propertyContractDelegate?: string }[];
};

export type CallPathFrame = {
    eventIndex: number;
    add: any[];
    remove: any[];
};

export type FlatNode = {
    id: string;
    label: string;
    depth: number;
    isLeaf: boolean;
    leafCount: number;
    leafStartIndex: number;
};

export type GridModel = {
    columnLevels: FlatNode[][];
    rowLevels: FlatNode[][];
    leafColumns: FlatNode[];
    leafRows: FlatNode[];
    cells: Map<number, Map<number, string[]>>;
    maxColDepth: number;
    maxRowDepth: number;
};

// ═══════════════════════════════════════════════════════════════════════
// API Adapter
// ═══════════════════════════════════════════════════════════════════════

/**
 * Abstract API adapter. On the server (tests), this wraps L6 APIs.
 * On the client (browser), this wraps `ctx.apiCall`.
 */
export interface RepApiAdapter {
    getColumnTree(spineInstanceTreeId: string): Promise<{ columns: ColumnNode[] }>;
    getRowTree(spineInstanceTreeId: string): Promise<{ rows: RowNode[] }>;
    getComponents(spineInstanceTreeId: string): Promise<{ components: Component[] }>;
    getCallPathFrames(spineInstanceTreeId: string): Promise<{ frames: CallPathFrame[] }>;
}

// ═══════════════════════════════════════════════════════════════════════
// Server API Adapter (for tests — wraps L6 APIs from modelServer.api)
// ═══════════════════════════════════════════════════════════════════════

export function createServerAdapter(apis: { codepathApi: any; quadrantApi: any }): RepApiAdapter {
    const { codepathApi, quadrantApi } = apis;
    if (!quadrantApi) throw new Error('createServerAdapter: quadrantApi is required');
    if (!codepathApi) throw new Error('createServerAdapter: codepathApi is required');
    return {
        async getColumnTree(spineInstanceTreeId: string) {
            const result = await quadrantApi.getColumnTree(spineInstanceTreeId);
            return { columns: result.columns || [] };
        },
        async getRowTree(spineInstanceTreeId: string) {
            const result = await quadrantApi.getRowTree(spineInstanceTreeId);
            return { rows: result.rows || [] };
        },
        async getComponents(spineInstanceTreeId: string) {
            const result = await codepathApi.getComponents(spineInstanceTreeId);
            return { components: result.components || [] };
        },
        async getCallPathFrames(spineInstanceTreeId: string) {
            const result = await codepathApi.getCallPathFrames(spineInstanceTreeId);
            return { frames: result.frames || [] };
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════
// Client API Adapter (for browser — wraps ctx.apiCall)
// ═══════════════════════════════════════════════════════════════════════

export function createClientAdapter(apiCall: (path: string, params: Record<string, string>) => Promise<any>): RepApiAdapter {
    const quadrantBase = `/api/${QUADRANT_KEY}`;
    const codepathBase = `/api/${CODEPATH_KEY}`;
    return {
        async getColumnTree(spineInstanceTreeId: string) {
            const r = await apiCall(`${quadrantBase}/getColumnTree`, { spineInstanceTreeId });
            return { columns: r.result?.columns || [] };
        },
        async getRowTree(spineInstanceTreeId: string) {
            const r = await apiCall(`${quadrantBase}/getRowTree`, { spineInstanceTreeId });
            return { rows: r.result?.rows || [] };
        },
        async getComponents(spineInstanceTreeId: string) {
            const r = await apiCall(`${codepathBase}/getComponents`, { spineInstanceTreeId });
            return { components: r.result?.components || [] };
        },
        async getCallPathFrames(spineInstanceTreeId: string) {
            const r = await apiCall(`${codepathBase}/getCallPathFrames`, { spineInstanceTreeId });
            return { frames: r.result?.frames || [] };
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════
// Grid Model Builder (pure logic, no DOM)
// ═══════════════════════════════════════════════════════════════════════

export function buildGridModel(columnTree: ColumnNode[], rowTree: RowNode[]): GridModel {
    const { levels: columnLevels, leaves: leafColumns } = flattenTree(
        columnTree,
        (n: ColumnNode) => n.columns,
        (n: ColumnNode) => n.column?.label || shortName(n.capsule.$id),
        (n: ColumnNode) => n.capsule.$id
    );

    const { levels: rowLevels, leaves: leafRows } = flattenTree(
        rowTree,
        (n: RowNode) => n.rows,
        (n: RowNode) => n.row?.label || shortName(n.capsule.$id),
        (n: RowNode) => n.capsule.$id
    );

    const cells = buildCellMap(columnTree, rowTree, leafColumns, leafRows);

    return {
        columnLevels,
        rowLevels,
        leafColumns,
        leafRows,
        cells,
        maxColDepth: columnLevels.length,
        maxRowDepth: rowLevels.length,
    };
}

function flattenTree<T>(
    nodes: T[],
    getChildren: (n: T) => T[],
    getLabel: (n: T) => string,
    getId: (n: T) => string,
): { levels: FlatNode[][]; leaves: FlatNode[] } {
    const levels: FlatNode[][] = [];
    const leaves: FlatNode[] = [];
    let leafIndex = 0;

    function walk(node: T, depth: number): FlatNode {
        const children = getChildren(node);
        const isLeaf = children.length === 0;

        while (levels.length <= depth) levels.push([]);

        let leafCount: number;
        let leafStartIndex: number;

        if (isLeaf) {
            leafCount = 1;
            leafStartIndex = leafIndex;
            leafIndex++;
        } else {
            const childNodes = children.map(c => walk(c, depth + 1));
            leafCount = childNodes.reduce((sum, c) => sum + c.leafCount, 0);
            leafStartIndex = childNodes[0]?.leafStartIndex ?? 0;
        }

        const flatNode: FlatNode = {
            id: getId(node),
            label: getLabel(node),
            depth,
            isLeaf,
            leafCount,
            leafStartIndex,
        };

        levels[depth].push(flatNode);
        if (isLeaf) leaves.push(flatNode);

        return flatNode;
    }

    nodes.forEach(n => walk(n, 0));
    return { levels, leaves };
}

function buildCellMap(
    columnTree: ColumnNode[],
    rowTree: RowNode[],
    leafColumns: FlatNode[],
    leafRows: FlatNode[],
): Map<number, Map<number, string[]>> {
    const cells = new Map<number, Map<number, string[]>>();

    const colIdToIndex = new Map<string, number>();
    leafColumns.forEach((col, idx) => colIdToIndex.set(col.id, idx));

    const rowIdToIndex = new Map<string, number>();
    leafRows.forEach((row, idx) => rowIdToIndex.set(row.id, idx));

    const elementToRowIndex = new Map<string, number>();
    function indexRowElements(nodes: RowNode[]) {
        for (const row of nodes) {
            const rowIdx = rowIdToIndex.get(row.capsule.$id);
            if (rowIdx !== undefined) {
                for (const cap of row.capsules) {
                    elementToRowIndex.set(cap.$id, rowIdx);
                }
            }
            indexRowElements(row.rows);
        }
    }
    indexRowElements(rowTree);

    function walkColumns(nodes: ColumnNode[]) {
        for (const col of nodes) {
            const colIdx = colIdToIndex.get(col.capsule.$id);
            if (colIdx !== undefined) {
                for (const cap of col.capsules) {
                    const rowIdx = elementToRowIndex.get(cap.$id);
                    if (rowIdx !== undefined) {
                        if (!cells.has(colIdx)) cells.set(colIdx, new Map());
                        const colMap = cells.get(colIdx)!;
                        if (!colMap.has(rowIdx)) colMap.set(rowIdx, []);
                        colMap.get(rowIdx)!.push(cap.$id);
                    }
                }
            }
            walkColumns(col.columns);
        }
    }
    walkColumns(columnTree);

    return cells;
}

function shortName(id: string): string {
    const parts = id.split('/');
    return parts[parts.length - 1] || id;
}

// ═══════════════════════════════════════════════════════════════════════
// Rep Data Provider
// ═══════════════════════════════════════════════════════════════════════

export interface RepData {
    gridModel: GridModel;
    components: Component[];
    componentById: Map<string, Component>;
}

export interface CallPathFramesData {
    frames: CallPathFrame[];
}

// ═══════════════════════════════════════════════════════════════════════
// Anchor Point ID helpers
// ═══════════════════════════════════════════════════════════════════════

export function anchorId(capsuleId: string, kind: 'action' | 'property' | 'connection', name: string): string {
    return `${capsuleId}:${kind}:${name}`;
}

// ── Overlay types ────────────────────────────────────────────────────

export type OverlayLineSegment = {
    '#': 'OverlayLineSegment';
    key: string;
    /** Anchor point ID for line start (capsuleId:kind:name) */
    fromAnchor: string;
    fromSide: 'left' | 'middle' | 'right';
    /** Anchor point ID for line end */
    toAnchor: string;
    toSide: 'left' | 'middle' | 'right';
    color: string;
    dashed: boolean;
    arrow: boolean;
    opacity: number;
    /** Category for grouping/filtering */
    category: 'call' | 'call-entry' | 'call-internal' | 'call-to-mapping' | 'mapping-to-target' | 'property-access' | 'mapping-ref';
};

export type OverlayHighlight = {
    '#': 'OverlayHighlight';
    anchorId: string;
    color: string;
    kind: 'active-function' | 'active-property' | 'active-mapping';
    label?: string;
};

export type OverlayFrame = {
    eventIndex: number;
    lines: OverlayLineSegment[];
    highlights: OverlayHighlight[];
};

// ═══════════════════════════════════════════════════════════════════════
// getOverlayFrame — compute overlay data for a single event index
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute the complete overlay state for a given event index.
 *
 * Walks CallPathFrames up to eventIndex, resolves active call/property
 * lines against component data, and returns logical line segments that
 * reference anchor point IDs (not pixel coordinates).
 *
 * The SVG overlay resolves anchor IDs to pixel rects at render time.
 *
 * Line types (mirroring model-webapp ConnectionOverlay):
 * - Call lines (green, dashed, arrow): callerAction → mapping → targetAction
 * - Property access lines (purple, solid): callerAction → property
 * - Mapping ref lines (blue, dashed, arrow): property → target capsule
 *
 * Highlights:
 * - Active functions (green glow)
 * - Active properties (purple glow, with get/set label)
 * - Active mappings (green background)
 */
export function getOverlayFrame(
    eventIndex: number,
    frames: CallPathFrame[],
    componentById: Map<string, Component>,
): OverlayFrame {
    // Walk frames up to eventIndex to build active line state
    const activeCallLines = new Map<string, any>();
    const activePropLines = new Map<string, any>();

    for (const frame of frames) {
        if (frame.eventIndex > eventIndex) break;
        for (const entry of frame.remove) {
            activeCallLines.delete(entry.lineId);
            activePropLines.delete(entry.lineId);
        }
        for (const entry of frame.add) {
            if (entry['#'] === 'CallLine') {
                activeCallLines.set(entry.lineId, entry);
            } else if (entry['#'] === 'PropertyLine') {
                activePropLines.set(entry.lineId, entry);
            }
        }
    }

    const lines: OverlayLineSegment[] = [];
    const highlights: OverlayHighlight[] = [];
    const seenHighlights = new Set<string>();

    // ── Call lines ────────────────────────────────────────────────────
    for (const raw of activeCallLines.values()) {
        const fromCapsule = raw.fromCapsule || '';
        const toCapsule = raw.toCapsule || '';
        const fromAction = raw.fromAction || '';
        const toAction = raw.toAction || '';
        const isSameCapsule = fromCapsule !== '' && fromCapsule === toCapsule;

        // Resolve mapping property for cross-capsule calls
        let mappingProperty = '';
        if (fromCapsule && toCapsule && !isSameCapsule) {
            const callerComp = componentById.get(fromCapsule);
            if (callerComp) {
                const conn = callerComp.connections.find((c) => c.target === toCapsule);
                if (conn) mappingProperty = conn.propertyName;
            }
        }

        const fromAnchor = fromCapsule && fromAction ? anchorId(fromCapsule, 'action', fromAction) : '';
        const toAnchor = toCapsule && toAction ? anchorId(toCapsule, 'action', toAction) : '';

        if (fromAnchor && toAnchor && mappingProperty && !isSameCapsule) {
            // Cross-capsule call through mapping:
            // Line 1: caller action (middle) → mapping row (middle) [vertical within caller card]
            const mappingAnchor = anchorId(fromCapsule, 'connection', mappingProperty);
            lines.push({
                '#': 'OverlayLineSegment',
                key: `call-to-mapping-${raw.lineId}`,
                fromAnchor,
                fromSide: 'middle',
                toAnchor: mappingAnchor,
                toSide: 'middle',
                color: '#16a34a',
                dashed: false,
                arrow: false,
                opacity: 0.7,
                category: 'call-to-mapping',
            });
            // Line 2: mapping row (right) → target action (left)
            lines.push({
                '#': 'OverlayLineSegment',
                key: `mapping-to-target-${raw.lineId}`,
                fromAnchor: mappingAnchor,
                fromSide: 'right',
                toAnchor,
                toSide: 'left',
                color: '#16a34a',
                dashed: false,
                arrow: true,
                opacity: 0.7,
                category: 'mapping-to-target',
            });
            // Highlight the mapping
            const mhKey = `mapping:${fromCapsule}:${mappingProperty}`;
            if (!seenHighlights.has(mhKey)) {
                seenHighlights.add(mhKey);
                highlights.push({
                    '#': 'OverlayHighlight',
                    anchorId: mappingAnchor,
                    color: 'rgba(22, 163, 74, 0.15)',
                    kind: 'active-mapping',
                });
            }
        } else if (fromAnchor && toAnchor && isSameCapsule) {
            // Same-capsule call: direct vertical line (solid green)
            lines.push({
                '#': 'OverlayLineSegment',
                key: `call-internal-${raw.lineId}`,
                fromAnchor,
                fromSide: 'middle',
                toAnchor,
                toSide: 'middle',
                color: '#16a34a',
                dashed: false,
                arrow: true,
                opacity: 0.7,
                category: 'call-internal',
            });
        } else if (!fromAnchor && toAnchor) {
            // Entry-point call (no caller): stub arrow into target
            lines.push({
                '#': 'OverlayLineSegment',
                key: `call-entry-${raw.lineId}`,
                fromAnchor: '',
                fromSide: 'left',
                toAnchor,
                toSide: 'left',
                color: '#16a34a',
                dashed: true,
                arrow: true,
                opacity: 0.6,
                category: 'call-entry',
            });
        } else if (fromAnchor && toAnchor && !isSameCapsule) {
            // Cross-capsule call without mapping found (direct line fallback)
            // Draw from caller action right to target action left
            lines.push({
                '#': 'OverlayLineSegment',
                key: `call-direct-${raw.lineId}`,
                fromAnchor,
                fromSide: 'right',
                toAnchor,
                toSide: 'left',
                color: '#16a34a',
                dashed: false,
                arrow: true,
                opacity: 0.7,
                category: 'call',
            });
        } else if (fromAnchor && !toAnchor) {
            // Unresolved target (fallback stub)
            lines.push({
                '#': 'OverlayLineSegment',
                key: `call-direct-${raw.lineId}`,
                fromAnchor,
                fromSide: 'right',
                toAnchor: toCapsule && toAction ? anchorId(toCapsule, 'action', toAction) : '',
                toSide: 'left',
                color: '#22c55e',
                dashed: true,
                arrow: true,
                opacity: 0.7,
                category: 'call',
            });
        }

        // Highlight target function
        if (toCapsule && toAction) {
            const fhKey = `fn:${toCapsule}:${toAction}`;
            if (!seenHighlights.has(fhKey)) {
                seenHighlights.add(fhKey);
                highlights.push({
                    '#': 'OverlayHighlight',
                    anchorId: anchorId(toCapsule, 'action', toAction),
                    color: '#22c55e',
                    kind: 'active-function',
                });
            }
        }
        // Highlight caller function too (if it exists)
        if (fromCapsule && fromAction) {
            const fhKey = `fn:${fromCapsule}:${fromAction}`;
            if (!seenHighlights.has(fhKey)) {
                seenHighlights.add(fhKey);
                highlights.push({
                    '#': 'OverlayHighlight',
                    anchorId: anchorId(fromCapsule, 'action', fromAction),
                    color: '#22c55e',
                    kind: 'active-function',
                });
            }
        }
    }

    // ── Property lines ────────────────────────────────────────────────
    for (const raw of activePropLines.values()) {
        const capsuleId = raw.capsuleId || '';
        const propertyName = raw.propertyName || '';
        const fromCapsule = raw.fromCapsule || '';
        const fromAction = raw.fromAction || '';
        const callerAnchor = fromCapsule && fromAction ? anchorId(fromCapsule, 'action', fromAction) : '';

        if (raw.isMappingRef) {
            // Mapping-ref property: lives in "connects with" section → connection anchor
            const connAnchor = capsuleId && propertyName ? anchorId(capsuleId, 'connection', propertyName) : '';

            // Line: caller action → connection row (getter access of mapping property)
            if (callerAnchor && connAnchor) {
                lines.push({
                    '#': 'OverlayLineSegment',
                    key: `prop-access-${raw.lineId}`,
                    fromAnchor: callerAnchor,
                    fromSide: 'middle',
                    toAnchor: connAnchor,
                    toSide: 'middle',
                    color: '#16a34a',
                    dashed: false,
                    arrow: false,
                    opacity: 0.7,
                    category: 'property-access',
                });
            }
            // Highlight the connection row (active-mapping)
            if (connAnchor) {
                const mhKey = `mapping:${capsuleId}:${propertyName}`;
                if (!seenHighlights.has(mhKey)) {
                    seenHighlights.add(mhKey);
                    highlights.push({
                        '#': 'OverlayHighlight',
                        anchorId: connAnchor,
                        color: 'rgba(22, 163, 74, 0.15)',
                        kind: 'active-mapping',
                    });
                }
            }
        } else {
            // Regular property: lives in "properties" section → property anchor
            const propAnchor = capsuleId && propertyName ? anchorId(capsuleId, 'property', propertyName) : '';

            // Line: caller action → property row (red, solid)
            // Getter: arrow at source (data flows back up), Setter: arrow at target
            if (callerAnchor && propAnchor) {
                const isGetter = raw.eventType !== 'set';
                lines.push({
                    '#': 'OverlayLineSegment',
                    key: `prop-access-${raw.lineId}`,
                    fromAnchor: isGetter ? propAnchor : callerAnchor,
                    fromSide: 'middle',
                    toAnchor: isGetter ? callerAnchor : propAnchor,
                    toSide: 'middle',
                    color: '#dc2626',
                    dashed: false,
                    arrow: true,
                    opacity: 0.7,
                    category: 'property-access',
                });
            }
            // Highlight the property row
            if (propAnchor) {
                const phKey = `prop:${capsuleId}:${propertyName}`;
                if (!seenHighlights.has(phKey)) {
                    seenHighlights.add(phKey);
                    highlights.push({
                        '#': 'OverlayHighlight',
                        anchorId: propAnchor,
                        color: '#dc2626',
                        kind: 'active-property',
                        label: raw.eventType === 'set' ? '← set' : '→ get',
                    });
                }
            }
        }
    }

    return { eventIndex, lines, highlights };
}

export interface RepDataProvider {
    /** Fetch and merge grid structure + components. */
    fetchRepData(spineInstanceTreeId: string): Promise<RepData>;
    /** Fetch call-path state transitions for the full model run. */
    fetchCallPathFrames(spineInstanceTreeId: string): Promise<CallPathFramesData>;
    /** Compute overlay state for a single event index. */
    getOverlayFrame(spineInstanceTreeId: string, eventIndex: number): Promise<OverlayFrame>;
}

export function createRepDataProvider(api: RepApiAdapter): RepDataProvider {
    return {
        async fetchRepData(spineInstanceTreeId: string): Promise<RepData> {
            const [colResult, rowResult, componentsResult] = await Promise.all([
                api.getColumnTree(spineInstanceTreeId),
                api.getRowTree(spineInstanceTreeId),
                api.getComponents(spineInstanceTreeId),
            ]);

            const gridModel = buildGridModel(colResult.columns, rowResult.rows);
            const components = componentsResult.components;

            const componentById = new Map<string, Component>();
            for (const comp of components) {
                componentById.set(comp.$id, comp);
            }

            return { gridModel, components, componentById };
        },

        async fetchCallPathFrames(spineInstanceTreeId: string): Promise<CallPathFramesData> {
            const result = await api.getCallPathFrames(spineInstanceTreeId);
            return { frames: result.frames };
        },

        async getOverlayFrame(spineInstanceTreeId: string, eventIndex: number): Promise<OverlayFrame> {
            const [repData, framesData] = await Promise.all([
                this.fetchRepData(spineInstanceTreeId),
                this.fetchCallPathFrames(spineInstanceTreeId),
            ]);
            return getOverlayFrame(eventIndex, framesData.frames, repData.componentById);
        },
    };
}
