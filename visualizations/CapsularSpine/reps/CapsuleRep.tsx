import { For, Show, createSignal } from "solid-js";
import { registerRep, RenderItem, PrettyJson, vlog, splitFilePath, makeRelativePath } from "../../../workbench/app/src/lib/renderLib";
import type { JsonObject, JsonValue } from "../../../workbench/app/src/lib/renderLib";

registerRep({
    name: "Capsule",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule",
    render: (data, ctx) => {
        const hashType = data["#"] as string;
        const id = data["$id"] as string | undefined;
        const capsuleName = data["capsuleName"] as string | undefined;
        const cstFilepath = data["cstFilepath"] as string | undefined;
        const moduleFilepath = data["moduleFilepath"] as string | undefined;
        const moduleUri = data["moduleUri"] as string | undefined;
        let sourceLineRef = data["capsuleSourceLineRef"] as string | undefined;
        // Keep the raw absolute path for the Code button before display transforms
        const rawSourceLineRef = sourceLineRef;
        // Extract ":line" suffix for display
        const lineMatch = rawSourceLineRef?.match(/:(\d+)$/);
        const lineSuffix = lineMatch ? `:${lineMatch[1]}` : '';

        // Title is $id relative to dirname of spineInstanceUri
        let title = id ?? capsuleName ?? hashType;
        let titleIsRelative = false;
        if (id && ctx.spineInstanceUri) {
            const baseDir = ctx.spineInstanceUri.substring(0, ctx.spineInstanceUri.lastIndexOf('/'));
            if (baseDir) {
                const rel = makeRelativePath(id, baseDir);
                if (rel !== id) {
                    title = '/' + rel;
                    titleIsRelative = true;
                }
            }
        }
        const showCapsuleName = capsuleName && capsuleName !== id;

        // Smart display: strip moduleFilepath prefix from capsuleSourceLineRef
        if (sourceLineRef && moduleFilepath && sourceLineRef.startsWith(moduleFilepath)) {
            sourceLineRef = sourceLineRef.slice(moduleFilepath.length);
        }

        // Smart display: hide moduleUri if same as title
        const showModuleUri = moduleUri && moduleUri !== title;

        // Collect remaining properties (everything not specially rendered)
        const specialKeys = new Set(["#", "$id", "capsuleName", "cstFilepath", "moduleFilepath", "moduleUri", "capsuleSourceLineRef"]);
        const rest: JsonObject = {};
        for (const [k, v] of Object.entries(data)) {
            if (!specialKeys.has(k)) rest[k] = v;
        }
        const hasRest = Object.keys(rest).length > 0;

        // Determine if body has rich content beyond just capsuleSourceLineRef
        const hasRichBody = !!(cstFilepath || moduleFilepath || hasRest);
        // If only capsuleSourceLineRef is extra, body starts collapsed
        const [expanded, setExpanded] = createSignal(hasRichBody);
        // Lazy-loaded full capsule data
        const [loadedData, setLoadedData] = createSignal<JsonObject | null>(null);
        const [loading, setLoading] = createSignal(false);
        const [copied, setCopied] = createSignal(false);

        // Capsules.select.Capsule is only active when nested inside a 'Capsules' parent rep
        const actionAllowed = !!id && !!ctx.onClickValue && (ctx.parentRep ?? "").startsWith("Capsules");
        const preview = () => id ? ctx.getPreview?.(id) : undefined;

        const handleSelect = (e: MouseEvent) => {
            if (!id) return;
            const el = e.currentTarget as HTMLElement;
            el.dispatchEvent(new CustomEvent("Capsules.select.Capsule", {
                detail: { $id: id },
                bubbles: true,
                composed: true,
            }));
        };

        const handleCodeClick = (e: MouseEvent) => {
            e.stopPropagation();
            if (!rawSourceLineRef) return;
            document.dispatchEvent(new CustomEvent("Capsule.code.open", {
                detail: { filepath: rawSourceLineRef },
            }));
        };

        const handleHeaderClick = (e: MouseEvent) => {
            if (actionAllowed) {
                handleSelect(e);
            } else {
                setExpanded(!expanded());
            }
        };

        const handleSourceLineClick = () => {
            if (!rawSourceLineRef) return;
            document.dispatchEvent(new CustomEvent("Capsule.code.open", {
                detail: { filepath: rawSourceLineRef },
            }));
        };

        const handleCopy = async (e: MouseEvent) => {
            e.stopPropagation();
            if (!rawSourceLineRef) return;
            try {
                await navigator.clipboard.writeText(rawSourceLineRef);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
            } catch { /* ignore */ }
        };

        const handleLoad = async (e: MouseEvent) => {
            e.stopPropagation();
            if (!id || loading()) return;
            setLoading(true);
            try {
                const resp = await fetch(`http://localhost:4000/api/Encapsulate/CapsuleSpine/getCapsule?capsuleName=${encodeURIComponent(id)}`);
                const json = await resp.json();
                if (json.result) setLoadedData(json.result as JsonObject);
            } catch (err) {
                vlog("Capsule/Load", "getCapsule failed:", err);
            } finally {
                setLoading(false);
            }
        };

        // Render the body content for a capsule data object
        const renderBody = (d: JsonObject) => {
            const bodyRest: JsonObject = {};
            for (const [k, v] of Object.entries(d)) {
                if (!specialKeys.has(k)) bodyRest[k] = v;
            }
            const bodyHasRest = Object.keys(bodyRest).length > 0;
            let bodySourceLineRef = d["capsuleSourceLineRef"] as string | undefined;
            const bodyModuleFilepath = d["moduleFilepath"] as string | undefined;
            const bodyCstFilepath = d["cstFilepath"] as string | undefined;
            if (bodySourceLineRef && bodyModuleFilepath && bodySourceLineRef.startsWith(bodyModuleFilepath)) {
                bodySourceLineRef = bodySourceLineRef.slice(bodyModuleFilepath.length);
            }
            return (
                <>
                    <Show when={bodyCstFilepath}>
                        <div class="rep-capsule-source">
                            <Show when={bodyCstFilepath} keyed>
                                {(fp) => {
                                    const { prefix, highlight, highlightType, file } = splitFilePath(fp);
                                    const hlClass = highlightType === "magenta" ? "rep-source-highlight" : "rep-source-file";
                                    return (
                                        <>
                                            <span class="rep-source-dir">{prefix}</span>
                                            <Show when={highlight}>
                                                <span class={hlClass}>{highlight}</span>
                                            </Show>
                                            <span class="rep-source-file">{file}</span>
                                        </>
                                    );
                                }}
                            </Show>
                        </div>
                    </Show>
                    <Show when={bodySourceLineRef || bodyModuleFilepath}>
                        <div class="rep-capsule-source rep-capsule-source-clickable" onClick={handleSourceLineClick} title="Open in editor">
                            <Show when={bodyModuleFilepath} keyed>
                                {(fp) => {
                                    const { prefix, highlight, highlightType, file } = splitFilePath(fp);
                                    const hlClass = highlightType === "magenta" ? "rep-source-highlight" : "rep-source-file";
                                    return (
                                        <>
                                            <span class="rep-source-dir">{prefix}</span>
                                            <Show when={highlight}>
                                                <span class={hlClass}>{highlight}</span>
                                            </Show>
                                            <span class="rep-source-file">{file}</span>
                                        </>
                                    );
                                }}
                            </Show>
                            <Show when={bodySourceLineRef}>
                                <span class="rep-source-line">{bodySourceLineRef}</span>
                            </Show>
                            <button class="rep-capsule-copy-btn" onClick={handleCopy} title="Copy path">
                                {copied() ? "✓" : "⎘"}
                            </button>
                        </div>
                    </Show>
                    <Show when={preview() != null}>
                        <div class="rep-capsule-preview">
                            <pre class="entity-json">
                                <PrettyJson data={preview()!} />
                            </pre>
                        </div>
                    </Show>
                    <Show when={bodyHasRest}>
                        <div class="rep-capsule-rest">
                            <For each={Object.entries(bodyRest)}>
                                {([key, val]) => {
                                    const hasTag = typeof val === "object" && val !== null && !Array.isArray(val) && "#" in val;
                                    return (
                                        <Show when={hasTag} fallback={
                                            <pre class="entity-json rep-capsule-rest-json">
                                                <span class="json-key">"{key}"</span>
                                                <span class="json-colon">{": "}</span>
                                                <PrettyJson
                                                    data={val as JsonValue}
                                                    filterField={ctx.filterField}
                                                    onClickValue={ctx.onClickValue}
                                                />
                                            </pre>
                                        }>
                                            <RenderItem
                                                data={val as JsonValue}
                                                filterField={ctx.filterField}
                                                onClickValue={ctx.onClickValue}
                                                getPreview={ctx.getPreview}
                                                spineInstanceUri={ctx.spineInstanceUri}
                                            />
                                        </Show>
                                    );
                                }}
                            </For>
                        </div>
                    </Show>
                </>
            );
        };

        return (
            <div class="rep-capsule">
                <div
                    class={`rep-capsule-header ${actionAllowed ? "clickable" : "expandable"}`}
                    onClick={handleHeaderClick}
                >
                    <span class="rep-capsule-type">{hashType}</span>
                    <Show when={titleIsRelative} fallback={
                        <span class={`rep-capsule-name ${actionAllowed ? "clickable" : ""}`}>{title}<Show when={lineSuffix}><span class="rep-capsule-line">{lineSuffix}</span></Show></span>
                    }>
                        <span class={`rep-capsule-name ${actionAllowed ? "clickable" : ""}`}>
                            <span class="rep-capsule-rootdir">&lt;SpineRootDir&gt;</span>{title}<Show when={lineSuffix}><span class="rep-capsule-line">{lineSuffix}</span></Show>
                        </span>
                    </Show>
                    <Show when={showCapsuleName}>
                        <span class="rep-capsule-module">[{capsuleName}]</span>
                    </Show>
                    <Show when={showModuleUri}>
                        <span class="rep-capsule-module">[{moduleUri}]</span>
                    </Show>
                    <Show when={rawSourceLineRef}>
                        <button class="rep-capsule-code-btn" onClick={handleCodeClick} title="Open source file">Code</button>
                    </Show>
                </div>
                <Show when={expanded()}>
                    <div class="rep-capsule-body">
                        <Show when={loadedData()} fallback={renderBody(data)}>
                            {(ld) => renderBody(ld())}
                        </Show>
                        <Show when={!hasRichBody && !loadedData()}>
                            <button class="rep-capsule-load-btn" onClick={handleLoad} disabled={loading()}>
                                {loading() ? "Loading..." : "Load"}
                            </button>
                        </Show>
                    </div>
                </Show>
            </div>
        );
    },
});
