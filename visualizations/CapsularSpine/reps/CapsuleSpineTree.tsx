// ── CapsuleSpineTree rep ────────────────────────────────────────────
// Renders a CapsuleSpineTree as a Cytoscape compound-nodes graph
// inside a nested Dockview so visualization tabs can be tiled.

import { onMount, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import cytoscapeLib from "cytoscape";
const cytoscape = (cytoscapeLib as any).default || cytoscapeLib;
import { DockviewComponent } from "dockview-core";
import type { CreateComponentOptions, IContentRenderer, DockviewTheme } from "dockview-core";

const themeBlueprintVellum: DockviewTheme = {
    name: "blueprint-vellum",
    className: "dockview-theme-blueprint-vellum",
    gap: 4,
};
import "dockview-core/dist/styles/dockview.css";
import { registerRep } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue, RepContext } from "../../../workbench/app/src/lib/renderLib";

// ── Pre-computed node metadata ──────────────────────────────────────
// Traverse the tree once to gather per-node flags that influence
// rendering (colours, shapes, etc.).  New flags can be added here
// without touching the Cytoscape style block.

type NodeMeta = {
    isContractDelegateTarget: boolean;
};

function precomputeNodeMeta(tree: JsonObject): Map<string, NodeMeta> {
    const meta = new Map<string, NodeMeta>();
    const ensure = (id: string) => {
        if (!meta.has(id)) meta.set(id, { isContractDelegateTarget: false });
        return meta.get(id)!;
    };

    function walk(capsule: JsonObject) {
        const id = capsule["$id"] as string | undefined;
        if (!id) return;
        ensure(id);

        const mappings = capsule["mappings"] as JsonObject | undefined;
        if (mappings && typeof mappings === "object") {
            for (const [propName, mapping] of Object.entries(mappings)) {
                if (propName === "#") continue;
                const m = mapping as JsonObject;
                const child = m["capsule"] as JsonObject | undefined;
                if (!child) continue;
                const childId = child["$id"] as string | undefined;
                if (!childId) continue;

                ensure(childId);
                // Use the explicit server flag to identify PropertyContractMapping
                if (m["isPropertyContractDelegate"]) {
                    meta.get(childId)!.isContractDelegateTarget = true;
                }
                walk(child);
            }
        }

        const ext = capsule["extends"] as JsonObject | undefined;
        if (ext && typeof ext === "object") {
            const extCapsule = ext["capsule"] as JsonObject | undefined;
            if (extCapsule) {
                const extId = extCapsule["$id"] as string | undefined;
                if (extId) { ensure(extId); walk(extCapsule); }
            }
        }
    }

    const list = tree["list"] as JsonValue[] | undefined;
    if (Array.isArray(list)) {
        for (const item of list) {
            if (typeof item === "object" && item !== null && !Array.isArray(item)) {
                walk(item as JsonObject);
            }
        }
    }
    return meta;
}

// ── Data extraction ─────────────────────────────────────────────────

type CyNode = { data: { id: string; label: string; parent?: string; nodeType?: string } };
type CyEdge = { data: { id: string; source: string; target: string; label?: string; edgeType?: string } };

function extractGraph(
    tree: JsonObject,
    spineInstanceUri?: string,
    nodeMeta?: Map<string, NodeMeta>,
): { nodes: CyNode[]; edges: CyEdge[] } {
    const nodes: CyNode[] = [];
    const edges: CyEdge[] = [];
    const seen = new Set<string>();

    // Format label: if it matches @org/name/rest, split into two lines
    // with the @org/name prefix on top and the rest below.
    function formatLabel(raw: string): string {
        const m = raw.match(/^(@[^/]+\/[^/]+)\/(.+)$/);
        if (m) return `${m[1]}\n/${m[2]}`;
        return raw;
    }

    function shortLabel(id: string): string {
        if (!spineInstanceUri) return formatLabel(id);
        const baseDir = spineInstanceUri.substring(0, spineInstanceUri.lastIndexOf('/'));
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

    function walk(capsule: JsonObject, parentGroupId?: string) {
        const id = capsule["$id"] as string | undefined;
        if (!id || seen.has(id)) return;
        seen.add(id);

        const meta = nodeMeta?.get(id);
        const nodeData: CyNode["data"] = { id, label: shortLabel(id) };
        if (parentGroupId) nodeData.parent = parentGroupId;
        if (meta?.isContractDelegateTarget) nodeData.nodeType = "contractDelegateTarget";
        nodes.push({ data: nodeData });

        // Mappings → edges + recurse
        const mappings = capsule["mappings"] as JsonObject | undefined;
        if (mappings && typeof mappings === "object") {
            for (const [propName, mapping] of Object.entries(mappings)) {
                if (propName === "#") continue;
                const m = mapping as JsonObject;
                const child = m["capsule"] as JsonObject | undefined;
                if (!child) continue;
                const childId = child["$id"] as string | undefined;
                if (!childId) continue;

                const edgeId = `${id}→${propName}→${childId}`;
                const edgeData: CyEdge["data"] = { id: edgeId, source: id, target: childId, label: propName };
                edgeData.edgeType = m["isPropertyContractDelegate"] ? "contractDelegate" : "mapping";
                edges.push({ data: edgeData });

                if (!seen.has(childId)) {
                    walk(child);
                }
            }
        }

        // Extends → edge + recurse
        const ext = capsule["extends"] as JsonObject | undefined;
        if (ext && typeof ext === "object") {
            const extCapsule = ext["capsule"] as JsonObject | undefined;
            if (extCapsule) {
                const extId = extCapsule["$id"] as string | undefined;
                if (extId) {
                    edges.push({ data: { id: `${id}→extends→${extId}`, source: id, target: extId, label: "extends", edgeType: "extends" } });
                    if (!seen.has(extId)) {
                        walk(extCapsule);
                    }
                }
            }
        }
    }

    // CapsuleSpineTree has a list of root capsules
    const list = tree["list"] as JsonValue[] | undefined;
    if (Array.isArray(list)) {
        for (const item of list) {
            if (typeof item === "object" && item !== null && !Array.isArray(item)) {
                walk(item as JsonObject);
            }
        }
    }

    return { nodes, edges };
}

// ── Cytoscape compound-nodes renderer ───────────────────────────────

function renderCompoundNodes(container: HTMLElement, data: JsonObject, spineInstanceUri?: string) {
    // Pre-compute node metadata before building the graph
    const nodeMeta = precomputeNodeMeta(data);
    const { nodes, edges } = extractGraph(data, spineInstanceUri, nodeMeta);

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
                    "background-color": "#e4dbc6",
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
                selector: ":parent",
                css: {
                    "text-valign": "top",
                    "text-halign": "center",
                    "background-color": "#ffffff",
                    "border-color": "#c4b89e",
                    "padding": "15px",
                } as any,
            },
            // Nodes targeted by a propertyContractDelegate mapping
            {
                selector: "node[nodeType = 'contractDelegateTarget']",
                css: {
                    "background-color": "#f2ecda",
                    "border-color": "#9a7030",
                    "color": "#9a7030",
                } as any,
            },
            {
                selector: "edge",
                css: {
                    "curve-style": "bezier",
                    "target-arrow-shape": "triangle",
                    "target-arrow-color": "#2b5a8c",
                    "line-color": "#c4b89e",
                    "width": 1,
                    "label": "data(label)",
                    "font-size": "11px",
                    "color": "#8a7a62",
                    "text-rotation": "autorotate",
                    "text-margin-y": -14,
                } as any,
            },
            // mapping edges: muted rose, thicker, arrow on source side (reversed direction)
            {
                selector: "edge[edgeType = 'mapping']",
                css: {
                    "line-color": "#a63d2f",
                    "target-arrow-shape": "none",
                    "source-arrow-shape": "triangle",
                    "source-arrow-color": "#a63d2f",
                    "color": "#a63d2f",
                    "width": 3,
                    "arrow-scale": 1.4,
                } as any,
            },
            // extends edges: dashed amber, arrow toward declaring capsule (source)
            {
                selector: "edge[edgeType = 'extends']",
                css: {
                    "line-style": "dashed",
                    "line-color": "#9a7030",
                    "target-arrow-shape": "none",
                    "source-arrow-shape": "triangle",
                    "source-arrow-color": "#9a7030",
                } as any,
            },
            // propertyContractDelegate edges: amber, arrow toward declaring capsule (source)
            {
                selector: "edge[edgeType = 'contractDelegate']",
                css: {
                    "line-color": "#9a7030",
                    "target-arrow-shape": "none",
                    "source-arrow-shape": "triangle",
                    "source-arrow-color": "#9a7030",
                    "color": "#9a7030",
                    "width": 3,
                    "arrow-scale": 1.4,
                } as any,
            },
        ],
        elements: { nodes, edges },
        layout: {
            name: "cose",
            animate: false,
            nodeDimensionsIncludeLabels: true,
            padding: 20,
        } as any,
    });

    // Center and fit after layout completes
    cy.on('layoutstop', () => {
        cy.fit(undefined, 30);
        cy.center();
    });

    return cy;
}

// ── Tree layout data extraction ──────────────────────────────────────
// Walks the CapsuleSpineTree from the root and fans out:
//   • extends  → to the right  (+x, same y)   — hard follow
//   • mappings → downward       (same x, +y)  — hard follow
// If a capsule is already in the tree, the edge links directly to it
// (no duplicate node).
//
// Struct / contractDelegate mappings create a faded stub node off to
// the diagonal.  If the struct extends a capsule, a hard extends edge
// connects it to that capsule in the tree.

type TreeCyNode = {
    data: { id: string; label: string; nodeType?: string; isStruct?: string };
    position: { x: number; y: number };
};
type TreeCyEdge = {
    data: { id: string; source: string; target: string; label?: string; edgeType?: string };
};

const TREE_X_STEP = 320;
const TREE_Y_STEP = 160;
const TREE_DIAG_X = 280;
const TREE_DIAG_Y = -120;

function extractTreeGraph(
    tree: JsonObject,
    spineInstanceUri?: string,
    nodeMeta?: Map<string, NodeMeta>,
): { nodes: TreeCyNode[]; edges: TreeCyEdge[] } {
    const nodes: TreeCyNode[] = [];
    const edges: TreeCyEdge[] = [];
    const placed = new Set<string>();   // capsule IDs already in the graph
    let edgeSeq = 0;                    // unique edge-id suffix

    function formatLabel(raw: string): string {
        const m = raw.match(/^(@[^/]+\/[^/]+)\/(.+)$/);
        if (m) return `${m[1]}\n/${m[2]}`;
        return raw;
    }

    function shortLabel(id: string): string {
        if (!spineInstanceUri) return formatLabel(id);
        const baseDir = spineInstanceUri.substring(0, spineInstanceUri.lastIndexOf('/'));
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
        const meta = nodeMeta?.get(id);
        const nd: TreeCyNode["data"] = { id, label: shortLabel(id), ...extra };
        if (meta?.isContractDelegateTarget) nd.nodeType = "contractDelegateTarget";
        nodes.push({ data: nd, position: { x, y } });
    }

    function addEdge(src: string, tgt: string, label: string, edgeType: string) {
        edges.push({ data: { id: `e${edgeSeq++}_${src}→${label}→${tgt}`, source: src, target: tgt, label, edgeType } });
    }

    // Build a lookup from $id → full capsule JSON.  The root list
    // contains full capsule objects (with nested mappings, extends, etc.)
    // but when a capsule is referenced via a parent's mapping, the
    // reference may be a minimal stub { $id: '...' } without nested
    // data.  The lookup lets us always use the full object.
    const capsuleLookup = new Map<string, JsonObject>();
    const list = tree["list"] as JsonValue[] | undefined;
    if (Array.isArray(list)) {
        for (const item of list) {
            if (typeof item === "object" && item !== null && !Array.isArray(item)) {
                const cid = (item as JsonObject)["$id"] as string | undefined;
                if (cid) capsuleLookup.set(cid, item as JsonObject);
            }
        }
    }

    // Ensure a capsule exists in the graph.  If it is already placed,
    // return its id without creating a new node.  Otherwise walk it
    // recursively (hard follow).  Prefers the full object from the
    // lookup so nested mappings/extends are available.
    function ensureCapsule(capsule: JsonObject, x: number, y: number, depth: number): { id: string; rows: number } | null {
        const id = capsule["$id"] as string | undefined;
        if (!id) return null;
        if (placed.has(id)) return { id, rows: 0 };
        const full = capsuleLookup.get(id) || capsule;
        return { id, rows: walk(full, x, y, depth) };
    }

    // Returns the number of grid rows consumed by this subtree.
    // depth is used to zigzag mapping children left/right.
    function walk(capsule: JsonObject, x: number, y: number, depth: number): number {
        const id = capsule["$id"] as string | undefined;
        if (!id) return 0;
        if (placed.has(id)) return 0;   // already placed — caller links to it

        placed.add(id);
        addNode(id, x, y);

        let rowsConsumed = 1;

        // ── Extends → to the right (hard follow) ──
        const ext = capsule["extends"] as JsonObject | undefined;
        if (ext && typeof ext === "object") {
            const extCapsule = ext["capsule"] as JsonObject | undefined;
            if (extCapsule) {
                const result = ensureCapsule(extCapsule, x + TREE_X_STEP, y, depth);
                if (result) {
                    addEdge(id, result.id, "extends", "extends");
                    if (result.rows > rowsConsumed) rowsConsumed = result.rows;
                }
            }
        }

        // ── Mappings ──
        const mappings = capsule["mappings"] as JsonObject | undefined;
        if (mappings && typeof mappings === "object") {
            let mappingOffset = 0;
            let diagIndex = 0;

            for (const [propName, mapping] of Object.entries(mappings)) {
                if (propName === "#") continue;
                const m = mapping as JsonObject;
                const child = m["capsule"] as JsonObject | undefined;
                if (!child) continue;
                const childId = child["$id"] as string | undefined;
                if (!childId) continue;

                const isDelegate = !!m["isPropertyContractDelegate"];

                if (isDelegate) {
                    // ── Struct mapping → faded stub diagonal up-right ──
                    diagIndex++;
                    const diagX = x + TREE_DIAG_X * diagIndex;
                    const diagY = y + TREE_DIAG_Y * diagIndex;

                    // Always create a dedicated struct stub node (faded)
                    const stubId = `__struct_${edgeSeq++}_${childId}`;
                    addNode(stubId, diagX, diagY, { isStruct: "true" });
                    // Copy the label from the real capsule
                    nodes[nodes.length - 1].data.label = shortLabel(childId);
                    addEdge(id, stubId, propName, "contractDelegate");

                    // If the struct extends a capsule, hard-link to it
                    const structExt = child["extends"] as JsonObject | undefined;
                    if (structExt && typeof structExt === "object") {
                        const structExtCap = structExt["capsule"] as JsonObject | undefined;
                        if (structExtCap) {
                            const structExtId = structExtCap["$id"] as string | undefined;
                            if (structExtId) {
                                // Ensure the extended capsule is in the tree
                                const result = ensureCapsule(structExtCap, diagX + TREE_X_STEP, diagY, depth + 1);
                                if (result) {
                                    addEdge(stubId, result.id, "extends", "extends");
                                }
                            }
                        }
                    }
                } else {
                    // ── Regular mapping → downward, zigzag left/right ──
                    const childY = y + TREE_Y_STEP * (rowsConsumed + mappingOffset);
                    const childDepth = depth + 1 + mappingOffset;
                    const nudge = (childDepth % 2 === 0 ? -1 : 1) * 100;
                    const result = ensureCapsule(child, x + nudge, childY, childDepth);
                    if (result) {
                        addEdge(id, result.id, propName, "mapping");
                        mappingOffset += Math.max(result.rows, 1);
                    }
                }
            }
            rowsConsumed += mappingOffset;
        }

        return rowsConsumed;
    }

    // Walk the root list in reverse.  The list is alphabetically sorted
    // by capsule name, so the actual root capsule (which maps to the
    // others) tends to be last.  Walking it first lets its recursive
    // walk place children with proper zigzag positions.  Capsules
    // already placed by recursion are skipped.
    if (Array.isArray(list)) {
        const items = [...list].reverse();
        let currentY = 0;
        for (const item of items) {
            if (typeof item === "object" && item !== null && !Array.isArray(item)) {
                const capsuleId = (item as JsonObject)["$id"] as string | undefined;
                if (capsuleId && placed.has(capsuleId)) continue; // already placed by recursion
                const rows = walk(item as JsonObject, 0, currentY * TREE_Y_STEP, 0);
                currentY += Math.max(rows, 1);
            }
        }
    }

    return { nodes, edges };
}

// ── Cytoscape Tree renderer ─────────────────────────────────────────

function renderTree(container: HTMLElement, data: JsonObject, spineInstanceUri?: string) {
    const nodeMeta = precomputeNodeMeta(data);
    const { nodes, edges } = extractTreeGraph(data, spineInstanceUri, nodeMeta);

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
                    "background-color": "#e4dbc6",
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
            // Struct stub nodes — faded
            {
                selector: "node[isStruct]",
                css: {
                    "opacity": 0.4,
                    "border-style": "dashed",
                } as any,
            },
            // Nodes targeted by a propertyContractDelegate mapping
            {
                selector: "node[nodeType = 'contractDelegateTarget']",
                css: {
                    "background-color": "#f2ecda",
                    "border-color": "#9a7030",
                    "color": "#9a7030",
                } as any,
            },
            {
                selector: "edge",
                css: {
                    "curve-style": "bezier",
                    "target-arrow-shape": "triangle",
                    "target-arrow-color": "#2b5a8c",
                    "line-color": "#c4b89e",
                    "width": 1,
                    "label": "data(label)",
                    "font-size": "11px",
                    "color": "#8a7a62",
                    "text-rotation": "autorotate",
                    "text-margin-y": -14,
                } as any,
            },
            // mapping edges: muted rose, thicker, arrow on source side (reversed direction)
            {
                selector: "edge[edgeType = 'mapping']",
                css: {
                    "line-color": "#a63d2f",
                    "target-arrow-shape": "none",
                    "source-arrow-shape": "triangle",
                    "source-arrow-color": "#a63d2f",
                    "color": "#a63d2f",
                    "width": 3,
                    "arrow-scale": 1.4,
                } as any,
            },
            // extends edges: dashed amber, arrow toward declaring capsule (source)
            {
                selector: "edge[edgeType = 'extends']",
                css: {
                    "line-style": "dashed",
                    "line-color": "#9a7030",
                    "target-arrow-shape": "none",
                    "source-arrow-shape": "triangle",
                    "source-arrow-color": "#9a7030",
                } as any,
            },
            // propertyContractDelegate edges: amber, arrow toward declaring capsule (source)
            {
                selector: "edge[edgeType = 'contractDelegate']",
                css: {
                    "line-color": "#9a7030",
                    "target-arrow-shape": "none",
                    "source-arrow-shape": "triangle",
                    "source-arrow-color": "#9a7030",
                    "color": "#9a7030",
                    "width": 3,
                    "arrow-scale": 1.4,
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

// ── Dockview content renderers ──────────────────────────────────────

// Rep URI for this file — used by Rep.code.show event
const REP_URI = "~viz/CapsularSpine/reps/CapsuleSpineTree";

function makeCodeButton(el: HTMLElement) {
    const codeBtn = document.createElement("button");
    codeBtn.textContent = "Visualization Code";
    codeBtn.style.cssText = "position:absolute;top:6px;right:6px;z-index:10;padding:3px 10px;font-size:11px;background:#e4dbc6;color:#5a4a36;border:1px solid #c4b89e;border-radius:3px;cursor:pointer;transition:all 0.1s ease;";
    codeBtn.addEventListener("mouseenter", () => { codeBtn.style.borderColor = "#2b5a8c"; codeBtn.style.color = "#2e2318"; });
    codeBtn.addEventListener("mouseleave", () => { codeBtn.style.borderColor = "#c4b89e"; codeBtn.style.color = "#5a4a36"; });
    codeBtn.addEventListener("click", () => {
        el.dispatchEvent(new CustomEvent("Rep.code.show", {
            detail: { repUri: REP_URI },
            bubbles: true,
            composed: true,
        }));
    });
    el.appendChild(codeBtn);
}

function createCyRenderer(
    renderFn: (container: HTMLElement, data: JsonObject, spineInstanceUri?: string) => any,
    data: JsonObject,
    spineInstanceUri?: string,
): IContentRenderer {
    const el = document.createElement("div");
    el.style.cssText = "width:100%;height:100%;background:#ffffff;position:relative;";

    // Dedicated inner container for Cytoscape so the button overlay
    // does not interfere with pointer events on the canvas.
    const cyContainer = document.createElement("div");
    cyContainer.style.cssText = "width:100%;height:100%;position:absolute;top:0;left:0;";
    el.appendChild(cyContainer);

    let cy: cytoscape.Core | null = null;
    let ro: ResizeObserver | null = null;
    let initialized = false;

    function initCy() {
        if (initialized) return;
        // Only initialize when the container has real dimensions
        if (cyContainer.offsetWidth === 0 || cyContainer.offsetHeight === 0) return;
        initialized = true;
        cy = renderFn(cyContainer, data, spineInstanceUri);
        ro = new ResizeObserver(() => {
            if (cy) {
                cy.resize();
                cy.fit(undefined, 30);
            }
        });
        ro.observe(cyContainer);
    }

    return {
        element: el,
        init() {
            makeCodeButton(el);
            // Try to init immediately; if the tab is hidden (zero size),
            // a ResizeObserver will catch when it becomes visible.
            requestAnimationFrame(() => {
                initCy();
                if (!initialized) {
                    const visRo = new ResizeObserver(() => {
                        if (!initialized && cyContainer.offsetWidth > 0) {
                            initCy();
                            if (initialized) visRo.disconnect();
                        }
                    });
                    visRo.observe(cyContainer);
                }
            });
        },
        dispose() {
            ro?.disconnect();
            if (cy) cy.destroy();
        },
    };
}

// ── Rep registration ────────────────────────────────────────────────

registerRep({
    name: "CapsuleSpineTree",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "CapsuleSpineTree",
    render: (data: JsonObject, ctx: RepContext): JSX.Element => {
        let containerRef: HTMLDivElement | undefined;
        let dockview: DockviewComponent | undefined;

        onMount(() => {
            if (!containerRef) return;

            dockview = new DockviewComponent(containerRef, {
                theme: themeBlueprintVellum,
                createComponent: (options: CreateComponentOptions): IContentRenderer => {
                    switch (options.name) {
                        case "tree":
                            return createCyRenderer(renderTree, data, ctx.spineInstanceUri);
                        case "compound-nodes":
                        default:
                            return createCyRenderer(renderCompoundNodes, data, ctx.spineInstanceUri);
                    }
                },
            });

            dockview.addPanel({
                id: "compound-nodes",
                title: "Declaration Graph",
                component: "compound-nodes",
            });

            dockview.addPanel({
                id: "tree",
                title: "Instance Graph",
                component: "tree",
                position: { referencePanel: "compound-nodes" },
            });
        });

        onCleanup(() => {
            dockview?.dispose();
        });

        return (
            <div
                class="rep-spine-tree-wrap"
                ref={(el: HTMLDivElement) => { containerRef = el; }}
            />
        );
    },
});
