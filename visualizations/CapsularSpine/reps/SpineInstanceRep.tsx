import { registerRep } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "SpineInstance",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "SpineInstance",
    render: (data, ctx) => {
        const hashType = data["#"] as string;
        const id = data["$id"] as string | undefined;
        const title = id ?? hashType;
        const actionAllowed = !!id && !!ctx.onClickValue && (ctx.parentRep ?? "").startsWith("SpineInstances");

        const handleSelect = (e: MouseEvent) => {
            if (!id) return;
            const el = e.currentTarget as HTMLElement;
            el.dispatchEvent(new CustomEvent("SpineInstances.select.SpineInstance", {
                detail: { $id: id },
                bubbles: true,
                composed: true,
            }));
        };

        return (
            <div class="rep-capsule">
                <div
                    class={`rep-capsule-header ${actionAllowed ? "clickable" : ""}`}
                    onClick={actionAllowed ? handleSelect : undefined}
                >
                    <span class="rep-capsule-type">{hashType}</span>
                    <span class={`rep-capsule-name ${actionAllowed ? "clickable" : ""}`}>{title}</span>
                </div>
            </div>
        );
    },
});
