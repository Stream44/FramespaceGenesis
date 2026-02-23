// ── Visualization panel abstraction ──────────────────────────────────
// Each visualization registers itself with a unique id, a display name,
// and a SolidJS component that receives the workbench context.

import type { JSX } from "solid-js";
import type { EngineClient } from "../engines";
import type { WorkbenchLib } from "../workbenchLib";

export type VisualizationContext = {
    /** All connected engine clients, keyed by engine id */
    engines: Record<string, EngineClient>;
    /** Currently selected spine instance URI */
    selectedSpineInstance: () => string | null;
    /** Shared libraries provided by the workbench */
    lib: WorkbenchLib;
};

export type VisualizationDef = {
    /** Unique panel id, e.g. "framespace-api" */
    id: string;
    /** Display title shown in the dockview tab */
    title: string;
    /** Short description */
    description: string;
    /** The SolidJS component to render inside the dockview panel */
    component: (props: { ctx: VisualizationContext }) => JSX.Element;
    /** Default position hint: "left" | "right" | "bottom" */
    position?: "left" | "right" | "bottom";
};
