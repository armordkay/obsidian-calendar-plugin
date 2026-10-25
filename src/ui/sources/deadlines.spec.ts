import moment from "moment";
import "moment/locale/ar";
import { createDeadlineSource } from "./deadlines";
import type { Deadline } from "../deadlines";

const task = (date: string, time = ""): Deadline => ({ date, time, path: "tasks.md", line: 0, text: "Task" });

afterEach(() => moment.locale("en"));

it("marks a date overdue when any remaining task on it is late", async () => {
  const now = moment("2026-10-25T12:00");
  const source = createDeadlineSource([task("2026-10-24"), task("2026-10-25", "09:00"), task("2026-10-25", "15:00"), task("2026-10-26")], now);
  expect((await source.getDailyMetadata(moment("2026-10-24"))).classes)
    .toEqual(["has-deadline", "has-overdue-deadline"]);
  expect((await source.getDailyMetadata(moment("2026-10-25"))).classes)
    .toEqual(["has-deadline", "has-overdue-deadline"]);
  expect((await source.getDailyMetadata(moment("2026-10-26"))).classes).toEqual(["has-deadline"]);
  expect((await source.getDailyMetadata(moment("2026-10-27"))).classes).toEqual([]);
});

it("changes at the next minute and returns to ordinary deadline styling when the late task is completed", async () => {
  const date = moment("2026-10-25");
  const tasks = [task("2026-10-25", "09:00"), task("2026-10-25", "15:00")];
  expect((await createDeadlineSource(tasks, moment("2026-10-25T09:00")).getDailyMetadata(date)).classes)
    .toEqual(["has-deadline"]);
  expect((await createDeadlineSource(tasks, moment("2026-10-25T09:01")).getDailyMetadata(date)).classes)
    .toContain("has-overdue-deadline");
  expect((await createDeadlineSource(tasks.slice(1), moment("2026-10-25T09:01")).getDailyMetadata(date)).classes)
    .toEqual(["has-deadline"]);
});

it("keeps all-day tasks current until midnight and handles localized date labels", async () => {
  const tasks = [task("2026-10-25")];
  const date = moment("2026-10-25").locale("ar");
  expect((await createDeadlineSource(tasks, moment("2026-10-25T23:59").locale("ar")).getDailyMetadata(date)).classes)
    .toEqual(["has-deadline"]);
  expect((await createDeadlineSource(tasks, moment("2026-10-26T00:00").locale("ar")).getDailyMetadata(date)).classes)
    .toContain("has-overdue-deadline");
});
