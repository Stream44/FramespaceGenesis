import { Show } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/PropertyMapping",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/PropertyMapping",
    render: (data, ctx) => {
        const capsule = data["capsule"] as JsonValue | undefined;
        return (
            <div class="rep-capsule-mapping">
                <span class="rep-capsule-mapping-tag">PropertyMapping</span>
                <Show when={capsule}>
                    <RenderItem
                        data={capsule as JsonValue}
                        parentRep="Capsule/PropertyMapping"
                        filterField={ctx.filterField}
                        onClickValue={ctx.onClickValue}
                        getPreview={ctx.getPreview}
                        spineInstanceUri={ctx.spineInstanceUri}
                    />
                </Show>
            </div>
        );
    },
});
