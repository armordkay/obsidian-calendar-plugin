import type { Moment } from "moment";
import {
  getDailyNote,
  getDailyNoteSettings,
  getDateFromFile,
  getWeeklyNote,
  getWeeklyNoteSettings,
} from "src/io/periodicNotes";
import { FileView, TFile, ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type { TAbstractFile } from "obsidian";
import { get } from "svelte/store";

import { TRIGGER_ON_OPEN, VIEW_TYPE_CALENDAR } from "src/constants";
import { tryToCreateDailyNote } from "src/io/dailyNotes";
import { tryToCreateWeeklyNote } from "src/io/weeklyNotes";
import type { ISettings } from "src/settings";

import Calendar from "./ui/Calendar.svelte";
import { showFileMenu } from "./ui/fileMenu";
import { activeFile, dailyNotes, weeklyNotes, settings } from "./ui/stores";
import {
  customTagsSource,
  streakSource,
  tasksSource,
  wordCountSource,
} from "./ui/sources";

export default class CalendarDeadlinesView extends ItemView {
  private calendar: Calendar;
  private settings: ISettings;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);

    this.openOrCreateDailyNote = this.openOrCreateDailyNote.bind(this);
    this.openOrCreateWeeklyNote = this.openOrCreateWeeklyNote.bind(this);

    this.onNoteSettingsUpdate = this.onNoteSettingsUpdate.bind(this);
    this.onFileCreated = this.onFileCreated.bind(this);
    this.onFileDeleted = this.onFileDeleted.bind(this);
    this.onFileModified = this.onFileModified.bind(this);
    this.onFileOpen = this.onFileOpen.bind(this);

    this.onHoverDay = this.onHoverDay.bind(this);
    this.onHoverWeek = this.onHoverWeek.bind(this);

    this.onContextMenuDay = this.onContextMenuDay.bind(this);
    this.onContextMenuWeek = this.onContextMenuWeek.bind(this);

    this.registerEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (<any>this.app.workspace).on(
        "periodic-notes:settings-updated",
        this.onNoteSettingsUpdate
      )
    );
    this.registerEvent(this.app.vault.on("create", this.onFileCreated));
    this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
    this.registerEvent(this.app.vault.on("modify", this.onFileModified));
    this.registerEvent(this.app.metadataCache.on("changed", this.onFileModified));
    this.registerEvent(this.app.vault.on("rename", () => this.onNoteSettingsUpdate()));
    this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));

    this.settings = null;
    this.register(
      settings.subscribe((val) => {
        this.settings = val;

        // Refresh the calendar if settings change
        if (this.calendar) {
          this.calendar.tick();
        }
      })
    );
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText(): string {
    return "Calendar Deadlines";
  }

  getIcon(): string {
    return "calendar-with-checkmark";
  }

  onClose(): Promise<void> {
    if (this.calendar) {
      this.calendar.$destroy();
      this.calendar = null;
    }
    return Promise.resolve();
  }

  async onOpen(): Promise<void> {
    // Integration point: external plugins can listen for `calendar-deadlines:open`
    // to feed in additional sources.
    const sources = [
      customTagsSource,
      streakSource,
      wordCountSource,
      tasksSource,
    ];
    this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);

    this.calendar = new Calendar({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target: (this as any).contentEl,
      props: {
        onClickDay: this.openOrCreateDailyNote,
        onClickWeek: this.openOrCreateWeeklyNote,
        onHoverDay: this.onHoverDay,
        onHoverWeek: this.onHoverWeek,
        onContextMenuDay: this.onContextMenuDay,
        onContextMenuWeek: this.onContextMenuWeek,
        sources,
      },
    });
  }

  onHoverDay(
    date: Moment,
    targetEl: EventTarget,
    isMetaPressed: boolean
  ): void {
    if (!isMetaPressed) {
      return;
    }
    const { format } = getDailyNoteSettings();
    const note = getDailyNote(date, get(dailyNotes));
    this.app.workspace.trigger(
      "link-hover",
      this,
      targetEl,
      date.format(format),
      note?.path
    );
  }

  onHoverWeek(
    date: Moment,
    targetEl: EventTarget,
    isMetaPressed: boolean
  ): void {
    if (!isMetaPressed) {
      return;
    }
    const note = getWeeklyNote(date, get(weeklyNotes));
    const { format } = getWeeklyNoteSettings();
    this.app.workspace.trigger(
      "link-hover",
      this,
      targetEl,
      date.format(format),
      note?.path
    );
  }

  private onContextMenuDay(date: Moment, event: MouseEvent): void {
    const note = getDailyNote(date, get(dailyNotes));
    if (!note) {
      // If no file exists for a given day, show nothing.
      return;
    }
    showFileMenu(this.app, note, {
      x: event.pageX,
      y: event.pageY,
    });
  }

  private onContextMenuWeek(date: Moment, event: MouseEvent): void {
    const note = getWeeklyNote(date, get(weeklyNotes));
    if (!note) {
      // If no file exists for a given day, show nothing.
      return;
    }
    showFileMenu(this.app, note, {
      x: event.pageX,
      y: event.pageY,
    });
  }

  private onNoteSettingsUpdate(): void {
    dailyNotes.reindex();
    weeklyNotes.reindex();
    this.updateActiveFile();
  }

  private async onFileDeleted(_file: TAbstractFile): Promise<void> {
    this.onNoteSettingsUpdate();
  }

  private async onFileModified(file: TAbstractFile): Promise<void> {
    const date = file instanceof TFile && (getDateFromFile(file, "day") || getDateFromFile(file, "week"));
    if (date && this.calendar) {
      this.calendar.tick();
    }
  }

  private onFileCreated(file: TAbstractFile): void {
    if (file instanceof TFile && this.app.workspace.layoutReady && this.calendar) {
      if (getDateFromFile(file, "day")) {
        dailyNotes.reindex();
        this.calendar.tick();
      }
      if (getDateFromFile(file, "week")) {
        weeklyNotes.reindex();
        this.calendar.tick();
      }
    }
  }

  public onFileOpen(_file: TFile): void {
    if (this.app.workspace.layoutReady) {
      this.updateActiveFile();
    }
  }

  private updateActiveFile(): void {
    const view = this.app.workspace.activeLeaf?.view;

    let file = null;
    if (view instanceof FileView) {
      file = view.file;
    }
    activeFile.setFile(file);

    if (this.calendar) {
      const date = file && getDateFromFile(file, "day");
      if (date) {
        this.calendar.$set({ selectedDate: date, selectedWeek: null });
      } else {
        const week = file && getDateFromFile(file, "week");
        if (week) this.calendar.$set({ selectedDate: week, selectedWeek: week });
      }
      this.calendar.tick();
    }
  }

  public revealActiveNote(file: TFile | null = this.app.workspace.getActiveFile()): void {
    if (!file || !this.calendar) return;
    // Check to see if the active note is a daily-note
    let date = getDateFromFile(file, "day");
    if (date) {
      this.calendar.$set({ displayedMonth: date, selectedDate: date, selectedWeek: null });
      return;
    }

    // Check to see if the active note is a weekly-note
    date = getDateFromFile(file, "week");
    if (date) {
      this.calendar.$set({ displayedMonth: date, selectedDate: date, selectedWeek: date });
      return;
    }
  }

  async openOrCreateWeeklyNote(
    date: Moment,
    inNewSplit: boolean
  ): Promise<void> {
    const { workspace } = this.app;

    const startOfWeek = date.clone().startOf("week");

    const existingFile = getWeeklyNote(date, get(weeklyNotes));

    if (!existingFile) {
      // File doesn't exist
      try {
        await tryToCreateWeeklyNote(startOfWeek, inNewSplit, this.settings, (file) => {
          activeFile.setFile(file);
        });
      } catch (error) {
        new Notice("Could not create weekly note. Check its folder and template.");
        console.error("[Calendar Deadlines] Weekly note creation failed", error);
      }
      return;
    }

    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    try {
      await leaf.openFile(existingFile);
      activeFile.setFile(existingFile);
      workspace.setActiveLeaf(leaf, true, true);
    } catch (error) {
      new Notice("Could not open weekly note.");
      console.error("[Calendar Deadlines] Could not open weekly note", error);
    }
  }

  async openOrCreateDailyNote(
    date: Moment,
    inNewSplit: boolean
  ): Promise<void> {
    const { workspace } = this.app;
    const existingFile = getDailyNote(date, get(dailyNotes));
    if (!existingFile) {
      // File doesn't exist
      try {
        await tryToCreateDailyNote(
          date,
          inNewSplit,
          this.settings,
          (dailyNote: TFile) => {
            activeFile.setFile(dailyNote);
          }
        );
      } catch (error) {
        new Notice("Could not create daily note. Check its folder and template.");
        console.error("[Calendar Deadlines] Daily note creation failed", error);
      }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mode = (this.app.vault as any).getConfig("defaultViewMode");
    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    try {
      await leaf.openFile(existingFile, { active: true, state: { mode } });
      activeFile.setFile(existingFile);
    } catch (error) {
      new Notice("Could not open daily note.");
      console.error("[Calendar Deadlines] Could not open daily note", error);
    }
  }
}
