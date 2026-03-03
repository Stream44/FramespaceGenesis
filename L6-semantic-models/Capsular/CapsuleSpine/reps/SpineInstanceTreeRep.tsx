// ── SpineInstanceTreeRep ────────────────────────────────────────────
// Renders a SpineInstanceTree as a Cytoscape graph showing the
// runtime capsule instantiation hierarchy (parent-child instances).
//
// Visualization approach mirrors SpineDeclarationTreeRep: preset
// layout with recursive positioning, short labels relative to the
// spineInstanceTreeId, and distinct node/edge styles per type.

import { onMount, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { registerRep } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";
import type { JsonObject, RepContext } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";

// ── Data extraction ─────────────────────────────────────────────────

type TreeCyNode = {
    data: { id: string; label: string; nodeType?: string; isStruct?: string };
    position: { x: number; y: number };
};
type TreeCyEdge = {
    data: { id: string; source: string; target: string; label?: string; edgeType?: string };
};

const STEP = 300;
const STRUCT_CAPSULE_ID = "@stream44.studio/encapsulate/structs/Capsule";

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

    // Find the root instance from the tree data.
    // Raw API data uses 'rootInstance' key; normalized snapshot data
    // renames it to the capsuleSourceUriLineRef value.
    function findRootInstance(t: JsonObject): JsonObject | undefined {
        // Check raw API shape first
        const ri = t["rootInstance"];
        if (ri && typeof ri === 'object' && !Array.isArray(ri) && (ri as JsonObject)['#'] === 'CapsuleInstance') {
            return ri as JsonObject;
        }
        // Fall back: search for any CapsuleInstance value (normalized data)
        for (const [key, val] of Object.entries(t)) {
            if (key === '#' || key === '$id') continue;
            if (val && typeof val === 'object' && !Array.isArray(val) && (val as JsonObject)['#'] === 'CapsuleInstance') {
                return val as JsonObject;
            }
        }
        return undefined;
    }

    // Build a lookup of all instances keyed by $id (recursive).
    // Handles shared instances (same $id appearing in multiple subtrees).
    const instanceLookup = new Map<string, JsonObject>();
    function indexInstance(inst: JsonObject) {
        const iid = inst["$id"] as string | undefined;
        if (iid && !instanceLookup.has(iid)) {
            instanceLookup.set(iid, inst);
            const childrenObj = inst["children"] as JsonObject | undefined;
            if (childrenObj && typeof childrenObj === "object") {
                const list = childrenObj["list"] as JsonObject[] | undefined;
                if (Array.isArray(list)) {
                    for (const child of list) indexInstance(child);
                }
            }
        }
    }
    const rootInstance = findRootInstance(tree);
    if (rootInstance) indexInstance(rootInstance);

    // Recursive walk — positions nodes and creates edges.
    // Returns the number of vertical slots consumed.
    function walk(instance: JsonObject, x: number, y: number, isRoot: boolean): number {
        const id = instance["$id"] as string | undefined;
        if (!id || placed.has(id)) return 0;

        placed.add(id);

        const capsuleName = instance["capsuleName"] as string | undefined;
        const isStruct = capsuleName === STRUCT_CAPSULE_ID;

        // Use capsuleName for the label (shows what capsule this is an instance of)
        const label = capsuleName ? shortLabel(capsuleName) : shortLabel(id);

        if (isStruct) {
            addNode(id, x, y, { isStruct: "true" });
            nodes[nodes.length - 1].data.label = label;
            return 1;
        }

        const nodeType = isRoot ? "root" : "instance";
        addNode(id, x, y, { nodeType });
        nodes[nodes.length - 1].data.label = label;

        // Get children from children.list
        const childrenObj = instance["children"] as JsonObject | undefined;
        const childList: JsonObject[] = [];
        if (childrenObj && typeof childrenObj === "object") {
            const list = childrenObj["list"] as JsonObject[] | undefined;
            if (Array.isArray(list)) childList.push(...list);
        }

        // Separate struct children from regular children
        const structChildren: JsonObject[] = [];
        const regularChildren: JsonObject[] = [];
        for (const child of childList) {
            const cName = child["capsuleName"] as string | undefined;
            if (cName === STRUCT_CAPSULE_ID) {
                structChildren.push(child);
            } else {
                regularChildren.push(child);
            }
        }

        // Struct children → faded stub to upper-left (like declaration tree)
        for (const sc of structChildren) {
            const scId = sc["$id"] as string | undefined;
            if (!scId) continue;
            if (placed.has(scId)) {
                addEdge(id, scId, "struct", "struct");
            } else {
                const stubId = `__struct_${edgeSeq++}_${scId}`;
                addNode(stubId, x - STEP * 0.8, y - STEP * 0.7, { isStruct: "true" });
                nodes[nodes.length - 1].data.label = shortLabel(STRUCT_CAPSULE_ID);
                placed.add(scId);
                addEdge(id, stubId, "struct", "struct");
            }
        }

        // Regular children → right, stacked vertically
        let slotsConsumed = 1;
        let currentY = y - ((regularChildren.length - 1) * STEP) / 2;
        for (const child of regularChildren) {
            const childId = child["$id"] as string | undefined;
            if (!childId) continue;

            if (placed.has(childId)) {
                addEdge(id, childId, "child", "instantiation");
            } else {
                const full = instanceLookup.get(childId) || child;
                const consumed = walk(full, x + STEP, currentY, false);
                addEdge(id, childId, "child", "instantiation");
                slotsConsumed += consumed;
                currentY += Math.max(consumed, 1) * STEP;
            }
        }

        return slotsConsumed;
    }

    if (rootInstance) {
        walk(rootInstance, 0, 0, true);
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
                    "font-size": "15px",
                    "color": "#2b5a8c",
                    "background-color": "#d4e8f2",
                    "border-color": "#2b5a8c",
                    "border-width": 1,
                    "padding-top": "4px",
                    "padding-bottom": "4px",
                    "padding-left": "14px",
                    "padding-right": "14px",
                    "text-wrap": "wrap",
                    "text-max-width": "400px",
                } as any,
            },
            {
                selector: "node[isStruct]",
                css: {
                    "opacity": 0.4,
                    "border-style": "dashed",
                    "background-color": "#e8f0f8",
                    "border-color": "#7a9ab8",
                    "color": "#7a9ab8",
                    "font-size": "12px",
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
                    "width": 1,
                    "label": "data(label)",
                    "font-size": "11px",
                    "color": "#5a8ab4",
                    "text-rotation": "autorotate",
                    "text-margin-y": -14,
                } as any,
            },
            {
                selector: "edge[edgeType = 'instantiation']",
                css: {
                    "line-color": "#4a8ac4",
                    "target-arrow-color": "#4a8ac4",
                    "width": 3,
                    "arrow-scale": 1.4,
                } as any,
            },
            {
                selector: "edge[edgeType = 'struct']",
                css: {
                    "line-style": "dashed",
                    "line-color": "#7a9ab8",
                    "target-arrow-color": "#7a9ab8",
                    "width": 1,
                    "opacity": 0.4,
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
    match: (data) => {
        if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
        const obj = data as JsonObject;
        if (obj["#"] !== "SpineInstanceTree") return false;
        // Raw API data has 'rootInstance'; normalized data has a dynamic key
        if (obj["rootInstance"]) return true;
        for (const [key, val] of Object.entries(obj)) {
            if (key === '#' || key === '$id') continue;
            if (val && typeof val === 'object' && !Array.isArray(val) && (val as JsonObject)['#'] === 'CapsuleInstance') return true;
        }
        return false;
    },
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
