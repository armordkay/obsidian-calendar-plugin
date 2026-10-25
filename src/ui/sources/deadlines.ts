import type { Moment } from "moment";
import type { ICalendarSource } from "obsidian-calendar-ui";
import type { Deadline } from "../deadlines";
import { dateKey, isOverdue } from "../dates";

/** A day is overdue if any of its remaining deadlines has expired. */
export function createDeadlineSource(tasks: Deadline[], now: Moment): ICalendarSource {
  const dates = new Set(tasks.map(task => task.date));
  const overdueDates = new Set(tasks.filter(task => isOverdue(task, now)).map(task => task.date));
  return {
    getDailyMetadata: async date => {
      const key = dateKey(date);
      return {
        classes: [
          ...(dates.has(key) ? ["has-deadline"] : []),
          ...(overdueDates.has(key) ? ["has-overdue-deadline"] : []),
        ],
        dots: dates.has(key)
          ? [{ className: "deadline-dot", color: "default", isFilled: true }] : [],
      };
    },
  };
}
