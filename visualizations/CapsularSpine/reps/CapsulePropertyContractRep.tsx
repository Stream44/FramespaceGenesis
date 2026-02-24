import { For, Show } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/PropertyContract",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/PropertyContract",
    render: (data, ctx) => {
        const props = data["properties"] as JsonObject | undefined;
        const propsEntries = props ? Object.entries(props).filter(([k]) => k !== "#") : [];
        const rest = Object.entries(data).filter(([k]) => k !== "#" && k !== "properties");
        return (
            <div class="rep-capsule-section rep-capsule-section-nested">
                <Show when={propsEntries.length > 0}>
                    <div class="rep-capsule-section-header">Properties</div>
                    <div class="rep-capsule-section-items">
                        <For each={propsEntries}>
                            {([key, value]) => {
                                const hasTag = typeof value === "object" && value !== null && !Array.isArray(value) && "#" in value;
                                return (
                                    <div class="rep-capsule-section-item">
                                        <span class="rep-capsule-section-item-key">{key}</span>
                                        <Show when={hasTag} fallback={
                                            <span class="rep-capsule-kv-val">{typeof value === "string" ? value : JSON.stringify(value)}</span>
                                        }>
                                            <RenderItem
                                                data={value as JsonValue}
                                                parentRep="Capsule/PropertyContract"
                                                filterField={ctx.filterField}
                                                onClickValue={ctx.onClickValue}
                                                getPreview={ctx.getPreview}
                                                spineInstanceUri={ctx.spineInstanceUri}
                                            />
                                        </Show>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </Show>
                <Show when={rest.length > 0}>
                    <div class="rep-capsule-section-body">
                        <For each={rest}>
                            {([key, value]) => (
                                <div class="rep-capsule-kv">
                                    <span class="rep-capsule-kv-key">{key}</span>
                                    <span class="rep-capsule-kv-val">{typeof value === "string" ? value : JSON.stringify(value)}</span>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        );
    },
});
