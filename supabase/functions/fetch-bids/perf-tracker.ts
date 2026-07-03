// perf-tracker.ts — 소스별 성능 측정 인프라

interface PerfEntry {
  label: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
  itemCount: number;
  errors: string[];
}

export class PerfTracker {
  private entries = new Map<string, PerfEntry>();
  private globalStart = performance.now();

  start(label: string): void {
    this.entries.set(label, {
      label,
      startMs: performance.now(),
      itemCount: 0,
      errors: [],
    });
  }

  end(label: string, itemCount?: number): void {
    const entry = this.entries.get(label);
    if (!entry) return;
    entry.endMs = performance.now();
    entry.durationMs = Math.round(entry.endMs - entry.startMs);
    if (itemCount !== undefined) entry.itemCount = itemCount;
  }

  error(label: string, msg: string): void {
    const entry = this.entries.get(label);
    if (entry) {
      entry.errors.push(msg);
      if (!entry.endMs) {
        entry.endMs = performance.now();
        entry.durationMs = Math.round(entry.endMs - entry.startMs);
      }
    }
  }

  report(): {
    totalDurationMs: number;
    sources: Record<string, { durationMs: number; items: number; errors: string[] }>;
    memoryMB: number;
  } {
    const sources: Record<string, { durationMs: number; items: number; errors: string[] }> = {};

    for (const [key, entry] of this.entries) {
      sources[key] = {
        durationMs: entry.durationMs ?? 0,
        items: entry.itemCount,
        errors: entry.errors,
      };
    }

    // Deno memory info (best-effort)
    let memoryMB = 0;
    try {
      const mem = (Deno as any).memoryUsage?.();
      if (mem?.heapUsed) memoryMB = Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10;
    } catch {
      // not available in all environments
    }

    return {
      totalDurationMs: Math.round(performance.now() - this.globalStart),
      sources,
      memoryMB,
    };
  }
}
