import moment from "moment";
import "moment/locale/ar";
import "moment/locale/fa";
import { dateKey, followCurrentMonth, isOverdue, timeKey } from "./dates";

afterEach(() => moment.locale("en"));

it.each(["en", "ar", "fa"])("uses machine date/time keys for %s without changing display locale", locale => {
  const now = moment("2026-10-25T12:00").locale(locale);
  expect(dateKey(now)).toBe("2026-10-25");
  expect(timeKey(now)).toBe("12:00");
  expect(now.locale()).toBe(locale);
  expect(isOverdue({ date: "2026-10-26", time: "09:00" }, now)).toBe(false);
  expect(isOverdue({ date: "2026-10-25", time: "11:59" }, now)).toBe(true);
  expect(isOverdue({ date: "2026-10-25", time: "12:00" }, now)).toBe(false);
  expect(isOverdue({ date: "2026-10-25", time: "" }, now)).toBe(false);
  expect(isOverdue({ date: "2026-10-24", time: "" }, now)).toBe(true);
});

it("follows the current month across midnight, leaving a browsed month in place", () => {
  const before = moment("2026-10-31T23:59");
  const after = moment("2026-11-01T00:00");
  const current = moment("2026-10-05");
  expect(followCurrentMonth(current, before, after).format("YYYY-MM")).toBe("2026-11");
  const browsed = moment("2026-08-15");
  expect(followCurrentMonth(browsed, before, after)).toBe(browsed);
  expect(current.format("YYYY-MM-DD")).toBe("2026-10-05");
});
