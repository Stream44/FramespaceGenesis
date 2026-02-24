import { For, Show } from "solid-js";
import { registerRep, RenderItem } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/SpineContract",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/SpineContract",
    render: (data, ctx) => {
        // Extract propertyContracts explicitly — '#' is a valid contractKey in this object,
        // NOT a type tag, so we iterate ALL keys of propertyContracts including '#'.
        const pcRaw = data["propertyContracts"] as JsonObject | undefined;
        const pcEntries = pcRaw ? Object.entries(pcRaw).filter(([, v]) =>
            typeof v === "object" && v !== null && !Array.isArray(v)
        ) : [];
        const rest = Object.entries(data).filter(([k]) => k !== "#" && k !== "propertyContracts");
        return (
            <div class="rep-capsule-section rep-capsule-section-nested">
                <Show when={pcEntries.length > 0}>
                    <div class="rep-capsule-section-header">Property Contracts</div>
                    <div class="rep-capsule-section-items">
                        <For each={pcEntries}>
                            {([key, value]) => (
                                <div class="rep-capsule-section-item">
                                    <span class="rep-capsule-section-item-key">{key}</span>
                                    <RenderItem
                                        data={value as JsonValue}
                                        parentRep="Capsule/SpineContract"
                                        filterField={ctx.filterField}
                                        onClickValue={ctx.onClickValue}
                                        getPreview={ctx.getPreview}
                                        spineInstanceUri={ctx.spineInstanceUri}
                                    />
                                </div>
                            )}
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
