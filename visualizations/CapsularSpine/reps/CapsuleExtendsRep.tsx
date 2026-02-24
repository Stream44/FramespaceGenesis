import { Show } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/Extends",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/Extends",
    render: (data, ctx) => {
        const capsule = data["capsule"] as JsonValue | undefined;
        return (
            <div class="rep-capsule-section">
                <div class="rep-capsule-section-header">Extends</div>
                <Show when={capsule}>
                    <div class="rep-capsule-section-items">
                        <RenderItem
                            data={capsule as JsonValue}
                            parentRep="Capsule/Extends"
                            filterField={ctx.filterField}
                            onClickValue={ctx.onClickValue}
                            getPreview={ctx.getPreview}
                            spineInstanceUri={ctx.spineInstanceUri}
                        />
                    </div>
                </Show>
            </div>
        );
    },
});
