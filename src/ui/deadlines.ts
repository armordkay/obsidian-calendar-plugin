export interface Deadline {
  path: string;
  line: number;
  text: string;
  date: string;
  time: string;
}

function validDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function validTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

function parseStamp(value: string): { date: string; time: string } | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\S+))?$/);
  if (!match || !validDate(match[1]) || (match[2] && !validTime(match[2]))) return null;
  return { date: match[1], time: match[2] || "" };
}

/** Parse one cached task. Invalid explicit dates/times are never changed to all-day. */
export function parseDeadline(text: string, path: string, line: number): Deadline | null {
  const task = text.match(/^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[ \]\s+(.*)$/);
  if (!task) return null;
  const body = task[1];
  const due = body.match(/\[due::\s*([^\]]*)\]/i) ||
    body.match(/📅\s*(\d{4}-\d{2}-\d{2}(?:T[^\s]+| +\d{1,2}:[^\s]+)?)(?![\dT])/);
  const reminder = body.match(/\(@([^)]*)\)/) ||
    body.match(/⏰\s*(\d{4}-\d{2}-\d{2}(?:T[^\s]+| +\d{1,2}:[^\s]+)?)(?![\dT])/);
  const stamp = due || reminder;
  if (!stamp) return null;
  const parsed = parseStamp(stamp[1]);
  const reminderStamp = reminder && parseStamp(reminder[1]);
  if (!parsed || (reminder && !reminderStamp)) return null;

  const inline = body.match(/\[time::\s*([^\]]*)\]/i);
  const leading = body.match(/^(\d{1,2}:\S+)(?:\s+|$)/);
  if ((inline && !validTime(inline[1].trim())) || (leading && !validTime(leading[1]))) return null;
  const time = parsed.time ||
    (reminderStamp?.date === parsed.date ? reminderStamp.time : "") ||
    inline?.[1].trim() || leading?.[1] || "";
  let title = body;
  for (const field of [due, reminder, inline, leading]) {
    if (field) title = title.replace(field[0], "");
  }
  return { path, line, date: parsed.date, time, text: title.trim() || "Untitled task" };
}

export function sortDeadlines(tasks: Deadline[]): Deadline[] {
  return tasks.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.time || "24:00").localeCompare(b.time || "24:00") ||
    a.path.localeCompare(b.path) || a.line - b.line
  );
}

/** Keep every date in the timeline, including dates outside the visible month. */
export function groupDeadlines(tasks: Deadline[]): { date: string; tasks: Deadline[] }[] {
  const groups = new Map<string, Deadline[]>();
  for (const task of sortDeadlines([...tasks])) {
    const group = groups.get(task.date) || [];
    group.push(task);
    groups.set(task.date, group);
  }
  return Array.from(groups, ([date, tasks]) => ({ date, tasks }));
}
