// ── Header Status Element ─────────────────────────────────────────────
// Provides panel IDs and definitions for on-demand panels launched from
// the workbench header: request log and model APIs.

export const REQUEST_LOG_PANEL_ID = "request-log";
export const MODEL_APIS_PANEL_ID = "framespace-api";
export const MODELS_PANEL_ID = "framespace-models";

export const requestLogPanelDef = {
    id: REQUEST_LOG_PANEL_ID,
    title: "Request Log",
    component: REQUEST_LOG_PANEL_ID,
};

export const modelApisPanelDef = {
    id: MODEL_APIS_PANEL_ID,
    title: "Model APIs",
    component: MODEL_APIS_PANEL_ID,
};
