import type { App, TFile } from "obsidian";
import { DeadlineIndex } from "./deadlineIndex";

function setup() {
  const files: TFile[] = [];
  const contents = new Map<string, string>();
  const read = jest.fn(async (file: TFile) => contents.get(file.path) || "");
  const metadata = jest.fn(() => ({ listItems: [{ task: " ", position: { start: { line: 0 } } }] }));
  const app = {
    vault: { getMarkdownFiles: () => files, cachedRead: read },
    metadataCache: { getFileCache: metadata },
  } as unknown as Pick<App, "vault" | "metadataCache">;
  const index = new DeadlineIndex(app);
  function add(path: string, content = "- [ ] Task 📅 2026-10-25") {
    const file = { path, extension: "md", stat: { mtime: 1, size: content.length } } as TFile;
    files.push(file);
    contents.set(path, content);
    return file;
  }
  return { files, contents, read, metadata, index, add };
}

afterEach(() => jest.restoreAllMocks());

it("reads unchanged files once and updates only the changed note", async () => {
  const { index, read, add, contents } = setup();
  const first = add("first.md");
  add("second.md");
  await index.reindex();
  expect(read).toHaveBeenCalledTimes(2);
  await index.reindex();
  expect(read).toHaveBeenCalledTimes(2);
  contents.set(first.path, "- [ ] Changed 📅 2026-10-26");
  await index.update(first, true);
  expect(read).toHaveBeenCalledTimes(3);
  expect(index.tasks.map(task => task.date)).toEqual(["2026-10-25", "2026-10-26"]);
});

it("does not read files without pending tasks", async () => {
  const { index, read, add, metadata } = setup();
  add("no-tasks.md");
  metadata.mockReturnValue({ listItems: [] });
  await index.reindex();
  expect(read).not.toHaveBeenCalled();
  expect(index.tasks).toEqual([]);
});

it("retains good deadlines when another file fails, then clears the failure on retry", async () => {
  const { index, read, add } = setup();
  add("broken.md");
  add("good.md");
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  read.mockRejectedValueOnce(new Error("unreadable"));
  await index.reindex();
  expect(index.failedPaths).toEqual(["broken.md"]);
  expect(index.tasks.map(task => task.path)).toEqual(["good.md"]);
  await index.reindex();
  expect(index.failedPaths).toEqual([]);
  expect(index.tasks).toHaveLength(2);
});

it("removes renamed/deleted folders and does not resurrect an in-flight result", async () => {
  const { index, read, add } = setup();
  const file = add("old/note.md");
  let finish: (text: string) => void;
  read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = index.update(file);
  index.remove("old");
  finish("- [ ] Stale task 📅 2026-10-25");
  await pending;
  expect(index.tasks).toEqual([]);
  const renamed = add("new/note.md");
  await index.update(renamed);
  expect(index.tasks.map(task => task.path)).toEqual(["new/note.md"]);
});

it("keeps the newest task when file reads finish out of order", async () => {
  const { index, read, add } = setup();
  const file = add("note.md");
  let finish: (text: string) => void;
  read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const old = index.update(file);
  read.mockResolvedValueOnce("- [ ] New 📅 2026-10-26");
  await index.update(file, true);
  finish("- [ ] Old 📅 2026-10-25");
  await old;
  expect(index.tasks[0].text).toBe("New");
});

it("ignores results after the view has been disposed", async () => {
  const { index, read, add } = setup();
  const file = add("note.md");
  let finish: (text: string) => void;
  read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = index.update(file);
  index.dispose();
  finish("- [ ] Task 📅 2026-10-25");
  await pending;
  expect(index.tasks).toEqual([]);
});
