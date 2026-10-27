import type { Moment } from "moment";
import { App, Notice, Plugin, WorkspaceLeaf } from "obsidian";

import { VIEW_TYPE_CALENDAR } from "./constants";
import { settings } from "./ui/stores";
import {
  CalendarDeadlinesSettingsTab,
  defaultSettings,
  ISettings,
} from "./settings";
import CalendarView from "./view";

declare global {
  interface Window {
    app: App;
    moment: () => Moment;
  }
}

export default class CalendarDeadlinesPlugin extends Plugin {
  public options: ISettings;
  private unloading = false;
  private opening: Promise<CalendarView | null> = null;

  onunload(): void {
    this.unloading = true;
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_CALENDAR)
      .forEach((leaf) => leaf.detach());
  }

  async onload(): Promise<void> {
    this.unloading = false;
    this.register(
      settings.subscribe((value) => {
        this.options = value;
      })
    );

    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf: WorkspaceLeaf) => new CalendarView(leaf)
    );

    this.addCommand({
      id: "show-calendar-view",
      name: "Open view",
      callback: () => { void this.initLeaf(); },
    });

    this.addCommand({
      id: "open-weekly-note",
      name: "Open Weekly Note",
      callback: async () => {
        const view = await this.initLeaf();
        if (view) await view.openOrCreateWeeklyNote(window.moment(), false);
      },
    });

    this.addCommand({
      id: "reveal-active-note",
      name: "Reveal active note",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        const view = await this.initLeaf();
        if (view) view.revealActiveNote(file);
      },
    });

    await this.loadOptions();

    this.addSettingTab(new CalendarDeadlinesSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      if (!this.unloading && this.options.openOnStartup) void this.initLeaf();
    });
  }

  async initLeaf(): Promise<CalendarView | null> {
    if (this.unloading) return null;
    if (this.opening) return this.opening;
    this.opening = this.openLeaf();
    try {
      return await this.opening;
    } finally {
      this.opening = null;
    }
  }

  private async openLeaf(): Promise<CalendarView | null> {
    try {
      const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0] ||
        this.app.workspace.getRightLeaf(false);
      if (!leaf) throw new Error("No workspace pane is available");
      if (leaf.view.getViewType() !== VIEW_TYPE_CALENDAR) {
        await leaf.setViewState({ type: VIEW_TYPE_CALENDAR });
      }
      if (this.unloading) {
        if (leaf.view.getViewType() === VIEW_TYPE_CALENDAR) leaf.detach();
        return null;
      }
      await this.app.workspace.revealLeaf(leaf);
      return leaf.view instanceof CalendarView ? leaf.view : null;
    } catch (error) {
      new Notice("Could not open Calendar Deadlines.");
      console.error("[Calendar Deadlines] Could not open view", error);
      return null;
    }
  }

  async loadOptions(): Promise<void> {
    const options = await this.loadData();
    settings.set({ ...defaultSettings, ...(options || {}) });

    await this.saveData(this.options);
  }

  async writeOptions(
    changeOpts: (settings: ISettings) => Partial<ISettings>
  ): Promise<void> {
    settings.update((old) => ({ ...old, ...changeOpts(old) }));
    await this.saveData(this.options);
  }
}
