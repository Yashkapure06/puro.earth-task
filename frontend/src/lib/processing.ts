/** Minimum time the processing step stays visible so localhost does not skip it. */
export const MONEY_PROCESSING_MIN_MS = 1600;

/**
 * Resolve a payment request, then wait out any remaining floor.
 * The API call starts immediately. Failures skip the floor so declines are not delayed.
 */
export async function waitWithFloor<T>(
  task: Promise<T>,
  floorMs = MONEY_PROCESSING_MIN_MS,
): Promise<T> {
  const started = Date.now();
  const result = await task;
  const remaining = floorMs - (Date.now() - started);
  if (remaining > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, remaining);
    });
  }
  return result;
}
