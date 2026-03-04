// ── CodepathGrid rep ─────────────────────────────────────────────────
// Renders a Visualization/Codepath as a grid with:
// - Column headers: one per capsule that participated in the execution
// - Rows: one per membrane event, showing event type and property
// - Cells placed in the column of the event's owning capsule
//
// The rep receives {'#': 'SwimlaneView', spineInstanceTreeId?} and
// fetches visualization data internally via the apiCall context.

import { onMount, createSignal, createMemo, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { registerRep } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";
import type { JsonObject, RepContext } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

type Column = {
    '#': 'CodepathColumn';
    $id: string;
    index: number;
    label: string;
};

type Cell = {
    '#': 'CodepathCell';
    columnIndex: number;
    eventType: string;
    membrane: 'external' | 'internal';
    propertyName: string;
    callEventIndex?: number;
    resolvedCaller?: { capsuleSourceNameRef: string; propertyName: string };
    callerColumnIndex?: number;
    dataSeen?: string;
    isMappingRef?: boolean;
    mappingTargetRef?: string;
    mappingTargetColumnIndex?: number;
    activeInvocationCount: number;
    rawEvent?: Record<string, any>;
};

type Row = {
    '#': 'CodepathRow';
    $id: string;
    index: number;
    eventIndex: number;
    cell: Cell;
};

type CodepathModel = {
    columns: Column[];
    rows: Row[];
};

// ═══════════════════════════════════════════════════════════════════════
// Styling
// ═══════════════════════════════════════════════════════════════════════

const EVENT_COLORS: Record<string, string> = {
    'call': '#3b82f6',
    'call-result': '#22c55e',
    'get': '#f59e0b',
    'set': '#ef4444',
};

const EVENT_BG: Record<string, string> = {
    'call': '#eff6ff',
    'call-result': '#f0fdf4',
    'get': '#fffbeb',
    'set': '#fef2f2',
};

// Internal events use muted/dashed styling to distinguish from external
const INTERNAL_EVENT_COLORS: Record<string, string> = {
    'call': '#93c5fd',
    'call-result': '#86efac',
    'get': '#fcd34d',
    'set': '#fca5a5',
};

const INTERNAL_EVENT_BG: Record<string, string> = {
    'call': '#f8fafc',
    'call-result': '#f8fdf9',
    'get': '#fffef5',
    'set': '#fef8f8',
};

function eventColor(eventType: string, membrane: string = 'external'): string {
    if (membrane === 'internal') {
        return INTERNAL_EVENT_COLORS[eventType] || '#9ca3af';
    }
    return EVENT_COLORS[eventType] || '#6b7280';
}

function eventBg(eventType: string, membrane: string = 'external'): string {
    if (membrane === 'internal') {
        return INTERNAL_EVENT_BG[eventType] || '#fafafa';
    }
    return EVENT_BG[eventType] || '#f9fafb';
}

// ═══════════════════════════════════════════════════════════════════════
// Property State Accumulator
// ═══════════════════════════════════════════════════════════════════════

type PropertyEntry = {
    capsule: string;
    columnIndex: number;
    property: string;
    value: string;
    eventType: 'set' | 'get';
    lastChangedAt: number;   // row index where last updated
    isMappingRef?: boolean;
    mappingTargetColumnIndex?: number;
    mappingTargetLabel?: string;
};

type PropertyState = {
    // key: "columnIndex:propertyName"
    entries: Map<string, PropertyEntry>;
    // The property key active at the current event (if set/get)
    activeKey: string | null;
    activeType: 'set' | 'get' | null;
};

// Values are JSON-stringified from the server, so we need to check for
// stringified empty/null/undefined values as well as actual empty strings.
const EMPTY_DATA_VALUES = new Set(['', '""', 'null', 'undefined', '"undefined"', '"null"']);

function isEmptyDataSeen(dataSeen: string | undefined): boolean {
    if (!dataSeen) return true;
    return EMPTY_DATA_VALUES.has(dataSeen.trim());
}

function computePropertyState(
    rows: Row[],
    columns: Column[],
    upToPosition: number
): PropertyState {
    const entries = new Map<string, PropertyEntry>();
    let activeKey: string | null = null;
    let activeType: 'set' | 'get' | null = null;

    // Build a lookup from column $id to column for resolving mappingTargetRef
    const colById = new Map<string, Column>();
    for (const col of columns) colById.set(col.$id, col);

    for (let i = 0; i <= upToPosition && i < rows.length; i++) {
        const row = rows[i];
        const { eventType, columnIndex, propertyName, dataSeen } = row.cell;
        if (eventType === 'set' || eventType === 'get') {
            const key = `${columnIndex}:${propertyName}`;
            const capsuleLabel = columns.find(c => c.index === columnIndex)?.label ?? `Col ${columnIndex}`;

            const isMappingRef = row.cell.isMappingRef ?? false;

            // Resolve mapping target label: try columnIndex first, then $id lookup
            let mappingTargetLabel: string | undefined;
            const mtci = row.cell.mappingTargetColumnIndex;
            if (mtci !== undefined) {
                mappingTargetLabel = columns.find(c => c.index === mtci)?.label ?? `Col ${mtci}`;
            } else if (isMappingRef && row.cell.mappingTargetRef) {
                // Column $id is the capsuleSourceNameRef
                const targetCol = colById.get(row.cell.mappingTargetRef);
                mappingTargetLabel = targetCol?.label;
            }

            const empty = isEmptyDataSeen(dataSeen);

            if (eventType === 'set') {
                if (empty && !isMappingRef) {
                    // Set to empty and not a mapping → remove from display
                    entries.delete(key);
                } else {
                    entries.set(key, {
                        capsule: capsuleLabel,
                        columnIndex,
                        property: propertyName,
                        value: isMappingRef ? '' : (dataSeen ?? ''),
                        eventType: 'set',
                        lastChangedAt: i,
                        isMappingRef,
                        mappingTargetColumnIndex: mtci,
                        mappingTargetLabel,
                    });
                }
            } else if (eventType === 'get') {
                // For gets: if mapping, always track; otherwise only if non-empty & not yet tracked
                if (isMappingRef) {
                    if (!entries.has(key)) {
                        entries.set(key, {
                            capsule: capsuleLabel,
                            columnIndex,
                            property: propertyName,
                            value: '',
                            eventType: 'get',
                            lastChangedAt: i,
                            isMappingRef,
                            mappingTargetColumnIndex: mtci,
                            mappingTargetLabel,
                        });
                    }
                } else if (!empty && !entries.has(key)) {
                    entries.set(key, {
                        capsule: capsuleLabel,
                        columnIndex,
                        property: propertyName,
                        value: dataSeen ?? '',
                        eventType: 'get',
                        lastChangedAt: i,
                    });
                }
            }
            // Mark the current event's property as active only on the last row
            if (i === upToPosition) {
                activeKey = key;
                activeType = eventType;
            }
        }
    }

    return { entries, activeKey, activeType };
}

// ═══════════════════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════════════════

function CodepathTable(props: { model: CodepathModel; activeEventIndex?: () => number }): JSX.Element {
    const { columns, rows } = props.model;

    // Sequential position from the timeline (0..N-1)
    const activeSeqIdx = createMemo(() => props.activeEventIndex?.() ?? -1);

    // Memo: convert the sequential activeEventIndex from the timeline
    // to the sparse eventIndex used by swimlane rows
    const activeRowEventIndex = createMemo(() => {
        const seqIdx = activeSeqIdx();
        if (seqIdx < 0 || seqIdx >= rows.length) return -1;
        // The timeline position i corresponds to rows[i].eventIndex
        const mapped = rows[seqIdx]?.eventIndex ?? -1;
        return mapped;
    });

    // Accumulated property state up to the current timeline position
    const propertyState = createMemo(() =>
        computePropertyState(rows, columns, activeSeqIdx())
    );

    const [hoveredEvent, setHoveredEvent] = createSignal<Record<string, any> | null>(null);
    const [hoveredRect, setHoveredRect] = createSignal<{ left: number; right: number; top: number; bottom: number }>({ left: 0, right: 0, top: 0, bottom: 0 });
    const [copied, setCopied] = createSignal(false);

    const handleMouseEnter = (e: MouseEvent, rawEvent: Record<string, any> | undefined) => {
        if (rawEvent) {
            const el = e.currentTarget as HTMLElement;
            const rect = el.getBoundingClientRect();
            setHoveredEvent(rawEvent);
            setHoveredRect({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
        }
    };

    const handleMouseLeave = () => {
        setHoveredEvent(null);
    };

    const handleClick = async (rawEvent: Record<string, any> | undefined) => {
        if (!rawEvent) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(rawEvent, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch { /* ignore */ }
    };

    // Position tooltip to the right of the cell; if not enough space, to the left
    // Max-width is from cell edge to browser edge; horizontal scroll if content overflows
    const tooltipStyle = () => {
        const r = hoveredRect();
        const spaceRight = window.innerWidth - r.right - 16; // 8px gap + 8px margin
        const spaceLeft = r.left - 16;
        const positionRight = spaceLeft > spaceRight;

        let left: string;
        let right: string;
        let maxWidth: number;

        if (positionRight) {
            // Position to the left of the cell
            left = 'auto';
            right = `${window.innerWidth - r.left + 8}px`;
            maxWidth = spaceLeft;
        } else {
            // Position to the right of the cell
            left = `${r.right + 8}px`;
            right = '8px';
            maxWidth = spaceRight;
        }

        // Y position: align with cell top, but ensure it stays in viewport
        const top = Math.max(8, Math.min(r.top, window.innerHeight - 200));

        return `position:fixed;left:${left};right:${right};top:${top}px;max-width:${maxWidth}px;overflow-x:auto;overflow-y:hidden;background:#1e293b;color:#e2e8f0;padding:8px 10px;border-radius:4px;font-size:10px;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.3);white-space:pre;font-family:'SF Mono','Fira Code',monospace;pointer-events:none;`;
    };

    return (
        <div style="font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; position: relative;">
            {/* Hover tooltip - no scroll, auto-sized */}
            <Show when={hoveredEvent()}>
                <div style={tooltipStyle()}>
                    {JSON.stringify(hoveredEvent(), null, 2)}
                </div>
            </Show>
            {/* Copied feedback */}
            <Show when={copied()}>
                <div style="position:fixed;top:12px;right:12px;background:#22c55e;color:#fff;padding:4px 12px;border-radius:4px;font-size:11px;z-index:1001;">
                    Copied to clipboard
                </div>
            </Show>

            {/* Column headers */}
            <div style={`display:grid;grid-template-columns:40px repeat(${columns.length}, 1fr);gap:1px;margin-bottom:2px;`}>
                <div style="padding:4px 2px;font-size:9px;color:#9ca3af;text-align:center;">#</div>
                <For each={columns}>
                    {(col) => (
                        <div style="padding:4px 6px;background:#1e293b;color:#e2e8f0;font-weight:600;font-size:10px;text-align:center;border-radius:4px 4px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title={col.$id}>
                            {col.label}
                        </div>
                    )}
                </For>
            </div>

            {/* Event rows */}
            <For each={rows}>
                {(row) => {
                    const isInternal = row.cell.membrane === 'internal';
                    const hasCallerConnector = isInternal && row.cell.callerColumnIndex !== undefined && row.cell.callerColumnIndex !== row.cell.columnIndex;
                    // Mapping reference: draw horizontal line from caller cell to target capsule column
                    const hasMappingRef = row.cell.isMappingRef && row.cell.mappingTargetColumnIndex !== undefined && row.cell.mappingTargetColumnIndex !== row.cell.columnIndex;
                    const mappingTargetCol = row.cell.mappingTargetColumnIndex;
                    const mappingSourceCol = row.cell.columnIndex;

                    // Active event highlighting from timeline
                    const isActive = () => activeRowEventIndex() === row.eventIndex;

                    return (
                        <div
                            style={`display:grid;grid-template-columns:40px repeat(${columns.length}, 1fr);gap:1px;min-height:22px;`}
                            class={isActive() ? 'swimlane-row-active' : ''}
                        >
                            {/* Row index */}
                            <div style="padding:1px;font-size:9px;color:#9ca3af;text-align:center;display:flex;align-items:center;justify-content:center;">
                                {row.eventIndex}
                            </div>
                            {/* Cells - one per column */}
                            <For each={columns}>
                                {(col) => {
                                    const isTarget = col.index === row.cell.columnIndex;
                                    const isCaller = hasCallerConnector && col.index === row.cell.callerColumnIndex;
                                    const isBetween = hasCallerConnector && row.cell.callerColumnIndex !== undefined &&
                                        ((col.index > row.cell.callerColumnIndex && col.index < row.cell.columnIndex) ||
                                            (col.index < row.cell.callerColumnIndex && col.index > row.cell.columnIndex));

                                    // Mapping reference line: target column (where the mapping points to)
                                    const isMappingTarget = hasMappingRef && col.index === mappingTargetCol;
                                    // Mapping reference line: columns between source and target
                                    const isMappingBetween = hasMappingRef && mappingTargetCol !== undefined && mappingSourceCol !== undefined &&
                                        ((col.index > mappingSourceCol && col.index < mappingTargetCol) ||
                                            (col.index < mappingSourceCol && col.index > mappingTargetCol));

                                    // Draw connector: caller origin column (for internal calls)
                                    if (isCaller) {
                                        return (
                                            <div style="background:#f1f5f9;border-left:1px solid #e5e7eb;display:flex;align-items:center;justify-content:flex-end;padding-right:2px;">
                                                <span style="color:#94a3b8;font-size:9px;">→</span>
                                            </div>
                                        );
                                    }
                                    // Draw connector: columns between caller and target (for internal calls)
                                    if (isBetween) {
                                        return (
                                            <div style="background:#f8fafc;border-left:1px solid #e5e7eb;display:flex;align-items:center;">
                                                <div style="width:100%;border-top:1px dashed #cbd5e1;"></div>
                                            </div>
                                        );
                                    }

                                    // Mapping reference: target column - show dot in center
                                    if (isMappingTarget) {
                                        return (
                                            <div style="background:#fef3c7;border-left:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;">
                                                <div style="width:6px;height:6px;border-radius:50%;background:#f59e0b;"></div>
                                            </div>
                                        );
                                    }
                                    // Mapping reference: columns between source and target - draw horizontal line
                                    if (isMappingBetween) {
                                        return (
                                            <div style="background:#fffbeb;border-left:1px solid #e5e7eb;display:flex;align-items:center;">
                                                <div style="width:100%;border-top:2px solid #fbbf24;"></div>
                                            </div>
                                        );
                                    }

                                    if (!isTarget) {
                                        const hasActive = row.cell.activeInvocationCount > 0;
                                        return (
                                            <div style={`background:${hasActive ? '#f8fafc' : 'transparent'};border-left:1px solid #e5e7eb;`} />
                                        );
                                    }

                                    // Target cell - render the event
                                    const bg = eventBg(row.cell.eventType, row.cell.membrane);
                                    const color = eventColor(row.cell.eventType, row.cell.membrane);
                                    const borderStyle = isInternal ? 'dashed' : 'solid';
                                    const indent = isInternal ? 'margin-left:8px;' : '';
                                    const cellStyle = `background:${bg};border-left:3px ${borderStyle} ${color};padding:1px 4px;display:flex;align-items:center;gap:3px;border-radius:2px;cursor:pointer;overflow:hidden;white-space:nowrap;${indent}`;
                                    const labelStyle = `color:${color};font-weight:600;font-size:9px;text-transform:uppercase;flex-shrink:0;`;

                                    return (
                                        <div
                                            style={cellStyle}
                                            onMouseEnter={(e: any) => handleMouseEnter(e, row.cell.rawEvent)}
                                            onMouseLeave={handleMouseLeave}
                                            onClick={() => handleClick(row.cell.rawEvent)}
                                        >
                                            <span style={labelStyle}>{row.cell.eventType}</span>
                                            <span style="color:#1e293b;font-weight:500;flex-shrink:0;">{row.cell.propertyName}</span>
                                            <Show when={row.cell.resolvedCaller}>
                                                <span style="color:#94a3b8;font-size:9px;flex-shrink:0;">
                                                    ←{row.cell.resolvedCaller!.propertyName}
                                                </span>
                                            </Show>
                                            {/* Mapping reference: show arrow with "ref" label instead of =[object] */}
                                            <Show when={hasMappingRef}>
                                                <span style="color:#f59e0b;font-size:9px;margin-left:auto;flex-shrink:0;font-weight:600;">
                                                    ref→
                                                </span>
                                            </Show>
                                            <Show when={row.cell.dataSeen && !hasMappingRef}>
                                                <span style="color:#64748b;font-size:9px;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">
                                                    ={row.cell.dataSeen}
                                                </span>
                                            </Show>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    );
                }}
            </For>
            {/* Property State Panel */}
            <Show when={activeSeqIdx() >= 0}>
                <PropertyStatePanel state={propertyState()} columns={columns} />
            </Show>
        </div>
    );
}

// ── Property State Panel ───────────────────────────────────────────────────

function PropertyStatePanel(props: { state: PropertyState; columns: Column[] }): JSX.Element {
    // Group entries by columnIndex
    const entriesByColumn = createMemo(() => {
        const byCol = new Map<number, PropertyEntry[]>();
        for (const entry of props.state.entries.values()) {
            const list = byCol.get(entry.columnIndex) ?? [];
            list.push(entry);
            byCol.set(entry.columnIndex, list);
        }
        return byCol;
    });

    return (
        <div class="swimlane-state-panel">
            <div class="swimlane-state-header">Property State</div>
            {/* Use same grid as swimlane: 40px index col + 1fr per column */}
            <div style={`display:grid;grid-template-columns:40px repeat(${props.columns.length}, 1fr);gap:1px;`}>
                {/* Empty cell for index column */}
                <div />
                {/* One cell per column */}
                <For each={props.columns}>
                    {(col) => {
                        const colEntries = () => entriesByColumn().get(col.index) ?? [];
                        return (
                            <div class="swimlane-state-col">
                                <For each={colEntries()}>
                                    {(entry) => {
                                        const key = `${entry.columnIndex}:${entry.property}`;
                                        const isActive = () => props.state.activeKey === key;
                                        const activeType = () => isActive() ? props.state.activeType : null;
                                        return (
                                            <div
                                                class={`swimlane-state-entry${isActive() ? ' active' : ''}${activeType() === 'set' ? ' is-set' : ''}${activeType() === 'get' ? ' is-get' : ''}`}
                                            >
                                                <span class="swimlane-state-prop">{entry.property}</span>
                                                <span class="swimlane-state-eq">=</span>
                                                {entry.isMappingRef ? (
                                                    <span class="swimlane-state-mapping">{entry.mappingTargetLabel ?? '→ capsule'}</span>
                                                ) : (
                                                    <span class="swimlane-state-val">{entry.value}</span>
                                                )}
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// Rep Registration
// ═══════════════════════════════════════════════════════════════════════

registerRep({
    name: "SwimlaneView",
    render: (data: JsonObject, ctx: RepContext): JSX.Element => {
        const [loading, setLoading] = createSignal(true);
        const [error, setError] = createSignal<string | null>(null);
        const [model, setModel] = createSignal<CodepathModel | null>(null);

        async function fetchData() {
            const spineInstanceTreeId = (data.spineInstanceTreeId as string) || ctx.spineInstanceTreeId;

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
                const result = await ctx.apiCall(
                    "/api/@stream44.studio~FramespaceGenesis~L8-view-models~CapsuleSpine~Codepath~ModelQueryMethods/getSwimlaneView",
                    { spineInstanceTreeId }
                );

                const vizData = result.result;
                if (!vizData || !vizData.columns || !vizData.rows) {
                    setError("No codepath data available");
                    setLoading(false);
                    return;
                }

                setModel({
                    columns: vizData.columns,
                    rows: vizData.rows,
                });
                setLoading(false);
            } catch (err: any) {
                setError(err.message ?? String(err));
                setLoading(false);
            }
        }

        onMount(() => {
            fetchData();
        });

        return (
            <div
                class="rep-codepath-grid"
                style="width:100%;height:100%;overflow:auto;background:#fafafa;padding:16px;"
            >
                <Show when={loading()}>
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">
                        Loading Codepath data...
                    </div>
                </Show>
                <Show when={error()}>
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#a63d2f;">
                        Error: {error()}
                    </div>
                </Show>
                <Show when={!loading() && !error() && model()}>
                    <CodepathTable model={model()!} activeEventIndex={ctx.activeEventIndex} />
                </Show>
            </div>
        );
    },
});
