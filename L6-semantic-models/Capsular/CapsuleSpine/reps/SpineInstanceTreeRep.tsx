// ── SpineInstanceTreeRep ────────────────────────────────────────────
// Renders a SpineInstanceTree as a Cytoscape graph showing the
// runtime capsule instantiation hierarchy (parent-child instances).

import { onMount, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { registerRep } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";
import type { JsonObject, RepContext } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";

// ── Data extraction ─────────────────────────────────────────────────

type TreeCyNode = {
    data: { id: string; label: string; nodeType?: string };
    position: { x: number; y: number };
};
type TreeCyEdge = {
    data: { id: string; source: string; target: string; label?: string; edgeType?: string };
};

const STEP_X = 350;
const STEP_Y = 120;

function extractInstanceGraph(
    tree: JsonObject,
    spineInstanceTreeId?: string,
): { nodes: TreeCyNode[]; edges: TreeCyEdge[] } {
    const nodes: TreeCyNode[] = [];
    const edges: TreeCyEdge[] = [];
    const placed = new Set<string>();
    let edgeSeq = 0;

    function formatLabel(raw: string): string {
        const m = raw.match(/^(@[^/]+\/[^/]+)\/(.+)$/);
        if (m) return `${m[1]}\n/${m[2]}`;
        return raw;
    }

    function shortLabel(id: string): string {
        if (!spineInstanceTreeId) return formatLabel(id);
        const baseDir = spineInstanceTreeId.substring(0, spineInstanceTreeId.lastIndexOf('/'));
        if (!baseDir) return formatLabel(id);
        const parts = id.split('/');
        const baseParts = baseDir.split('/');
        let common = 0;
        while (common < baseParts.length && common < parts.length && baseParts[common] === parts[common]) common++;
        if (common === 0) return formatLabel(id);
        const ups = baseParts.length - common;
        const rest = parts.slice(common);
        return formatLabel('../'.repeat(ups) + rest.join('/'));
    }

    function addNode(id: string, x: number, y: number, extra?: Partial<TreeCyNode["data"]>) {
        const nd: TreeCyNode["data"] = { id, label: shortLabel(id), ...extra };
        nodes.push({ data: nd, position: { x, y } });
    }

    function addEdge(src: string, tgt: string, label: string, edgeType: string) {
        edges.push({ data: { id: `e${edgeSeq++}_${src}→${label}→${tgt}`, source: src, target: tgt, label, edgeType } });
    }

    // Walk the instance tree recursively
    // Returns the total height consumed by this subtree
    function walk(instance: JsonObject, x: number, y: number): number {
        const id = instance["$id"] as string | undefined;
        if (!id || placed.has(id)) return 0;

        placed.add(id);

        // Determine node type based on instance properties
        const capsuleName = instance["capsuleName"] as string | undefined;
        const nodeType = capsuleName ? "instance" : "root";

        // Get children (child instances)
        const children = instance["children"] as JsonObject[] | undefined;
        const childList = Array.isArray(children) ? children : [];

        // Calculate total height needed for children
        let totalChildHeight = 0;
        const childHeights: number[] = [];

        // First pass: calculate heights
        for (const child of childList) {
            const childId = child["$id"] as string | undefined;
            if (childId && !placed.has(childId)) {
                // Estimate height (will be refined in second pass)
                const childChildren = child["children"] as JsonObject[] | undefined;
                const h = Math.max(1, Array.isArray(childChildren) ? childChildren.length : 1);
                childHeights.push(h);
                totalChildHeight += h;
            } else {
                childHeights.push(0);
            }
        }

        // Place this node
        addNode(id, x, y, { nodeType });

        // Second pass: place children
        let currentY = y - (totalChildHeight * STEP_Y) / 2;
        for (let i = 0; i < childList.length; i++) {
            const child = childList[i];
            const childId = child["$id"] as string | undefined;
            if (!childId) continue;

            if (placed.has(childId)) {
                // Just add edge to existing node
                const propName = child["propertyName"] as string | undefined;
                addEdge(id, childId, propName ?? "child", "instantiation");
            } else {
                const childHeight = childHeights[i];
                const childY = currentY + (childHeight * STEP_Y) / 2;

                const consumed = walk(child, x + STEP_X, childY);

                const propName = child["propertyName"] as string | undefined;
                addEdge(id, childId, propName ?? "child", "instantiation");

                currentY += Math.max(consumed, 1) * STEP_Y;
            }
        }

        return Math.max(totalChildHeight, 1);
    }

    const rootInstance = tree["rootInstance"] as JsonObject | undefined;
    if (rootInstance) {
        walk(rootInstance, 0, 0);
    }

    return { nodes, edges };
}

// ── Cytoscape renderer ──────────────────────────────────────────────

function renderInstanceTree(container: HTMLElement, data: JsonObject, spineInstanceTreeId: string | undefined, cytoscape: any) {
    const { nodes, edges } = extractInstanceGraph(data, spineInstanceTreeId);

    const cy = cytoscape({
        container,
        boxSelectionEnabled: false,
        style: [
            {
                selector: "node",
                css: {
                    "shape": "round-rectangle",
                    "content": "data(label)",
                    "text-valign": "center",
                    "text-halign": "center",
                    "font-size": "14px",
                    "color": "#2b5a8c",
                    "background-color": "#d4e8f2",
                    "border-color": "#2b5a8c",
                    "border-width": 1,
                    "padding-top": "4px",
                    "padding-bottom": "4px",
                    "padding-left": "14px",
                    "padding-right": "14px",
                    "text-wrap": "wrap",
                    "text-max-width": "350px",
                } as any,
            },
            {
                selector: "node[nodeType = 'root']",
                css: {
                    "background-color": "#b8d4e8",
                    "border-width": 2,
                    "font-weight": "bold",
                } as any,
            },
            {
                selector: "node[nodeType = 'instance']",
                css: {
                    "background-color": "#e4f0f8",
                } as any,
            },
            {
                selector: "edge",
                css: {
                    "curve-style": "bezier",
                    "target-arrow-shape": "triangle",
                    "target-arrow-color": "#2b5a8c",
                    "line-color": "#8ab4d4",
                    "width": 2,
                    "label": "data(label)",
                    "font-size": "10px",
                    "color": "#5a8ab4",
                    "text-rotation": "autorotate",
                    "text-margin-y": -12,
                } as any,
            },
            {
                selector: "edge[edgeType = 'instantiation']",
                css: {
                    "line-color": "#4a8ac4",
                    "target-arrow-color": "#4a8ac4",
                    "width": 2,
                } as any,
            },
        ],
        elements: { nodes, edges },
        layout: {
            name: "preset",
            padding: 30,
        } as any,
    });

    cy.on('layoutstop', () => {
        cy.fit(undefined, 30);
        cy.center();
    });

    return cy;
}

// ── Rep registration ────────────────────────────────────────────────

registerRep({
    name: "SpineInstanceTree",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "SpineInstanceTree" &&
        !!(data as JsonObject)["rootInstance"],
    render: (data: JsonObject, ctx: RepContext): JSX.Element => {
        let containerRef: HTMLDivElement | undefined;
        let cy: any = null;
        let ro: ResizeObserver | null = null;
        const lib = ctx.lib!;

        onMount(() => {
            if (!containerRef) return;

            const initCy = () => {
                if (cy) return;
                if (containerRef!.offsetWidth === 0 || containerRef!.offsetHeight === 0) return;
                cy = renderInstanceTree(containerRef!, data, ctx.spineInstanceTreeId, lib.cytoscape);
                ro = new ResizeObserver(() => {
                    if (cy) {
                        cy.resize();
                        cy.fit(undefined, 30);
                    }
                });
                ro.observe(containerRef!);
            };

            requestAnimationFrame(() => {
                initCy();
                if (!cy) {
                    const visRo = new ResizeObserver(() => {
                        if (!cy && containerRef!.offsetWidth > 0) {
                            initCy();
                            if (cy) visRo.disconnect();
                        }
                    });
                    visRo.observe(containerRef!);
                }
            });
        });

        onCleanup(() => {
            ro?.disconnect();
            if (cy) cy.destroy();
        });

        return (
            <div
                class="rep-spine-instance-tree"
                ref={(el: HTMLDivElement) => { containerRef = el; }}
                style="width:100%;height:100%;min-height:400px;background:#ffffff;"
            />
        );
    },
});
