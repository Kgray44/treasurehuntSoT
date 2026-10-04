/** Lab transport recovery requires an observed native suspension, never a failed product operation. */
export class DeviceLabLifecycleControlPoll {
  private foreground = true;
  private backgroundEpoch = 0;
  private acknowledgedEpoch = 0;
  constructor(
    private readonly clock = () => Date.now(),
    private readonly delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {}
  private async awaitForeground() {
    // A real geofence input step intentionally keeps the app backgrounded for
    // six minutes. Its suspension window is distinct from network recovery.
    const suspensionDeadline = this.clock() + 600000;
    while (!this.foreground && this.clock() < suspensionDeadline) await this.delay(50);
    if (!this.foreground) throw new Error("NATIVE_CONTROL_FOREGROUND_UNOBSERVED");
  }
  lifecycle(state: "FOREGROUND" | "BACKGROUND") {
    this.foreground = state === "FOREGROUND";
    if (state === "BACKGROUND") this.backgroundEpoch++;
  }
  async next<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
    await this.awaitForeground();
    let deadline: number | null = null;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timeout = new Error("NATIVE_CONTROL_REQUEST_TIMEOUT");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          request(controller.signal),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => {
                controller.abort();
                reject(timeout);
              },
              deadline === null ? 15000 : Math.max(1, deadline - this.clock()),
            );
          }),
        ]);
        if (deadline !== null && this.clock() >= deadline) throw new Error("NATIVE_CONTROL_RESUME_TIMEOUT");
        if (this.foreground) this.acknowledgedEpoch = this.backgroundEpoch;
        return result;
      } catch (error) {
        clearTimeout(timer);
        if (
          (!(error instanceof TypeError) && error !== timeout && !controller.signal.aborted) ||
          this.backgroundEpoch <= this.acknowledgedEpoch
        )
          throw error;
        if (attempt >= 3) throw new Error("NATIVE_CONTROL_RESUME_RETRY_EXHAUSTED");
        await this.awaitForeground();
        deadline ??= this.clock() + 15000;
        await this.delay(250);
        if (this.clock() >= deadline) throw new Error("NATIVE_CONTROL_RESUME_TIMEOUT");
      } finally {
        clearTimeout(timer);
      }
    }
  }
}
