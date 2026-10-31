import { ALL_EDGES, RANGE } from './types.ts'
import type { Attr, Component, FigureAttr, Panel } from './types.ts'

// Independent check: sees only what a person sees and knows nothing about how
// the item was built. It tries every rule it knows along rows and columns.
// An item is valid only if all fitting rules agree and one option remains.

type Line = number[]
type Hypothesis = (a: Line, b: Line, partial: Line) => number | null

const same = (a: Line, b: Line) => a.length === b.length && a.every((v, i) => v === b[i])
const sorted = (a: Line) => [...a].sort((x, y) => x - y)

function perLine(fit: (x: number, y: number, z: number) => boolean, predict: (x: number, y: number) => number): Hypothesis {
  return (a, b, p) => (fit(a[0], a[1], a[2]) && fit(b[0], b[1], b[2]) ? predict(p[0], p[1]) : null)
}

const constant: Hypothesis = (a, b, p) =>
  a[0] === a[1] && a[1] === a[2] && b[0] === b[1] && b[1] === b[2] && p[0] === p[1] ? p[1] : null

const latin: Hypothesis = (a, b, p) => {
  const set = sorted(a)
  if (new Set(a).size !== 3 || !same(set, sorted(b))) return null
  if (p[0] === p[1] || !set.includes(p[0]) || !set.includes(p[1])) return null
  return set.find((v) => v !== p[0] && v !== p[1]) ?? null
}

function progression(modulo: number | null): Hypothesis {
  const diff = (x: number, y: number) => (modulo ? (y - x + modulo) % modulo : y - x)
  return (a, b, p) => {
    const d = diff(a[0], a[1])
    if (d === 0 || diff(a[1], a[2]) !== d || diff(b[0], b[1]) !== d || diff(b[1], b[2]) !== d) return null
    if (diff(p[0], p[1]) !== d) return null
    return modulo ? (p[1] + d) % modulo : p[1] + d
  }
}

const sumConstant: Hypothesis = (a, b, p) => {
  const s = a[0] + a[1] + a[2]
  return s === b[0] + b[1] + b[2] ? s - p[0] - p[1] : null
}

const COUNT_ARITHMETIC: Hypothesis[] = [
  perLine((x, y, z) => x + y === z, (x, y) => x + y),
  perLine((x, y, z) => x - y === z, (x, y) => x - y),
  perLine((x, y, z) => y - x === z, (x, y) => y - x),
  perLine((x, y, z) => x * y === z, (x, y) => x * y),
  perLine((x, y, z) => Math.max(x, y) === z, (x, y) => Math.max(x, y)),
  perLine((x, y, z) => Math.min(x, y) === z, (x, y) => Math.min(x, y)),
  sumConstant,
]

const EDGE_OPS: Hypothesis[] = [
  perLine((x, y, z) => (x | y) === z, (x, y) => x | y),
  perLine((x, y, z) => (x & y) === z, (x, y) => x & y),
  perLine((x, y, z) => (x ^ y) === z, (x, y) => x ^ y),
  perLine((x, y, z) => (x & ~y & ALL_EDGES) === z, (x, y) => x & ~y & ALL_EDGES),
  perLine((x, y, z) => (y & ~x & ALL_EDGES) === z, (x, y) => y & ~x & ALL_EDGES),
  constant,
]

function hypothesesFor(attr: Attr, comp: Component): Hypothesis[] {
  if (attr === 'edges') return EDGE_OPS
  if (attr === 'angle') return [constant, latin, progression(8)]
  if (attr === 'count') return [constant, latin, progression(null), ...COUNT_ARITHMETIC]
  if (attr === 'shape' && comp.kind === 'figure' && comp.family === 'asym') return [constant, latin]
  return [constant, latin, progression(null)]
}

function inRange(attr: Attr, v: number): boolean {
  if (attr === 'edges') return v >= 0 && v <= ALL_EDGES
  const [lo, hi] = RANGE[attr as FigureAttr]
  return v >= lo && v <= hi
}

const read = (c: Component, attr: Attr) => (c as unknown as Record<Attr, number>)[attr]

function attrsOf(c: Component): Attr[] {
  return c.kind === 'lines' ? ['edges'] : ['shape', 'count', 'size', 'fill', 'angle']
}

function predictions(cells: Panel[], comp: number, attr: Attr): Set<number> {
  const v = cells.map((p) => read(p[comp], attr))
  const hyps = hypothesesFor(attr, cells[0][comp])
  const rows = { a: [v[0], v[1], v[2]], b: [v[3], v[4], v[5]], p: [v[6], v[7]] }
  const cols = { a: [v[0], v[3], v[6]], b: [v[1], v[4], v[7]], p: [v[2], v[5]] }
  const out = new Set<number>()
  for (const { a, b, p } of [rows, cols]) {
    for (const h of hyps) {
      const value = h(a, b, p)
      if (value !== null && inRange(attr, value)) out.add(value)
    }
  }
  return out
}

export type Solution = { status: 'unique'; index: number } | { status: 'ambiguous' | 'unsolved' | 'no-option' | 'many-options' }

export function solve(cells: Panel[], options: Panel[]): Solution {
  let candidates = options.map((_, i) => i)
  for (let comp = 0; comp < cells[0].length; comp++) {
    for (const attr of attrsOf(cells[0][comp])) {
      const found = predictions(cells, comp, attr)
      if (found.size === 0) return { status: 'unsolved' }
      if (found.size > 1) return { status: 'ambiguous' }
      const [value] = found
      candidates = candidates.filter((i) => read(options[i][comp], attr) === value)
    }
  }
  if (candidates.length === 0) return { status: 'no-option' }
  if (candidates.length > 1) return { status: 'many-options' }
  return { status: 'unique', index: candidates[0] }
}

// Flat list of "attribute=value" tags, used by the attacks in audit.ts.
export function features(panel: Panel): string[] {
  const out: string[] = []
  panel.forEach((c, i) => {
    if (c.kind === 'lines') {
      for (let b = 0; b < 16; b++) out.push(`${i}.e${b}=${(c.edges >> b) & 1}`)
    } else {
      for (const a of attrsOf(c)) out.push(`${i}.${a}=${read(c, a)}`)
    }
  })
  return out
}
