// ── Visualization panel abstraction ──────────────────────────────────
// Each visualization registers itself with a unique id, a display name,
// and a SolidJS component that receives the workbench context.

import type { JSX } from "solid-js";
import type { ModelApiClient } from "../modelApiClient";
import type { WorkbenchLib } from "../workbenchLib";

export type VisualizationContext = {
    /** The model API client */
    api: ModelApiClient;
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
    /** Tab component type for dockview (e.g. "no-close-tab") */
    tabComponent?: string;
    /** Initial width in grid columns (multiplied by colWidth) */
    initialWidthCols?: number;
    /** Maximum width in grid columns */
    maxWidthCols?: number;
    /** Minimum width in grid columns */
    minWidthCols?: number;
};
