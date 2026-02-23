// ── CapsuleSpineTree rep ────────────────────────────────────────────
// Renders a CapsuleSpineTree as a Cytoscape compound-nodes graph
// inside a nested Dockview so visualization tabs can be tiled.

import { onMount, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import cytoscapeLib from "cytoscape";
const cytoscape = (cytoscapeLib as any).default || cytoscapeLib;
import { DockviewComponent } from "dockview-core";
import type { CreateComponentOptions, IContentRenderer } from "dockview-core";
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
                    "color": "#58a6ff",
                    "background-color": "#0d1b2e",
                    "border-color": "#1f6feb",
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
                    "background-color": "#161b22",
                    "border-color": "#30363d",
                    "padding": "15px",
                } as any,
            },
            // Nodes targeted by a propertyContractDelegate mapping
            {
                selector: "node[nodeType = 'contractDelegateTarget']",
                css: {
                    "background-color": "#3d3520",
                    "border-color": "#e3b341",
                    "color": "#e3b341",
                } as any,
            },
            {
                selector: "edge",
                css: {
                    "curve-style": "bezier",
                    "target-arrow-shape": "triangle",
                    "target-arrow-color": "#58a6ff",
                    "line-color": "#30363d",
                    "width": 1,
                    "label": "data(label)",
                    "font-size": "11px",
                    "color": "#8b949e",
                    "text-rotation": "autorotate",
                    "text-margin-y": -14,
                } as any,
            },
            // mapping edges: magenta, thicker, arrow on source side (reversed direction)
            {
                selector: "edge[edgeType = 'mapping']",
                css: {
                    "line-color": "#db61a2",
                    "target-arrow-shape": "none",
                    "source-arrow-shape": "triangle",
                    "source-arrow-color": "#db61a2",
                    "color": "#db61a2",
                    "width": 3,
                    "arrow-scale": 1.4,
                } as any,
            },
            // extends edges: dashed orange
            {
                selector: "edge[edgeType = 'extends']",
                css: {
                    "line-style": "dashed",
                    "line-color": "#d4956b",
                    "target-arrow-color": "#d4956b",
                } as any,
            },
            // propertyContractDelegate edges: yellow
            {
                selector: "edge[edgeType = 'contractDelegate']",
                css: {
                    "line-color": "#e3b341",
                    "target-arrow-color": "#e3b341",
                    "color": "#e3b341",
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

// ── Dockview content renderer for Compound Nodes tab ────────────────

// Rep URI for this file — used by Rep.code.show event
const REP_URI = "~viz/CapsularSpine/reps/CapsuleSpineTree";

function createCompoundNodesRenderer(data: JsonObject, spineInstanceUri?: string): (options: CreateComponentOptions) => IContentRenderer {
    return (_options: CreateComponentOptions) => {
        const el = document.createElement("div");
        el.style.cssText = "width:100%;height:100%;background:#0d1117;position:relative;";

        let cy: cytoscape.Core | null = null;
        let ro: ResizeObserver | null = null;

        return {
            element: el,
            init() {
                // Add Code button overlay
                const codeBtn = document.createElement("button");
                codeBtn.textContent = "Visualization Code";
                codeBtn.style.cssText = "position:absolute;top:6px;right:6px;z-index:10;padding:3px 10px;font-size:11px;background:#21262d;color:#c9d1d9;border:1px solid #30363d;border-radius:4px;cursor:pointer;";
                codeBtn.addEventListener("mouseenter", () => { codeBtn.style.borderColor = "#58a6ff"; });
                codeBtn.addEventListener("mouseleave", () => { codeBtn.style.borderColor = "#30363d"; });
                codeBtn.addEventListener("click", () => {
                    el.dispatchEvent(new CustomEvent("Rep.code.show", {
                        detail: { repUri: REP_URI },
                        bubbles: true,
                        composed: true,
                    }));
                });
                el.appendChild(codeBtn);

                // Wait for container to have dimensions before initializing
                requestAnimationFrame(() => {
                    cy = renderCompoundNodes(el, data, spineInstanceUri);

                    // Re-fit on container resize
                    ro = new ResizeObserver(() => {
                        if (cy) {
                            cy.resize();
                            cy.fit(undefined, 30);
                        }
                    });
                    ro.observe(el);
                });
            },
            dispose() {
                ro?.disconnect();
                if (cy) cy.destroy();
            },
        };
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
                createComponent: createCompoundNodesRenderer(data, ctx.spineInstanceUri),
            });

            dockview.addPanel({
                id: "compound-nodes",
                title: "Cytoscape: Compound Nodes",
                component: "compound-nodes",
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
