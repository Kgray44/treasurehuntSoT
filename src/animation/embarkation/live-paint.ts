/** A presentation cache, not application state. Every capture freezes current
 * canonical content synchronously; only resource decode is asynchronous. A
 * superseded capture can never replace newer content. Rendering reads `current`
 * and never starts capture, encoding or DOM traversal in the animation loop. */
export class LivePaint<T extends { dispose(): void }> {
  current: T | null = null;
  revision = 0;
  paintedRevision = -1;
  captures = 0;
  discarded = 0;
  failure: unknown = null;
  private running: Promise<void> | null = null;
  private queued = false;
  private disposed = false;
  constructor(
    private capture: (revision: number) => Promise<T>,
    private published: (error: unknown | null) => void = () => {},
  ) {}
  invalidate() {
    if (this.disposed) return;
    this.revision++;
    this.failure = null;
    // Coalesce synchronous React mutations without sampling a half-committed
    // subtree. flush() also provides an explicit readiness barrier before JOIN.
    if (!this.queued) {
      this.queued = true;
      queueMicrotask(() => {
        this.queued = false;
        void this.flush();
      });
    }
  }
  flush(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async drain() {
    while (!this.disposed && this.paintedRevision !== this.revision) {
      const requested = this.revision;
      try {
        this.captures++;
        const next = await this.capture(requested);
        if (this.disposed || requested !== this.revision) {
          next.dispose();
          this.discarded++;
          continue;
        }
        const previous = this.current;
        this.current = next;
        this.paintedRevision = requested;
        previous?.dispose();
        this.published(null);
      } catch (error) {
        // A failed obsolete decode does not poison a newer valid update.
        if (requested !== this.revision) continue;
        this.failure = error;
        if (!this.disposed) this.published(error);
        break;
      }
    }
  }
  get ready() {
    return !this.disposed && this.current !== null && this.paintedRevision === this.revision;
  }
  dispose() {
    this.disposed = true;
    this.current?.dispose();
    this.current = null;
  }
}
