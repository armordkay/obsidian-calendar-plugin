import type { App } from "obsidian";
import type CalendarDeadlinesPlugin from "./main";
import { CalendarDeadlinesSettingsTab, defaultSettings } from "./settings";
import type { ISettings } from "./settings";
import { getDefaultSettings } from "./testUtils/settings";

interface ToggleRow {
  name?: string;
  value?: boolean;
  change?: (value: boolean) => Promise<void>;
}
const mockRows: ToggleRow[] = [];

jest.mock("obsidian", () => ({
  PluginSettingTab: class {
    containerEl = { empty: jest.fn(), createEl: jest.fn() };
  },
  Setting: class {
    row: ToggleRow = {};
    constructor() { mockRows.push(this.row); }
    setName(name: string) { this.row.name = name; return this; }
    setDesc(_description: string) { return this; }
    addToggle(callback: (toggle: {
      setValue: (value: boolean) => void;
      onChange: (change: ToggleRow["change"]) => void;
    }) => void) {
      callback({
        setValue: value => { this.row.value = value; },
        onChange: change => { this.row.change = change; },
      });
      return this;
    }
  },
}), { virtual: true });
jest.mock("obsidian-daily-notes-interface", () => ({ appHasDailyNotesPluginLoaded: () => true }));
jest.mock("./ui/locale", () => ({}));

beforeEach(() => { mockRows.length = 0; });

function setup(openOnStartup: boolean) {
  const plugin = {
    options: getDefaultSettings({ openOnStartup }),
    initLeaf: jest.fn(),
    writeOptions: jest.fn(async (change: (settings: ISettings) => Partial<ISettings>) => {
      plugin.options = { ...plugin.options, ...change(plugin.options) };
    }),
  };
  const tab = new CalendarDeadlinesSettingsTab({} as App, plugin as unknown as CalendarDeadlinesPlugin);
  return { plugin, tab };
}

it("defaults startup ON for configurations without the new key", () => {
  expect(defaultSettings.openOnStartup).toBe(true);
  expect(getDefaultSettings().openOnStartup).toBe(true);
});

it.each([true, false])("displays the saved startup toggle value %s", value => {
  const { tab } = setup(value);
  tab.addOpenOnStartupSetting();
  expect(mockRows).toHaveLength(1);
  expect(mockRows[0].name).toBe("Open panel on startup");
  expect(mockRows[0].value).toBe(value);
});

it("writes ON then OFF without opening a pane or changing other settings", async () => {
  const { plugin, tab } = setup(false);
  const original = { ...plugin.options };
  tab.addOpenOnStartupSetting();
  await mockRows[0].change(true);
  expect(plugin.options).toEqual({ ...original, openOnStartup: true });
  await mockRows[0].change(false);
  expect(plugin.options).toEqual(original);
  expect(plugin.writeOptions).toHaveBeenCalledTimes(2);
  expect(plugin.initLeaf).not.toHaveBeenCalled();
});

it("displays the startup toggle immediately after week numbers", () => {
  const { tab } = setup(false);
  for (const method of ["addDotThresholdSetting", "addWeekStartSetting", "addConfirmCreateSetting", "addLocaleOverrideSetting"] as const) {
    jest.spyOn(tab, method).mockImplementation(() => undefined);
  }
  const weeks = jest.spyOn(tab, "addShowWeeklyNoteSetting");
  tab.display();
  expect(weeks).toHaveBeenCalledTimes(1);
  expect(mockRows.map(row => row.name)).toEqual(["Show week number", "Open panel on startup"]);
});
