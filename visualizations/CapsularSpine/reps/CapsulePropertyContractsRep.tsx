import { For, Show } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/PropertyContracts",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/PropertyContracts",
    render: (data) => {
        const entries = Object.entries(data).filter(([k]) => k !== "#");
        return (
            <div class="rep-property-contracts">
                <div class="rep-property-contracts-header">Capsule Property Contracts</div>
                <For each={entries}>
                    {([key, value]) => (
                        <div class="rep-property-contracts-item">
                            <span class="rep-property-contracts-key">{key}</span>
                            <Show when={typeof value === "object" && value !== null}>
                                <RenderItem data={value as JsonValue} parentRep="Capsule/PropertyContracts" />
                            </Show>
                        </div>
                    )}
                </For>
            </div>
        );
    },
});
