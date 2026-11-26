/** Axial hex coordinates (pointy-top). */

export interface Hex {
  q: number;
  r: number;
}

export const HEX_DIRS: Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

/** All cells within `radius` of the center, in a stable order. */
export function hexDisk(radius: number): Hex[] {
  const out: Hex[] = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      if (Math.abs(q + r) <= radius) out.push({ q, r });
    }
  }
  return out;
}

/** Neighbor indices for each cell of a disk. */
export function hexNeighbors(cells: Hex[]): number[][] {
  const index = new Map(cells.map((h, i) => [`${h.q},${h.r}`, i]));
  return cells.map((h) =>
    HEX_DIRS.map((d) => index.get(`${h.q + d.q},${h.r + d.r}`)).filter((i): i is number => i !== undefined),
  );
}

/** Pixel center of a hex of the given size (center-to-corner). */
export const hexToPixel = (h: Hex, size: number): [number, number] => [size * Math.sqrt(3) * (h.q + h.r / 2), size * 1.5 * h.r];

/** SVG polygon points for a pointy-top hex. */
export function hexPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
