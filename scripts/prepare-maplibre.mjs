import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const target = new URL("public/maps/maplibre/", root);
await mkdir(target, { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(new URL(`node_modules/maplibre-gl/dist/${name}`, root), new URL(name, target));
}
await copyFile(new URL("node_modules/maplibre-gl/LICENSE.txt", root), new URL("LICENSE.txt", target));
console.log(`Prepared MapLibre worker in ${fileURLToPath(target)}`);
