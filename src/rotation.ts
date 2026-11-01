import { Rng } from './rng.ts'
import { solveRotation } from './rotation-solver.ts'
import type { Cube } from './rotation-solver.ts'

// Mental rotation: figures of cubes. One option is the reference turned in space.
// With mirrors, the options form three mirror pairs, so finding the pair is not enough
// and no option stands out without being compared with the reference.

export type RotationItem = {
  level: number
  difficulty: number
  reference: Cube[]
  options: Cube[][]
  answer: number
  guess: number
}

type Config = { cubes: number; moved: number; mirrors: boolean; turns: number }

export const ROTATION_LEVELS: Config[] = [
  { cubes: 6, moved: 2, mirrors: false, turns: 1 },
  { cubes: 6, moved: 1, mirrors: false, turns: 1 },
  { cubes: 6, moved: 2, mirrors: true, turns: 1 },
  { cubes: 7, moved: 1, mirrors: true, turns: 1 },
  { cubes: 7, moved: 1, mirrors: true, turns: 2 },
  { cubes: 8, moved: 1, mirrors: true, turns: 2 },
  { cubes: 9, moved: 1, mirrors: true, turns: 3 },
  { cubes: 10, moved: 1, mirrors: true, turns: 3 },
]

const OPTION_COUNT = 6
const MAX_FRAGMENTS = 1
type Matrix = number[][]

const apply = (m: Matrix, c: Cube): Cube => [0, 1, 2].map((i) => m[i][0] * c[0] + m[i][1] * c[1] + m[i][2] * c[2]) as Cube
const times = (a: Matrix, b: Matrix): Matrix => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]))

// Quarter turns about each axis. A rotation's depth is how many it takes to reach it.
const QUARTERS: Matrix[] = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
  [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 1, 0], [-1, 0, 0], [0, 0, 1]],
]

const BY_DEPTH: Matrix[][] = (() => {
  const identity: Matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  const seen = new Set([JSON.stringify(identity)])
  const layers: Matrix[][] = [[identity]]
  while (seen.size < 24) {
    const next: Matrix[] = []
    for (const m of layers[layers.length - 1]) {
      for (const q of QUARTERS) {
        const r = times(q, m)
        const key = JSON.stringify(r)
        if (!seen.has(key)) {
          seen.add(key)
          next.push(r)
        }
      }
    }
    layers.push(next)
  }
  return layers
})()
const ALL_ROTATIONS = BY_DEPTH.flat()

function normalize(cubes: Cube[]): Cube[] {
  const min = [0, 1, 2].map((i) => Math.min(...cubes.map((c) => c[i])))
  return cubes.map((c) => c.map((v, i) => v - min[i]) as Cube).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
}

const key = (cubes: Cube[]) => JSON.stringify(normalize(cubes))
const classKey = (cubes: Cube[]) => ALL_ROTATIONS.map((m) => key(cubes.map((c) => apply(m, c)))).sort()[0]
const mirror = (cubes: Cube[]): Cube[] => normalize(cubes.map(([x, y, z]) => [-x, y, z]))
const DIRS: Cube[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const add = (a: Cube, b: Cube): Cube => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const has = (cubes: Cube[], c: Cube) => cubes.some((x) => x[0] === c[0] && x[1] === c[1] && x[2] === c[2])
const neighbours = (cubes: Cube[], c: Cube) => DIRS.filter((d) => has(cubes, add(c, d))).length
const span = (cubes: Cube[]) => [0, 1, 2].map((i) => Math.max(...cubes.map((c) => c[i])) - Math.min(...cubes.map((c) => c[i])) + 1)

// What can be told without turning anything: the outer box and how the figure branches.
function profile(cubes: Cube[]): string {
  const branching = cubes.map((c) => neighbours(cubes, c)).sort().join('')
  return `${[...span(cubes)].sort().join()}|${branching}`
}

function connected(cubes: Cube[]): boolean {
  const seen: Cube[] = [cubes[0]]
  for (let i = 0; i < seen.length; i++) {
    for (const d of DIRS) {
      const n = add(seen[i], d)
      if (has(cubes, n) && !has(seen, n)) seen.push(n)
    }
  }
  return seen.length === cubes.length
}

// Usable means turning it always changes it, and its mirror image is a different figure.
function usable(cubes: Cube[]): boolean {
  if (span(cubes).some((s) => s < 2 || s > 4)) return false
  if (new Set(ALL_ROTATIONS.map((m) => key(cubes.map((c) => apply(m, c))))).size !== 24) return false
  return classKey(cubes) !== classKey(mirror(cubes))
}

function grow(r: Rng, count: number): Cube[] | null {
  const cubes: Cube[] = [[0, 0, 0]]
  for (let tries = 0; cubes.length < count && tries < 200; tries++) {
    // Mostly extend the end, so figures look like bent arms rather than clumps.
    const from = r.next() < 0.75 ? cubes[cubes.length - 1] : r.pick(cubes)
    const c = add(from, r.pick(DIRS))
    if (!has(cubes, c) && neighbours(cubes, c) === 1) cubes.push(c)
  }
  return cubes.length === count && usable(cubes) ? normalize(cubes) : null
}

function moveCubes(r: Rng, figure: Cube[], moves: number): Cube[] | null {
  let cubes = figure
  for (let m = 0; m < moves; m++) {
    const removable = r.shuffle(cubes).find((c) => connected(cubes.filter((x) => x !== c)))
    if (!removable) return null
    const rest = cubes.filter((x) => x !== removable)
    const spots = r
      .shuffle(rest.flatMap((c) => DIRS.map((d) => add(c, d))))
      .filter((c) => !has(rest, c) && (c[0] !== removable[0] || c[1] !== removable[1] || c[2] !== removable[2]) && neighbours(rest, c) === 1)
    if (spots.length === 0) return null
    cubes = [...rest, spots[0]]
  }
  return usable(cubes) ? normalize(cubes) : null
}

// What a person sees. Looking along (1,1,1), each cube face covers two triangles of a
// flat lattice; the nearest face wins each triangle.
type Face = { axis: 0 | 1 | 2; corners: Cube[] }

function facesOf([x, y, z]: Cube): Face[] {
  return [
    { axis: 2, corners: [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]] },
    { axis: 0, corners: [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]] },
    { axis: 1, corners: [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]] },
  ]
}

const flat = ([x, y, z]: Cube) => [x - z, y - z]

export function visible(cubes: Cube[]): { signature: string; cubesSeen: number; fragments: number } {
  const seen = new Map<string, { depth: number; cube: number; axis: number }>()
  cubes.forEach(([x, y, z], cube) => {
    for (const face of facesOf([x, y, z])) {
      const p = face.corners.map(flat)
      // Split along the lattice diagonal so neighbouring faces share triangle shapes.
      const d02 = Math.abs(p[0][0] - p[2][0]) === 1 && Math.abs(p[0][1] - p[2][1]) === 1 && (p[0][0] - p[2][0]) * (p[0][1] - p[2][1]) > 0
      const tris = d02 ? [[p[0], p[1], p[2]], [p[0], p[2], p[3]]] : [[p[1], p[2], p[3]], [p[1], p[3], p[0]]]
      const depth = face.corners.reduce((s, c) => s + c[0] + c[1] + c[2], 0)
      for (const t of tris) {
        const k = t.map((q) => q.join(',')).sort().join('|')
        const old = seen.get(k)
        if (!old || depth > old.depth) seen.set(k, { depth, cube, axis: face.axis })
      }
    }
  })
  const counts = new Map<number, number>()
  for (const v of seen.values()) counts.set(v.cube, (counts.get(v.cube) ?? 0) + 1)
  const cubesSeen = [...counts.values()].filter((n) => n >= 3).length
  // A face cut in half by a nearer cube is drawn as a stray wedge.
  const perFace = new Map<string, number>()
  for (const v of seen.values()) perFace.set(`${v.cube}:${v.axis}`, (perFace.get(`${v.cube}:${v.axis}`) ?? 0) + 1)
  const fragments = [...perFace.values()].filter((n) => n === 1).length
  const signature = [...seen.entries()].map(([k, v]) => `${k}:${v.axis}`).sort().join(' ')
  return { signature, cubesSeen, fragments }
}

// A cube that cannot be seen, or two views that look the same, would make an item unfair.
function clearView(r: Rng, cubes: Cube[], turns: Matrix[], used: Set<string>): Cube[] | null {
  for (const m of r.shuffle(turns)) {
    const view = normalize(cubes.map((c) => apply(m, c)))
    const { signature, cubesSeen, fragments } = visible(view)
    if (cubesSeen === view.length && fragments <= MAX_FRAGMENTS && !used.has(signature)) {
      used.add(signature)
      return view
    }
  }
  return null
}

function tryBuild(r: Rng, level: number): RotationItem | null {
  const cfg = ROTATION_LEVELS[level - 1]
  const base = grow(r, cfg.cubes)
  if (!base) return null
  const used = new Set<string>()
  const reference = clearView(r, base, ALL_ROTATIONS, used)
  if (!reference) return null

  const shapes: Cube[][] = [reference]
  const wanted = profile(reference)
  const classes = new Set([classKey(reference), classKey(mirror(reference))])
  const addShape = (s: Cube[]) => {
    const k = classKey(s)
    if (classes.has(k)) return false
    classes.add(k)
    shapes.push(s)
    return true
  }
  if (cfg.mirrors) {
    shapes.push(mirror(reference))
    for (let tries = 0; shapes.length < OPTION_COUNT && tries < 200; tries++) {
      const other = moveCubes(r, reference, cfg.moved)
      if (other && profile(other) === wanted && !classes.has(classKey(mirror(other))) && addShape(other)) {
        classes.add(classKey(mirror(other)))
        shapes.push(mirror(other))
      }
    }
  } else {
    for (let tries = 0; shapes.length < OPTION_COUNT && tries < 200; tries++) {
      const other = moveCubes(r, reference, cfg.moved)
      if (other && profile(other) === wanted) addShape(other)
    }
  }
  if (shapes.length !== OPTION_COUNT) return null

  // Every option is turned equally far, so the amount of turning gives nothing away.
  const turns = BY_DEPTH[Math.min(cfg.turns, BY_DEPTH.length - 1)]
  const views: Cube[][] = []
  for (const s of shapes) {
    const view = clearView(r, s, turns, used)
    if (!view) return null
    views.push(view)
  }

  const order = r.shuffle(views.map((_, i) => i))
  const options = order.map((i) => views[i])
  const index = order.indexOf(0)
  const solution = solveRotation(reference, options)
  if (solution.status !== 'unique' || solution.index !== index) return null

  const difficulty = 0.5 + 0.7 * (cfg.cubes - 5) + (cfg.mirrors ? 1.6 : 0) + 0.8 * (cfg.turns - 1) + (cfg.moved === 1 ? 0.5 : 0)
  return { level, difficulty: Math.round(difficulty * 10) / 10, reference, options, answer: index, guess: 1 / OPTION_COUNT }
}

export function generateRotation(seed: string, level: number): RotationItem {
  if (!Number.isInteger(level) || level < 1 || level > ROTATION_LEVELS.length) throw new RangeError(`bad level ${level}`)
  const r = new Rng(`rotation:${seed}:${level}`)
  for (let attempt = 0; attempt < 5000; attempt++) {
    const item = tryBuild(r, level)
    if (item) return item
  }
  throw new Error(`no valid rotation item for level ${level}, seed ${seed}`)
}

const INK = '#111111'
const SHADES = ['#d6d6d6', '#9c9c9c', '#ffffff'] // faces along x, y, z
const n = (v: number) => String(Math.round(v * 100) / 100)
const project = ([x, y, z]: Cube) => [(x - y) * 0.866, (x + y) * 0.5 - z]

function bounds(cubes: Cube[]) {
  const pts = cubes.flatMap((c) => facesOf(c).flatMap((f) => f.corners)).map(project)
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) }
}

function figureSvg(cubes: Cube[], unit: number): string {
  const b = bounds(cubes)
  const ox = 50 - (unit * (b.x0 + b.x1)) / 2
  const oy = 50 - (unit * (b.y0 + b.y1)) / 2
  const sorted = [...cubes].sort((a, c) => a[0] + a[1] + a[2] - (c[0] + c[1] + c[2]))
  let body = ''
  for (const c of sorted) {
    for (const f of facesOf(c)) {
      const pts = f.corners.map(project).map(([x, y]) => `${n(ox + unit * x)},${n(oy + unit * y)}`).join(' ')
      body += `<polygon points="${pts}" fill="${SHADES[f.axis]}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`
}

// One scale for every figure in the item, so size says nothing.
export function renderRotation(item: RotationItem): { panels: string[]; options: string[] } {
  const all = [item.reference, ...item.options]
  const largest = Math.max(...all.map((c) => { const b = bounds(c); return Math.max(b.x1 - b.x0, b.y1 - b.y0) }))
  const unit = 88 / largest
  return { panels: [figureSvg(item.reference, unit)], options: item.options.map((o) => figureSvg(o, unit)) }
}
