import { getWaterHistoryStore } from '../app/lib/water-history-store.ts';
import { collectWaterObservations } from '../app/lib/collect-water-observations.ts';

const store = getWaterHistoryStore();
if (!store) throw new Error('Observation storage is unavailable');
async function collect() {
  try { const result = await collectWaterObservations(store); console.log(`${result.fetchedAt} · saved valid water observations from ${result.stations} stations`); }
  catch (error) { console.error('Water observation collection failed:', error.message); if (!process.argv.includes('--watch')) process.exitCode = 1; }
}
await collect();
if (process.argv.includes('--watch')) {
  let busy = false;
  const timer = setInterval(async () => { if (busy) return; busy = true; try { await collect(); } finally { busy = false; } }, 300000);
  const stop = () => { clearInterval(timer); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
