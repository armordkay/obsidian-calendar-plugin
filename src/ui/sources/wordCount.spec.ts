import type { TFile } from "obsidian";
import { getDotsForDailyNote } from "./wordCount";
import { settings } from "../stores";

jest.mock("src/io/periodicNotes", () => ({}));
jest.mock("../utils", () => ({
  clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
  getWordCount: (value: string) => value.split(/\s+/).filter(Boolean).length,
}));
jest.mock("../stores", () => {
  const { writable } = jest.requireActual<typeof import("svelte/store")>("svelte/store");
  return { settings: writable({ wordsPerDot: 250 }) };
});

afterEach(() => jest.restoreAllMocks());

it("keeps day metadata available if a note is deleted or unreadable during rendering", async () => {
  const cachedRead = jest.fn().mockRejectedValueOnce(new Error("File deleted"))
    .mockResolvedValue("Recovered note");
  Object.assign(window, { app: { vault: { cachedRead } } });
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  const file = { path: "daily.md" } as TFile;
  expect(await getDotsForDailyNote(file)).toEqual([]);
  expect(await getDotsForDailyNote(file)).toHaveLength(1);
});

it("does not read notes when word dots are disabled", async () => {
  const cachedRead = jest.fn();
  Object.assign(window, { app: { vault: { cachedRead } } });
  settings.update(value => ({ ...value, wordsPerDot: 0 }));
  expect(await getDotsForDailyNote({ path: "daily.md" } as TFile)).toEqual([]);
  expect(cachedRead).not.toHaveBeenCalled();
  settings.update(value => ({ ...value, wordsPerDot: 250 }));
});
