import { For, Show, createSignal } from "solid-js";
import type { JSX } from "solid-js";

// ── Verbose logging (disable with window.VERBOSE = false) ────────────
function vlog(context: string, ...args: any[]) {
    if ((globalThis as any).VERBOSE !== false) console.log(`[RenderLib/${context}]`, ...args);
}

// ── Types ────────────────────────────────────────────────────────────────────

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

// ── Rep system (representations) ─────────────────────────────────────

export type Rep = {
    name: string;
    match: (data: JsonValue) => boolean;
    render: (data: JsonObject, ctx: RepContext) => JSX.Element;
};

export type RepContext = {
    parentRep?: string;
    filterField?: string;
    onClickValue?: (field: string, value: string) => void;
    reps: Rep[];
    getPreview?: (key: string) => JsonValue | undefined;
    spineInstanceUri?: string;
};

const repRegistry: Rep[] = [];

export function registerRep(rep: Rep) {
    repRegistry.push(rep);
}

export function findRep(data: JsonValue): Rep | null {
    // New convention: objects with a '#' key use it as the rep type name
    if (typeof data === "object" && data !== null && !Array.isArray(data) && "#" in data) {
        const hashType = (data as JsonObject)["#"];
        if (typeof hashType === "string") {
            for (const rep of repRegistry) {
                if (rep.match(data)) {
                    vlog("findRep", `# = "${hashType}" → rep "${rep.name}"`);
                    return rep;
                }
            }
            vlog("findRep", `# = "${hashType}" → no matching rep`);
        }
    }
    return null;
}

// ── Path utilities ──────────────────────────────────────────────────

function makeRelativePath(fullPath: string, baseDir: string): string {
    const fullParts = fullPath.split('/');
    const baseParts = baseDir.split('/');
    // Find common prefix length
    let common = 0;
    while (common < baseParts.length && common < fullParts.length && baseParts[common] === fullParts[common]) {
        common++;
    }
    if (common === 0) return fullPath; // no common prefix
    const ups = baseParts.length - common;
    const rest = fullParts.slice(common);
    const rel = '../'.repeat(ups) + rest.join('/');
    return rel;
}

// ── Built-in rep: Capsule ────────────────────────────────────────────

type SplitResult = { prefix: string; highlight: string; highlightType: "magenta" | "yellow" | "none"; file: string };

function splitFilePath(filepath: string): SplitResult {
    const idx = filepath.lastIndexOf("/");
    if (idx < 0) return { prefix: "", highlight: "", highlightType: "none", file: filepath };
    const dir = filepath.slice(0, idx + 1);
    const file = filepath.slice(idx + 1);

    // If path contains .~o, highlight from .~o dir to end of dir in magenta
    const dotOIdx = dir.indexOf(".~o/");
    if (dotOIdx >= 0) {
        return {
            prefix: dir.slice(0, dotOIdx),
            highlight: dir.slice(dotOIdx),
            highlightType: "magenta",
            file,
        };
    }

    // Otherwise highlight from after 'packages/' to end of dir in yellow
    const pkgIdx = dir.lastIndexOf("packages/");
    if (pkgIdx >= 0) {
        const afterPkg = pkgIdx + "packages/".length;
        return {
            prefix: dir.slice(0, afterPkg),
            highlight: dir.slice(afterPkg),
            highlightType: "yellow",
            file,
        };
    }

    return { prefix: dir, highlight: "", highlightType: "none", file };
}

// ── Built-in rep: Error ──────────────────────────────────────────────

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

// ── Built-in rep: Capsule/PropertyContracts ──────────────────────────

registerRep({
    name: "Capsule/PropertyContracts",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/PropertyContracts",
    render: (data) => {
        const entries = Object.entries(data).filter(([k]) => k !== "#");
        return (
            <div class="rep-property-contracts">
                <div class="rep-property-contracts-header">Capsule Property Contracts</div>
                <For each={entries}>
                    {([key, value]) => (
                        <div class="rep-property-contracts-item">
                            <span class="rep-property-contracts-key">{key}</span>
                            <Show when={typeof value === "object" && value !== null}>
                                <RenderItem data={value as JsonValue} parentRep="Capsule/PropertyContracts" />
                            </Show>
                        </div>
                    )}
                </For>
            </div>
        );
    },
});

// ── Built-in rep: Capsule/Source ──────────────────────────────────

registerRep({
    name: "Capsule/Source",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/Source",
    render: (data) => {
        const entries = Object.entries(data).filter(([k]) => k !== "#");
        return (
            <div class="rep-capsule-section">
                <div class="rep-capsule-section-header">Source</div>
                <div class="rep-capsule-section-body">
                    <For each={entries}>
                        {([key, value]) => (
                            <div class="rep-capsule-kv">
                                <span class="rep-capsule-kv-key">{key}</span>
                                <span class="rep-capsule-kv-val">{typeof value === "string" ? value : JSON.stringify(value)}</span>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        );
    },
});

// ── Built-in rep: Capsule/SpineContracts ─────────────────────────

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

// ── Built-in rep: Capsule/SpineContract ──────────────────────────

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

// ── Built-in rep: Capsule/PropertyContract ───────────────────────

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

// ── Built-in rep: Capsule/Property ───────────────────────────────

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

// ── Built-in rep: Capsule/Properties ─────────────────────────────

registerRep({
    name: "Capsule/Properties",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/Properties",
    render: (data, ctx) => {
        const entries = Object.entries(data).filter(([k]) => k !== "#");
        return (
            <div class="rep-capsule-section">
                <div class="rep-capsule-section-header">Properties</div>
                <div class="rep-capsule-section-items">
                    <For each={entries}>
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
                                            parentRep="Capsule/Properties"
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

// ── Built-in rep: Capsule/Extends ────────────────────────────────

registerRep({
    name: "Capsule/Extends",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/Extends",
    render: (data, ctx) => {
        const capsule = data["capsule"] as JsonValue | undefined;
        return (
            <div class="rep-capsule-section">
                <div class="rep-capsule-section-header">Extends</div>
                <Show when={capsule}>
                    <div class="rep-capsule-section-items">
                        <RenderItem
                            data={capsule as JsonValue}
                            parentRep="Capsule/Extends"
                            filterField={ctx.filterField}
                            onClickValue={ctx.onClickValue}
                            getPreview={ctx.getPreview}
                            spineInstanceUri={ctx.spineInstanceUri}
                        />
                    </div>
                </Show>
            </div>
        );
    },
});

// ── Built-in rep: Capsule/Mappings ───────────────────────────────

registerRep({
    name: "Capsule/Mappings",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/Mappings",
    render: (data, ctx) => {
        const entries = Object.entries(data).filter(([k]) => k !== "#");
        return (
            <div class="rep-capsule-section">
                <div class="rep-capsule-section-header">Mappings</div>
                <div class="rep-capsule-section-items">
                    <For each={entries}>
                        {([key, value]) => (
                            <div class="rep-capsule-section-item">
                                <span class="rep-capsule-section-item-key">{key}</span>
                                <RenderItem
                                    data={value as JsonValue}
                                    parentRep="Capsule/Mappings"
                                    filterField={ctx.filterField}
                                    onClickValue={ctx.onClickValue}
                                    getPreview={ctx.getPreview}
                                    spineInstanceUri={ctx.spineInstanceUri}
                                />
                            </div>
                        )}
                    </For>
                </div>
            </div>
        );
    },
});

// ── Built-in rep: Capsule/PropertyMapping ────────────────────────

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

// ── Built-in rep: Capsule/PropertyContractMapping ────────────────

registerRep({
    name: "Capsule/PropertyContractMapping",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "Capsule/PropertyContractMapping",
    render: (data, ctx) => {
        const capsule = data["capsule"] as JsonValue | undefined;
        const isDelegate = data["isPropertyContractDelegate"] as boolean | undefined;
        return (
            <div class="rep-capsule-mapping">
                <span class="rep-capsule-mapping-tag rep-capsule-mapping-tag-delegate">ContractDelegate</span>
                <Show when={capsule}>
                    <RenderItem
                        data={capsule as JsonValue}
                        parentRep="Capsule/PropertyContractMapping"
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
                const resp = await fetch(`http://localhost:4000/api/QueryCapsuleSpineModel/getCapsule?capsuleName=${encodeURIComponent(id)}`);
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

// ── Built-in rep: Capsules (list) ───────────────────────────────────

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

// ── Built-in rep: SpineInstance (individual item) ───────────────────

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

// ── Built-in rep: SpineInstances (list) ─────────────────────────────

registerRep({
    name: "SpineInstances",
    match: (data) =>
        typeof data === "object" && data !== null && !Array.isArray(data) &&
        (data as JsonObject)["#"] === "SpineInstances" &&
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

// ── Pretty-print primitives ──────────────────────────────────────────

function classForType(v: JsonValue): string {
    if (v === null) return "json-null";
    if (typeof v === "string") return "json-string";
    if (typeof v === "number") return "json-number";
    if (typeof v === "boolean") return "json-bool";
    return "";
}

function formatPrimitive(v: JsonValue): string {
    if (v === null) return "null";
    if (typeof v === "string") return `"${v}"`;
    return String(v);
}

// ── Collapsible expression toggle ────────────────────────────────────

function ExpressionToggle(props: { value: string }): JSX.Element {
    const [expanded, setExpanded] = createSignal(false);
    return (
        <>
            <button
                class="code-toggle-btn"
                onClick={() => setExpanded(prev => !prev)}
            >{expanded() ? "Hide Code" : "Show Code"}</button>
            <Show when={expanded()}>
                <span class="json-string">{"\n"}{props.value}</span>
            </Show>
        </>
    );
}

// ── Pretty JSON renderer (used for both Rendered and Raw views) ──────

export function PrettyJson(props: {
    data: JsonValue;
    filterField?: string;
    onClickValue?: (field: string, value: string) => void;
    indent?: number;
}): JSX.Element {
    const indent = props.indent ?? 0;
    const pad = "  ".repeat(indent);
    const data = props.data;

    if (data === null || typeof data !== "object") {
        return <span class={classForType(data)}>{formatPrimitive(data)}</span>;
    }

    if (Array.isArray(data)) {
        if (data.length === 0) return <span class="json-bracket">{"[]"}</span>;
        return (
            <>
                <span class="json-bracket">{"["}</span>{"\n"}
                <For each={data}>
                    {(item, i) => (
                        <>
                            {pad + "  "}
                            <PrettyJson
                                data={item}
                                filterField={props.filterField}
                                onClickValue={props.onClickValue}
                                indent={indent + 1}
                            />
                            {i() < data.length - 1 ? "," : ""}{"\n"}
                        </>
                    )}
                </For>
                {pad}<span class="json-bracket">{"]"}</span>
            </>
        );
    }

    // Object
    const entries = Object.entries(data);
    if (entries.length === 0) return <span class="json-bracket">{"{}"}</span>;

    return (
        <>
            <span class="json-bracket">{"{"}</span>{"\n"}
            <For each={entries}>
                {([key, val], i) => {
                    const isFilterField = props.filterField === key;
                    const isClickable = isFilterField && props.onClickValue && typeof val === "string";
                    const isExpression = key.endsWith("Expression") && typeof val === "string";
                    return (
                        <>
                            {pad + "  "}
                            <span class="json-key">"{key}"</span>
                            <span class="json-colon">{": "}</span>
                            <Show when={isExpression} fallback={
                                <Show when={isClickable} fallback={
                                    <PrettyJson
                                        data={val as JsonValue}
                                        filterField={props.filterField}
                                        onClickValue={props.onClickValue}
                                        indent={indent + 1}
                                    />
                                }>
                                    <span
                                        class="json-filter-value"
                                        onClick={() => props.onClickValue!(key, val as string)}
                                    >
                                        "{val as string}"
                                    </span>
                                </Show>
                            }>
                                <ExpressionToggle value={val as string} />
                            </Show>
                            {i() < entries.length - 1 ? "," : ""}{"\n"}
                        </>
                    );
                }}
            </For>
            {pad}<span class="json-bracket">{"}"}</span>
        </>
    );
}

// ── Render item: tries reps first, falls back to entity card ─────────

function extractFilterValue(data: JsonValue, filterField?: string): string | null {
    if (!filterField || typeof data !== "object" || data === null || Array.isArray(data)) return null;
    const val = (data as JsonObject)[filterField];
    return typeof val === "string" ? val : null;
}

function RenderItem(props: {
    data: JsonValue;
    parentRep?: string;
    filterField?: string;
    onClickValue?: (field: string, value: string) => void;
    getPreview?: (key: string) => JsonValue | undefined;
    spineInstanceUri?: string;
}): JSX.Element {
    const rep = () => findRep(props.data);
    vlog("RenderItem", "parentRep:", props.parentRep ?? "(none)", "data #:", typeof props.data === "object" && props.data !== null && !Array.isArray(props.data) ? (props.data as any)["#"] ?? "(no #)" : typeof props.data);

    return (
        <Show when={rep()} fallback={
            <div class="entity-card">
                <pre class="entity-json">
                    <PrettyJson data={props.data} />
                </pre>
            </div>
        }>
            {(r) => r().render(props.data as JsonObject, {
                parentRep: props.parentRep,
                filterField: props.filterField,
                onClickValue: props.onClickValue,
                reps: repRegistry,
                getPreview: props.getPreview,
                spineInstanceUri: props.spineInstanceUri,
            })}
        </Show>
    );
}

// ── Result renderer: passes data to RenderItem, reps handle everything ─

export function ResultView(props: {
    data: JsonValue;
    filterField?: string;
    onClickValue?: (field: string, value: string) => void;
    getPreview?: (key: string) => JsonValue | undefined;
    spineInstanceUri?: string;
}): JSX.Element {
    return (
        <div class="result-view">
            <RenderItem
                data={props.data}
                filterField={props.filterField}
                onClickValue={props.onClickValue}
                getPreview={props.getPreview}
                spineInstanceUri={props.spineInstanceUri}
            />
        </div>
    );
}

// ── Raw JSON view (pretty-printed with syntax highlighting) ──────────

export function RawJsonView(props: { data: JsonValue }): JSX.Element {
    return (
        <div class="raw-json-view">
            <pre class="entity-json">
                <PrettyJson data={props.data} />
            </pre>
        </div>
    );
}
