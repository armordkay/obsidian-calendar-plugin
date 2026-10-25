<script lang="ts">
  import type { Moment } from "moment";
  import { onMount, tick } from "svelte";
  import { Notice, TFile } from "obsidian";
  import { groupDeadlines } from "./deadlines";
  import { DeadlineIndex } from "src/io/deadlineIndex";
  import { dateKey as getDateKey, isOverdue } from "./dates";
  import { getScrollContainer, scrollTimelineControl } from "./scroll";
  import type { Deadline } from "./deadlines";

  export let selectedDate: Moment;
  export let today: Moment;
  export let tasks: Deadline[] = [];
  export let onSelectDate: (date: Moment) => void;
  let timelineEl: HTMLDivElement;
  let lastScrolledDate = "";
  let loading = true;
  let failedPaths: string[] = [];
  let retry = () => {};

  $: dateKey = getDateKey(selectedDate);
  $: groups = groupDeadlines(tasks);
  $: if (timelineEl && groups.length) scrollToDate(dateKey);

  async function scrollToDate(date: string, force = false) {
    if (!force && lastScrolledDate === date) return;
    const initial = !lastScrolledDate;
    lastScrolledDate = date;
    // Opening the panel should leave the calendar visible above the timeline.
    if (initial && !force) return;
    await tick();
    if (!timelineEl || lastScrolledDate !== date) return;
    const days = Array.from(timelineEl.querySelectorAll<HTMLElement>("[data-deadline-date]"));
    // With no deadlines on the selected day, reveal the next available day.
    const target = days.find(day => day.dataset.deadlineDate >= date) || days[days.length - 1];
    const panel = getScrollContainer(timelineEl.parentElement);
    if (target && panel) {
      panel.scrollTop += target.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientTop;
    }
  }

  function jumpToToday() {
    onSelectDate(today.clone());
    scrollToDate(getDateKey(today), true);
  }

  async function openTask(task: Deadline) {
    const { vault, workspace } = window.app;
    const file = vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) {
      new Notice("This deadline note no longer exists. The list will update after indexing.");
      return;
    }
    onSelectDate(window.moment(task.date, "YYYY-MM-DD", "en", true).locale(today.locale()));
    try {
      await workspace.getLeaf(false).openFile(file, {
        active: true,
        eState: { line: task.line },
      });
      onSelectDate(window.moment(task.date, "YYYY-MM-DD", "en", true).locale(today.locale()));
    } catch (error) {
      new Notice("Could not open deadline note.");
      console.error("[Calendar Deadlines] Could not open deadline", error);
    }
  }

  onMount(() => {
    const { vault, metadataCache } = window.app;
    const index = new DeadlineIndex(window.app);
    const pending = new Map<string, TFile>();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;

    function publish() {
      if (disposed) return;
      tasks = index.tasks;
      failedPaths = index.failedPaths;
      loading = false;
    }

    async function rescan(force = false) {
      await index.reindex(force);
      publish();
    }

    async function flush() {
      const batch = Array.from(pending.values());
      pending.clear();
      for (const file of batch) {
        if (disposed) return;
        await index.update(file, true);
      }
      publish();
    }

    function changed(file: TFile) {
      if (file.extension !== "md") return;
      pending.set(file.path, file);
      clearTimeout(timer);
      timer = setTimeout(flush, 200);
    }

    function remove(path: string) {
      for (const key of pending.keys()) {
        if (key === path || key.startsWith(`${path}/`)) pending.delete(key);
      }
      index.remove(path);
      publish();
    }

    retry = () => { void rescan(true); };
    const events = [
      { emitter: metadataCache, ref: metadataCache.on("changed", changed) },
      // On startup, files may not have metadata yet. Fingerprints skip unchanged reads.
      { emitter: metadataCache, ref: metadataCache.on("resolved", () => { void rescan(); }) },
      { emitter: vault, ref: vault.on("delete", file => remove(file.path)) },
      { emitter: vault, ref: vault.on("rename", (file, oldPath) => {
        remove(oldPath);
        if (file instanceof TFile) changed(file);
        else void rescan();
      }) },
    ];
    void rescan();
    return () => {
      disposed = true;
      clearTimeout(timer);
      pending.clear();
      index.dispose();
      events.forEach(({ emitter, ref }) => emitter.offref(ref));
    };
  });
</script>

<section class="calendar-deadlines" aria-label="Deadlines">
  <div class="deadline-header">
    <h4>Deadlines <span>{tasks.length}</span></h4>
    <button on:click={jumpToToday}>Today</button>
  </div>
  <p class="deadline-period">All dates · {selectedDate.format("ddd, DD MMM YYYY")}</p>
  {#if failedPaths.length}
    <p role="status" title={failedPaths.join("\n")}>
      Could not read {failedPaths.length} note(s).
      <button on:click={retry}>Retry</button>
    </p>
  {/if}
  {#if loading}
    <p role="status">Loading deadlines…</p>
  {:else if !tasks.length}
    <p class="deadline-empty">No deadlines.</p>
  {:else}
    <div class="deadline-scroll" bind:this={timelineEl} on:wheel|capture|nonpassive={scrollTimelineControl}
      tabindex="0" role="region" aria-label="Deadline timeline for all dates">
      <div class="deadline-timeline">
        {#each groups as group (group.date)}
          <div class="deadline-group" class:selected={group.date === dateKey} data-deadline-date={group.date}>
            <button class="deadline-date" aria-current={group.date === dateKey ? "date" : undefined}
              on:click={() => onSelectDate(window.moment(group.date, "YYYY-MM-DD", "en", true).locale(today.locale()))}>
              {window.moment(group.date, "YYYY-MM-DD", "en", true).locale(today.locale()).format("ddd, DD MMM YYYY")}
            </button>
            <ul>
              {#each group.tasks as task (`${task.path}:${task.line}`)}
                <li class:overdue={isOverdue(task, today)}>
                  <button class="deadline-marker" aria-label={`Open ${task.text}`} on:click={() => openTask(task)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M3 11h18M8 3v4M16 3v4" />
                    </svg>
                  </button>
                  <button class="deadline-task" on:click={() => openTask(task)} title={`${task.path}:${task.line + 1}`}>
                    <span class="deadline-time">{task.time || "All day"}</span>
                    <span class="deadline-title">{task.text}</span>
                    <small>{task.path.replace(/\.md$/, "")}</small>
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>
