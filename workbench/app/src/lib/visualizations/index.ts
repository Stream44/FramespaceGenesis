// ── Visualization registry ───────────────────────────────────────────
// All visualizations register here. The workbench iterates this list
// to populate dockview panels.

export type { VisualizationDef, VisualizationContext } from "./types";
export type { WorkbenchLib } from "../workbenchLib";
export { workbenchLib } from "../workbenchLib";
export { FramespaceAPI } from "~viz/FramespaceAPI";

import type { VisualizationDef } from "./types";
import { FramespaceAPI } from "~viz/FramespaceAPI";

// Side-effect import: registers CapsuleSpineTree rep with renderLib
import "~viz/CapsularSpine/reps/CapsuleSpineTree";

export const visualizations: VisualizationDef[] = [
    {
        id: "framespace-api",
        title: "Framespace API",
        description: "Interactive API explorer for engine endpoints",
        component: FramespaceAPI,
        position: "left",
    },
];
