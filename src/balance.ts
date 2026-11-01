import { solveBalance } from './balance-solver.ts'
import type { Scale } from './balance-solver.ts'
import { Rng } from './rng.ts'

// Balance items: scales in equilibrium show how shapes relate, and the last scale
// must be completed. Each shape has a hidden weight the person works out.

export type BalanceItem = {
  level: number
  difficulty: number
  shapes: number[] // drawing index for each shape in this item
  scales: Scale[]
  target: number[]
  options: number[][] // 6 candidates, as counts per shape
  answer: number
  guess: number
}

type Config = { shapes: number; scales: number; sideMax: number; targetMax: number; near: boolean }

export const BALANCE_LEVELS: Config[] = [
  { shapes: 2, scales: 1, sideMax: 3, targetMax: 2, near: false },
  { shapes: 2, scales: 1, sideMax: 4, targetMax: 3, near: true },
  { shapes: 3, scales: 2, sideMax: 3, targetMax: 1, near: false },
  { shapes: 3, scales: 2, sideMax: 3, targetMax: 2, near: true },
  { shapes: 4, scales: 3, sideMax: 3, targetMax: 2, near: false },
  { shapes: 4, scales: 3, sideMax: 4, targetMax: 3, near: true },
  { shapes: 5, scales: 4, sideMax: 3, targetMax: 2, near: false },
  { shapes: 5, scales: 4, sideMax: 4, targetMax: 3, near: true },
]

const WEIGHTS = [1, 2, 3, 4, 6, 8, 12]
const OPTION_COUNT = 6

const total = (m: number[], w: number[]) => m.reduce((s, c, i) => s + c * w[i], 0)
const size = (m: number[]) => m.reduce((a, b) => a + b, 0)
const disjoint = (a: number[], b: number[]) => a.every((c, i) => c === 0 || b[i] === 0)

// Every way to put between 1 and max shapes on one side.
function multisets(n: number, max: number): number[][] {
  const out: number[][] = []
  const walk = (i: number, left: number, cur: number[]) => {
    if (i === n) {
      if (size(cur) > 0) out.push([...cur])
      return
    }
    for (let c = 0; c <= left; c++) {
      cur[i] = c
      walk(i + 1, left - c, cur)
    }
    cur[i] = 0
  }
  walk(0, max, Array(n).fill(0))
  return out
}

function distance(a: number[], b: number[]): number {
  return a.reduce((s, c, i) => s + Math.abs(c - b[i]), 0)
}

function tryBuild(r: Rng, level: number): BalanceItem | null {
  const cfg = BALANCE_LEVELS[level - 1]
  const w = Array.from({ length: cfg.shapes }, () => r.pick(WEIGHTS))
  if (new Set(w).size < cfg.shapes) return null

  const sides = multisets(cfg.shapes, cfg.sideMax)
  const pairs: Scale[] = []
  for (const left of sides) {
    for (const right of sides) {
      if (total(left, w) === total(right, w) && disjoint(left, right)) pairs.push({ left, right })
    }
  }
  if (pairs.length < cfg.scales) return null
  // Pick by how many shapes sit on each side first, or one simple pattern would dominate.
  const pattern = (s: Scale) => [size(s.left), size(s.right)].sort().join(':')
  const patterns = [...new Set(pairs.map(pattern))]
  const pickByPattern = () => {
    const wanted = r.pick(patterns)
    return r.pick(pairs.filter((p) => pattern(p) === wanted))
  }
  const scales: Scale[] = []
  for (let tries = 0; scales.length < cfg.scales && tries < 40; tries++) {
    const s = pickByPattern()
    if (s && !scales.includes(s)) scales.push(s)
  }
  if (scales.length < cfg.scales) return null

  const targets = multisets(cfg.shapes, cfg.targetMax)
  const target = r.pick(targets)
  // With two shapes every option is a count of one shape, so counts need room on both sides of the answer.
  const pool = multisets(cfg.shapes, cfg.shapes === 2 ? 9 : 6)
  const fits = r.shuffle(pool.filter((m) => total(m, w) === total(target, w) && disjoint(m, target)))
  // Working it out must take a step: the target is never a side already shown.
  if (scales.some((s) => s.left.join() === target.join() || s.right.join() === target.join())) return null
  const answer = fits[0]
  if (!answer) return null

  // Wrong options leave out the target's shapes too, or that alone would give away the answer.
  const free = pool.filter((m) => total(m, w) !== total(target, w) && disjoint(m, target))
  const close = free.filter((m) => Math.abs(size(m) - size(answer)) <= 1)
  const wrong = close.length >= OPTION_COUNT - 1 ? close : free
  const ranked = cfg.near
    ? [...r.shuffle(wrong)].sort((a, b) => Math.abs(total(a, w) - total(target, w)) - Math.abs(total(b, w) - total(target, w))).slice(0, 14)
    : wrong
  if (ranked.length < OPTION_COUNT - 1) return null
  const distractors = r.shuffle(ranked).slice(0, OPTION_COUNT - 1)
  const raw = [answer, ...distractors]

  const order = r.shuffle(raw.map((_, i) => i))
  const options = order.map((i) => raw[i])
  const index = order.indexOf(0)

  const solution = solveBalance(scales, target, options)
  if (solution.status !== 'unique' || solution.index !== index) return null

  const difficulty = 1.2 + 1.3 * (cfg.shapes - 2) + 0.9 * (cfg.scales - 1) + 0.3 * (size(target) - 1) + (cfg.near ? 0.5 : 0)
  return {
    level,
    difficulty: Math.round(difficulty * 10) / 10,
    shapes: r.shuffle([0, 1, 2, 3, 4]).slice(0, cfg.shapes),
    scales,
    target,
    options,
    answer: index,
    guess: 1 / OPTION_COUNT,
  }
}

export function generateBalance(seed: string, level: number): BalanceItem {
  if (!Number.isInteger(level) || level < 1 || level > BALANCE_LEVELS.length) throw new RangeError(`bad level ${level}`)
  const r = new Rng(`balance:${seed}:${level}`)
  for (let attempt = 0; attempt < 5000; attempt++) {
    const item = tryBuild(r, level)
    if (item) return item
  }
  throw new Error(`no valid balance item for level ${level}, seed ${seed}`)
}

const INK = '#111111'
const FILLS = ['#ffffff', '#d6d6d6', '#9c9c9c', '#555555', INK]
const n = (v: number) => String(Math.round(v * 100) / 100)

function shapeSvg(kind: number, x: number, y: number, r: number): string {
  const style = `fill="${FILLS[kind]}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"`
  const points = (sides: number, start: number) =>
    Array.from({ length: sides }, (_, i) => {
      const t = ((start + (360 * i) / sides) * Math.PI) / 180
      return `${n(x + r * Math.cos(t))},${n(y + r * Math.sin(t))}`
    }).join(' ')
  switch (kind) {
    case 0:
      return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.92)}" ${style}/>`
    case 1:
      return `<polygon points="${points(4, 45)}" ${style}/>`
    case 2:
      return `<polygon points="${points(3, -90)}" ${style}/>`
    case 3:
      return `<polygon points="${points(4, 0)}" ${style}/>`
    default:
      return `<polygon points="${points(6, 0)}" ${style}/>`
  }
}

function group(m: number[], shapes: number[], cx: number, baseY: number, r: number, perRow: number): string {
  const list: number[] = []
  m.forEach((c, i) => {
    for (let k = 0; k < c; k++) list.push(shapes[i])
  })
  const gap = r * 2.3
  let out = ''
  list.forEach((kind, i) => {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, list.length - row * perRow)
    const col = i % perRow
    out += shapeSvg(kind, cx + (col - (inRow - 1) / 2) * gap, baseY - r - row * gap, r)
  })
  return out
}

function scaleSvg(left: number[], right: number[] | null, shapes: number[]): string {
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`
  const pan = (cx: number) => line(cx - 46, 84, cx + 46, 84) + line(cx - 46, 84, cx, 12) + line(cx + 46, 84, cx, 12)
  const items = group(left, shapes, 48, 83, 7.5, 4) + (right ? group(right, shapes, 172, 83, 7.5, 4) : '')
  const blank = right ? '' : `<text x="172" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#9a9a9a">?</text>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 118" aria-hidden="true">` +
    line(48, 12, 172, 12) + line(110, 12, 110, 110) + line(92, 110, 128, 110) + pan(48) + pan(172) + items + blank +
    `</svg>`
  )
}

function optionSvg(m: number[], shapes: number[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70" aria-hidden="true">${group(m, shapes, 50, 44 + (size(m) > 3 ? 13 : 0), 9.5, 3)}</svg>`
}

export function renderBalance(item: BalanceItem): { panels: string[]; options: string[] } {
  return {
    panels: [...item.scales.map((s) => scaleSvg(s.left, s.right, item.shapes)), scaleSvg(item.target, null, item.shapes)],
    options: item.options.map((o) => optionSvg(o, item.shapes)),
  }
}
