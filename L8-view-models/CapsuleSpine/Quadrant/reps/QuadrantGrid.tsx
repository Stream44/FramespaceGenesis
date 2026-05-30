// ── QuadrantGrid rep ────────────────────────────────────────────────
// Renders a Visualization/Quadrant as an HTML table with:
// - Column headers as top rows with colspan for parent columns
// - Row headers as left columns with rowspan for parent rows
// - Grid cells at leaf column/row intersections containing elements
//
// The rep receives {'#': 'QuadrantGrid', spineInstanceTreeId?} and
// fetches column/row data internally via the apiCall context.

import { onMount, onCleanup, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { registerRep } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";
import type { JsonObject, RepContext } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

type ColumnNode = {
    '#': 'QuadrantTreeColumn';
    capsule: { '#': 'Capsule'; $id: string; capsuleSourceLineRef: string };
    column: { '#': 'Column'; label: string };
    capsules: { '#': 'Capsule'; $id: string; capsuleSourceLineRef: string }[];
    columns: ColumnNode[];
};

type RowNode = {
    '#': 'QuadrantTreeRow';
    capsule: { '#': 'Capsule'; $id: string; capsuleSourceLineRef: string };
    row: { '#': 'Row'; label: string };
    capsules: { '#': 'Capsule'; $id: string; capsuleSourceLineRef: string }[];
    rows: RowNode[];
};

type FlatNode = {
    id: string;
    label: string;
    depth: number;
    isLeaf: boolean;
    leafCount: number;      // Number of leaf descendants (for colspan/rowspan)
    leafStartIndex: number; // Index of first leaf descendant
};

type Element = {
    $id: string;
    capsuleSourceLineRef: string;
};

// ═══════════════════════════════════════════════════════════════════════
// Grid Model - Clean data structures for table rendering
// ═══════════════════════════════════════════════════════════════════════

interface GridModel {
    // Column headers organized by depth level (for header rows)
    columnLevels: FlatNode[][];
    // Row headers organized by depth level (for header columns)
    rowLevels: FlatNode[][];
    // Leaf columns and rows for grid cells
    leafColumns: FlatNode[];
    leafRows: FlatNode[];
    // Element placement: leafColIndex -> leafRowIndex -> elements
    cells: Map<number, Map<number, Element[]>>;
    // Dimensions
    maxColDepth: number;
    maxRowDepth: number;
}

function buildGridModel(columnTree: ColumnNode[], rowTree: RowNode[]): GridModel {
    // Flatten and compute metadata for columns
    const { levels: columnLevels, leaves: leafColumns } = flattenTree(
        columnTree,
        (n: ColumnNode) => n.columns,
        (n: ColumnNode) => n.column?.label || shortName(n.capsule.$id),
        (n: ColumnNode) => n.capsule.$id
    );

    // Flatten and compute metadata for rows
    const { levels: rowLevels, leaves: leafRows } = flattenTree(
        rowTree,
        (n: RowNode) => n.rows,
        (n: RowNode) => n.row?.label || shortName(n.capsule.$id),
        (n: RowNode) => n.capsule.$id
    );

    // Build element placement map
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

        // Ensure level array exists
        while (levels.length <= depth) levels.push([]);

        let leafCount: number;
        let leafStartIndex: number;

        if (isLeaf) {
            leafCount = 1;
            leafStartIndex = leafIndex;
            leafIndex++;
        } else {
            // Process children first to compute leaf info
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
): Map<number, Map<number, Element[]>> {
    const cells = new Map<number, Map<number, Element[]>>();

    // Create column ID to leaf index map
    const colIdToIndex = new Map<string, number>();
    leafColumns.forEach((col, idx) => colIdToIndex.set(col.id, idx));

    // Create row ID to leaf index map
    const rowIdToIndex = new Map<string, number>();
    leafRows.forEach((row, idx) => rowIdToIndex.set(row.id, idx));

    // Index all elements by their row
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

    // Walk columns and place elements in cells
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
                        colMap.get(rowIdx)!.push({
                            $id: cap.$id,
                            capsuleSourceLineRef: cap.capsuleSourceLineRef,
                        });
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
// Styles
// ═══════════════════════════════════════════════════════════════════════

const STYLES = {
    table: `
        border-collapse: collapse;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
    `,
    cornerCell: `
        background: #f5f5f5;
        border: none;
        min-width: 80px;
        min-height: 32px;
    `,
    columnHeader: `
        background: linear-gradient(180deg, #e8f4fc 0%, #d4e5f7 100%);
        border: 1px solid #2b5a8c;
        color: #2b5a8c;
        font-weight: 600;
        text-align: center;
        vertical-align: middle;
        padding: 8px 12px;
        min-width: 120px;
        min-height: 32px;
    `,
    columnHeaderFirst: `
        background: linear-gradient(180deg, #e8f4fc 0%, #d4e5f7 100%);
        border: 1px solid #2b5a8c;
        border-left: 1px solid #2b5a8c;
        color: #2b5a8c;
        font-weight: 600;
        text-align: center;
        vertical-align: middle;
        padding: 8px 12px;
        min-width: 120px;
        min-height: 32px;
    `,
    rowHeader: `
        background: linear-gradient(90deg, #e8f4fc 0%, #d4e5f7 100%);
        border: 1px solid #2b5a8c;
        color: #2b5a8c;
        font-weight: 600;
        text-align: center;
        vertical-align: middle;
        padding: 8px 12px;
        min-width: 80px;
        min-height: 60px;
    `,
    rowHeaderFirst: `
        background: linear-gradient(90deg, #e8f4fc 0%, #d4e5f7 100%);
        border: 1px solid #2b5a8c;
        border-top: 1px solid #2b5a8c;
        color: #2b5a8c;
        font-weight: 600;
        text-align: center;
        vertical-align: middle;
        padding: 8px 12px;
        min-width: 80px;
        min-height: 60px;
    `,
    gridCell: `
        border: 1px solid #e0e0e0;
        background: #ffffff;
        vertical-align: top;
        padding: 8px;
        min-width: 120px;
        min-height: 60px;
    `,
    element: `
        background: linear-gradient(180deg, #f5edd8 0%, #e4dbc6 100%);
        border: 1px solid #9a7030;
        border-radius: 4px;
        padding: 4px 8px;
        margin: 2px 0;
        font-size: 11px;
        color: #5a4a36;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 110px;
    `,
    emptyCell: `
        color: #ccc;
        font-style: italic;
        text-align: center;
    `,
};

// ═══════════════════════════════════════════════════════════════════════
// Table Renderer Component
// ═══════════════════════════════════════════════════════════════════════

function QuadrantTable(props: { model: GridModel }): JSX.Element {
    const model = () => props.model;

    return (
        <table style={STYLES.table}>
            {/* Column header rows */}
            <thead>
                <For each={model().columnLevels}>
                    {(levelNodes, levelIdx) => (
                        <tr>
                            {/* Corner cells for row header columns */}
                            <Show when={levelIdx() === 0}>
                                <For each={Array(model().maxRowDepth).fill(0)}>
                                    {(_, colIdx) => (
                                        <th
                                            style={STYLES.cornerCell}
                                            rowspan={model().maxColDepth}
                                        />
                                    )}
                                </For>
                            </Show>
                            {/* Column headers at this level */}
                            <For each={levelNodes}>
                                {(col, colIdx) => (
                                    <th
                                        style={levelIdx() === 0 && colIdx() === 0 ? STYLES.columnHeaderFirst : STYLES.columnHeader}
                                        colspan={col.leafCount}
                                        rowspan={col.isLeaf ? model().maxColDepth - col.depth : 1}
                                    >
                                        {col.label}
                                    </th>
                                )}
                            </For>
                        </tr>
                    )}
                </For>
            </thead>
            {/* Data rows */}
            <tbody>
                <For each={model().leafRows}>
                    {(leafRow, rowIdx) => (
                        <tr>
                            {/* Row headers - only render cells that start at this row */}
                            <For each={model().rowLevels}>
                                {(levelNodes, levelIdx) => {
                                    // Find the node at this level that covers this row
                                    const node = levelNodes.find(n =>
                                        n.leafStartIndex === rowIdx() ||
                                        (n.isLeaf && n.leafStartIndex === rowIdx())
                                    );
                                    return (
                                        <Show when={node && node.leafStartIndex === rowIdx()}>
                                            <th
                                                style={rowIdx() === 0 && levelIdx() === 0 ? STYLES.rowHeaderFirst : STYLES.rowHeader}
                                                rowspan={node!.leafCount}
                                                colspan={node!.isLeaf ? model().maxRowDepth - node!.depth : 1}
                                            >
                                                {node!.label}
                                            </th>
                                        </Show>
                                    );
                                }}
                            </For>
                            {/* Grid cells */}
                            <For each={model().leafColumns}>
                                {(leafCol, colIdx) => {
                                    const elements = model().cells.get(colIdx())?.get(rowIdx()) || [];
                                    return (
                                        <td style={STYLES.gridCell}>
                                            <For each={elements}>
                                                {(elem) => (
                                                    <div style={STYLES.element} title={elem.$id}>
                                                        {shortName(elem.$id)}
                                                    </div>
                                                )}
                                            </For>
                                        </td>
                                    );
                                }}
                            </For>
                        </tr>
                    )}
                </For>
            </tbody>
        </table>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// Logging
// ═══════════════════════════════════════════════════════════════════════

function vlog(...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) {
        console.log("[QuadrantGrid]", ...args);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Rep Registration
// ═══════════════════════════════════════════════════════════════════════

registerRep({
    name: "QuadrantGrid",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "QuadrantGrid",

    render: (data: JsonObject, ctx: RepContext): JSX.Element => {
        const [loading, setLoading] = createSignal(true);
        const [error, setError] = createSignal<string | null>(null);
        const [gridModel, setGridModel] = createSignal<GridModel | null>(null);

        async function fetchData() {
            const spineInstanceTreeId = (data.spineInstanceTreeId as string) || ctx.spineInstanceTreeId;

            vlog("fetchData", {
                dataSpineInstanceTreeId: data.spineInstanceTreeId,
                ctxSpineInstanceUri: ctx.spineInstanceTreeId,
                resolved: spineInstanceTreeId,
                hasApiCall: !!ctx.apiCall,
            });

            if (!spineInstanceTreeId) {
                setError("Missing spineInstanceTreeId");
                setLoading(false);
                return;
            }

            if (!ctx.apiCall) {
                setError("No API client available");
                setLoading(false);
                return;
            }

            try {
                vlog("Fetching column and row trees...");
                const [colResult, rowResult] = await Promise.all([
                    ctx.apiCall("/api/@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Quadrant~ModelQueryMethods/getColumnTree", { spineInstanceTreeId }),
                    ctx.apiCall("/api/@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Quadrant~ModelQueryMethods/getRowTree", { spineInstanceTreeId }),
                ]);

                const columnTree = colResult.result?.columns || [];
                const rowTree = rowResult.result?.rows || [];

                vlog("Fetch complete", {
                    columns: columnTree.length,
                    rows: rowTree.length,
                });

                if (columnTree.length === 0 || rowTree.length === 0) {
                    setError(`No data: ${columnTree.length} columns, ${rowTree.length} rows`);
                    setLoading(false);
                    return;
                }

                const model = buildGridModel(columnTree, rowTree);
                vlog("Grid model built", {
                    colLevels: model.columnLevels.length,
                    rowLevels: model.rowLevels.length,
                    leafCols: model.leafColumns.length,
                    leafRows: model.leafRows.length,
                });

                setGridModel(model);
                setLoading(false);
            } catch (err: any) {
                vlog("ERROR:", err);
                setError(err.message ?? String(err));
                setLoading(false);
            }
        }

        onMount(() => {
            fetchData();
        });

        return (
            <div
                class="rep-quadrant-grid"
                style="width:100%;height:100%;overflow:auto;background:#fafafa;padding:16px;"
            >
                <Show when={loading()}>
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">
                        Loading Quadrant data...
                    </div>
                </Show>
                <Show when={error()}>
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#a63d2f;">
                        Error: {error()}
                    </div>
                </Show>
                <Show when={!loading() && !error() && gridModel()}>
                    <QuadrantTable model={gridModel()!} />
                </Show>
            </div>
        );
    },
});
