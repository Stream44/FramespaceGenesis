> **⚠️ AI Agent Instructions — Keep This Document Up To Date**
>
> This is a **living reference document** maintained by AI agents during development sessions.
> When you learn something new about the topics covered here — a gotcha, a pattern, a fix —
> **add it to the relevant section** (or create a new one). Keep entries concise and code-first.
> If you refactor or extend the workbench, update the examples here so they stay accurate.
> Do **not** delete existing content unless it is provably wrong or obsolete.

---

# Dockview API Reference (Vanilla TypeScript / `dockview-core`)

> **Purpose**: AI-consumable quick-reference for assisted development with dockview.
> **Package**: `dockview-core` (framework-agnostic, zero dependencies).
> **Source docs**: `visualizations/___/dockview/packages/docs`

---

## 1. Installation & Setup

```sh
npm install dockview-core
```

```ts
import 'dockview-core/dist/styles/dockview.css';
import { createDockview, themeAbyss } from 'dockview-core';
```

### Minimal Bootstrap

```ts
import 'dockview-core/dist/styles/dockview.css';
import {
    createDockview,
    GroupPanelPartInitParameters,
    IContentRenderer,
    DockviewApi,
    themeAbyss,
} from 'dockview-core';

class MyPanel implements IContentRenderer {
    private readonly _element: HTMLElement;
    get element(): HTMLElement { return this._element; }

    constructor() {
        this._element = document.createElement('div');
    }

    init(params: GroupPanelPartInitParameters): void {
        const panelApi  = params.api;           // DockviewPanelApi
        const dockApi   = params.containerApi;  // DockviewApi
        const title     = params.title;
        const myParams  = params.params;        // custom params
        this._element.textContent = title;
    }
}

const api: DockviewApi = createDockview(document.getElementById('app')!, {
    theme: themeAbyss,
    createComponent(options) {
        switch (options.name) {
            case 'myPanel': return new MyPanel();
            default: throw new Error(`Unknown component: ${options.name}`);
        }
    },
});
```

---

## 2. `DockviewComponentOptions` (constructor options)

Passed as second arg to `createDockview(element, options)`.

### Layout & Behaviour

| Option | Type | Description |
|---|---|---|
| `theme` | `DockviewTheme` | Theme object (sets CSS class + gap + DnD overlay mode) |
| `className` | `string` | Additional CSS class on root element |
| `locked` | `boolean` | Prevent resizing via drag handles between panels |
| `hideBorders` | `boolean` | Hide separator borders |
| `disableAutoResizing` | `boolean` | Disable `ResizeObserver`; call `api.layout(w,h)` manually |
| `defaultRenderer` | `'onlyWhenVisible' \| 'always'` | Default DOM retention mode for hidden panels |
| `defaultHeaderPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | Default tab header position |
| `singleTabMode` | `'fullwidth' \| 'default'` | When group has 1 tab, stretch it full width |
| `noPanelsOverlay` | `'emptyGroup' \| 'watermark'` | What to show when dock is empty |
| `scrollbars` | `'native' \| 'custom'` | Tab header scrollbar implementation |
| `disableTabsOverflowList` | `boolean` | Disable overflow dropdown for tabs |

### Drag & Drop

| Option | Type | Description |
|---|---|---|
| `disableDnd` | `boolean` | Completely disable all drag and drop |
| `dndEdges` | `false \| DroptargetOverlayModel` | Configure or disable far-edge drop overlays. Model: `{ size: {value, type:'pixels'\|'percentage'}, activationSize: {value, type} }` |
| `disableFloatingGroups` | `boolean` | Disable floating group support |
| `floatingGroupBounds` | `'boundedWithinViewport' \| { minimumHeightWithinViewport?: number, minimumWidthWithinViewport?: number }` | Bounding box for floating groups. Default: 100px min in viewport |
| `popoutUrl` | `string` | URL for popout window HTML page. Default: `'/popout.html'` |

### Component Factories (required)

| Option | Signature | Description |
|---|---|---|
| `createComponent` | `(options: {id, name}) => IContentRenderer` | **Required.** Factory for panel content renderers |
| `createTabComponent` | `(options: {id, name}) => ITabRenderer \| undefined` | Factory for custom tab renderers |
| `createWatermarkComponent` | `() => IWatermarkRenderer` | Factory for watermark (empty dock) renderer |
| `createLeftHeaderActionComponent` | `(group: DockviewGroupPanel) => IHeaderActionsRenderer` | Left header actions factory |
| `createRightHeaderActionComponent` | `(group: DockviewGroupPanel) => IHeaderActionsRenderer` | Right header actions factory |
| `createPrefixHeaderActionComponent` | `(group: DockviewGroupPanel) => IHeaderActionsRenderer` | Prefix (before tabs) header actions factory |
| `defaultTabComponent` | `string` | Name of default tab component |

---

## 3. Renderer Interfaces

### `IContentRenderer` — Panel Body

```ts
interface IContentRenderer {
    readonly element: HTMLElement;
    init(params: GroupPanelPartInitParameters): void;
    update?(event: PanelUpdateEvent<Parameters>): void;  // called on param changes
    layout?(width: number, height: number): void;
    focus?(): void;
    toJSON?(): object;
    dispose?(): void;
}
```

`GroupPanelPartInitParameters` provides:
- `api: DockviewPanelApi` — panel-level API
- `containerApi: DockviewApi` — dock-level API
- `title: string`
- `params: Record<string, any>` — custom parameters

### `ITabRenderer` — Custom Tab

```ts
interface ITabRenderer {
    readonly element: HTMLElement;
    init(params: TabPartInitParameters): void;  // extends GroupPanelPartInitParameters + { tabLocation }
    update?(event: PanelUpdateEvent<Parameters>): void;
    dispose?(): void;
}
```

### `IHeaderActionsRenderer` — Group Header Actions

```ts
interface IHeaderActionsRenderer extends IDisposable {
    readonly element: HTMLElement;
    init(params: IGroupHeaderProps): void;
}

// IGroupHeaderProps:
interface IGroupHeaderProps {
    api: DockviewGroupPanelApi;
    containerApi: DockviewApi;
    group: IDockviewGroupPanel;
}
```

### `IWatermarkRenderer` — Empty State

```ts
interface IWatermarkRenderer {
    readonly element: HTMLElement;
    init(params: { containerApi: DockviewApi; group?: IDockviewGroupPanel }): void;
    dispose?(): void;
}
```

---

## 4. `DockviewApi` — Dock-Level API

Returned by `createDockview()`. Store and reuse this reference.

### Properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique instance identifier |
| `width` | `number` | Component width (px) |
| `height` | `number` | Component height (px) |
| `size` | `number` | Total number of groups |
| `totalPanels` | `number` | Total number of panels |
| `panels` | `IDockviewPanel[]` | All panel objects |
| `groups` | `DockviewGroupPanel[]` | All group objects |
| `activePanel` | `IDockviewPanel \| undefined` | Currently active panel |
| `activeGroup` | `DockviewGroupPanel \| undefined` | Currently active group |

### Methods

| Method | Signature | Description |
|---|---|---|
| `addPanel` | `(options: AddPanelOptions) => IDockviewPanel` | Add a panel |
| `removePanel` | `(panel: IDockviewPanel) => void` | Remove a panel |
| `getPanel` | `(id: string) => IDockviewPanel \| undefined` | Get panel by id |
| `addGroup` | `(options?: AddGroupOptions) => DockviewGroupPanel` | Add an empty group |
| `removeGroup` | `(group: IDockviewGroupPanel) => void` | Remove group + its panels |
| `getGroup` | `(id: string) => IDockviewGroupPanel \| undefined` | Get group by id |
| `closeAllGroups` | `() => void` | Close all groups and panels |
| `addFloatingGroup` | `(item: IDockviewPanel \| DockviewGroupPanel, options?: FloatingGroupOptions) => void` | Float an existing panel/group |
| `addPopoutGroup` | `(item, options?) => Promise<boolean>` | Open panel/group in new window |
| `maximizeGroup` | `(panel: IDockviewPanel) => void` | Maximize a group |
| `hasMaximizedGroup` | `() => boolean` | Check if any group is maximized |
| `exitMaximizedGroup` | `() => void` | Exit maximized state |
| `moveToNext` | `(options?: MovementOptions) => void` | Focus next panel/group |
| `moveToPrevious` | `(options?: MovementOptions) => void` | Focus previous panel/group |
| `toJSON` | `() => SerializedDockview` | Serialize current layout |
| `fromJSON` | `(data: SerializedDockview, options?) => void` | Deserialize/load layout |
| `clear` | `() => void` | Reset to empty state |
| `layout` | `(width, height, force?) => void` | Force resize |
| `focus` | `() => void` | Focus the dock |
| `updateOptions` | `(options: Partial<DockviewComponentOptions>) => void` | Update options at runtime |
| `dispose` | `() => void` | Teardown (vanilla TS only) |

### Events

| Event | Payload | Description |
|---|---|---|
| `onDidLayoutChange` | `void` | Any layout change (debounce recommended) |
| `onDidLayoutFromJSON` | `void` | After `fromJSON` completes |
| `onDidAddPanel` | `IDockviewPanel` | Panel added |
| `onDidRemovePanel` | `IDockviewPanel` | Panel removed |
| `onDidActivePanelChange` | `IDockviewPanel \| undefined` | Active panel changed |
| `onDidMovePanel` | `MovePanelEvent` | Panel moved |
| `onDidAddGroup` | `DockviewGroupPanel` | Group added |
| `onDidRemoveGroup` | `DockviewGroupPanel` | Group removed |
| `onDidActiveGroupChange` | `DockviewGroupPanel \| undefined` | Active group changed |
| `onDidMaximizedGroupChange` | `DockviewMaximizedGroupChanged` | Maximize state changed |
| `onDidDrop` | `DockviewDidDropEvent` | Drop event completed |
| `onWillDrop` | `DockviewWillDropEvent` | Before drop (preventable) |
| `onWillShowOverlay` | `DockviewWillShowOverlayLocationEvent` | Before overlay shown (preventable) |
| `onWillDragPanel` | `TabDragEvent` | Before panel drag (preventable via `nativeEvent.preventDefault()`) |
| `onWillDragGroup` | `GroupDragEvent` | Before group drag (preventable) |
| `onUnhandledDragOverEvent` | `DockviewDndOverlayEvent` | External drag over (call `event.accept()` to allow) |
| `onDidPopoutGroupSizeChange` | `PopoutGroupChangeSizeEvent` | Popout window resized |
| `onDidPopoutGroupPositionChange` | `PopoutGroupChangePositionEvent` | Popout window moved |
| `onDidOpenPopoutWindowFail` | `void` | Popout window failed to open |

**Event pattern**: All events return `IDisposable`. Always call `.dispose()` to unsubscribe.

```ts
const disposable = api.onDidLayoutChange(() => {
    const layout = api.toJSON();
    localStorage.setItem('layout', JSON.stringify(layout));
});
// later: disposable.dispose();
```

---

## 5. `DockviewPanelApi` — Panel-Level API

Accessed via `params.api` inside renderers, or `panel.api` on panel references.

### Properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Panel id |
| `component` | `string` | Component renderer name |
| `tabComponent` | `string \| undefined` | Tab renderer name |
| `title` | `string \| undefined` | Current title |
| `group` | `DockviewGroupPanel` | Parent group |
| `width` | `number` | Panel width (px) |
| `height` | `number` | Panel height (px) |
| `isActive` | `boolean` | Is the active tab in its group |
| `isVisible` | `boolean` | Is currently visible |
| `isFocused` | `boolean` | Has focus |
| `isGroupActive` | `boolean` | Is the parent group active |
| `renderer` | `DockviewPanelRenderer` | Current render mode |
| `location` | `DockviewGroupLocation` | `{type: 'grid'\|'floating'\|'popout'}` |

### Methods

| Method | Signature | Description |
|---|---|---|
| `close` | `() => void` | Close/remove this panel |
| `setTitle` | `(title: string) => void` | Update title |
| `setActive` | `() => void` | Make this panel active |
| `setRenderer` | `(renderer: DockviewPanelRenderer) => void` | Change render mode |
| `setSize` | `({width?, height?}) => void` | Resize the panel's group |
| `moveTo` | `({group?, position?, index?, skipSetActive?}) => void` | Move panel to another group/position |
| `maximize` | `() => void` | Maximize this panel's group |
| `isMaximized` | `() => boolean` | Check if group is maximized |
| `exitMaximized` | `() => void` | Exit maximized (only if this group) |
| `updateParameters` | `(params: Record<string, any>) => void` | Update custom params (triggers `update()` on renderer) |
| `getParameters` | `<T>() => T` | Get current params |
| `getWindow` | `() => Window` | Get the Window object (useful for popouts) |

### Events

| Event | Payload | Description |
|---|---|---|
| `onDidTitleChange` | `{title: string}` | Title changed |
| `onDidDimensionsChange` | `{width, height}` | Size changed |
| `onDidVisibilityChange` | `{isVisible: boolean}` | Visibility changed |
| `onDidActiveChange` | `{isActive: boolean}` | Active state changed |
| `onDidActiveGroupChange` | `{isActive: boolean}` | Parent group active state changed |
| `onDidGroupChange` | `{}` | Panel moved to different group |
| `onDidLocationChange` | `{location: DockviewGroupLocation}` | Location type changed (grid/floating/popout) |
| `onDidRendererChange` | `{renderer: DockviewPanelRenderer}` | Render mode changed |
| `onDidParametersChange` | `Parameters` | Custom params changed |
| `onDidFocusChange` | `{isFocused: boolean}` | Focus changed |
| `onWillFocus` | `WillFocusEvent` | Before focus (preventable) |

---

## 6. `DockviewGroupPanelApi` — Group-Level API

Accessed via `panel.group.api` or `panel.api.group.api`.

> **Tip**: Use sparingly. Groups change as panels move. Prefer panel API.

### Properties

| Property | Type |
|---|---|
| `location` | `DockviewGroupLocation` |
| `isActive` | `boolean` |
| `isVisible` | `boolean` |
| `width` / `height` | `number` |

### Methods

| Method | Signature | Description |
|---|---|---|
| `setSize` | `({width?, height?}) => void` | Resize group |
| `moveTo` | `({group?, position?, index?, skipSetActive?}) => void` | Move entire group |
| `setConstraints` | `({minimumWidth?, maximumWidth?, minimumHeight?, maximumHeight?}) => void` | Set size constraints (not serialized) |
| `setHeaderPosition` | `(position: 'top'\|'bottom'\|'left'\|'right') => void` | Change header position |
| `getHeaderPosition` | `() => DockviewHeaderPosition` | Get header position |
| `maximize` | `() => void` | Maximize (grid groups only) |
| `isMaximized` | `() => boolean` | Check maximized |
| `exitMaximized` | `() => void` | Exit maximized |
| `close` | `() => void` | Remove group |
| `getWindow` | `() => Window` | Get Window (for popouts) |

### Events

| Event | Payload |
|---|---|
| `onDidLocationChange` | `{location: DockviewGroupLocation}` |
| `onDidActivePanelChange` | `{panel: IDockviewPanel \| undefined}` |
| `onDidActiveChange` | `{isActive: boolean}` |
| `onDidVisibilityChange` | `{isVisible: boolean}` |
| `onDidDimensionsChange` | `{width, height}` |
| `onDidConstraintsChange` | `{minimumWidth?, minimumHeight?, maximumWidth?, maximumHeight?}` |

### Group Object Properties

| Property | Description |
|---|---|
| `group.locked` | `boolean \| 'no-drop-target'` — Set `true` to block drops into group (keeps edge zones). Set `'no-drop-target'` to disable all drop zones. |
| `group.header.hidden` | `boolean` — Hide the tab header bar |
| `group.activePanel` | `IDockviewPanel \| undefined` — Currently active panel in group |

---

## 7. Adding Panels — `AddPanelOptions`

```ts
api.addPanel({
    id: 'unique_id',              // required, unique
    component: 'myPanel',         // required, matches createComponent switch
    title: 'My Panel',            // optional, shown in default tab
    tabComponent: 'myTab',        // optional, matches createTabComponent switch
    params: { key: 'value' },     // optional, custom data
    renderer: 'always',           // 'always' | 'onlyWhenVisible' (default)
    inactive: true,               // don't auto-activate

    // Positioning (pick one strategy):
    // A) Relative to panel
    position: { referencePanel: 'panel_1', direction: 'right' },
    // B) Relative to group
    position: { referenceGroup: 'group_id', direction: 'below' },
    // C) Absolute (edge of dock)
    position: { direction: 'left' },
    // D) Within same group (add as tab), with optional index
    position: { referencePanel: 'panel_1', index: 2 },

    // Floating
    floating: true,
    // or with position:
    floating: { position: { left: 10, top: 10 }, width: 300, height: 300 },

    // Size constraints
    initialWidth: 400,
    initialHeight: 300,
    minimumWidth: 100,
    maximumWidth: 800,
    minimumHeight: 100,
    maximumHeight: 600,
});
```

### Direction Values

`'above' | 'below' | 'left' | 'right' | 'within'`

- `within` = add as tab in same group
- Others = create new group in that direction

---

## 8. Panel Rendering Modes

| Mode | Behaviour |
|---|---|
| `'onlyWhenVisible'` (default) | DOM element removed when panel hidden. Most memory efficient. Loses scroll position. |
| `'always'` | DOM element kept alive but hidden. Preserves scroll position and DOM state. |

Set per-panel: `renderer: 'always'` in `addPanel()`.
Set default: `defaultRenderer: 'always'` in constructor options.

---

## 9. Custom Tab Renderer (Vanilla TS)

```ts
import { ITabRenderer, PanelUpdateEvent, Parameters, GroupPanelPartInitParameters } from 'dockview-core';

class MyTab implements ITabRenderer {
    private readonly _element: HTMLElement;
    get element(): HTMLElement { return this._element; }

    constructor() {
        this._element = document.createElement('div');
    }

    init(params: GroupPanelPartInitParameters): void {
        this._element.textContent = params.api.title ?? 'Tab';

        params.api.onDidTitleChange((e) => {
            this._element.textContent = e.title;
        });
    }

    update(event: PanelUpdateEvent<Parameters>): void {
        // React to param changes
    }

    dispose(): void {
        // Cleanup
    }
}

// Register:
const api = createDockview(el, {
    theme: themeAbyss,
    createComponent: (opts) => new MyPanel(),
    createTabComponent: (opts) => {
        switch (opts.name) {
            case 'myTab': return new MyTab();
            default: return undefined; // falls back to default tab
        }
    },
});

// Use:
api.addPanel({ id: 'p1', component: 'myPanel', tabComponent: 'myTab', title: 'Hello' });
```

---

## 10. Group Header Actions (Vanilla TS)

Three slots in the group header: **prefix** (before tabs), **left** (after tabs, left side), **right** (after tabs, right side).

```ts
import { IHeaderActionsRenderer, IGroupHeaderProps, DockviewGroupPanel } from 'dockview-core';

class MyRightActions implements IHeaderActionsRenderer {
    private readonly _element: HTMLElement;
    private readonly _disposables: (() => void)[] = [];
    get element(): HTMLElement { return this._element; }

    constructor(group: DockviewGroupPanel) {
        this._element = document.createElement('div');
    }

    init(params: IGroupHeaderProps): void {
        const group = params.group;
        const btn = document.createElement('button');
        btn.textContent = 'gear';
        this._element.appendChild(btn);

        const d = group.api.onDidActivePanelChange((e) => {
            // react to active panel changes
        });
        this._disposables.push(() => d.dispose());
    }

    dispose(): void {
        this._disposables.forEach(d => d());
    }
}

// Register in options:
createDockview(el, {
    // ...
    createPrefixHeaderActionComponent:  (group) => new MyPrefixActions(group),
    createLeftHeaderActionComponent:    (group) => new MyLeftActions(group),
    createRightHeaderActionComponent:   (group) => new MyRightActions(group),
});
```

### Gotcha: `group.activePanel` is `undefined` at `init()` time

Header action components are created **before** panels are added to the group.
This means `group.activePanel` will be `undefined` when `init(params)` fires.

**Pattern**: Render conditionally at init, then always re-render on panel change:

```ts
class ToggleActions implements IHeaderActionsRenderer {
    private readonly _element = document.createElement('div');
    private _disposeRender?: () => void;
    get element() { return this._element; }

    constructor(private group: DockviewGroupPanel) {}

    init(params: IGroupHeaderProps): void {
        // May be undefined — render only if available
        if (this.group.activePanel) {
            this._render(this.group.activePanel.id);
        }

        // Always subscribe — this fires reliably when panels activate
        const d = this.group.api.onDidActivePanelChange((e) => {
            if (e.panel) this._render(e.panel.id);
        });
        // Store disposable for cleanup
    }

    private _render(panelId: string) {
        if (this._disposeRender) this._disposeRender();
        this._element.innerHTML = '';
        // ... render your toggle/buttons for panelId ...
    }

    dispose() { this._disposeRender?.(); }
}
```

### Using SolidJS `render()` inside Dockview header actions

When the workbench uses SolidJS for reactive UI inside vanilla Dockview header actions,
use `render(() => <Component />, element)` from `solid-js/web`. The returned function
is the dispose callback. Re-call it before each re-render to clean up the previous tree.

```ts
import { render } from 'solid-js/web';

// Inside the _render method:
private _render(panelId: string) {
    if (this._disposeRender) this._disposeRender();
    this._element.innerHTML = '';
    this._disposeRender = render(() => {
        // SolidJS reactive component here
        return <div>...</div>;
    }, this._element);
}
```

---

## 11. Watermark (Empty State)

```ts
import { IWatermarkRenderer, WatermarkRendererInitParameters } from 'dockview-core';

class MyWatermark implements IWatermarkRenderer {
    private readonly _element: HTMLElement;
    get element(): HTMLElement { return this._element; }

    constructor() {
        this._element = document.createElement('div');
        this._element.textContent = 'Drop panels here';
    }

    init(params: WatermarkRendererInitParameters): void {
        // params.containerApi, params.group
    }

    dispose(): void {}
}

// Register:
createDockview(el, {
    createComponent: ...,
    createWatermarkComponent: () => new MyWatermark(),
});
```

---

## 12. Floating Groups

Each floating container holds **one group** with multiple tabs.

```ts
// Create panel directly as floating
api.addPanel({
    id: 'float1',
    component: 'myPanel',
    floating: true,
});

// With explicit position/size
api.addPanel({
    id: 'float2',
    component: 'myPanel',
    floating: { position: { left: 50, top: 50 }, width: 400, height: 300 },
});

// Float an existing panel/group
api.addFloatingGroup(existingPanel, {
    position: { left: 100, top: 100 },
    width: 300,
    height: 200,
});
```

**User interactions**:
- Hold `Shift` + drag tab = float it
- Hold `Shift` + drag floating tab = move floating group
- Drag empty header space = move floating group

**Check location**: `panel.api.location` returns `{type: 'grid' | 'floating' | 'popout'}`

**Cannot** be maximized.

---

## 13. Popout Windows

Opens a group in a new browser window. Requires a blank HTML page.

```ts
// Popout a group
await api.addPopoutGroup(panel.group, {
    popoutUrl: '/popout.html',
    box: { left: 0, top: 0, height: 400, width: 600 },
    onDidOpen: ({ id, window }) => { /* ... */ },
    onWillClose: ({ id, window }) => { /* ... */ },
});

// Move popout back to grid
panel.group.api.moveTo({ position: 'right' });
// or
const group = api.addGroup();
panel.group.api.moveTo({ group });
```

**Cannot** be maximized.

---

## 14. Maximized Groups

```ts
// Via dock API
api.maximizeGroup(panel);
api.hasMaximizedGroup();    // boolean
api.exitMaximizedGroup();

// Via panel API (convenience)
panel.api.maximize();
panel.api.isMaximized();    // boolean
panel.api.exitMaximized();

// Via group API
panel.group.api.maximize();
panel.group.api.isMaximized();
panel.group.api.exitMaximized();

// Listen
api.onDidMaximizedGroupChange((event) => { /* ... */ });
```

Only **grid** groups can be maximized (not floating, not popout).

---

## 15. Locked Groups & Dock

### Locked Dock (global)

Prevents resizing via drag handles between all panels.

```ts
createDockview(el, { locked: true });
// or at runtime:
api.updateOptions({ locked: true });
```

Combine with `disableDnd: true` for a fully static grid.

### Locked Group (per-group)

Prevents drop events into a specific group.

```ts
panel.group.locked = true;            // blocks tab drops, keeps edge drop zones
panel.group.locked = 'no-drop-target'; // disables ALL drop zones for this group
```

Panels can still be added programmatically via API.

---

## 16. Hidden Header

```ts
panel.group.header.hidden = true;  // hide tab bar for this group
panel.group.header.hidden = false; // show it again
```

---

## 17. Drag & Drop

### Disable Globally

```ts
createDockview(el, { disableDnd: true });
```

### DnD Edge Configuration

```ts
createDockview(el, {
    dndEdges: {
        size: { value: 100, type: 'pixels' },
        activationSize: { value: 5, type: 'percentage' },
    },
});
// or disable edge drops:
createDockview(el, { dndEdges: false });
```

### External DnD — Accept External Drops

```ts
// Allow external drag events to show overlay
api.onUnhandledDragOverEvent((event) => {
    event.accept(); // call to show drop overlay for this external drag
});

// Handle the actual drop
api.onDidDrop((event) => {
    api.addPanel({
        id: 'new_panel',
        component: 'myPanel',
        position: { referencePanel: event.group.activePanel.id, direction: 'within' },
    });
});
```

### Intercept Internal Drags

```ts
api.onWillDragPanel((event: TabDragEvent) => {
    // event.nativeEvent.preventDefault() to cancel
});

api.onWillDragGroup((event: GroupDragEvent) => {
    // event.nativeEvent.preventDefault() to cancel
});

api.onWillShowOverlay((event) => {
    // event.preventDefault() to prevent overlay + drop
});

api.onWillDrop((event) => {
    // event.preventDefault() to cancel the drop
});
```

---

## 18. State Serialization

### Save

```ts
const layout: SerializedDockview = api.toJSON();
localStorage.setItem('layout', JSON.stringify(layout));

// Listen for changes
const d = api.onDidLayoutChange(() => {
    localStorage.setItem('layout', JSON.stringify(api.toJSON()));
});
```

### Load

```ts
const saved = localStorage.getItem('layout');
if (saved) {
    try {
        api.fromJSON(JSON.parse(saved));
    } catch (err) {
        console.error('Failed to load layout', err);
        // load default layout instead
    }
}
```

`fromJSON` throws on invalid/corrupted data but resets gracefully.

**Note**: `params` set via `addPanel` or `updateParameters` ARE serialized with `toJSON()`. Keep params small and static. Do NOT store application state in params.

---

## 19. Panel Resizing

```ts
// Via panel API (preferred)
panel.api.setSize({ width: 400, height: 300 }); // at least one dimension required

// Via group API (same effect)
panel.group.api.setSize({ width: 400, height: 300 });

// Listen
panel.api.onDidDimensionsChange(({ width, height }) => { /* ... */ });
```

### Group Constraints (not serialized)

```ts
panel.group.api.setConstraints({
    minimumWidth: 200,
    maximumWidth: 600,
    minimumHeight: 150,
    maximumHeight: 400,
});
panel.group.api.onDidConstraintsChange((constraints) => { /* ... */ });
```

---

## 20. Updating Panels

### Title

```ts
panel.api.setTitle('New Title');
// Listen:
panel.api.onDidTitleChange(({ title }) => { /* ... */ });
```

### Parameters

```ts
panel.api.updateParameters({ key: 'newValue', anotherKey: 42 });
// Delete a param:
panel.api.updateParameters({ key: undefined });
```

This triggers the `update(event)` method on both `IContentRenderer` and `ITabRenderer`:

```ts
update(event: PanelUpdateEvent<Parameters>): void {
    // event.params contains the updated params
}
```

---

## 21. Moving Panels & Groups

### Move Panel

```ts
panel.api.moveTo({
    group: targetGroup,       // target group (optional, defaults to current)
    position: 'center',       // Position enum value
    index: 2,                 // tab index within group
    skipSetActive: false,
});
```

### Move Group

```ts
panel.group.api.moveTo({
    group: targetGroup,
    position: 'right',
});
```

---

## 22. Scrollbars in Panels

- Panel with `height: 100%` = **no scrollbar**, content clipped
- Panel with `height: 2000px` (fixed) = **scrollbar appears**
- Panel with `height: 100%` + child with `overflow: auto` = **scrollbar on child**

Best practice: Use a wrapper div with `height: 100%; overflow: auto;` inside your panel element.

---

## 23. Theming

### Built-in Themes

| Import | CSS Class | Notes |
|---|---|---|
| `themeDark` | `dockview-theme-dark` | |
| `themeLight` | `dockview-theme-light` | |
| `themeAbyss` | `dockview-theme-abyss` | VS Code abyss |
| `themeDracula` | `dockview-theme-dracula` | VS Code dracula |
| `themeVisualStudio` | `dockview-theme-vs` | Visual Studio |
| `themeReplit` | `dockview-theme-replit` | Replit-style, `gap: 10` |
| `themeAbyssSpaced` | `dockview-theme-abyss-spaced` | Abyss + `gap: 10`, absolute DnD overlay |
| `themeLightSpaced` | `dockview-theme-light-spaced` | Light + `gap: 10`, absolute DnD overlay |

### `DockviewTheme` Interface

```ts
interface DockviewTheme {
    name: string;
    className: string;                              // CSS class applied to root
    gap?: number;                                   // px gap between groups (default 0)
    dndOverlayMounting?: 'absolute' | 'relative';   // overlay mount strategy
    dndPanelOverlay?: 'content' | 'group';           // overlay covers content or whole group
}
```

### Custom Theme

```ts
const myTheme: DockviewTheme = {
    name: 'myTheme',
    className: 'my-custom-theme',
    gap: 4,
};

createDockview(el, { theme: myTheme });
```

### CSS Custom Properties

Override these in your theme CSS class to customize appearance:

**Layout & Background**
- `--dv-background-color` — dock background
- `--dv-group-view-background-color` — group/panel area background
- `--dv-separator-border` — border between groups
- `--dv-active-sash-color` — color of resize handle on hover/drag

**Tabs Container**
- `--dv-tabs-and-actions-container-background-color` — tab bar background
- `--dv-tabs-and-actions-container-height` — tab bar height
- `--dv-tabs-and-actions-container-font-size` — tab font size
- `--dv-tabs-container-scrollbar-color` — tab scrollbar color

**Tab Colors (4-state matrix: active/inactive group x visible/hidden panel)**
- `--dv-activegroup-visiblepanel-tab-background-color` — active group, selected tab bg
- `--dv-activegroup-visiblepanel-tab-color` — active group, selected tab text
- `--dv-activegroup-hiddenpanel-tab-background-color` — active group, unselected tab bg
- `--dv-activegroup-hiddenpanel-tab-color` — active group, unselected tab text
- `--dv-inactivegroup-visiblepanel-tab-background-color` — inactive group, selected tab bg
- `--dv-inactivegroup-visiblepanel-tab-color` — inactive group, selected tab text
- `--dv-inactivegroup-hiddenpanel-tab-background-color` — inactive group, unselected tab bg
- `--dv-inactivegroup-hiddenpanel-tab-color` — inactive group, unselected tab text
- `--dv-tab-divider-color` — divider between tabs
- `--dv-tab-close-icon` — close button icon (CSS content/mask)

**Drag & Drop**
- `--dv-drag-over-background-color` — drop overlay background
- `--dv-drag-over-border-color` — drop overlay border

**Floating**
- `--dv-floating-box-shadow` — shadow on floating groups

**Paneview**
- `--dv-paneview-active-outline-color` — active pane outline
- `--dv-paneview-header-border-color` — pane header border

**Icons**
- `--dv-icon-hover-background-color` — icon button hover bg

### Extending a Theme

```css
.dockview-theme-abyss {
    .groupview {
        &.active-group {
            > .tabs-and-actions-container {
                border-bottom: 2px solid var(--dv-activegroup-visiblepanel-tab-background-color);
            }
        }
        &.inactive-group {
            > .tabs-and-actions-container {
                border-bottom: 2px solid var(--dv-inactivegroup-visiblepanel-tab-background-color);
            }
        }
    }
}
```

### Key CSS Selectors

| Selector | Target |
|---|---|
| `.dockview-theme-*` | Theme root |
| `.groupview` | Group container |
| `.groupview.active-group` | Active group |
| `.groupview.inactive-group` | Inactive group |
| `.tabs-and-actions-container` | Tab bar + actions |
| `.tab` | Individual tab |
| `.dv-drop-target-edge` | Edge drop target |

---

## 24. Advanced Features

### Nested Dockviews

You can nest a `createDockview()` inside a panel's `init()` by creating a child dockview in the panel's element. Each instance is independent.

### iframes in Panels

Use `renderer: 'always'` to prevent iframe reload when switching tabs. The iframe stays in the DOM.

### Keyboard Navigation

Use `api.moveToNext()` / `api.moveToPrevious()` for programmatic keyboard navigation.

### Tab Height

Controlled via CSS: `--dv-tabs-and-actions-container-height`.

### Single Tab Full Width

```ts
createDockview(el, { singleTabMode: 'fullwidth' });
```

### Header Position

```ts
// Per group
panel.group.api.setHeaderPosition('bottom'); // 'top' | 'bottom' | 'left' | 'right'

// Default for all groups
createDockview(el, { defaultHeaderPosition: 'bottom' });
```

---

## 25. Disposable Pattern

All event subscriptions and the dock itself return `IDisposable`. Always dispose to prevent memory leaks.

```ts
const disposables: IDisposable[] = [];

disposables.push(api.onDidLayoutChange(() => { /* ... */ }));
disposables.push(api.onDidActivePanelChange((p) => { /* ... */ }));

// Cleanup
disposables.forEach(d => d.dispose());

// Or dispose the entire dock (vanilla TS only, not for framework wrappers)
api.dispose();
```

---

## 26. Complete Vanilla TS Example

```ts
import 'dockview-core/dist/styles/dockview.css';
import {
    createDockview,
    DockviewApi,
    GroupPanelPartInitParameters,
    IContentRenderer,
    ITabRenderer,
    IHeaderActionsRenderer,
    IGroupHeaderProps,
    DockviewGroupPanel,
    PanelUpdateEvent,
    Parameters,
    themeAbyss,
} from 'dockview-core';

// --- Panel ---
class EditorPanel implements IContentRenderer {
    private readonly _element: HTMLElement;
    get element() { return this._element; }

    constructor() {
        this._element = document.createElement('div');
        this._element.style.cssText = 'height:100%;overflow:auto;padding:8px;color:white;';
    }

    init(params: GroupPanelPartInitParameters): void {
        this._element.textContent = `Editor: ${params.api.title}`;
        params.api.onDidTitleChange(e => {
            this._element.textContent = `Editor: ${e.title}`;
        });
    }

    update(event: PanelUpdateEvent<Parameters>): void {}
    dispose(): void {}
}

// --- Tab ---
class MyTab implements ITabRenderer {
    private readonly _element: HTMLElement;
    get element() { return this._element; }

    constructor() {
        this._element = document.createElement('div');
        this._element.style.cssText = 'padding:4px 8px;color:white;cursor:pointer;';
    }

    init(params: GroupPanelPartInitParameters): void {
        this._element.textContent = params.api.title ?? 'Tab';
        params.api.onDidTitleChange(e => { this._element.textContent = e.title; });
    }

    update(event: PanelUpdateEvent<Parameters>): void {}
    dispose(): void {}
}

// --- Header Actions ---
class CloseAllAction implements IHeaderActionsRenderer {
    private readonly _element: HTMLElement;
    get element() { return this._element; }

    constructor(group: DockviewGroupPanel) {
        this._element = document.createElement('button');
        this._element.textContent = 'X';
        this._element.onclick = () => group.api.close();
    }

    init(params: IGroupHeaderProps): void {}
    dispose(): void {}
}

// --- Create Dock ---
const api = createDockview(document.getElementById('app')!, {
    theme: themeAbyss,
    createComponent: (opts) => {
        switch (opts.name) {
            case 'editor': return new EditorPanel();
            default: throw new Error(`Unknown: ${opts.name}`);
        }
    },
    createTabComponent: (opts) => {
        switch (opts.name) {
            case 'myTab': return new MyTab();
            default: return undefined;
        }
    },
    createRightHeaderActionComponent: (group) => new CloseAllAction(group),
});

// --- Add Panels ---
api.addPanel({ id: 'file1', component: 'editor', tabComponent: 'myTab', title: 'main.ts' });
api.addPanel({ id: 'file2', component: 'editor', tabComponent: 'myTab', title: 'utils.ts',
    position: { referencePanel: 'file1' } }); // same group as tab
api.addPanel({ id: 'terminal', component: 'editor', title: 'Terminal',
    position: { referencePanel: 'file1', direction: 'below' } });
api.addPanel({ id: 'sidebar', component: 'editor', title: 'Explorer',
    position: { direction: 'left' }, initialWidth: 200 });

// --- Save/Load ---
api.onDidLayoutChange(() => {
    localStorage.setItem('dock_layout', JSON.stringify(api.toJSON()));
});
```

---

## 27. Key Imports Cheatsheet

```ts
// Core creation
import { createDockview } from 'dockview-core';

// Types for renderers
import {
    IContentRenderer,
    ITabRenderer,
    IWatermarkRenderer,
    GroupPanelPartInitParameters,
    TabPartInitParameters,
    WatermarkRendererInitParameters,
    PanelUpdateEvent,
    Parameters,
} from 'dockview-core';

// Header actions
import {
    IHeaderActionsRenderer,
    IGroupHeaderProps,
} from 'dockview-core';

// API types
import {
    DockviewApi,
    DockviewPanelApi,
    DockviewGroupPanelApi,
} from 'dockview-core';

// Options & config
import {
    DockviewComponentOptions,
    AddPanelOptions,
    AddGroupOptions,
    DockviewPanelRenderer,
    DockviewHeaderPosition,
    Direction,
    CreateComponentOptions,
} from 'dockview-core';

// Themes
import {
    DockviewTheme,
    themeAbyss,
    themeDark,
    themeLight,
    themeDracula,
    themeVisualStudio,
    themeReplit,
    themeAbyssSpaced,
    themeLightSpaced,
} from 'dockview-core';

// Serialization
import { SerializedDockview } from 'dockview-core';

// Group & Panel types
import {
    DockviewGroupPanel,
    IDockviewGroupPanel,
    IDockviewPanel,
    DockviewGroupLocation,
} from 'dockview-core';

// DnD events
import {
    DockviewDidDropEvent,
    DockviewWillDropEvent,
    DockviewDndOverlayEvent,
    TabDragEvent,
    GroupDragEvent,
} from 'dockview-core';

// CSS
import 'dockview-core/dist/styles/dockview.css';
```
