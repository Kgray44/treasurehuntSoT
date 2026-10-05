/** Keep a synthetic OS position live within one scenario step, without retrying the scenario. */
export async function deliverDeviceLabPosition(options: {
  inject(): Promise<void>;
  completed(): boolean;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  budgetMs?: number;
}) {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const budgetMs = options.budgetMs ?? 120000;
  if (!Number.isInteger(budgetMs) || budgetMs < 1000 || budgetMs > 120000)
    throw new Error("DEVICE_LAB_LOCATION_BUDGET_INVALID");
  const started = now();
  let injections = 0;
  while (!options.completed() && now() - started < budgetMs) {
    await options.inject();
    injections++;
    if (!options.completed()) await sleep(Math.min(1000, Math.max(0, budgetMs - (now() - started))));
  }
  return { injections, elapsedMs: now() - started, budgetMs, completed: options.completed() };
}
