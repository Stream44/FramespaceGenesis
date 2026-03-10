// ── Visualization registry ───────────────────────────────────────────
// All visualizations register here. The workbench iterates this list
// to populate dockview panels.

export type { VisualizationDef, VisualizationContext } from "./types";
export type { WorkbenchLib } from "../workbenchLib";
export { workbenchLib } from "../workbenchLib";
export { FramespaceAPI, panelDef as FramespaceAPIPanelDef } from "~L8/Workbench/ModelAPIs/Panel";
export { FramespacesPanel, panelDef as FramespacesPanelDef } from "~L8/Workbench/Framespaces/Panel";
export type { FramespaceLink } from "~L8/Workbench/Framespaces/Panel";

import type { VisualizationDef } from "./types";
import { panelDef as FramespacesPanelDef } from "~L8/Workbench/Framespaces/Panel";
import { panelDef as FramespaceAPIPanelDef } from "~L8/Workbench/ModelAPIs/Panel";

// Side-effect imports: register reps with renderLib
import "~L6/Framespace/Workbench/reps/ErrorRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsulePropertyContractsRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsuleSourceRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsuleSpineContractsRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsuleSpineContractRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsulePropertyContractRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsulePropertyRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsulePropertiesRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsuleExtendsRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsuleMappingsRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsulePropertyMappingRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsulePropertyContractMappingRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsuleRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsulesRep";
import "~L6/Capsular/CapsuleSpine/reps/SpineInstanceRep";
import "~L6/Capsular/CapsuleSpine/reps/SpineInstancesRep";
import "~L6/Capsular/CapsuleSpine/reps/CapsuleSpineTree";
import "~L6/Capsular/CapsuleSpine/reps/SpineDeclarationTreeRep";
import "~L6/Capsular/CapsuleSpine/reps/SpineInstanceTreeRep";
import "~L8/CapsuleSpine/Quadrant/reps/TableView";
import "~L8/CapsuleSpine/Codepath/reps/SwimlaneView";
import "~L8/Composite/Quadrant-Codepath/reps/QuadrantCodepathView";

// Default visualizations — these are shown from the start and are non-closable
export const visualizations: VisualizationDef[] = [
    {
        ...FramespacesPanelDef,
        component: () => null, // placeholder — rendered inline in WorkbenchDockview
    },
];

// On-demand panels — these are closable and launched from the header
export const onDemandPanels = {
    modelApis: FramespaceAPIPanelDef,
};
