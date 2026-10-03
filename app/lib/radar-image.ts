type RadarImage = {
  on: (event: "load" | "error", callback: () => void) => unknown;
  off: (event: "load" | "error", callback: () => void) => unknown;
  getElement: () => HTMLImageElement | undefined;
};

/** Subscribe before mounting: a cached image may finish during addTo(). */
export function watchRadarImage(image: RadarImage, mount: () => void, onReady: () => void, onError: () => void, timeoutMs = 15000) {
  let active = true;
  const cleanup = () => {
    clearTimeout(timer);
    image.off("load", loaded);
    image.off("error", failed);
  };
  const finish = (callback: () => void) => {
    if (!active) return;
    active = false;
    cleanup();
    callback();
  };
  const loaded = () => finish(onReady);
  const failed = () => finish(onError);
  const timer = setTimeout(failed, timeoutMs);
  image.on("load", loaded);
  image.on("error", failed);
  try {
    mount();
    const element = image.getElement();
    if (element?.complete) {
      if (element.naturalWidth > 0) loaded();
      else failed();
    }
  } catch { failed(); }
  return () => { active = false; cleanup(); };
}
