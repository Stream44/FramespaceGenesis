import { Show } from "solid-js";
import { registerRep } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Error",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Error",
    render: (data) => {
        const method = data["method"] as string | undefined;
        const message = data["message"] as string | undefined;
        const stack = data["stack"] as string | undefined;
        return (
            <div class="error-rep">
                <div class="error-rep-header">
                    <span class="error-rep-icon">⚠</span>
                    <span class="error-rep-title">{method ? `Error in ${method}` : "Error"}</span>
                </div>
                <Show when={message}>
                    <div class="error-rep-message">{message}</div>
                </Show>
                <Show when={stack}>
                    <details class="error-rep-stack-details">
                        <summary>Stack trace</summary>
                        <pre class="error-rep-stack">{stack}</pre>
                    </details>
                </Show>
            </div>
        );
    },
});
