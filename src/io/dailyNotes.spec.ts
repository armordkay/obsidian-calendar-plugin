import moment from "moment";
import type { TFile } from "obsidian";
import { createDailyNote } from "./periodicNotes";
import { tryToCreateDailyNote } from "./dailyNotes";
import { createConfirmationDialog } from "src/ui/modal";
import type { ISettings } from "src/settings";

jest.mock("./periodicNotes", () => ({
  createDailyNote: jest.fn(),
  getDailyNoteSettings: () => ({ format: "YYYY-MM-DD" }),
}));
jest.mock("src/ui/modal", () => ({ createConfirmationDialog: jest.fn() }));

const create = createDailyNote as jest.Mock;
const confirm = createConfirmationDialog as jest.Mock;
const openFile = jest.fn().mockResolvedValue(undefined);
const date = moment("2026-10-25");
const settings = { shouldConfirmBeforeCreate: false } as ISettings;

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(window, { app: { workspace: { getUnpinnedLeaf: () => ({ openFile }) } } });
});

it("never opens a missing result when the upstream creator fails", async () => {
  create.mockResolvedValue(undefined);
  await expect(tryToCreateDailyNote(date, false, settings)).rejects.toThrow("returned no file");
  expect(openFile).not.toHaveBeenCalled();
});

it("waits for creation before opening the file and notifying the selection", async () => {
  let finish: (file: TFile) => void;
  create.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const callback = jest.fn();
  const pending = tryToCreateDailyNote(date, false, settings, callback);
  expect(openFile).not.toHaveBeenCalled();
  const file = { path: "Daily/2026-10-25.md" } as TFile;
  finish(file);
  await pending;
  expect(openFile).toHaveBeenCalledWith(file, { active: true });
  expect(callback).toHaveBeenCalledWith(file);
});

it("does not create a note until the confirmation is accepted", async () => {
  await tryToCreateDailyNote(date, false, { ...settings, shouldConfirmBeforeCreate: true });
  expect(create).not.toHaveBeenCalled();
  create.mockResolvedValue({ path: "Daily/2026-10-25.md" });
  await confirm.mock.calls[0][0].onAccept();
  expect(create).toHaveBeenCalledTimes(1);
});
