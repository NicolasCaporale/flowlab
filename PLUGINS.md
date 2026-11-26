# FlowLab Plugin Development Guide (`FlowLabPlugins`)

FlowLab includes a modular plugin engine (`src/plugins.js`) that allows users and developers to:
1. Manage pre-installed and catalog plugins (**Pierangelo — AI Tutor**, **Algorithm Comparison & Benchmark Chart**, **Autograder & Test Suite**, **Complexity & Operations Analyzer**, **Diagram Linter & Quality Check**) by enabling/disabling them via their checkbox or removing/re-installing them from the catalog.
2. Build and import custom plugins either by uploading a local JavaScript file (`.js`) via **“Load plugin from file (.js)…”** or by pasting a **GitHub repository / `.js` file link** via **“Import from GitHub”** in the **Plugins** dialog.

---

## 1. Plugin System Architecture

The plugin architecture is strictly separated into two layers:
- **Core Plugin Engine (`src/plugins.js` → `window.FlowLabPlugins` / `Plugins`)**:
  - Maintains the central plugin registry (`FlowLabPlugins.register(...)`).
  - Persists `{ installed, enabled }` states in `localStorage` (`flowlab:plugins:v3`) as well as custom plugin scripts loaded from `.js` files or GitHub (`flowlab:customPlugins`) so they remain installed across browser reloads.
  - Dynamically renders the **FlowLab Plugins** management modal and the bottom-right quick access dock (`#pluginDock`).
  - Provides shared services to plugins such as the headless execution engine (`ctx.runHeadless`).
- **Individual Plugins (each in its own `.js` file inside `modules/plugin/` or loaded externally)**:
  - `modules/plugin/pierangelo.js` — **Pierangelo — AI Tutor** (`pierangelo-ai`, pre-installed and active by default)
  - `modules/plugin/benchmark.js` — **Algorithm Comparison & Benchmark Chart** (`algorithm-benchmark`, pre-installed, disabled by default)
  - `modules/plugin/autograder.js` — **Autograder & Test Suite** (`autograder`, available in catalog)
  - `modules/plugin/complexity.js` — **Complexity & Operations Analyzer** (`complexity-analyzer`, available in catalog)
  - `modules/plugin/linter.js` — **Diagram Linter & Quality Check** (`diagram-linter`, available in catalog)
  - Any external `.js` file loaded by the user from disk or GitHub, containing only its own logic and registering itself via `FlowLabPlugins.register({ ... })`.

---

## 2. Basic Structure of a Plugin File (`.js`)

When you load a `.js` file from the **Plugins** dialog (either from a local file or from a GitHub repository), FlowLab executes it and passes the global `FlowLabPlugins` and `FlowLab` objects.

Below is the minimal skeleton of a valid `my-plugin.js` file:

```javascript
FlowLabPlugins.register({
  // Unique plugin identifier (required, no spaces)
  id: 'my-first-plugin',

  // Name and description displayed in the "FlowLab Plugins" dialog
  name: 'My Custom Plugin',
  description: 'Adds a custom tool to inspect or transform the current flowchart.',
  version: '1.0',
  author: 'Your Name',

  // Short label for the quick-launch button in the bottom-right dock (#pluginDock).
  // Setting shortLabel automatically creates a dock button while the plugin is enabled!
  shortLabel: 'MyTool',

  // Optional 24x24 SVG icon (stroke="currentColor")
  iconSvg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',

  // Called once when the plugin is first initialized
  onInit(ctx) {
    console.log('Plugin initialized!', ctx.prog);
  },

  // Called whenever the user checks (enables) the plugin
  onEnable(ctx) {
    console.log('Plugin enabled');
  },

  // Called whenever the user unchecks (disables) or removes the plugin
  onDisable(ctx) {
    console.log('Plugin disabled');
  },

  // Called when the user clicks "Open" in the Plugins dialog
  // or clicks the quick button in the bottom-right dock (#pluginDock)
  onOpen(ctx) {
    const { openModal, h, toast } = ctx.ui;
    openModal({
      title: 'My Custom Plugin',
      body: h('div', { class: 'fields' },
        h('p', null, 'Current program: ' + (ctx.prog.attrs.name || 'Untitled')),
        h('button', {
          type: 'button',
          class: 'btn small primary',
          onclick: () => toast('Hello from My Custom Plugin!', 'ok')
        }, 'Show notification')
      ),
      okText: 'Close',
      noCancel: true
    });
  }
});
```

---

## 3. Configuration Properties for `FlowLabPlugins.register(config)`

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | **Required.** Unique identifier for the plugin (e.g. `'block-statistics'`). |
| `name` / `getName()` | `string \| Function` | Display name of the plugin. Can be a string or a function `() => string` (useful for localization). |
| `description` / `getDesc()` | `string \| Function` | Description shown in the plugin card. |
| `version` | `string` | Plugin version string (default: `'1.0'`). |
| `author` | `string` | Author name (default: `'FlowLab'`). |
| `shortLabel` / `getShortLabel()` | `string \| Function` | Short label for the quick button in the bottom-right dock (`#pluginDock`). |
| `showInDock` | `boolean` | If `true` (default when `shortLabel` is provided), displays a button in `#pluginDock` while the plugin is enabled. |
| `iconSvg` | `string` | Raw `<svg viewBox="0 0 24 24">...</svg>` markup displayed in the plugin card and dock button. |
| `icon` | `string \| Function` | Image URL or Data-URI (`data:image/png;base64,...`) used as an avatar instead of `iconSvg`. |
| `preinstalled` | `boolean` | If `true`, displays the `Pre-installed` badge next to the plugin title. |
| `defaultInstalled` | `boolean` | If `true` (default), the plugin is listed under Installed Plugins on first launch; if `false`, it appears in the Available Plugins Catalog. |
| `defaultEnabled` | `boolean` | If `true` (default), the plugin starts with its checkbox enabled. |
| `onInit(ctx)` | `Function` | Executed once when the plugin is first activated. |
| `onEnable(ctx)` | `Function` | Executed when the plugin is enabled (checkbox checked). |
| `onDisable(ctx)` | `Function` | Executed when the plugin is disabled (checkbox unchecked) or removed. |
| `onOpen(ctx)` | `Function` | Executed when clicking **“Open”** in the Plugins dialog or clicking the plugin's dock button. |

---

## 4. The Context Object (`ctx`) and FlowLab APIs

Every lifecycle callback (`onInit`, `onEnable`, `onDisable`, `onOpen`) receives a `ctx` object providing full access to FlowLab:

### 4.1 `ctx.ui` — Modals, DOM Builder, and Notifications
- **`ctx.ui.h(tag, attrs, ...children)`**: helper to build DOM elements cleanly.
  - Example: `h('div', { class: 'fields' }, h('strong', null, 'Title'), h('p', { class: 'muted small' }, 'Description'))`
- **`ctx.ui.openModal({ title, body, wide, okText, noCancel, onOk })`**: opens a native FlowLab modal dialog (returns `{ close }`).
- **`ctx.ui.toast(message, kind)`**: shows a toast notification (`kind`: `'ok'`, `'warn'`, `'error'`).
- **`ctx.ui.infoBox(title, message)`**: opens an information dialog.
- **`ctx.ui.confirmBox(title, message, confirmText, onConfirm)`**: opens a confirmation dialog.

### 4.2 `ctx.prog` and `ctx.flowlab` — Reading and Modifying the Flowchart
- **`ctx.prog`**: the live data model of the open program:
  - `ctx.prog.attrs`: `{ name, authors, about }`
  - `ctx.prog.functions`: array of functions/methods (`[{ id, name, params, body, ... }]`)
  - `ctx.prog.classes`: array of UML classes in the Objects view
- **`ctx.flowlab`**:
  - `ctx.flowlab.state`: editor state (`prog`, `fi` current function index, `sel` selected block ID, `view` `'functions'` or `'objects'`)
  - `ctx.flowlab.render()`: re-renders the diagram after mutating `ctx.prog`
  - `ctx.flowlab.showFunc(fi)`: switches the active diagram to function index `fi`
  - `ctx.flowlab.serialize()`: serializes the current program to `.fprg` XML
  - `ctx.flowlab.loadText(xml, fileName)`: loads a program from an `.fprg` XML string

### 4.3 `ctx.runHeadless(prog, inputText, options)` — Fast Background Execution
Allows any plugin to execute `Main` or a specific function/method in memory without blocking the UI, feeding newline-separated inputs or function parameters (including arrays `{1, 2, 3}` and data structures `ArrayList`, `Stack`, `Queue`) and returning output, return values, and execution metrics:
```javascript
const res = ctx.runHeadless(ctx.prog, "{10, 20, 30}\n3\n20", { funcIndex: 1, maxSteps: 25000 });
// res.ok          -> true if execution completed without errors
// res.error       -> error message if execution failed
// res.returnText  -> formatted return value or in-place modified array
// res.outputText  -> full console output string (including returnText)
// res.outputLines -> array of printed output lines
// res.stats       -> { steps, comparisons, loopIterations, assignments, calls, maxDepth, memCells, byKind }
```

### 4.4 Global Libraries Available to Plugins
- **`ModelLib`**: `ModelLib.makeStmt(kind, props)`, `ModelLib.walk(body, callback)`, `ModelLib.hasClasses(prog)`
- **`ExprLib`**: `ExprLib.parseExpr(exprString)`, `ExprLib.parseLValue(lvalString)`, `ExprLib.parseLValueList(str)`, `ExprLib.parseArrayLit(str)`
- **`CodeGen`**: `CodeGen.generate(ctx.prog, lang)` where `lang` is `'pseudo'`, `'java'`, `'python'`, `'cpp'`, `'csharp'`, or `'javascript'`

---

## 5. Complete Ready-to-Import Examples

You can save either of the examples below as a `.js` file (or host them in a GitHub repository) and load them into FlowLab via **Plugins → Import from GitHub** or **Load plugin from file (.js)…**.

### Example 1: Lab Report & Markdown Exporter (`lab_report_plugin.js`)
Counts every block type in the flowchart and generates a formatted Markdown report with block statistics, pseudocode, and Java code ready to copy into a school lab assignment.

```javascript
FlowLabPlugins.register({
  id: 'lab-report-generator',
  name: 'Lab Report Generator (Markdown)',
  description: 'Generates a ready-to-copy Markdown lab report with block statistics, pseudocode and Java code.',
  shortLabel: 'Report',
  version: '1.0',
  author: 'FlowLab Student',
  iconSvg: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>',

  onOpen(ctx) {
    const { openModal, h, toast } = ctx.ui;
    const prog = ctx.prog;
    const counts = {};
    let total = 0;

    for (const fn of prog.functions) {
      ModelLib.walk(fn.body, (stmt) => {
        total++;
        counts[stmt.kind] = (counts[stmt.kind] || 0) + 1;
      });
    }

    const pseudo = CodeGen.generate(prog, 'pseudo');
    const md = [
      `# Lab Report: ${prog.attrs.name || 'Program'}`,
      prog.attrs.authors ? `**Author:** ${prog.attrs.authors}` : '',
      prog.attrs.about ? `**Description:** ${prog.attrs.about}` : '',
      '',
      `## Flowchart Statistics`,
      `- **Functions / Methods:** ${prog.functions.length}`,
      `- **Total Blocks:** ${total}`,
      ...Object.entries(counts).map(([k, n]) => `  - \`${k}\`: ${n}`),
      '',
      `## Pseudocode`,
      '```text',
      pseudo.trim(),
      '```'
    ].filter((l) => l !== null).join('\n');

    const ta = h('textarea', {
      class: 'mono',
      rows: 14,
      readonly: true,
      style: 'width:100%'
    });
    ta.value = md;

    openModal({
      title: 'Markdown Lab Report',
      wide: true,
      body: h('div', { class: 'fields' },
        h('p', { class: 'help' }, 'Copy this Markdown report and paste it into your lab assignment:'),
        ta,
        h('button', {
          type: 'button',
          class: 'btn small primary',
          onclick: async () => {
            await navigator.clipboard.writeText(md);
            toast('Markdown report copied to clipboard!', 'ok');
          }
        }, 'Copy to clipboard')
      ),
      okText: 'Close',
      noCancel: true
    });
  }
});
```

### Example 2: Quick Comment Header Inserter (`auto_header.js`)
Inserts a `Comment` block at the top of `Main` containing the exercise title, author, and current date with a single click.

```javascript
FlowLabPlugins.register({
  id: 'auto-header',
  name: 'Automatic Header Comment',
  description: 'Inserts a Comment block with title, author and today\'s date at the top of the Main diagram.',
  shortLabel: 'Header',
  version: '1.0',
  author: 'FlowLab',

  onOpen(ctx) {
    const { toast } = ctx.ui;
    const prog = ctx.prog;
    const mainFn = prog.functions[0];
    if (!mainFn) return;

    const today = new Date().toLocaleDateString();
    const author = prog.attrs.authors || 'Student';
    const title = prog.attrs.name || 'Exercise';

    const commentBlock = ModelLib.makeStmt('comment', {
      text: `${title} — Author: ${author} (${today})`
    });

    mainFn.body.unshift(commentBlock);
    ctx.flowlab.render();
    toast('Header comment added to the top of Main!', 'ok');
  }
});
```
