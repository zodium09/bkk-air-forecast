/** Folded maps have zero dimensions. Never initialize or resize a renderer in that state. */
export function observeVisibleMap(host: HTMLElement, onUsableSize: () => void) {
  let active = true;
  const sync = () => { if (active && host.clientWidth > 0 && host.clientHeight > 0) onUsableSize(); };
  const observer = new ResizeObserver(sync);
  observer.observe(host);
  sync();
  return () => { active = false; observer.disconnect(); };
}
