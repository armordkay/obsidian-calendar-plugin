import type { App, Command, PluginManifest } from "obsidian";
import moment from "moment";
import CalendarDeadlinesPlugin from "./main";

beforeEach(() => Object.assign(window, { moment }));

jest.mock("obsidian", () => ({
  Plugin: class {
    app;
    commands = [];
    constructor(app) { this.app = app; }
    register = jest.fn();
    registerView(type, factory) {
      if (this.app.views.has(type)) throw new Error("View already registered");
      this.app.views.set(type, factory);
    }
    addCommand(command) { this.commands.push(command); }
    addSettingTab = jest.fn();
    loadData = jest.fn().mockResolvedValue({});
    saveData = jest.fn().mockResolvedValue(undefined);
  },
  Notice: jest.fn(),
}), { virtual: true });
jest.mock("./view", () => ({
  __esModule: true,
  default: class {
    getViewType = () => "calendar-deadlines-view";
    openOrCreateWeeklyNote = jest.fn().mockResolvedValue(undefined);
    revealActiveNote = jest.fn();
  },
}));
jest.mock("./settings", () => ({
  defaultSettings: { weekStart: "locale", openOnStartup: true },
  CalendarDeadlinesSettingsTab: jest.fn(),
}));
jest.mock("./ui/stores", () => ({
  settings: jest.requireActual<typeof import("svelte/store")>("svelte/store").writable({}),
}));

function setup() {
  const original = { view: { getViewType: () => "calendar" }, detach: jest.fn() };
  const views = new Map([["calendar", jest.fn()]]);
  const leaf = {
    view: { getViewType: () => "empty" },
    detach: jest.fn(),
    setViewState: jest.fn(async ({ type }) => {
      await Promise.resolve();
      leaf.view = views.get(type)(leaf);
    }),
  };
  const activeFile = { path: "Daily/2026-10-25.md" };
  const app = {
    views,
    workspace: {
      getLeavesOfType: (type: string) => [original, leaf].filter(item => item.view.getViewType() === type),
      getRightLeaf: jest.fn(() => leaf),
      revealLeaf: jest.fn(),
      getActiveFile: jest.fn(() => activeFile),
      onLayoutReady: jest.fn(),
    },
  };
  const plugin = new CalendarDeadlinesPlugin(app as unknown as App, {} as PluginManifest) as
    CalendarDeadlinesPlugin & { commands: Command[] };
  return { app, plugin, leaf, original, activeFile };
}

async function layoutReady({ app, plugin }: ReturnType<typeof setup>) {
  const open = jest.spyOn(plugin, "initLeaf");
  const before = open.mock.calls.length;
  app.workspace.onLayoutReady.mock.calls[0][0]();
  if (open.mock.calls.length > before) await open.mock.results[before].value;
  return open;
}

it("defaults old configurations to startup ON", async () => {
  const context = setup();
  await context.plugin.onload();
  expect(context.plugin.options.openOnStartup).toBe(true);
  const open = await layoutReady(context);
  expect(open).toHaveBeenCalledTimes(1);
  expect(context.app.workspace.revealLeaf).toHaveBeenCalledTimes(1);
});

it.each([true, false])("respects startup %s when enabled after the layout is already ready", async value => {
  const { app, plugin } = setup();
  jest.spyOn(plugin, "loadData").mockResolvedValue({ openOnStartup: value });
  app.workspace.onLayoutReady.mockImplementation(callback => callback());
  const open = jest.spyOn(plugin, "initLeaf");
  await plugin.onload();
  if (value) await open.mock.results[0].value;
  expect(open).toHaveBeenCalledTimes(value ? 1 : 0);
  expect(app.workspace.revealLeaf).toHaveBeenCalledTimes(value ? 1 : 0);
});

it("reuses a restored pane when startup is ON", async () => {
  const context = setup();
  await context.plugin.onload();
  await context.plugin.initLeaf();
  const restored = context.leaf.view;
  context.app.workspace.getRightLeaf.mockClear();
  context.app.workspace.revealLeaf.mockClear();
  context.leaf.setViewState.mockClear();
  await layoutReady(context);
  expect(context.app.workspace.getRightLeaf).not.toHaveBeenCalled();
  expect(context.leaf.setViewState).not.toHaveBeenCalled();
  expect(context.app.workspace.revealLeaf).toHaveBeenCalledWith(context.leaf);
  expect(context.leaf.view).toBe(restored);
});

it("preserves saved startup OFF and does not create or reveal panes", async () => {
  const context = setup();
  jest.spyOn(context.plugin, "loadData").mockResolvedValue({ openOnStartup: false });
  const save = jest.spyOn(context.plugin, "saveData");
  await context.plugin.onload();
  expect(context.plugin.options.openOnStartup).toBe(false);
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ openOnStartup: false }));
  const open = await layoutReady(context);
  expect(open).not.toHaveBeenCalled();
  expect(context.app.workspace.getRightLeaf).not.toHaveBeenCalled();
  expect(context.leaf.setViewState).not.toHaveBeenCalled();
  expect(context.app.workspace.revealLeaf).not.toHaveBeenCalled();
});

it("leaves restored panes untouched when startup is OFF", async () => {
  const context = setup();
  jest.spyOn(context.plugin, "loadData").mockResolvedValue({ openOnStartup: false });
  await context.plugin.onload();
  await context.plugin.initLeaf();
  const restored = context.leaf.view;
  context.app.workspace.revealLeaf.mockClear();
  context.leaf.setViewState.mockClear();
  const open = await layoutReady(context);
  expect(open).not.toHaveBeenCalled();
  expect(context.app.workspace.revealLeaf).not.toHaveBeenCalled();
  expect(context.leaf.setViewState).not.toHaveBeenCalled();
  expect(context.leaf.detach).not.toHaveBeenCalled();
  expect(context.leaf.view).toBe(restored);
});

it.each([[true, false], [false, true]])(
  "uses the latest option before layout becomes ready (%s to %s)", async (initial, latest) => {
    const context = setup();
    jest.spyOn(context.plugin, "loadData").mockResolvedValue({ openOnStartup: initial });
    await context.plugin.onload();
    await context.plugin.writeOptions(() => ({ openOnStartup: latest }));
    expect(context.app.workspace.revealLeaf).not.toHaveBeenCalled();
    expect(context.leaf.detach).not.toHaveBeenCalled();
    const open = await layoutReady(context);
    expect(open).toHaveBeenCalledTimes(latest ? 1 : 0);
    expect(context.app.workspace.revealLeaf).toHaveBeenCalledTimes(latest ? 1 : 0);
  }
);

it("saves ON then OFF without changing other settings", async () => {
  const { plugin } = setup();
  jest.spyOn(plugin, "loadData").mockResolvedValue({ openOnStartup: false, weekStart: "monday" });
  const save = jest.spyOn(plugin, "saveData");
  await plugin.onload();
  save.mockClear();
  await plugin.writeOptions(() => ({ openOnStartup: true }));
  await plugin.writeOptions(() => ({ openOnStartup: false }));
  expect(save).toHaveBeenNthCalledWith(1, expect.objectContaining({ openOnStartup: true, weekStart: "monday" }));
  expect(save).toHaveBeenNthCalledWith(2, expect.objectContaining({ openOnStartup: false, weekStart: "monday" }));
});

it("keeps all manual commands available when startup is OFF and reuses the pane", async () => {
  const context = setup();
  const { plugin, leaf, activeFile } = context;
  jest.spyOn(plugin, "loadData").mockResolvedValue({ openOnStartup: false });
  await plugin.onload();
  const open = await layoutReady(context);
  for (const id of ["show-calendar-view", "open-weekly-note", "reveal-active-note"]) {
    await plugin.commands.find(command => command.id === id).callback();
    await open.mock.results[open.mock.results.length - 1].value;
  }
  const view = leaf.view as unknown as { openOrCreateWeeklyNote: jest.Mock; revealActiveNote: jest.Mock };
  expect(view.openOrCreateWeeklyNote).toHaveBeenCalledWith(expect.anything(), false);
  expect(view.revealActiveNote).toHaveBeenCalledWith(activeFile);
  expect(leaf.setViewState).toHaveBeenCalledTimes(1);
  expect(context.app.workspace.revealLeaf).toHaveBeenCalledTimes(3);
});

it("does not open after unloading before layout is ready", async () => {
  const context = setup();
  await context.plugin.onload();
  context.plugin.onunload();
  expect(await layoutReady(context)).not.toHaveBeenCalled();
  expect(context.leaf.setViewState).not.toHaveBeenCalled();
  expect(context.app.workspace.revealLeaf).not.toHaveBeenCalled();
  expect(context.original.detach).not.toHaveBeenCalled();
});

it("coexists with Calendar and only closes the fork's pane", async () => {
  const { app, plugin, leaf, original } = setup();
  await plugin.onload();
  expect(app.views.has("calendar")).toBe(true);
  expect(app.views.has("calendar-deadlines-view")).toBe(true);
  await plugin.initLeaf();
  plugin.onunload();
  expect(leaf.detach).toHaveBeenCalledTimes(1);
  expect(original.detach).not.toHaveBeenCalled();
});

it("reopens a closed pane for weekly-note and reveal commands", async () => {
  const { plugin, leaf, activeFile } = setup();
  await plugin.onload();
  await plugin.commands.find(command => command.id === "open-weekly-note").callback();
  const firstView = leaf.view as unknown as { openOrCreateWeeklyNote: jest.Mock };
  expect(firstView.openOrCreateWeeklyNote).toHaveBeenCalled();
  leaf.view = { getViewType: () => "empty" };
  await plugin.commands.find(command => command.id === "reveal-active-note").callback();
  const reopened = leaf.view as unknown as { revealActiveNote: jest.Mock };
  expect(reopened.revealActiveNote).toHaveBeenCalledWith(activeFile);
  expect(leaf.setViewState).toHaveBeenCalledTimes(2);
});

it("creates a single pane for concurrent open requests", async () => {
  const { plugin, leaf } = setup();
  await plugin.onload();
  await Promise.all([plugin.initLeaf(), plugin.initLeaf()]);
  expect(leaf.setViewState).toHaveBeenCalledTimes(1);
});

it("does not recreate a pane after the plugin is disabled while it is opening", async () => {
  const { app, plugin, leaf, original } = setup();
  await plugin.onload();
  const pending = plugin.initLeaf();
  plugin.onunload();
  expect(await pending).toBeNull();
  expect(leaf.detach).toHaveBeenCalledTimes(1);
  expect(original.detach).not.toHaveBeenCalled();
  expect(app.workspace.revealLeaf).not.toHaveBeenCalled();
});
