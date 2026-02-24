import { For } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsules",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsules" &&
        Array.isArray((data as JsonObject)["list"]),
    render: (data, ctx) => {
        const repName = data["#"] as string;
        const list = data["list"] as JsonValue[];
        return (
            <div class="rep-list">
                <div class="rep-list-header">
                    <span class="rep-list-type">{repName}</span>
                    <span class="rep-list-count">{list.length} {list.length === 1 ? "item" : "items"}</span>
                </div>
                <div class="rep-list-items">
                    <For each={list}>
                        {(item) => (
                            <RenderItem
                                data={item}
                                parentRep={repName}
                                filterField={ctx.filterField}
                                onClickValue={ctx.onClickValue}
                                getPreview={ctx.getPreview}
                                spineInstanceUri={ctx.spineInstanceUri}
                            />
                        )}
                    </For>
                </div>
            </div>
        );
    },
});
