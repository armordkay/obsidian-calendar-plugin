import moment from "moment";
import { TFile } from "obsidian";
import { createWeeklyNote, getDateFromFile, getWeeklyNoteSettings, renderWeeklyTemplate } from "./periodicNotes";

jest.mock("obsidian", () => ({
  TFile: class {},
  normalizePath: (path: string) => path.split("/").filter(Boolean).join("/"),
}), { virtual: true });

const own = {
  weeklyNoteFolder: "Weekly", weeklyNoteFormat: "gggg-[W]ww", weeklyNoteTemplate: "Templates/week",
};
let periodic: { enabled: boolean; folder: string; format: string; template: string };
let app: {
  plugins: { getPlugin: jest.Mock };
  internalPlugins: { getPluginById: jest.Mock };
  vault: { getAbstractFileByPath: jest.Mock; cachedRead: jest.Mock; createFolder: jest.Mock; create: jest.Mock };
  metadataCache: { getFirstLinkpathDest: jest.Mock };
};

function file(path: string): TFile {
  return Object.assign(new TFile(), { path, basename: path.split("/").pop().replace(/\.md$/, ""), extension: "md" });
}

beforeEach(() => {
  moment.locale("en");
  periodic = { enabled: false, folder: "Periodic", format: "[Week] ww", template: "Periodic/template" };
  app = {
    plugins: { getPlugin: jest.fn(id => {
      if (id === "calendar-deadlines") return { options: own };
      if (id === "calendar") return { options: { weeklyNoteFolder: "Original-calendar" } };
      if (id === "periodic-notes") return { settings: { weekly: periodic } };
      return null;
    }) },
    internalPlugins: { getPluginById: jest.fn(() => ({ instance: { options: { folder: "Daily", format: "YYYY-MM-DD" } } })) },
    vault: { getAbstractFileByPath: jest.fn(), cachedRead: jest.fn().mockResolvedValue("# {{title}}"), createFolder: jest.fn().mockResolvedValue(undefined), create: jest.fn(async path => file(path)) },
    metadataCache: { getFirstLinkpathDest: jest.fn(() => file("Templates/week.md")) },
  };
  Object.assign(window, { app, moment });
});

it("uses the fork's weekly settings, independently of Calendar", () => {
  expect(getWeeklyNoteSettings()).toEqual({ folder: "Weekly", format: "gggg-[W]ww", template: "Templates/week" });
  expect(app.plugins.getPlugin).not.toHaveBeenCalledWith("calendar");
});

it("prefers enabled Periodic Notes settings", () => {
  periodic.enabled = true;
  expect(getWeeklyNoteSettings()).toEqual({ folder: "Periodic", format: "[Week] ww", template: "Periodic/template" });
});

it("does not recognize date-like files outside their configured folders", () => {
  expect(getDateFromFile(file("Archive/2026-10-25.md"), "day")).toBeNull();
  expect(getDateFromFile(file("Daily/2026-10-25.md"), "day").isValid()).toBe(true);
  expect(getDateFromFile(file("Weekly-copy/2026-W43.md"), "week")).toBeNull();
  expect(getDateFromFile(file("Weekly/2026-W43.md"), "week").isValid()).toBe(true);
});

it("creates weekly notes in the fork folder using its template", async () => {
  const created = await createWeeklyNote(moment("2026-10-25"));
  expect(created.path).toMatch(/^Weekly\//);
  expect(app.vault.create).toHaveBeenCalledWith(created.path, expect.stringMatching(/^# 2026-W/));
  expect(app.vault.createFolder).toHaveBeenCalledWith("Weekly");
});

it("fails without creating an empty weekly note when its template is missing", async () => {
  app.metadataCache.getFirstLinkpathDest.mockReturnValue(null);
  await expect(createWeeklyNote(moment("2026-10-25"))).rejects.toThrow("Weekly template not found");
  expect(app.vault.create).not.toHaveBeenCalled();
});

it("renders independent weekday placeholders without mutating the requested date", () => {
  const date = moment("2026-10-25");
  const original = date.format("YYYY-MM-DD");
  expect(renderWeeklyTemplate("{{monday:YYYY-MM-DD}} {{sunday:YYYY-MM-DD}} {{time}}", date, "gggg-[W]ww", moment("2026-10-25T14:30")))
    .toBe("2026-10-26 2026-10-25 14:30");
  expect(date.format("YYYY-MM-DD")).toBe(original);
});
