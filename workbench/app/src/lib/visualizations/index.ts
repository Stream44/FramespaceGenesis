// ── Visualization registry ───────────────────────────────────────────
// All visualizations register here. The workbench iterates this list
// to populate dockview panels.

export type { VisualizationDef, VisualizationContext } from "./types";
export type { WorkbenchLib } from "../workbenchLib";
export { workbenchLib } from "../workbenchLib";
export { FramespaceAPI } from "~viz/FramespaceAPI/FramespaceAPI";

import type { VisualizationDef } from "./types";
import { FramespaceAPI } from "~viz/FramespaceAPI/FramespaceAPI";

// Side-effect imports: register reps with renderLib
import "~viz/FramespaceAPI/reps/ErrorRep";
import "~viz/CapsularSpine/reps/CapsulePropertyContractsRep";
import "~viz/CapsularSpine/reps/CapsuleSourceRep";
import "~viz/CapsularSpine/reps/CapsuleSpineContractsRep";
import "~viz/CapsularSpine/reps/CapsuleSpineContractRep";
import "~viz/CapsularSpine/reps/CapsulePropertyContractRep";
import "~viz/CapsularSpine/reps/CapsulePropertyRep";
import "~viz/CapsularSpine/reps/CapsulePropertiesRep";
import "~viz/CapsularSpine/reps/CapsuleExtendsRep";
import "~viz/CapsularSpine/reps/CapsuleMappingsRep";
import "~viz/CapsularSpine/reps/CapsulePropertyMappingRep";
import "~viz/CapsularSpine/reps/CapsulePropertyContractMappingRep";
import "~viz/CapsularSpine/reps/CapsuleRep";
import "~viz/CapsularSpine/reps/CapsulesRep";
import "~viz/CapsularSpine/reps/SpineInstanceRep";
import "~viz/CapsularSpine/reps/SpineInstancesRep";
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
