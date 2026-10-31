import type { Figure, Lines, Panel } from './types.ts'

const INK = '#111111'
const FILLS = ['#ffffff', '#d6d6d6', '#9c9c9c', '#555555', INK]
const SIZES = [0.42, 0.54, 0.66, 0.78, 0.92]

type Slot = { x: number; y: number; w: number; h: number }

const n = (v: number) => String(Math.round(v * 100) / 100)

function polygon(sides: number): string {
  const pts: string[] = []
  // Square sits flat; other polygons point up.
  const start = sides === 4 ? -135 : -90
  for (let i = 0; i < sides; i++) {
    const t = ((start + (360 * i) / sides) * Math.PI) / 180
    pts.push(`${n(Math.cos(t))},${n(Math.sin(t))}`)
  }
  return `M${pts.join('L')}Z`
}

const REGULAR = [polygon(3), polygon(4), polygon(5), polygon(6)]
// No rotational symmetry, so every 45° turn looks different.
const ASYM = [
  'M-.9,.45A.9,.9 0 0 1 .9,.45Z', // half disc
  'M-.8,.8L-.8,-.8L.8,.8Z', // right triangle
  'M-.75,-.85L-.2,-.85L-.2,.3L.75,.3L.75,.85L-.75,.85Z', // L
  'M-.8,-.85L.85,-.35L-.25,.05L-.25,.85L-.8,.85Z', // flag
]

function figureSvg(f: Figure, slot: Slot, tiles: number): string {
  const tile = Math.min(slot.w, slot.h) / tiles
  // Side by side or turned, figures would otherwise touch each other.
  const fit = tiles > 1 || f.family === 'asym' ? 0.84 : 1
  const radius = (tile / 2) * SIZES[f.size] * fit
  const rows: number[] = []
  for (let left = f.count; left > 0; left -= tiles) rows.push(Math.min(left, tiles))
  const path = f.family === 'regular' ? REGULAR[f.shape] : ASYM[f.shape]
  const cx = slot.x + slot.w / 2
  const cy = slot.y + slot.h / 2
  const out: string[] = []
  rows.forEach((inRow, ri) => {
    for (let i = 0; i < inRow; i++) {
      const px = cx + (i - (inRow - 1) / 2) * tile
      const py = cy + (ri - (rows.length - 1) / 2) * tile
      out.push(
        `<path transform="translate(${n(px)} ${n(py)}) rotate(${f.angle * 45}) scale(${n(radius)})" d="${path}" ` +
          `fill="${FILLS[f.fill]}" stroke="${INK}" stroke-width="${n(1.2 / radius)}" stroke-linejoin="round"/>`,
      )
    }
  })
  return out.join('')
}

// 3x3 points. 12 sides of the small squares, then 4 spokes from the centre to the corners.
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8],
  [0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8],
  [4, 0], [4, 2], [4, 6], [4, 8],
]

function linesSvg(l: Lines, slot: Slot): string {
  const side = Math.min(slot.w, slot.h) * 0.76
  const x0 = slot.x + slot.w / 2 - side / 2
  const y0 = slot.y + slot.h / 2 - side / 2
  const pt = (i: number) => [x0 + ((i % 3) * side) / 2, y0 + (Math.floor(i / 3) * side) / 2]
  let out = ''
  for (let i = 0; i < 9; i++) {
    const [x, y] = pt(i)
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="1" fill="#c4c4c4"/>`
  }
  EDGES.forEach(([a, b], e) => {
    if (!(l.edges & (1 << e))) return
    const [x1, y1] = pt(a)
    const [x2, y2] = pt(b)
    out += `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`
  })
  return out
}

// Tile size comes from every panel in the item, so it never hints at the answer.
export function tilesFor(all: Panel[], comp: number): number {
  let max = 1
  for (const p of all) {
    const c = p[comp]
    if (c.kind === 'figure') max = Math.max(max, c.count)
  }
  return Math.ceil(Math.sqrt(max))
}

export function panelSvg(panel: Panel, tiles: number[]): string {
  const slots: Slot[] =
    panel.length === 1
      ? [{ x: 6, y: 6, w: 88, h: 88 }]
      : [
          { x: 3, y: 26, w: 46, h: 48 },
          { x: 51, y: 26, w: 46, h: 48 },
        ]
  let body = ''
  panel.forEach((c, i) => {
    body += c.kind === 'lines' ? linesSvg(c, slots[i]) : figureSvg(c, slots[i], tiles[i])
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`
}

export function renderItem(item: { panels: Panel[]; options: Panel[] }): { panels: string[]; options: string[] } {
  const all = [...item.panels, ...item.options]
  const tiles = item.panels[0].map((_, i) => tilesFor(all, i))
  return {
    panels: item.panels.map((p) => panelSvg(p, tiles)),
    options: item.options.map((p) => panelSvg(p, tiles)),
  }
}
