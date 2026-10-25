import { groupDeadlines, parseDeadline, sortDeadlines } from "./deadlines";

describe("deadline task parsing", () => {
  const parse = (text: string) => parseDeadline(text, "Projects/work.md", 7);

  it("reads Tasks dates with reminder times and keeps the source location", () => {
    expect(parse("- [ ] Submit report 📅 2026-10-23 ⏰ 2026-10-23 14:30"))
      .toEqual({ path: "Projects/work.md", line: 7, text: "Submit report", date: "2026-10-23", time: "14:30" });
  });

  it("reads Dataview due timestamps", () => {
    expect(parse("- [ ] Report [due:: 2026-10-23T09:15]"))
      .toMatchObject({ text: "Report", date: "2026-10-23", time: "09:15" });
  });

  it("reads separate inline time fields", () => {
    expect(parse("- [ ] Report [due:: 2026-10-23] [time:: 08:00]"))
      .toMatchObject({ text: "Report", time: "08:00" });
  });

  it("reads reminder-only tasks and leading times", () => {
    expect(parse("  1. [ ] Meeting (@2026-10-23 10:00)"))
      .toMatchObject({ text: "Meeting", date: "2026-10-23", time: "10:00" });
    expect(parse("> - [ ] 09:00 Meeting 📅 2026-10-23"))
      .toMatchObject({ text: "Meeting", time: "09:00" });
  });

  it("keeps dates without a time as all-day tasks", () => {
    expect(parse("- [ ] Report 📅 2026-10-23"))
      .toMatchObject({ date: "2026-10-23", time: "" });
  });

  it("does not assign a different day's reminder time to a deadline", () => {
    expect(parse("- [ ] Report 📅 2026-10-23 ⏰ 2026-10-22 10:00"))
      .toMatchObject({ date: "2026-10-23", time: "" });
  });

  it.each([
    "- [x] Done 📅 2026-10-23", "- [-] Cancelled 📅 2026-10-23",
    "- Report 📅 2026-10-23", "- [ ] No deadline",
    "- [ ] Invalid 📅 2026-02-30", "- [ ] Invalid [due:: 2026-13-01]",
    "- [ ] Invalid 📅 2026-10-25 25:99", "- [ ] Invalid [due:: 2026-10-25T25:99]",
    "- [ ] Invalid 📅 2026-10-25 [time:: 09:75]",
    "- [ ] 29:00 Task 📅 2026-10-25",
    "- [ ] Invalid ⏰ 2026-10-25 14:99",
    "- [ ] Invalid 📅 2026-10-250",
    "- [ ] Invalid [due:: 2026-10-25T14:30Z]",
  ])("ignores completed, cancelled, non-task or invalid entries: %s", text => {
    expect(parse(text)).toBeNull();
  });

  it("sorts chronologically, placing all-day tasks after timed ones", () => {
    const tasks = [
      parse("- [ ] All day 📅 2026-10-23"),
      parse("- [ ] Later 📅 2026-10-24"),
      parse("- [ ] Afternoon 📅 2026-10-23 14:00"),
      parse("- [ ] Morning 📅 2026-10-23 09:00"),
    ];
    expect(sortDeadlines(tasks).map(task => task.text))
      .toEqual(["Morning", "Afternoon", "All day", "Later"]);
  });

  it("groups all dates across months and years without filtering or changing the input", () => {
    const tasks = [
      parse("- [ ] Next year 📅 2027-01-02"),
      parse("- [ ] Afternoon 📅 2026-10-23 14:00"),
      parse("- [ ] Earlier 📅 2025-09-10"),
      parse("- [ ] Morning 📅 2026-10-23 09:00"),
    ];
    const groups = groupDeadlines(tasks);
    expect(groups.map(group => group.date)).toEqual(["2025-09-10", "2026-10-23", "2027-01-02"]);
    expect(groups[1].tasks.map(task => task.text)).toEqual(["Morning", "Afternoon"]);
    expect(tasks[0].text).toBe("Next year");
    expect(groupDeadlines([])).toEqual([]);
  });
});
