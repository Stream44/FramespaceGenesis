// ── QuadrantCodepathView rep ────────────────────────────────────────
// Renders a Quadrant grid with component cards inside cells.
// Each card shows: name, connections (mappings), properties (data),
// and actions (functions). An SVG overlay draws call-path lines
// between component actions as execution progresses.
//
// The rep receives {'#': 'QuadrantCodepathView', spineInstanceTreeId?}
// and fetches data via the rep-data-provider which merges L6 Quadrant,
// L6 Codepath, and Composite Quadrant-Codepath APIs.

import { onMount, onCleanup, createSignal, createMemo, createEffect, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { registerRep } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";
import type { JsonObject, RepContext } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";
import {
    createClientAdapter,
    createRepDataProvider,
    getOverlayFrame,
    anchorId,
    type Component,
    type CallPathFrame,
    type GridModel,
    type RepDataProvider,
    type OverlayFrame,
} from "../rep-data-provider";

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

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
        background: #0f172a;
        border: none;
        min-width: 80px;
        min-height: 32px;
    `,
    columnHeader: `
        background: #1e293b;
        border: 1px solid #334155;
        color: #e2e8f0;
        font-weight: 600;
        text-align: center;
        vertical-align: middle;
        padding: 8px 12px;
        min-width: 200px;
        min-height: 32px;
    `,
    columnHeaderFirst: `
        background: #1e293b;
        border: 1px solid #334155;
        border-left: 1px solid #334155;
        color: #e2e8f0;
        font-weight: 600;
        text-align: center;
        vertical-align: middle;
        padding: 8px 12px;
        min-width: 200px;
        min-height: 32px;
    `,
    rowHeader: `
        background: #1e293b;
        border: 1px solid #334155;
        color: #e2e8f0;
        font-weight: 600;
        text-align: center;
        vertical-align: middle;
        padding: 8px 12px;
        min-width: 80px;
        min-height: 60px;
    `,
    rowHeaderFirst: `
        background: #1e293b;
        border: 1px solid #334155;
        border-top: 1px solid #334155;
        color: #e2e8f0;
        font-weight: 600;
        text-align: center;
        vertical-align: middle;
        padding: 8px 12px;
        min-width: 80px;
        min-height: 60px;
    `,
    gridCell: `
        border: 1px solid #1e293b;
        background: #0f172a;
        vertical-align: top;
        padding: 8px;
        min-width: 200px;
        min-height: 120px;
    `,
};

const CARD_STYLES = {
    card: `
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        margin: 4px 0;
        overflow: hidden;
        font-size: 11px;
    `,
    header: `
        background: #334155;
        padding: 6px 10px;
        font-weight: 700;
        color: #f1f5f9;
        font-size: 12px;
        border-bottom: 1px solid #475569;
        display: flex;
        align-items: center;
        gap: 6px;
    `,
    headerCode: `
        font-size: 9px;
        color: #94a3b8;
        font-weight: 400;
        margin-left: auto;
        cursor: pointer;
    `,
    section: `
        padding: 4px 10px;
        border-bottom: 1px solid #1e293b;
    `,
    sectionLabel: `
        font-size: 9px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
    `,
    connection: `
        color: #94a3b8;
        padding: 3px 4px;
        font-size: 10px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        border-radius: 3px;
    `,
    connectionActive: `
        color: #94a3b8;
        padding: 3px 4px;
        font-size: 10px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        border-radius: 3px;
        background: rgba(22, 163, 74, 0.15);
    `,
    property: `
        color: #a78bfa;
        padding: 3px 4px;
        font-size: 10px;
        border-radius: 3px;
    `,
    propertyActive: `
        color: #dc2626;
        padding: 3px 4px;
        font-size: 10px;
        border-radius: 3px;
        background: rgba(220, 38, 38, 0.12);
    `,
    propertyName: `
        color: #c4b5fd;
    `,
    propertyValue: `
        color: #64748b;
        margin-left: 4px;
    `,
    action: `
        padding: 3px 4px;
        font-size: 10px;
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 3px;
    `,
    actionActive: `
        padding: 3px 4px;
        font-size: 10px;
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 3px;
        background: rgba(34, 197, 94, 0.15);
    `,
    actionName: `
        color: #4ade80;
    `,
    actionBullet: `
        color: #4ade80;
        font-size: 8px;
    `,
};

// ═══════════════════════════════════════════════════════════════════════
// Anchor Point Store
// ═══════════════════════════════════════════════════════════════════════
// Each anchor point has left/middle/right coordinates (relative to
// the overlay container) so the overlay can attach lines at any side.

type AnchorPoint = {
    id: string;
    kind: 'action' | 'property' | 'connection';
    capsuleId: string;
    name: string;
    left: { x: number; y: number };
    middle: { x: number; y: number };
    right: { x: number; y: number };
};

type AnchorPointStore = Map<string, AnchorPoint>; // keyed by anchorId

// ═══════════════════════════════════════════════════════════════════════
// Component Card
// ═══════════════════════════════════════════════════════════════════════

function ComponentCardView(props: {
    card: Component;
    overlayFrame: () => OverlayFrame;
    registerAnchor: (capsuleId: string, kind: 'action' | 'property' | 'connection', name: string, el: HTMLElement) => void;
}): JSX.Element {
    const card = props.card;

    // Which actions are highlighted in the current overlay?
    const activeActions = createMemo(() => {
        const active = new Set<string>();
        for (const hl of props.overlayFrame().highlights) {
            if (hl.kind === 'active-function') {
                // anchorId format: capsuleId:action:name
                const parts = hl.anchorId.split(':');
                const kind = parts[parts.length - 2];
                const name = parts[parts.length - 1];
                const capsuleId = parts.slice(0, parts.length - 2).join(':');
                if (kind === 'action' && capsuleId === card.$id) active.add(name);
            }
        }
        return active;
    });

    // Which properties are currently highlighted? (multiple can be active)
    const activeProperties = createMemo(() => {
        const active = new Map<string, string>(); // name → label
        for (const hl of props.overlayFrame().highlights) {
            if (hl.kind === 'active-property') {
                const parts = hl.anchorId.split(':');
                const kind = parts[parts.length - 2];
                const name = parts[parts.length - 1];
                const capsuleId = parts.slice(0, parts.length - 2).join(':');
                if (kind === 'property' && capsuleId === card.$id) {
                    active.set(name, hl.label || '');
                }
            }
        }
        return active;
    });

    // Which connections are highlighted?
    const activeConnections = createMemo(() => {
        const active = new Set<string>();
        for (const hl of props.overlayFrame().highlights) {
            if (hl.kind === 'active-mapping') {
                const parts = hl.anchorId.split(':');
                const kind = parts[parts.length - 2];
                const name = parts[parts.length - 1];
                const capsuleId = parts.slice(0, parts.length - 2).join(':');
                if (kind === 'connection' && capsuleId === card.$id) active.add(name);
            }
        }
        return active;
    });

    // Filter out propertyContractDelegate items
    const visibleConnections = createMemo(() =>
        card.connections.filter((c: any) => !c.propertyContractDelegate)
    );
    const visibleProperties = createMemo(() =>
        card.properties.filter((p: any) => !p.propertyContractDelegate)
    );

    return (
        <div style={CARD_STYLES.card} data-capsule-id={card.$id}>
            {/* Header */}
            <div style={CARD_STYLES.header}>
                <span>{card.label}</span>
                <span
                    style={CARD_STYLES.headerCode}
                    onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        if (card.capsuleSourceLineRef && e.currentTarget) {
                            e.currentTarget.dispatchEvent(new CustomEvent('Capsule.code.open', {
                                bubbles: true,
                                detail: { filepath: card.capsuleSourceLineRef },
                            }));
                        }
                    }}
                >Code</span>
            </div>

            {/* Connections (only actual Mapping properties, not contract delegates) */}
            <Show when={visibleConnections().length > 0}>
                <div style={CARD_STYLES.section}>
                    <div style={CARD_STYLES.sectionLabel}>connects with</div>
                    <For each={visibleConnections()}>
                        {(conn) => {
                            const isActive = () => activeConnections().has(conn.propertyName);
                            return (
                                <div
                                    style={isActive() ? CARD_STYLES.connectionActive : CARD_STYLES.connection}
                                    ref={(el: HTMLElement) => props.registerAnchor(card.$id, 'connection', conn.propertyName, el)}
                                >
                                    <span style={CARD_STYLES.propertyName}>{conn.propertyName}</span>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            {/* Properties (excluding contract delegates) */}
            <Show when={visibleProperties().length > 0}>
                <div style={CARD_STYLES.section}>
                    <div style={CARD_STYLES.sectionLabel}>properties</div>
                    <For each={visibleProperties()}>
                        {(prop) => {
                            const isActive = () => activeProperties().has(prop.name);
                            const activeLabel = () => activeProperties().get(prop.name) || '';
                            return (
                                <div
                                    style={isActive() ? CARD_STYLES.propertyActive : CARD_STYLES.property}
                                    ref={(el: HTMLElement) => props.registerAnchor(card.$id, 'property', prop.name, el)}
                                >
                                    <span style={CARD_STYLES.propertyName}>
                                        {prop.name}
                                    </span>
                                    <Show when={isActive()}>
                                        <span style={CARD_STYLES.propertyValue}>
                                            {activeLabel()}
                                        </span>
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            {/* Actions (functions) */}
            <Show when={card.actions.length > 0}>
                <div style={`${CARD_STYLES.section}border-bottom:none;`}>
                    <div style={CARD_STYLES.sectionLabel}>functions</div>
                    <For each={card.actions}>
                        {(action) => {
                            const isActive = () => activeActions().has(action.name);
                            return (
                                <div
                                    style={isActive() ? CARD_STYLES.actionActive : CARD_STYLES.action}
                                    ref={(el: HTMLElement) => props.registerAnchor(card.$id, 'action', action.name, el)}
                                >
                                    <span style={CARD_STYLES.actionBullet}>●</span>
                                    <span style={CARD_STYLES.actionName}>
                                        {action.name}()
                                    </span>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// SVG Overlay — draws lines from OverlayFrame + AnchorPointStore
// ═══════════════════════════════════════════════════════════════════════

const SHOW_GUIDES = false;

type PixelLine = {
    x1: number; y1: number; x2: number; y2: number;
    key: string;
    color: string;
    dashed: boolean;
    arrow: boolean;
    arrowLarge: boolean;
    opacity: number;
    dotFrom: boolean;
    dotTo: boolean;
};

function CallLinesOverlay(props: {
    overlayFrame: () => OverlayFrame;
    anchors: () => AnchorPointStore;
    anchorVersion: () => number;
    containerRef: () => HTMLElement | null;
}): JSX.Element {

    // Resolve an anchor ID + side to pixel coordinates
    function resolveAnchor(aid: string, side: 'left' | 'middle' | 'right'): { x: number; y: number } | null {
        const anchor = props.anchors().get(aid);
        if (!anchor) return null;
        return anchor[side];
    }

    // Extract capsuleId from anchor ID for stagger grouping
    function capsuleFromAnchor(aid: string): string {
        const parts = aid.split(':');
        return parts.slice(0, parts.length - 2).join(':');
    }

    const lines = createMemo(() => {
        const result: PixelLine[] = [];
        const frame = props.overlayFrame();
        props.anchorVersion();

        // Track vertical line count per capsule for staggering (20px offset per line)
        const verticalCountPerCapsule = new Map<string, number>();
        const getOffset = (capsuleId: string): number => {
            const count = verticalCountPerCapsule.get(capsuleId) || 0;
            verticalCountPerCapsule.set(capsuleId, count + 1);
            return count * 16;
        };

        for (const seg of frame.lines) {
            if (seg.category === 'call-entry' && !seg.fromAnchor) {
                const to = resolveAnchor(seg.toAnchor, seg.toSide);
                if (to) {
                    result.push({
                        x1: to.x - 30, y1: to.y - 15, x2: to.x, y2: to.y,
                        key: seg.key,
                        color: seg.color, dashed: seg.dashed, arrow: seg.arrow,
                        arrowLarge: false, opacity: seg.opacity, dotFrom: false, dotTo: false,
                    });
                }
                continue;
            }

            const from = seg.fromAnchor ? resolveAnchor(seg.fromAnchor, seg.fromSide) : null;
            const to = seg.toAnchor ? resolveAnchor(seg.toAnchor, seg.toSide) : null;

            if (from && to) {
                let x1 = from.x, y1 = from.y, x2 = to.x, y2 = to.y;
                let dotFrom = false, dotTo = false;
                let arrowLarge = false;

                // Vertical lines within same capsule need staggering
                if (seg.category === 'call-internal' || seg.category === 'call-to-mapping') {
                    const capsuleId = capsuleFromAnchor(seg.fromAnchor);
                    const offset = getOffset(capsuleId);
                    x1 += offset;
                    x2 += offset;
                    dotFrom = true;
                    dotTo = true;
                } else if (seg.category === 'property-access') {
                    // Property access: also vertical within same capsule
                    const capsuleId = capsuleFromAnchor(seg.fromAnchor);
                    const offset = getOffset(capsuleId);
                    x1 += offset;
                    x2 += offset;
                    // Red lines: dot on non-arrow end
                    dotFrom = !seg.arrow;
                    dotTo = !seg.arrow;
                    if (seg.arrow) {
                        // Arrow end gets arrow, other end gets dot
                        dotFrom = false;
                        dotTo = true;
                    }
                } else if (seg.category === 'mapping-to-target') {
                    // Cross-capsule: right→left, large arrow at target
                    arrowLarge = true;
                    dotFrom = true;
                }

                result.push({
                    x1, y1, x2, y2,
                    key: seg.key,
                    color: seg.color, dashed: seg.dashed, arrow: seg.arrow,
                    arrowLarge, opacity: seg.opacity, dotFrom, dotTo,
                });
            } else if (from && !to) {
                result.push({
                    x1: from.x, y1: from.y, x2: from.x + 40, y2: from.y - 20,
                    key: seg.key,
                    color: seg.color, dashed: seg.dashed, arrow: seg.arrow,
                    arrowLarge: false, opacity: seg.opacity, dotFrom: false, dotTo: false,
                });
            }
        }

        return result;
    });

    // SVG must span the full scrollable area of the container
    const svgStyle = createMemo(() => {
        props.anchorVersion();
        const container = props.containerRef();
        if (!container) return 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;overflow:visible;';
        const w = container.scrollWidth;
        const h = container.scrollHeight;
        return `position:absolute;top:0;left:0;width:${w}px;height:${h}px;pointer-events:none;z-index:10;overflow:visible;`;
    });

    // Guide circles for debugging anchor positions
    const guideCircles = createMemo(() => {
        if (!SHOW_GUIDES) return [];
        props.anchorVersion();
        const circles: { x: number; y: number; label: string; color: string }[] = [];
        for (const [, anchor] of props.anchors()) {
            const kindColor = anchor.kind === 'action' ? '#22c55e'
                : anchor.kind === 'property' ? '#a78bfa'
                    : '#38bdf8';
            circles.push({ x: anchor.left.x, y: anchor.left.y, label: `L:${anchor.name}`, color: kindColor });
            circles.push({ x: anchor.middle.x, y: anchor.middle.y, label: `M:${anchor.name}`, color: kindColor });
            circles.push({ x: anchor.right.x, y: anchor.right.y, label: `R:${anchor.name}`, color: kindColor });
        }
        return circles;
    });

    return (
        <svg style={svgStyle()}>
            <defs>
                <marker id="arrow-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#16a34a" />
                </marker>
                <marker id="arrow-green-lg" markerWidth="14" markerHeight="10" refX="14" refY="5" orient="auto">
                    <polygon points="0 0, 14 5, 0 10" fill="#16a34a" opacity="0.8" />
                </marker>
                <marker id="arrow-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#dc2626" />
                </marker>
            </defs>
            {/* Guide circles */}
            <Show when={SHOW_GUIDES}>
                <For each={guideCircles()}>
                    {(g) => (
                        <circle
                            cx={String(g.x)}
                            cy={String(g.y)}
                            r="4"
                            fill="white"
                            opacity="0.5"
                            stroke={g.color}
                            stroke-width="1"
                        />
                    )}
                </For>
            </Show>
            {/* Lines */}
            <For each={lines()}>
                {(line) => {
                    const markerId = line.arrow
                        ? (line.color === '#dc2626' ? 'url(#arrow-red)'
                            : line.arrowLarge ? 'url(#arrow-green-lg)'
                                : 'url(#arrow-green)')
                        : undefined;
                    return <>
                        <line
                            x1={String(line.x1)}
                            y1={String(line.y1)}
                            x2={String(line.x2)}
                            y2={String(line.y2)}
                            stroke={line.color}
                            stroke-width="2"
                            stroke-dasharray={line.dashed ? "6,3" : "none"}
                            marker-end={markerId}
                            opacity={String(line.opacity)}
                        />
                        {line.dotFrom && <circle cx={String(line.x1)} cy={String(line.y1)} r="4" fill={line.color} opacity="0.8" />}
                        {line.dotTo && <circle cx={String(line.x2)} cy={String(line.y2)} r="4" fill={line.color} opacity="0.8" />}
                    </>;
                }}
            </For>
        </svg>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// Quadrant Table with Component Cards
// ═══════════════════════════════════════════════════════════════════════

function QuadrantCodepathTable(props: {
    gridModel: GridModel;
    cards: Map<string, Component>;
    overlayFrame: () => OverlayFrame;
}): JSX.Element {
    const model = () => props.gridModel;
    const [containerRef, setContainerRef] = createSignal<HTMLElement | null>(null);
    const [anchors, setAnchors] = createSignal<AnchorPointStore>(new Map());
    const [anchorVersion, setAnchorVersion] = createSignal(0);

    // Register an anchor point with left/middle/right coordinates
    function registerAnchor(capsuleId: string, kind: 'action' | 'property' | 'connection', name: string, el: HTMLElement) {
        requestAnimationFrame(() => {
            const container = containerRef();
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const rect = el.getBoundingClientRect();

            const relLeft = rect.left - containerRect.left;
            const relTop = rect.top - containerRect.top;
            const relRight = relLeft + rect.width;
            const centerY = relTop + rect.height / 2;

            const id = anchorId(capsuleId, kind, name);
            setAnchors(prev => {
                const next = new Map(prev);
                next.set(id, {
                    id,
                    kind,
                    capsuleId,
                    name,
                    left: { x: relLeft, y: centerY },
                    middle: { x: relLeft + rect.width / 2, y: centerY },
                    right: { x: relRight, y: centerY },
                });
                return next;
            });
            setAnchorVersion(v => v + 1);
        });
    }

    // Recompute all anchor positions on scroll/resize
    let scrollTimer: any = null;
    function remeasureAll() {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const container = containerRef();
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const next = new Map<string, AnchorPoint>();

            // Query all elements with data-anchor-id
            const anchorEls = container.querySelectorAll('[data-anchor-id]');
            anchorEls.forEach((el: Element) => {
                const htmlEl = el as HTMLElement;
                const id = htmlEl.dataset.anchorId || '';
                if (!id) return;
                const rect = htmlEl.getBoundingClientRect();
                const relLeft = rect.left - containerRect.left;
                const relTop = rect.top - containerRect.top;
                const centerY = relTop + rect.height / 2;

                // Parse anchor ID to get kind/capsuleId/name
                const parts = id.split(':');
                const name = parts[parts.length - 1];
                const kind = parts[parts.length - 2] as 'action' | 'property' | 'connection';
                const capsuleId = parts.slice(0, parts.length - 2).join(':');

                next.set(id, {
                    id, kind, capsuleId, name,
                    left: { x: relLeft, y: centerY },
                    middle: { x: relLeft + rect.width / 2, y: centerY },
                    right: { x: relLeft + rect.width, y: centerY },
                });
            });

            setAnchors(next);
            setAnchorVersion(v => v + 1);
        }, 50);
    }

    onMount(() => {
        const container = containerRef();
        if (container) {
            container.addEventListener('scroll', remeasureAll, { passive: true });
        }
    });

    onCleanup(() => {
        const container = containerRef();
        if (container) {
            container.removeEventListener('scroll', remeasureAll);
        }
        if (scrollTimer) clearTimeout(scrollTimer);
    });

    return (
        <div ref={setContainerRef} style="position:relative;overflow:visible;">
            {/* SVG overlay */}
            <CallLinesOverlay
                overlayFrame={props.overlayFrame}
                anchors={anchors}
                anchorVersion={anchorVersion}
                containerRef={containerRef}
            />

            <table style={STYLES.table}>
                {/* Column header rows */}
                <thead>
                    <For each={model().columnLevels}>
                        {(levelNodes, levelIdx) => (
                            <tr>
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
                                {/* Row headers */}
                                <For each={model().rowLevels}>
                                    {(levelNodes, levelIdx) => {
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
                                {/* Grid cells with component cards */}
                                <For each={model().leafColumns}>
                                    {(leafCol, colIdx) => {
                                        const capsuleIds = model().cells.get(colIdx())?.get(rowIdx()) || [];
                                        return (
                                            <td style={STYLES.gridCell}>
                                                <For each={capsuleIds}>
                                                    {(capsuleId) => {
                                                        const card = props.cards.get(capsuleId);
                                                        return (
                                                            <Show when={card} fallback={
                                                                <div style="color:#475569;font-size:10px;padding:4px;">
                                                                    {shortName(capsuleId)}
                                                                </div>
                                                            }>
                                                                <ComponentCardView
                                                                    card={card!}
                                                                    overlayFrame={props.overlayFrame}
                                                                    registerAnchor={registerAnchor}
                                                                />
                                                            </Show>
                                                        );
                                                    }}
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
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// Logging
// ═══════════════════════════════════════════════════════════════════════

function vlog(...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) {
        console.log("[QuadrantCodepath]", ...args);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Rep Registration
// ═══════════════════════════════════════════════════════════════════════

registerRep({
    name: "QuadrantCodepathView",
    render: (data: JsonObject, ctx: RepContext): JSX.Element => {
        const [loading, setLoading] = createSignal(true);
        const [error, setError] = createSignal<string | null>(null);
        const [gridModel, setGridModel] = createSignal<GridModel | null>(null);
        const [cards, setCards] = createSignal<Map<string, Component>>(new Map());
        // All frames from getCallPathFrames, fetched once
        const [allFrames, setAllFrames] = createSignal<CallPathFrame[]>([]);
        // Pre-computed overlay frame for the current event index
        const emptyFrame: OverlayFrame = { eventIndex: -1, lines: [], highlights: [] };
        const [currentOverlayFrame, setCurrentOverlayFrame] = createSignal<OverlayFrame>(emptyFrame);

        // Create provider once per rep instance
        let provider: RepDataProvider | null = null;
        let componentById: Map<string, Component> = new Map();

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
                vlog("Fetching via rep-data-provider...");

                const adapter = createClientAdapter(ctx.apiCall);
                provider = createRepDataProvider(adapter);

                const [repData, callPathData] = await Promise.all([
                    provider.fetchRepData(spineInstanceTreeId),
                    provider.fetchCallPathFrames(spineInstanceTreeId),
                ]);

                vlog("Fetch complete", {
                    leafColumns: repData.gridModel.leafColumns.length,
                    leafRows: repData.gridModel.leafRows.length,
                    components: repData.components.length,
                    frames: callPathData.frames.length,
                });

                if (repData.gridModel.leafColumns.length === 0 || repData.gridModel.leafRows.length === 0) {
                    setError(`No data: ${repData.gridModel.leafColumns.length} columns, ${repData.gridModel.leafRows.length} rows`);
                    setLoading(false);
                    return;
                }

                setGridModel(repData.gridModel);
                setCards(repData.componentById);
                componentById = repData.componentById;
                setAllFrames(callPathData.frames);
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

        // React to activeEventIndex changes — compute overlay frame
        // activeEventIndex is a sequential slider position (0, 1, 2, ...),
        // NOT the sparse eventIndex used by call-path frames.
        // Map sequential → sparse using eventLogEntries[seqIdx].eventIndex.
        createEffect(() => {
            const seqIdx = ctx.activeEventIndex?.() ?? -1;
            const entries = ctx.eventLogEntries?.() ?? [];
            const frames = allFrames();

            if (seqIdx >= 0 && seqIdx < entries.length && frames.length > 0) {
                const sparseEventIndex = entries[seqIdx]?.eventIndex ?? seqIdx;
                setCurrentOverlayFrame(getOverlayFrame(sparseEventIndex, frames, componentById));
            } else {
                setCurrentOverlayFrame(emptyFrame);
            }
        });

        return (
            <div
                class="rep-quadrant-codepath"
                style="width:100%;height:100%;overflow:auto;background:#0f172a;padding:16px;"
            >
                <Show when={loading()}>
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;">
                        Loading Quadrant-Codepath data...
                    </div>
                </Show>
                <Show when={error()}>
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;">
                        Error: {error()}
                    </div>
                </Show>
                <Show when={!loading() && !error() && gridModel()}>
                    <QuadrantCodepathTable
                        gridModel={gridModel()!}
                        cards={cards()}
                        overlayFrame={currentOverlayFrame}
                    />
                </Show>
            </div>
        );
    },
});
