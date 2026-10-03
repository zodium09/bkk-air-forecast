/** Keep independent public-provider requests within a small concurrency budget. */
export async function concurrentMap<T, R>(items: readonly T[], limit: number, run: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(limit)), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await run(items[index], index);
    }
  }));
  return results;
}
