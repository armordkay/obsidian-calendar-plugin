import type { TFile } from "obsidian";
import { getNumberOfRemainingTasks } from "./tasks";

jest.mock("src/io/periodicNotes", () => ({}));
jest.mock("../stores", () => ({}));

it("counts parsed Markdown tasks, including numbered/plus items, excluding code examples", async () => {
  // The metadata cache already excludes fenced code and identifies every list marker.
  const getFileCache = jest.fn(() => ({ listItems: [
    { task: " " }, { task: " " }, { task: "x" }, { task: "-" }, {},
  ] }));
  const cachedRead = jest.fn();
  Object.assign(window, { app: { metadataCache: { getFileCache }, vault: { cachedRead } } });
  expect(await getNumberOfRemainingTasks({ path: "tasks.md" } as TFile)).toBe(2);
  expect(cachedRead).not.toHaveBeenCalled();
  expect(await getNumberOfRemainingTasks(null)).toBe(0);
});
