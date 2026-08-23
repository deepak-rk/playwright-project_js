import { APIRequestContext } from '@playwright/test';

/** Polls GET /api/execution/:id until status leaves ['queued','preparing','running'], or times out. */
export async function pollExecutionRunUntilDone(
  request: APIRequestContext,
  runId: string,
  timeoutMs = 15_000,
): Promise<Record<string, unknown>> {
  const inFlight = new Set(['queued', 'preparing', 'running']);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request.get(`/api/execution/${runId}`);
    const run = (await res.json()) as { status: string };
    if (!inFlight.has(run.status)) return run;
    if (Date.now() > deadline) throw new Error(`Run ${runId} still ${run.status} after ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 300));
  }
}
