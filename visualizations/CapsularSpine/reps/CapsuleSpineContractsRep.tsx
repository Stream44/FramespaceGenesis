import { For, Show } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/SpineContracts",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/SpineContracts",
    render: (data, ctx) => {
        const entries = Object.entries(data).filter(([k]) => k !== "#");
        return (
            <div class="rep-capsule-section">
                <div class="rep-capsule-section-header">Spine Contracts</div>
                <div class="rep-capsule-section-items">
                    <For each={entries}>
                        {([key, value]) => {
                            const hasTag = typeof value === "object" && value !== null && !Array.isArray(value) && "#" in value;
                            return (
                                <div class="rep-capsule-section-item">
                                    <div class="rep-spine-contract-key">{key}</div>
                                    <Show when={hasTag} fallback={
                                        <span class="rep-capsule-kv-val">{typeof value === "string" ? value : JSON.stringify(value)}</span>
                                    }>
                                        <RenderItem
                                            data={value as JsonValue}
                                            parentRep="Capsule/SpineContracts"
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
            </div>
        );
    },
});
