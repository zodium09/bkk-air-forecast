import type { Map as LeafletMap } from "leaflet";
import type { EnvironmentLayer } from "../../lib/map-intelligence";
import { sampleMapSurface, type MapSurface } from "../../lib/map-surface";

/** Illustrative weather motion, clipped to supported data; never a radar or wind-field layer. */
export function installWeatherMotion(
  map: LeafletMap,
  surface: MapSurface,
  layer: EnvironmentLayer,
  dark: boolean,
) {
  const canvas = document.createElement("canvas");
  canvas.className = `mi-weather-canvas mi-weather-${layer}`;
  canvas.setAttribute("aria-hidden", "true");
  map.getContainer().appendChild(canvas);
  const context = canvas.getContext("2d");
  if (!context) {
    canvas.remove();
    return () => {};
  }
  const maskCanvas = document.createElement("canvas"),
    maskContext = maskCanvas.getContext("2d");
  if (!maskContext) {
    canvas.remove();
    return () => {};
  }
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  let width = 0,
    height = 0,
    frame = 0,
    last = 0,
    elapsed = 0,
    moving = false;
  // Decorative particles are randomized; the environmental values always come from the supplied raster.
  let particles: {
    x: number;
    y: number;
    phase: number;
    speed: number;
    life: number;
  }[] = [];
  const resize = () => {
    const size = map.getSize();
    width = size.x;
    height = size.y;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    maskCanvas.width = width;
    maskCanvas.height = height;
    const topLeft = map.latLngToContainerPoint([
        surface.bounds[1][0],
        surface.bounds[0][1],
      ]),
      bottomRight = map.latLngToContainerPoint([
        surface.bounds[0][0],
        surface.bounds[1][1],
      ]);
    maskContext.clearRect(0, 0, width, height);
    maskContext.drawImage(
      surface.mask,
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y,
    );
    const count = Math.min(
      layer === "rain" ? 190 : 100,
      Math.round((width * height) / (layer === "rain" ? 3200 : 5800)),
    );
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random(),
      life: Math.random(),
    }));
  };
  const pause = () => {
    moving = true;
    context.clearRect(0, 0, width, height);
  };
  const resume = () => {
    moving = false;
    resize();
  };
  resize();
  map.on("movestart zoomstart", pause);
  map.on("moveend zoomend resize", resume);
  const draw = (time: number) => {
    frame = requestAnimationFrame(draw);
    if (document.hidden || moving || time - last < 33) return;
    const dt = Math.min((time - (last || time)) / 1000, 0.08);
    last = time;
    elapsed += dt;
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, width, height);
    for (const p of particles) {
      p.life += dt * 0.17;
      if (layer === "rain") {
        p.x -= dt * 12 * p.speed;
        p.y += dt * 115 * p.speed;
      } else if (layer === "heat") {
        p.y -= dt * 13 * p.speed;
        p.x += Math.sin(elapsed * 0.7 + p.phase) * dt * 6;
      } else {
        p.x += Math.cos(p.phase) * dt * 8;
        p.y += Math.sin(p.phase + elapsed * 0.25) * dt * 7;
      }
      if (p.y > height + 25) {
        p.y = -20;
        p.x = Math.random() * width;
      }
      if (p.y < -25) p.y = height + 20;
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      const latLng = map.containerPointToLatLng([p.x, p.y]);
      const value = sampleMapSurface(surface, latLng.lat, latLng.lng);
      if (
        value === null ||
        (layer === "rain" && value <= 0.1) ||
        (layer === "heat" && value < 27) ||
        (layer === "air" && value <= 0)
      )
        continue;
      const alpha = 0.2 + Math.sin(p.life * Math.PI) ** 2 * 0.5;
      if (layer === "rain") {
        context.strokeStyle = dark
          ? `rgba(207,234,255,${alpha})`
          : `rgba(23,86,147,${alpha})`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(p.x, p.y);
        context.lineTo(p.x - 2, p.y + 13 * p.speed);
        context.stroke();
      } else if (layer === "heat") {
        context.strokeStyle = dark
          ? `rgba(255,230,168,${alpha * 0.6})`
          : `rgba(161,69,16,${alpha * 0.4})`;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(p.x, p.y);
        context.bezierCurveTo(
          p.x - 7,
          p.y - 9,
          p.x + 7,
          p.y - 16,
          p.x,
          p.y - 25,
        );
        context.stroke();
      } else {
        context.fillStyle = dark
          ? `rgba(228,255,237,${alpha * 0.7})`
          : `rgba(15,84,72,${alpha * 0.6})`;
        context.beginPath();
        context.arc(p.x, p.y, 1.2 * p.speed, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalCompositeOperation = "destination-in";
    context.drawImage(maskCanvas, 0, 0, width, height);
    context.globalCompositeOperation = "source-over";
  };
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    map.off("movestart zoomstart", pause);
    map.off("moveend zoomend resize", resume);
    canvas.remove();
  };
}
