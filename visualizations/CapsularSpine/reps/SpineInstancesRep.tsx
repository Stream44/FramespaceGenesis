import { For, Show } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "SpineInstances",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "SpineInstances" &&
        Array.isArray((data as JsonObject)["list"]),
    render: (data, ctx) => {
        const repName = data["#"] as string;
        const list = data["list"] as JsonValue[];
        const groups = data["groups"] as JsonValue[] | undefined;

        // If groups are available, render grouped view
        if (groups && Array.isArray(groups) && groups.length > 0) {
            return (
                <div class="rep-list">
                    <div class="rep-list-header">
                        <span class="rep-list-type">{repName}</span>
                        <span class="rep-list-count">{list.length} {list.length === 1 ? "instance" : "instances"}</span>
                    </div>
                    <div class="rep-list-items">
                        <For each={groups}>
                            {(group) => {
                                const g = group as JsonObject;
                                const modelName = g["modelName"] as string;
                                const exampleDir = g["exampleDir"] as string;
                                const items = g["list"] as JsonValue[];
                                return (
                                    <div class="rep-spine-group">
                                        <div class="rep-spine-group-header">
                                            <span class="rep-spine-group-model">{modelName}</span>
                                            <span class="rep-spine-group-sep">/</span>
                                            <span class="rep-spine-group-example">{exampleDir}</span>
                                            <span class="rep-list-count">{items.length}</span>
                                        </div>
                                        <div class="rep-spine-group-items">
                                            <For each={items}>
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
                            }}
                        </For>
                    </div>
                </div>
            );
        }

        // Fallback: flat list
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
