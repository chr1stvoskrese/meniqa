import { Rng } from './rng.ts'
import { solve } from './solver.ts'
import { ALL_EDGES, EDGE_COUNT, RANGE } from './types.ts'
import type { Attr, Component, Family, Figure, FigureAttr, Item, Panel, Rule, RuleType } from './types.ts'

type Grid = number[][]
type LevelConfig = { rules: number; pool: RuleType[]; components: 1 | 2; near: boolean }

const EASY: RuleType[] = ['progression', 'latin', 'rotation']
const ALL: RuleType[] = ['progression', 'latin', 'rotation', 'arithmetic', 'union', 'xor']
const HARD: RuleType[] = ['latin', 'rotation', 'arithmetic', 'xor']

export const LEVELS: LevelConfig[] = [
  { rules: 1, pool: EASY, components: 1, near: false },
  { rules: 1, pool: ALL, components: 1, near: false },
  { rules: 2, pool: EASY, components: 1, near: false },
  { rules: 2, pool: ALL, components: 1, near: true },
  { rules: 3, pool: EASY, components: 1, near: false },
  { rules: 3, pool: ALL, components: 2, near: true },
  { rules: 4, pool: ALL, components: 2, near: false },
  { rules: 4, pool: HARD, components: 2, near: true },
]

// Starting guess only. Real difficulty will be fitted from user answers.
const RULE_WEIGHT: Record<RuleType, number> = {
  progression: 1,
  rotation: 1.2,
  latin: 1.4,
  union: 1.5,
  arithmetic: 1.8,
  xor: 2,
}

const ATTR_NAME: Record<Attr, string> = {
  shape: 'Форма',
  count: 'Количество фигур',
  size: 'Размер',
  fill: 'Заливка',
  angle: 'Поворот',
  edges: 'Линии',
}

function progressionText(attr: Attr, step: number): string {
  const n = Math.abs(step)
  const up = step > 0
  switch (attr) {
    case 'count':
      return `Количество фигур: в каждой строке ${up ? 'растёт' : 'убывает'} на ${n}.`
    case 'size':
      return `Размер: в каждой строке фигуры становятся ${up ? 'больше' : 'меньше'}, шаг ${n}.`
    case 'fill':
      return `Заливка: в каждой строке фигуры становятся ${up ? 'темнее' : 'светлее'}, шаг ${n}.`
    default:
      return `Форма: в каждой строке углов становится ${up ? 'больше' : 'меньше'} на ${n}.`
  }
}

function progressionGrid(r: Rng, lo: number, hi: number): { grid: Grid; step: number } {
  const magnitude = hi - lo >= 4 && r.next() < 0.25 ? 2 : 1
  const step = r.pick([magnitude, -magnitude])
  const span = 2 * magnitude
  const startMin = step > 0 ? lo : lo + span
  const startMax = step > 0 ? hi - span : hi
  const grid: Grid = []
  for (let row = 0; row < 3; row++) {
    const s = r.int(startMin, startMax)
    grid.push([s, s + step, s + 2 * step])
  }
  return { grid, step }
}

function latinGrid(r: Rng, lo: number, hi: number): Grid {
  const pool: number[] = []
  for (let v = lo; v <= hi; v++) pool.push(v)
  const values = r.shuffle(pool).slice(0, 3)
  const dir = r.pick([1, 2])
  return [0, 1, 2].map((row) => [0, 1, 2].map((col) => values[(col + row * dir) % 3]))
}

function arithmeticGrid(r: Rng, hi: number): { grid: Grid; add: boolean } {
  const add = r.next() < 0.5
  const grid: Grid = []
  for (let row = 0; row < 3; row++) {
    if (add) {
      const a = r.int(1, hi - 1)
      const b = r.int(1, hi - a)
      grid.push([a, b, a + b])
    } else {
      const a = r.int(2, hi)
      const b = r.int(1, a - 1)
      grid.push([a, b, a - b])
    }
  }
  return { grid, add }
}

function rotationGrid(r: Rng, hard: boolean): { grid: Grid; step: number } {
  const step = r.pick(hard ? [1, 2, 3, 5, 6, 7] : [1, 2, 6, 7])
  const grid: Grid = []
  for (let row = 0; row < 3; row++) {
    const s = r.int(0, 7)
    grid.push([s, (s + step) % 8, (s + 2 * step) % 8])
  }
  return { grid, step }
}

function randomEdges(r: Rng): number {
  const n = r.int(4, 7)
  let mask = 0
  for (const e of r.shuffle([...Array(EDGE_COUNT).keys()]).slice(0, n)) mask |= 1 << e
  return mask
}

function linesGrid(r: Rng, type: 'union' | 'xor'): Grid {
  const grid: Grid = []
  while (grid.length < 3) {
    const a = randomEdges(r)
    const b = randomEdges(r)
    // Each row must tell the operations apart: shared lines and own lines on both sides.
    if ((a & b) === 0 || (a & ~b) === 0 || (b & ~a) === 0 || (a | b) === ALL_EDGES) continue
    grid.push([a, b, type === 'union' ? a | b : a ^ b])
  }
  return grid
}

type PlannedRule = { type: RuleType; attr: Attr }
type ComponentPlan = { kind: 'figure' | 'lines'; family: Family; rules: PlannedRule[]; rowConstant: FigureAttr[] }

const FIGURE_RULES: Record<FigureAttr, RuleType[]> = {
  count: ['progression', 'latin', 'arithmetic'],
  size: ['progression', 'latin'],
  fill: ['progression', 'latin'],
  shape: ['progression', 'latin'],
  angle: ['rotation'],
}

function candidates(plan: ComponentPlan, pool: RuleType[]): PlannedRule[] {
  if (plan.kind === 'lines') {
    if (plan.rules.length > 0) return []
    return (['union', 'xor'] as const).filter((t) => pool.includes(t)).map((type) => ({ type, attr: 'edges' as Attr }))
  }
  const out: PlannedRule[] = []
  for (const attr of Object.keys(FIGURE_RULES) as FigureAttr[]) {
    if (plan.rules.some((p) => p.attr === attr)) continue
    if (attr === 'angle' && plan.family !== 'asym') continue
    for (const type of FIGURE_RULES[attr]) {
      if (!pool.includes(type)) continue
      // Only regular polygons have an order (number of sides).
      if (attr === 'shape' && type === 'progression' && plan.family !== 'regular') continue
      out.push({ type, attr })
    }
  }
  return out
}

function planItem(r: Rng, cfg: LevelConfig): ComponentPlan[] | null {
  const hasLines = cfg.pool.includes('union') || cfg.pool.includes('xor')
  const newFigure = (): ComponentPlan => ({ kind: 'figure', family: r.pick(['regular', 'asym'] as const), rules: [], rowConstant: [] })
  const newLines = (): ComponentPlan => ({ kind: 'lines', family: 'regular', rules: [], rowConstant: [] })
  const plans: ComponentPlan[] = [newFigure()]
  if (cfg.components === 2) plans.push(hasLines && r.next() < 0.5 ? newLines() : newFigure())
  else if (hasLines && cfg.rules === 1 && r.next() < 0.34) plans[0] = newLines()

  for (let i = 0; i < cfg.rules; i++) {
    let placed = false
    for (let k = 0; k < plans.length && !placed; k++) {
      const plan = plans[(i + k) % plans.length]
      const options = candidates(plan, cfg.pool)
      if (options.length === 0) continue
      // Pick the type first so rules with few attributes are not crowded out.
      const type = r.pick([...new Set(options.map((o) => o.type))])
      plan.rules.push(r.pick(options.filter((o) => o.type === type)))
      placed = true
    }
    if (!placed) return null
  }
  return plans
}

type BuiltRule = { grid: Grid; text: string }

function buildRule(r: Rng, rule: PlannedRule, cfg: LevelConfig, plan: ComponentPlan): BuiltRule {
  const name = ATTR_NAME[rule.attr]
  const countMax = cfg.components === 2 ? 6 : 9
  const range = (): [number, number] => {
    if (rule.attr === 'edges') return [0, 0]
    if (rule.attr === 'count') return [1, countMax]
    return RANGE[rule.attr]
  }
  const [lo, hi] = range()
  switch (rule.type) {
    case 'progression': {
      const { grid, step } = progressionGrid(r, lo, hi)
      return { grid, text: progressionText(rule.attr, step) }
    }
    case 'latin': {
      const top = rule.attr === 'count' ? Math.min(hi, 6) : hi
      return { grid: latinGrid(r, lo, top), text: `${name}: в каждой строке три значения, каждое по одному разу.` }
    }
    case 'arithmetic': {
      const { grid, add } = arithmeticGrid(r, hi)
      return { grid, text: `${name}: третья клетка равна первой ${add ? 'плюс' : 'минус'} вторая.` }
    }
    case 'rotation': {
      const { grid, step } = rotationGrid(r, cfg.near)
      const clockwise = step <= 4
      const deg = (clockwise ? step : 8 - step) * 45
      return { grid, text: `Поворот: каждая следующая клетка на ${deg}° ${clockwise ? 'по часовой' : 'против часовой'}.` }
    }
    case 'union':
      return { grid: linesGrid(r, 'union'), text: 'Линии: третья клетка объединяет линии первых двух.' }
    case 'xor':
      return {
        grid: linesGrid(r, 'xor'),
        text: 'Линии: в третьей клетке остаются только те линии, что есть ровно в одной из первых двух.',
      }
  }
  throw new Error(`unknown rule ${rule.type} for ${plan.kind}`)
}

// Easy items still need three ways to go wrong. Extra attributes stay the same
// within a row but change between rows, so a wrong value can also be found in the
// matrix and "pick what looks familiar" does not work.
function addRowConstants(r: Rng, plans: ComponentPlan[], rulesCount: number, grids: Map<string, Grid>): void {
  const linesExtras = plans.some((p) => p.kind === 'lines') ? 2 : 0
  const needed = 3 - rulesCount - linesExtras
  if (needed <= 0) return
  const free: { comp: number; attr: FigureAttr }[] = []
  plans.forEach((plan, comp) => {
    if (plan.kind !== 'figure') return
    for (const attr of ['count', 'size', 'fill', 'shape', 'angle'] as FigureAttr[]) {
      if (plan.rules.some((p) => p.attr === attr)) continue
      if (attr === 'angle' && plan.family !== 'asym') continue
      free.push({ comp, attr })
    }
  })
  for (const { comp, attr } of r.shuffle(free).slice(0, needed)) {
    const [lo, hi] = attr === 'count' ? [1, 4] : attr === 'size' ? [1, 4] : RANGE[attr]
    const pool: number[] = []
    for (let v = lo; v <= hi; v++) pool.push(v)
    const [a, b, c] = r.shuffle(pool)
    grids.set(`${comp}.${attr}`, [[a, a, a], [b, b, b], [c, c, c]])
    plans[comp].rowConstant.push(attr)
  }
}

function constantFigure(r: Rng, plan: ComponentPlan, cfg: LevelConfig): Figure {
  const uses = (a: Attr) => plan.rules.some((p) => p.attr === a)
  return {
    kind: 'figure',
    family: plan.family,
    shape: r.int(...RANGE.shape),
    count: uses('size') || cfg.components === 2 ? r.int(1, 2) : r.pick([1, 1, 2, 3, 4]),
    size: r.int(2, 4),
    fill: r.int(0, 3),
    angle: plan.family === 'asym' ? r.pick([0, 2, 4, 6]) : 0,
  }
}

// One way of changing the correct answer. For lines, an alternative is a set of
// edges to flip; for anything else it is the replacement value.
type Axis = { comp: number; attr: Attr; alts: number[]; isRule: boolean }

function applyAxis(panel: Panel, axis: Axis, alt: number): void {
  const c = panel[axis.comp] as unknown as Record<Attr, number>
  if (axis.attr === 'edges') c.edges ^= alt
  else c[axis.attr] = alt
}

function ruleAlternatives(r: Rng, attr: FigureAttr, grid: Grid, near: boolean): number[] {
  const v = grid[2][2]
  const [lo, hi] = RANGE[attr]
  const gap = (x: number) => {
    const d = Math.abs(x - v)
    return attr === 'angle' ? Math.min(d, 8 - d) : d
  }
  const order = (xs: number[]) => (near ? [...xs].sort((a, b) => gap(a) - gap(b)) : r.shuffle(xs))
  // Values already visible in the matrix come first: they are the tempting mistakes.
  const visible = [...new Set(grid.flat().slice(0, 8))].filter((x) => x !== v)
  const around = [v + 1, v - 1, v + 2, v - 2].map((x) => (attr === 'angle' ? (x + 8) % 8 : x))
  const others = [...new Set(around)].filter((x) => x !== v && x >= lo && x <= hi && !visible.includes(x))
  return [...order(visible), ...order(others)]
}

function bits(mask: number): number[] {
  const out: number[] = []
  for (let b = 0; b < EDGE_COUNT; b++) if (mask & (1 << b)) out.push(1 << b)
  return out
}

function buildAxes(r: Rng, plans: ComponentPlan[], grids: Map<string, Grid>, answer: Panel, cfg: LevelConfig): { rule: Axis[]; extra: Axis[] } {
  const rule: Axis[] = []
  const extra: Axis[] = []
  const rowConstants: Axis[] = []
  plans.forEach((plan, comp) => {
    if (plan.kind === 'lines') {
      const g = grids.get(`${comp}.edges`) as Grid
      const [a, b] = g[2]
      const neither = ~(a | b) & ALL_EDGES
      // Flipping the shared lines turns "union" into "xor" and back: the natural mistake.
      rule.push({ comp, attr: 'edges', alts: [a & b, ...bits(a ^ b), ...bits(neither)], isRule: true })
      extra.push({ comp, attr: 'edges', alts: r.shuffle(bits(a ^ b)).slice(0, 1), isRule: false })
      extra.push({ comp, attr: 'edges', alts: r.shuffle(bits(neither)).slice(0, 1), isRule: false })
      return
    }
    const fig = answer[comp] as Figure
    for (const attr of ['count', 'size', 'fill', 'shape', 'angle'] as FigureAttr[]) {
      if (attr === 'angle' && fig.family !== 'asym') continue
      const planned = plan.rules.find((p) => p.attr === attr)
      if (planned) {
        rule.push({ comp, attr, alts: ruleAlternatives(r, attr, grids.get(`${comp}.${attr}`) as Grid, cfg.near), isRule: true })
        continue
      }
      if (plan.rowConstant.includes(attr)) {
        const g = grids.get(`${comp}.${attr}`) as Grid
        rowConstants.push({ comp, attr, alts: r.shuffle([g[0][0], g[1][0]]), isRule: false })
        continue
      }
      const v = fig[attr]
      const [lo, hi] = RANGE[attr]
      const step = attr === 'angle' ? 2 : 1
      const around = [v + step, v - step].map((x) => (attr === 'angle' ? (x + 8) % 8 : x)).filter((x) => x >= lo && x <= hi)
      extra.push({ comp, attr, alts: r.shuffle(around), isRule: false })
    }
  })
  const rest = r.shuffle(extra).sort((x, y) => Number(y.attr === 'edges') - Number(x.attr === 'edges'))
  return { rule, extra: [...rowConstants, ...rest] }
}

export type DistractorMode = 'balanced' | 'single-change'

// Balanced: options cover the corners of a cube of changes, so inside the option
// set every attribute value appears exactly as often as its alternative. Looking
// at the options alone says nothing about the answer. With 4 axes the set is a
// half-cube, which keeps the same balance.
function balancedOptions(answer: Panel, axes: Axis[]): Panel[] | null {
  if (axes.length < 3 || axes.some((a) => a.alts.length === 0)) return null
  const n = axes.length
  const out: Panel[] = []
  for (let m = 0; m < 1 << n; m++) {
    const flips = m.toString(2).split('1').length - 1
    if (n === 4 && flips % 2 === 1) continue
    const p = structuredClone(answer)
    axes.forEach((axis, i) => {
      if (m & (1 << i)) applyAxis(p, axis, axis.alts[0])
    })
    out.push(p)
  }
  return out
}

// The rule as first stated: each wrong option changes exactly one thing.
// Kept only so audit.ts can show how easily this form is beaten.
function singleChangeOptions(r: Rng, answer: Panel, rule: Axis[], extra: Axis[]): Panel[] | null {
  const variants: Panel[] = []
  const seen = new Set([JSON.stringify(answer)])
  const add = (axis: Axis, alt: number) => {
    const p = structuredClone(answer)
    applyAxis(p, axis, alt)
    const key = JSON.stringify(p)
    if (seen.has(key)) return
    seen.add(key)
    variants.push(p)
  }
  for (const axis of rule) for (const alt of r.shuffle(axis.alts).slice(0, 3)) add(axis, alt)
  for (const axis of extra) for (const alt of axis.alts) add(axis, alt)
  if (variants.length < 7) return null
  return [structuredClone(answer), ...variants.slice(0, 7)]
}

function tryBuild(r: Rng, level: number, mode: DistractorMode): Item | null {
  const cfg = LEVELS[level - 1]
  const plans = planItem(r, cfg)
  if (!plans) return null

  const grids = new Map<string, Grid>()
  const rules: Rule[] = []
  const bases: Component[] = plans.map((plan, comp) => {
    for (const rule of plan.rules) {
      const built = buildRule(r, rule, cfg, plan)
      grids.set(`${comp}.${rule.attr}`, built.grid)
      const side = plans.length === 2 ? (comp === 0 ? 'Слева. ' : 'Справа. ') : ''
      rules.push({ type: rule.type, comp, attr: rule.attr, text: side + built.text })
    }
    return plan.kind === 'lines' ? { kind: 'lines', edges: 0 } : constantFigure(r, plan, cfg)
  })

  addRowConstants(r, plans, rules.length, grids)
  const notes = plans.flatMap((plan, comp) =>
    plan.rowConstant.map((attr) => {
      const side = plans.length === 2 ? (comp === 0 ? 'Слева. ' : 'Справа. ') : ''
      return `${side}${ATTR_NAME[attr]}: одинаково внутри строки.`
    }),
  )

  const cells: Panel[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const panel = structuredClone(bases)
      panel.forEach((c, comp) => {
        const target = c as unknown as Record<Attr, number>
        const attrs: Attr[] = [...plans[comp].rules.map((x) => x.attr), ...plans[comp].rowConstant]
        for (const attr of attrs) target[attr] = (grids.get(`${comp}.${attr}`) as Grid)[row][col]
      })
      cells.push(panel)
    }
  }

  const answer = cells[8]
  const { rule, extra } = buildAxes(r, plans, grids, answer, cfg)
  const axes = rule.length >= 3 ? rule.slice(0, 4) : [...rule, ...extra].slice(0, 3)
  const raw = mode === 'balanced' ? balancedOptions(answer, axes) : singleChangeOptions(r, answer, rule, extra)
  if (!raw) return null
  if (new Set(raw.map((p) => JSON.stringify(p))).size !== raw.length) return null

  const order = r.shuffle(raw.map((_, i) => i))
  const options = order.map((i) => raw[i])
  const panels = cells.slice(0, 8)
  const index = order.indexOf(0)

  const solution = solve(panels, options)
  if (solution.status !== 'unique' || solution.index !== index) return null

  const score =
    rules.reduce((sum, x) => sum + RULE_WEIGHT[x.type], 0) +
    0.5 * (rules.length - 1) +
    0.5 * (plans.length - 1) +
    (cfg.near ? 0.5 : 0)

  return { level, difficulty: Math.round(score * 10) / 10, panels, options, answer: index, rules, notes }
}

export function generateItem(seed: string, level: number, mode: DistractorMode = 'balanced'): Item {
  if (!Number.isInteger(level) || level < 1 || level > LEVELS.length) throw new RangeError(`bad level ${level}`)
  const r = new Rng(`${seed}:${level}:${mode}`)
  for (let attempt = 0; attempt < 2000; attempt++) {
    const item = tryBuild(r, level, mode)
    if (item) return item
  }
  throw new Error(`no valid item for level ${level}, seed ${seed}`)
}
