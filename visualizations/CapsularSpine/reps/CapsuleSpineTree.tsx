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

    const root = tree["rootCapsule"] as JsonObject | undefined;
    if (root && typeof root === "object" && !Array.isArray(root)) {
        walk(root);
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

    // CapsuleSpineTree has a single rootCapsule
    const root = tree["rootCapsule"] as JsonObject | undefined;
    if (root && typeof root === "object" && !Array.isArray(root)) {
        walk(root as JsonObject);
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
// Layout rules (Y-axis is inverted: positive = down on screen):
//   • rootCapsule starts at bottom-left (origin 0,0)
//   • '#@stream44.studio/encapsulate/structs/Capsule' → NW (up-left), yellow/faded/smaller
//   • mappings → NE (up-right)
//   • extends → SE (down-right); link to existing node if already placed
//   • property contracts (non-struct) → S first, then fan between S and W

type TreeCyNode = {
    data: { id: string; label: string; nodeType?: string; isStruct?: string };
    position: { x: number; y: number };
};
type TreeCyEdge = {
    data: { id: string; source: string; target: string; label?: string; edgeType?: string };
};

const STEP = 300;
const STRUCT_CAPSULE_ID = "@stream44.studio/encapsulate/structs/Capsule";

function extractTreeGraph(
    tree: JsonObject,
    spineInstanceUri?: string,
    nodeMeta?: Map<string, NodeMeta>,
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

    // Build lookup for full capsule objects keyed by $id (recursive)
    const capsuleLookup = new Map<string, JsonObject>();
    function indexCapsule(cap: JsonObject) {
        const cid = cap["$id"] as string | undefined;
        if (cid && !capsuleLookup.has(cid)) {
            capsuleLookup.set(cid, cap);
            const mappings = cap["mappings"] as JsonObject | undefined;
            if (mappings && typeof mappings === "object") {
                for (const [k, v] of Object.entries(mappings)) {
                    if (k === "#") continue;
                    const child = (v as JsonObject)["capsule"] as JsonObject | undefined;
                    if (child) indexCapsule(child);
                }
            }
            const ext = cap["extends"] as JsonObject | undefined;
            if (ext && typeof ext === "object") {
                const extCap = ext["capsule"] as JsonObject | undefined;
                if (extCap) indexCapsule(extCap);
            }
        }
    }
    const rootCapsule = tree["rootCapsule"] as JsonObject | undefined;
    if (rootCapsule) indexCapsule(rootCapsule);

    // Walk the tree from the root with directional placement.
    // x,y is the position of this node. Returns the number of slots consumed.
    function walk(capsule: JsonObject, x: number, y: number): number {
        const id = capsule["$id"] as string | undefined;
        if (!id) return 0;
        if (placed.has(id)) return 0;

        placed.add(id);
        addNode(id, x, y);

        let slotsConsumed = 1;

        // Categorise children
        const mappings = capsule["mappings"] as JsonObject | undefined;
        const regularMappings: { propName: string; child: JsonObject; childId: string }[] = [];
        const contractMappings: { propName: string; child: JsonObject; childId: string }[] = [];
        let structMapping: { propName: string; child: JsonObject; childId: string } | null = null;

        if (mappings && typeof mappings === "object") {
            for (const [propName, mapping] of Object.entries(mappings)) {
                if (propName === "#") continue;
                const m = mapping as JsonObject;
                const child = m["capsule"] as JsonObject | undefined;
                if (!child) continue;
                const childId = child["$id"] as string | undefined;
                if (!childId) continue;

                const isDelegate = !!m["isPropertyContractDelegate"];
                if (isDelegate && childId === STRUCT_CAPSULE_ID) {
                    structMapping = { propName, child, childId };
                } else if (isDelegate) {
                    contractMappings.push({ propName, child, childId });
                } else {
                    regularMappings.push({ propName, child, childId });
                }
            }
        }

        // ── Struct Capsule → NW (up-left), always a faded stub ──
        if (structMapping) {
            const stubId = `__struct_${edgeSeq++}_${structMapping.childId}`;
            addNode(stubId, x - STEP * 0.8, y - STEP * 0.7, { isStruct: "true" });
            nodes[nodes.length - 1].data.label = shortLabel(structMapping.childId);
            addEdge(id, stubId, structMapping.propName, "contractDelegate");
        }

        // ── Regular mappings → NE (up-right), stacked ──
        let mappingIdx = 0;
        for (const { propName, child, childId } of regularMappings) {
            const full = capsuleLookup.get(childId) || child;
            if (placed.has(childId)) {
                addEdge(id, childId, propName, "mapping");
            } else {
                const mx = x + STEP;
                const my = y - STEP * (1 + mappingIdx * 0.8);
                const consumed = walk(full, mx, my);
                addEdge(id, childId, propName, "mapping");
                slotsConsumed += consumed;
                mappingIdx++;
            }
        }

        // ── Extends → SE (down-right); link if already exists ──
        const ext = capsule["extends"] as JsonObject | undefined;
        if (ext && typeof ext === "object") {
            const extCapsule = ext["capsule"] as JsonObject | undefined;
            if (extCapsule) {
                const extId = extCapsule["$id"] as string | undefined;
                if (extId) {
                    if (placed.has(extId)) {
                        addEdge(id, extId, "extends", "extends");
                    } else {
                        const full = capsuleLookup.get(extId) || extCapsule;
                        const ex = x + STEP;
                        const ey = y + STEP * 0.7;
                        const consumed = walk(full, ex, ey);
                        addEdge(id, extId, "extends", "extends");
                        slotsConsumed += consumed;
                    }
                }
            }
        }

        // ── Property contracts (non-struct) → S first, then fan S to W ──
        if (contractMappings.length > 0) {
            const count = contractMappings.length;
            // Fan angles from straight down (π/2) toward left (π), evenly spaced
            const startAngle = Math.PI / 2;   // straight down (S)
            const endAngle = Math.PI * 0.85;  // nearly W
            const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
            const contractRadius = STEP * 0.9;

            for (let i = 0; i < count; i++) {
                const { propName, child, childId } = contractMappings[i];
                const angle = startAngle + angleStep * i;
                const cx = x + Math.cos(angle) * contractRadius * -1; // flip x: S goes down, W goes left
                const cy = y + Math.sin(angle) * contractRadius;

                if (placed.has(childId)) {
                    addEdge(id, childId, propName, "contractDelegate");
                } else {
                    const stubId = `__contract_${edgeSeq++}_${childId}`;
                    addNode(stubId, cx, cy, { nodeType: "contractDelegateTarget" });
                    nodes[nodes.length - 1].data.label = shortLabel(childId);
                    addEdge(id, stubId, propName, "contractDelegate");

                    // If the contract capsule extends something, link it
                    const full = capsuleLookup.get(childId) || child;
                    const cExt = full["extends"] as JsonObject | undefined;
                    if (cExt && typeof cExt === "object") {
                        const cExtCap = cExt["capsule"] as JsonObject | undefined;
                        if (cExtCap) {
                            const cExtId = cExtCap["$id"] as string | undefined;
                            if (cExtId && placed.has(cExtId)) {
                                addEdge(stubId, cExtId, "extends", "extends");
                            }
                        }
                    }
                }
            }
        }

        return slotsConsumed;
    }

    if (rootCapsule) {
        walk(rootCapsule, 0, 0);
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
            // Struct stub nodes — yellow, faded, smaller
            {
                selector: "node[isStruct]",
                css: {
                    "opacity": 0.4,
                    "border-style": "dashed",
                    "background-color": "#f5edc8",
                    "border-color": "#9a7030",
                    "color": "#9a7030",
                    "font-size": "12px",
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
