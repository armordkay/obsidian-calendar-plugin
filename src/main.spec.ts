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
  defaultSettings: { weekStart: "locale" },
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
