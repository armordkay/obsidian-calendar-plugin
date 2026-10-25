import type { Moment, unitOfTime } from "moment";
import { normalizePath, TFile } from "obsidian";
import {
  createDailyNote,
  getDailyNoteSettings,
  getDateUID,
  getDateFromFile as getDailyDateFromFile,
} from "obsidian-daily-notes-interface";
import type { IPeriodicNoteSettings } from "obsidian-daily-notes-interface";

import { DEFAULT_WEEK_FORMAT, PLUGIN_ID } from "src/constants";
import type { ISettings } from "src/settings";

// Daily Notes remains owned by Obsidian/Periodic Notes. Weekly fallback belongs
// to this fork; obsidian-daily-notes-interface hardcodes the original Calendar ID.
export { createDailyNote, getDailyNoteSettings, getDateUID };

type Granularity = "day" | "week";
interface PluginOptions {
  options?: ISettings;
  settings?: { weekly?: IPeriodicNoteSettings & { enabled?: boolean } };
}

export function getWeeklyNoteSettings(): Required<IPeriodicNoteSettings> {
  const app = window.app as typeof window.app & {
    plugins: { getPlugin(id: string): PluginOptions | null };
  };
  const periodic = app.plugins.getPlugin("periodic-notes")?.settings?.weekly;
  const own = app.plugins.getPlugin(PLUGIN_ID)?.options;
  const settings = periodic?.enabled ? periodic : {
    folder: own?.weeklyNoteFolder,
    format: own?.weeklyNoteFormat,
    template: own?.weeklyNoteTemplate,
  };
  return {
    folder: settings.folder?.trim() || "",
    format: settings.format?.trim() || DEFAULT_WEEK_FORMAT,
    template: settings.template?.trim() || "",
  };
}

export function isInFolder(path: string, folder: string): boolean {
  const normalized = normalizePath(folder || "").replace(/^\/+|\/+$/g, "");
  return !normalized || path.startsWith(`${normalized}/`);
}

export function getDateFromFile(file: TFile | null, granularity: Granularity): Moment | null {
  if (!file || file.extension !== "md") return null;
  const settings = granularity === "day" ? getDailyNoteSettings() : getWeeklyNoteSettings();
  if (!settings || !isInFolder(file.path, settings.folder)) return null;
  if (granularity === "day") return getDailyDateFromFile(file, "day");

  const format = settings.format.split("/").pop();
  const clean = format.replace(/\[[^\]]*\]/g, "");
  const parsed = window.moment(file.basename, format, true);
  if (!parsed.isValid()) return null;
  // Preserve Calendar's week-number precedence for formats containing a day/month.
  if (/w{1,2}/i.test(clean) && /[MD]/.test(clean)) {
    const weekFormat = format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, "");
    return window.moment(file.basename, weekFormat, false);
  }
  return parsed;
}

function getAllNotes(granularity: Granularity): Record<string, TFile> {
  const notes: Record<string, TFile> = {};
  for (const file of window.app.vault.getMarkdownFiles()) {
    const date = getDateFromFile(file, granularity);
    if (date) notes[getDateUID(date, granularity)] = file;
  }
  return notes;
}

export const getAllDailyNotes = (): Record<string, TFile> => getAllNotes("day");
export const getAllWeeklyNotes = (): Record<string, TFile> => getAllNotes("week");
export const getDailyNote = (date: Moment, notes: Record<string, TFile>): TFile | null =>
  notes?.[getDateUID(date, "day")] || null;
export const getWeeklyNote = (date: Moment, notes: Record<string, TFile>): TFile | null =>
  notes?.[getDateUID(date, "week")] || null;

// Template syntax inherited from Liam Cain's Calendar / daily-notes-interface (MIT).
export function renderWeeklyTemplate(template: string, date: Moment, format: string, now: Moment): string {
  const filename = date.format(format);
  return template
    .replace(/{{\s*title\s*}}/gi, () => filename)
    .replace(/{{\s*time\s*}}/gi, () => now.format("HH:mm"))
    .replace(/{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
      (_, _kind, calc, delta, unit, customFormat) => {
        const value = date.clone().set({ hour: now.hour(), minute: now.minute(), second: now.second() });
        if (calc) value.add(Number(delta), unit as unitOfTime.DurationConstructor);
        return value.format(customFormat ? customFormat.substring(1).trim() : format);
      })
    .replace(/{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:(.*?)}}/gi,
      (_, name, customFormat) => {
        const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const offset = (names.indexOf(name.toLowerCase()) - date.localeData().firstDayOfWeek() + 7) % 7;
        return date.clone().startOf("week").add(offset, "days").format(customFormat.trim());
      });
}

export async function createWeeklyNote(date: Moment): Promise<TFile> {
  const { vault, metadataCache } = window.app;
  const { folder, format, template } = getWeeklyNoteSettings();
  const start = date.clone().startOf("week");
  const filename = start.format(format);
  const path = normalizePath([folder, filename.endsWith(".md") ? filename : `${filename}.md`].filter(Boolean).join("/"));
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  let content = "";
  if (template) {
    const templateFile = metadataCache.getFirstLinkpathDest(template, "");
    if (!(templateFile instanceof TFile)) throw new Error(`Weekly template not found: ${template}`);
    content = await vault.cachedRead(templateFile);
  }
  const directory = path.substring(0, path.lastIndexOf("/"));
  if (directory && !vault.getAbstractFileByPath(directory)) {
    try {
      await vault.createFolder(directory);
    } catch (error) {
      if (!vault.getAbstractFileByPath(directory)) throw error;
    }
  }
  try {
    return await vault.create(path, renderWeeklyTemplate(content, start, format, window.moment()));
  } catch (error) {
    // A second click or another plugin may have created the same note meanwhile.
    const created = vault.getAbstractFileByPath(path);
    if (created instanceof TFile) return created;
    throw error;
  }
}
