const DAY = 86400000;
export function refreshDue(now: number, previous: number, interval: number) {
  return now - previous >= interval || Math.floor((now + 25200000) / DAY) !== Math.floor((previous + 25200000) / DAY);
}
