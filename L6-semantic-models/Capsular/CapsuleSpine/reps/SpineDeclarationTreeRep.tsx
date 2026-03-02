// ── SpineDeclarationTreeRep ─────────────────────────────────────────
// Renders a SpineDeclarationTree as a Cytoscape graph showing the
// compile-time capsule declaration hierarchy (mappings, extends, contracts).

import { onMount, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { registerRep } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";
import type { JsonObject, RepContext } from "../../../../L13-workbench/vinxi-app/src/lib/renderLib";

// ── Pre-computed node metadata ──────────────────────────────────────

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
    spineInstanceTreeId?: string,
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

    function walk(capsule: JsonObject, x: number, y: number): number {
        const id = capsule["$id"] as string | undefined;
        if (!id) return 0;
        if (placed.has(id)) return 0;

        placed.add(id);
        addNode(id, x, y);

        let slotsConsumed = 1;

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

        // Struct Capsule → NW (up-left), always a faded stub
        if (structMapping) {
            const stubId = `__struct_${edgeSeq++}_${structMapping.childId}`;
            addNode(stubId, x - STEP * 0.8, y - STEP * 0.7, { isStruct: "true" });
            nodes[nodes.length - 1].data.label = shortLabel(structMapping.childId);
            addEdge(id, stubId, structMapping.propName, "contractDelegate");
        }

        // Regular mappings → NE (up-right), stacked
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

        // Extends → SE (down-right); link if already exists
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

        // Property contracts (non-struct) → S first, then fan S to W
        if (contractMappings.length > 0) {
            const count = contractMappings.length;
            const startAngle = Math.PI / 2;
            const endAngle = Math.PI * 0.85;
            const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
            const contractRadius = STEP * 0.9;

            for (let i = 0; i < count; i++) {
                const { propName, child, childId } = contractMappings[i];
                const angle = startAngle + angleStep * i;
                const cx = x + Math.cos(angle) * contractRadius * -1;
                const cy = y + Math.sin(angle) * contractRadius;

                if (placed.has(childId)) {
                    addEdge(id, childId, propName, "contractDelegate");
                } else {
                    const stubId = `__contract_${edgeSeq++}_${childId}`;
                    addNode(stubId, cx, cy, { nodeType: "contractDelegateTarget" });
                    nodes[nodes.length - 1].data.label = shortLabel(childId);
                    addEdge(id, stubId, propName, "contractDelegate");

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

// ── Cytoscape renderer ──────────────────────────────────────────────

function renderDeclarationTree(container: HTMLElement, data: JsonObject, spineInstanceTreeId: string | undefined, cytoscape: any) {
    const nodeMeta = precomputeNodeMeta(data);
    const { nodes, edges } = extractTreeGraph(data, spineInstanceTreeId, nodeMeta);

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

// ── Rep registration ────────────────────────────────────────────────

registerRep({
    name: "SpineDeclarationTree",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "SpineDeclarationTree",
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
                cy = renderDeclarationTree(containerRef!, data, ctx.spineInstanceTreeId, lib.cytoscape);
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
                class="rep-spine-declaration-tree"
                ref={(el: HTMLDivElement) => { containerRef = el; }}
                style="width:100%;height:100%;min-height:400px;background:#ffffff;"
            />
        );
    },
});
