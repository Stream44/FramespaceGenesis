import { For, Show } from "solid-js";
import { registerRep } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule/Property",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/Property",
    render: (data) => {
        const propType = data["propertyType"] as string | undefined;
        const shortType = propType?.replace("CapsulePropertyTypes.", "") ?? "";
        const rest = Object.entries(data).filter(([k]) => k !== "#" && k !== "propertyType");
        return (
            <div class="rep-capsule-property">
                <Show when={shortType}>
                    <span class="rep-capsule-prop-type">{shortType}</span>
                </Show>
                <For each={rest}>
                    {([key, value]) => (
                        <span class="rep-capsule-prop-tag">
                            <span class="rep-capsule-prop-tag-key">{key}</span>
                            <span class="rep-capsule-prop-tag-eq">=</span>
                            <span class="rep-capsule-prop-tag-val">{typeof value === "string" ? value : JSON.stringify(value)}</span>
                        </span>
                    )}
                </For>
            </div>
        );
    },
});
