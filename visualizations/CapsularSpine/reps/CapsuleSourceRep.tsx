import { For } from "solid-js";
import { registerRep } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/Source",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/Source",
    render: (data) => {
        const entries = Object.entries(data).filter(([k]) => k !== "#");
        return (
            <div class="rep-capsule-section">
                <div class="rep-capsule-section-header">Source</div>
                <div class="rep-capsule-section-body">
                    <For each={entries}>
                        {([key, value]) => (
                            <div class="rep-capsule-kv">
                                <span class="rep-capsule-kv-key">{key}</span>
                                <span class="rep-capsule-kv-val">{typeof value === "string" ? value : JSON.stringify(value)}</span>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        );
    },
});
