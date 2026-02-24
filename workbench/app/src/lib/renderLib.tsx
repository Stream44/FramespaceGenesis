import { For, Show, createSignal } from "solid-js";
import type { JSX } from "solid-js";

// ── Verbose logging (disable with window.VERBOSE = false) ────────────
export function vlog(context: string, ...args: any[]) {
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

export function makeRelativePath(fullPath: string, baseDir: string): string {
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

export type SplitResult = { prefix: string; highlight: string; highlightType: "magenta" | "yellow" | "none"; file: string };

export function splitFilePath(filepath: string): SplitResult {
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

export function RenderItem(props: {
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
