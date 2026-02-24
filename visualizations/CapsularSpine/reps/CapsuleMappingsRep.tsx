import { For } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/Mappings",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/Mappings",
    render: (data, ctx) => {
        const entries = Object.entries(data).filter(([k]) => k !== "#");
        return (
            <div class="rep-capsule-section">
                <div class="rep-capsule-section-header">Mappings</div>
                <div class="rep-capsule-section-items">
                    <For each={entries}>
                        {([key, value]) => (
                            <div class="rep-capsule-section-item">
                                <span class="rep-capsule-section-item-key">{key}</span>
                                <RenderItem
                                    data={value as JsonValue}
                                    parentRep="Capsule/Mappings"
                                    filterField={ctx.filterField}
                                    onClickValue={ctx.onClickValue}
                                    getPreview={ctx.getPreview}
                                    spineInstanceUri={ctx.spineInstanceUri}
                                />
                            </div>
                        )}
                    </For>
                </div>
            </div>
        );
    },
});
