<svelte:options immutable />

<script lang="ts">
  import type { Moment } from "moment";
  import { Calendar as CalendarBase } from "obsidian-calendar-ui";
  import type { ICalendarSource } from "obsidian-calendar-ui";
  import { onDestroy } from "svelte";
  import { getDateUID } from "obsidian-daily-notes-interface";

  import type { ISettings } from "src/settings";
  import { dailyNotes, settings, weeklyNotes } from "./stores";
  import Deadlines from "./Deadlines.svelte";
  import type { Deadline } from "./deadlines";
  import { followCurrentMonth } from "./dates";
  import { configureCalendarLocale } from "./locale";
  import { createDeadlineSource } from "./sources/deadlines";

  let today: Moment;

  $: today = getToday($settings);

  export let displayedMonth: Moment = today;
  export let selectedDate: Moment = window.moment();
  export let selectedWeek: Moment = null;
  let deadlineTasks: Deadline[] = [];
  let calendarSources: ICalendarSource[];
  export let sources: ICalendarSource[];
  export let onHoverDay: (date: Moment, targetEl: EventTarget) => boolean;
  export let onHoverWeek: (date: Moment, targetEl: EventTarget) => boolean;
  export let onClickDay: (date: Moment, isMetaPressed: boolean) => boolean;
  export let onClickWeek: (date: Moment, isMetaPressed: boolean) => boolean;
  export let onContextMenuDay: (date: Moment, event: MouseEvent) => boolean;
  export let onContextMenuWeek: (date: Moment, event: MouseEvent) => boolean;

  // Expiry changes with the clock even when task files do not change.
  $: calendarSources = [...sources, createDeadlineSource(deadlineTasks, today)];

  function selectDate(date: Moment) {
    selectedWeek = null;
    selectedDate = date.clone();
    displayedMonth = date.clone();
  }

  function clickDay(date: Moment, isMetaPressed: boolean) {
    selectDate(date);
    return onClickDay(date, isMetaPressed);
  }

  function clickWeek(date: Moment, isMetaPressed: boolean) {
    selectDate(date);
    selectedWeek = date.clone();
    return onClickWeek(date, isMetaPressed);
  }

  export function tick() {
    const next = window.moment();
    displayedMonth = followCurrentMonth(displayedMonth, today, next);
    today = next;
  }

  function getToday(settings: ISettings) {
    configureCalendarLocale(settings.localeOverride, settings.weekStart);
    dailyNotes.reindex();
    weeklyNotes.reindex();
    return window.moment();
  }

  // 1 minute heartbeat to keep `today` reflecting the current day
  const heartbeat = setInterval(tick, 1000 * 60);

  onDestroy(() => {
    clearInterval(heartbeat);
  });
</script>

<div class="calendar-deadlines-root">
<CalendarBase
  sources={calendarSources}
  {today}
  {onHoverDay}
  {onHoverWeek}
  {onContextMenuDay}
  {onContextMenuWeek}
  onClickDay={clickDay}
  onClickWeek={clickWeek}
  bind:displayedMonth
  localeData={today.localeData()}
  selectedId={getDateUID(selectedWeek || selectedDate, selectedWeek ? "week" : "day")}
  showWeekNums={$settings.showWeeklyNote}
/>

<Deadlines {selectedDate} {today} bind:tasks={deadlineTasks} onSelectDate={selectDate} />
</div>
