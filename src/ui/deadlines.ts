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

/** Parse one cached Markdown task, without evaluating Dataview expressions. */
export function parseDeadline(text: string, path: string, line: number): Deadline | null {
  const task = text.match(/^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[ \]\s+(.*)$/);
  if (!task) return null;

  const body = task[1];
  const due = body.match(/(?:📅\s*|\[due::\s*)(\d{4}-\d{2}-\d{2})(?:[ T]([01]\d|2[0-3]):([0-5]\d))?/i);
  const reminder = body.match(/(?:⏰\s*|\(@)(\d{4}-\d{2}-\d{2})(?:[ T]([01]\d|2[0-3]):([0-5]\d))?/);
  const match = due || reminder;
  if (!match || !validDate(match[1])) return null;

  const leadingTime = body.match(/^([01]\d|2[0-3]):([0-5]\d)\b/);
  const inlineTime = body.match(/\[time::\s*([01]\d|2[0-3]):([0-5]\d)\s*\]/i);
  const timeMatch = match[2] ? match :
    reminder && reminder[1] === match[1] && reminder[2] ? reminder : null;
  const time = timeMatch ? `${timeMatch[2]}:${timeMatch[3]}` :
    inlineTime ? `${inlineTime[1]}:${inlineTime[2]}` :
    leadingTime ? `${leadingTime[1]}:${leadingTime[2]}` : "";

  const title = body
    .replace(/\[(?:due|time)::[^\]]*\]/gi, "")
    .replace(/(?:📅|⏰)\s*\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?/g, "")
    .replace(/\(@\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?\)/g, "")
    .replace(/^\d{2}:\d{2}\s*/, "")
    .trim();
  return { path, line, date: match[1], time, text: title || "Untitled task" };
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
