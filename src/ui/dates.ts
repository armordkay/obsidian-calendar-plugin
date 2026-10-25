import type { Moment } from "moment";

/** Machine keys must not use localized digits. Only display labels use locale. */
export function dateKey(date: Moment): string {
  return date.clone().locale("en").format("YYYY-MM-DD");
}

export function timeKey(date: Moment): string {
  return date.clone().locale("en").format("HH:mm");
}

export function isOverdue(task: { date: string; time: string }, now: Moment): boolean {
  const today = dateKey(now);
  return task.date < today ||
    (task.date === today && !!task.time && task.time < timeKey(now));
}

export function followCurrentMonth(displayed: Moment, previous: Moment, next: Moment): Moment {
  return displayed.isSame(previous, "month") && !previous.isSame(next, "month")
    ? next.clone() : displayed;
}
