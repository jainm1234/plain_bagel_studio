/** Shared image size presets for description + step images (percent of container). */
export const WORKBENCH_IMAGE_SIZES = [
  { id: "s", label: "S", width: 33 },
  { id: "m", label: "M", width: 66 },
  { id: "l", label: "L", width: 100 },
] as const;

export function snapWorkbenchImageWidth(value: number) {
  let best = WORKBENCH_IMAGE_SIZES[WORKBENCH_IMAGE_SIZES.length - 1].width;
  let bestDist = Infinity;
  for (const size of WORKBENCH_IMAGE_SIZES) {
    const dist = Math.abs(size.width - value);
    if (dist < bestDist) {
      best = size.width;
      bestDist = dist;
    }
  }
  return best;
}
