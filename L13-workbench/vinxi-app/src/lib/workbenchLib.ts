// ── Workbench shared library ─────────────────────────────────────────
// Bundles third-party libraries so visualizations can import them from
// the workbench context instead of declaring their own dependencies.

import { marked } from "marked";
import * as dockviewCore from "dockview-core";
import cytoscape from "cytoscape";

export const workbenchLib = {
    marked,
    dockviewCore,
    cytoscape,
} as const;

export type WorkbenchLib = typeof workbenchLib;
