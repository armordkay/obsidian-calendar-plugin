<script lang="ts">
  import type { Moment } from "moment";
  import { onMount, tick } from "svelte";
  import { Notice, TFile } from "obsidian";
  import { groupDeadlines, parseDeadline, sortDeadlines } from "./deadlines";
  import type { Deadline } from "./deadlines";

  export let selectedDate: Moment;
  export let today: Moment;
  export let tasks: Deadline[] = [];
  export let onSelectDate: (date: Moment) => void;
  let timelineEl: HTMLDivElement;
  let lastScrolledDate = "";
  let loading = true;
  let failed = false;

  $: dateKey = selectedDate.format("YYYY-MM-DD");
  $: groups = groupDeadlines(tasks);
  $: if (timelineEl && groups.length) scrollToDate(dateKey);

  async function scrollToDate(date: string) {
    if (lastScrolledDate === date) return;
    lastScrolledDate = date;
    await tick();
    if (!timelineEl || lastScrolledDate !== date) return;
    const days = Array.from(timelineEl.querySelectorAll<HTMLElement>("[data-deadline-date]"));
    // With no deadlines on the selected day, reveal the next available day.
    const target = days.find(day => day.dataset.deadlineDate >= date) || days[days.length - 1];
    if (target) {
      timelineEl.scrollTop += target.getBoundingClientRect().top - timelineEl.getBoundingClientRect().top;
    }
  }

  function jumpToToday() {
    lastScrolledDate = "";
    onSelectDate(today.clone());
    scrollToDate(today.format("YYYY-MM-DD"));
  }

  async function openTask(task: Deadline) {
    const { vault, workspace } = window.app;
    const file = vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) return;
    onSelectDate(window.moment(task.date, "YYYY-MM-DD", true));
    try {
      await workspace.getUnpinnedLeaf().openFile(file, {
        active: true,
        eState: { line: task.line },
      });
      onSelectDate(window.moment(task.date, "YYYY-MM-DD", true));
    } catch (error) {
      new Notice("Could not open deadline note.");
      console.error("[Calendar] Could not open deadline", error);
    }
  }

  onMount(() => {
    const { vault, metadataCache } = window.app;
    let disposed = false;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout>;
    // Reuse unchanged file results when the metadata cache updates.
    const cache = new Map<string, { content: string; tasks: Deadline[] }>();

    async function refresh() {
      const current = ++revision;
      try {
        const result: Deadline[] = [];
        const paths = new Set<string>();
        for (const file of vault.getMarkdownFiles()) {
          if (disposed || current !== revision) return;
          paths.add(file.path);
          const items = metadataCache.getFileCache(file)?.listItems || [];
          const pending = items.filter(item => item.task === " ");
          if (!pending.length) {
            cache.delete(file.path);
            continue;
          }
          const content = await vault.cachedRead(file);
          const previous = cache.get(file.path);
          if (previous?.content === content) {
            result.push(...previous.tasks);
            continue;
          }
          const lines = content.split(/\r?\n/);
          const parsed = pending.map(item => parseDeadline(
            lines[item.position.start.line] || "", file.path, item.position.start.line
          )).filter((task): task is Deadline => !!task);
          cache.set(file.path, { content, tasks: parsed });
          result.push(...parsed);
        }
        if (!disposed && current === revision) {
          for (const path of cache.keys()) if (!paths.has(path)) cache.delete(path);
          tasks = sortDeadlines(result);
          failed = false;
        }
      } catch (error) {
        if (!disposed && current === revision) failed = true;
        console.error("[Calendar] Failed to load deadlines", error);
      } finally {
        if (!disposed && current === revision) loading = false;
      }
    }

    function schedule() {
      revision++;
      clearTimeout(timer);
      timer = setTimeout(refresh, 200);
    }
    const events = [
      { emitter: metadataCache, ref: metadataCache.on("changed", schedule) },
      { emitter: metadataCache, ref: metadataCache.on("resolved", schedule) },
      { emitter: vault, ref: vault.on("delete", schedule) },
      { emitter: vault, ref: vault.on("rename", schedule) },
    ];
    refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
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
  {#if failed}
    <p role="status">Could not load deadlines. Edit a note to retry.</p>
  {:else if loading}
    <p role="status">Loading deadlines…</p>
  {:else if !tasks.length}
    <p class="deadline-empty">No deadlines.</p>
  {:else}
    <div class="deadline-scroll" bind:this={timelineEl} tabindex="0" role="region" aria-label="Deadline timeline for all dates">
      <div class="deadline-timeline">
        {#each groups as group (group.date)}
          <div class="deadline-group" class:selected={group.date === dateKey} data-deadline-date={group.date}>
            <button class="deadline-date" aria-current={group.date === dateKey ? "date" : undefined}
              on:click={() => onSelectDate(window.moment(group.date, "YYYY-MM-DD", true))}>
              {window.moment(group.date, "YYYY-MM-DD", true).format("ddd, DD MMM YYYY")}
            </button>
            <ul>
              {#each group.tasks as task (`${task.path}:${task.line}`)}
                <li class:overdue={task.date < today.format("YYYY-MM-DD") ||
                  (task.date === today.format("YYYY-MM-DD") && task.time && task.time < today.format("HH:mm"))}>
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
