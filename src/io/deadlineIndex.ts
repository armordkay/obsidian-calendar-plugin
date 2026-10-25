import type { App, TFile } from "obsidian";
import { parseDeadline, sortDeadlines } from "src/ui/deadlines";
import type { Deadline } from "src/ui/deadlines";

interface IndexedFile {
  fingerprint: string;
  tasks: Deadline[];
}

/** Incremental per-file index. A bad file never hides deadlines from good files. */
export class DeadlineIndex {
  private files = new Map<string, IndexedFile>();
  private revisions = new Map<string, number>();
  private failures = new Set<string>();
  private disposed = false;

  constructor(private app: Pick<App, "vault" | "metadataCache">) {}

  get tasks(): Deadline[] {
    const tasks: Deadline[] = [];
    for (const file of this.files.values()) tasks.push(...file.tasks);
    return sortDeadlines(tasks);
  }

  get failedPaths(): string[] {
    return Array.from(this.failures).sort();
  }

  async update(file: TFile, force = false): Promise<void> {
    if (this.disposed || file.extension !== "md") return;
    const path = file.path;
    const metadata = this.app.metadataCache.getFileCache(file);
    // Obsidian may not have indexed a newly loaded file yet. Wait for changed/resolved.
    if (!metadata) return;
    const lines = (metadata.listItems || []).filter(item => item.task === " ")
      .map(item => item.position.start.line);
    const fingerprint = `${file.stat.mtime}:${file.stat.size}:${lines.join(",")}`;
    if (!force && this.files.get(path)?.fingerprint === fingerprint) return;
    const revision = (this.revisions.get(path) || 0) + 1;
    this.revisions.set(path, revision);
    try {
      const content = lines.length ? await this.app.vault.cachedRead(file) : "";
      if (this.disposed || this.revisions.get(path) !== revision) return;
      const text = content.split(/\r?\n/);
      const tasks = lines.map(line => parseDeadline(text[line] || "", path, line))
        .filter((task): task is Deadline => !!task);
      this.files.set(path, { fingerprint, tasks });
      this.failures.delete(path);
    } catch (error) {
      if (this.disposed || this.revisions.get(path) !== revision) return;
      this.files.delete(path);
      this.failures.add(path);
      console.error(`[Calendar Deadlines] Could not read ${path}`, error);
    }
  }

  remove(path: string): void {
    const known = new Set([...this.files.keys(), ...this.revisions.keys(), ...this.failures]);
    for (const key of known) {
      if (key === path || key.startsWith(`${path}/`)) {
        this.files.delete(key);
        this.failures.delete(key);
        // Invalidate in-flight reads too, including descendants of renamed folders.
        this.revisions.set(key, (this.revisions.get(key) || 0) + 1);
      }
    }
  }

  async reindex(force = false): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    const paths = new Set(files.map(file => file.path));
    for (const path of this.files.keys()) if (!paths.has(path)) this.remove(path);
    for (const path of this.failures) if (!paths.has(path)) this.remove(path);
    for (const file of files) {
      if (this.disposed) return;
      await this.update(file, force);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.files.clear();
    this.revisions.clear();
    this.failures.clear();
  }
}
