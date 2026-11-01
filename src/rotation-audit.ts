import { generateRotation, ROTATION_LEVELS, visible } from './rotation.ts'
import type { RotationItem } from './rotation.ts'
import { Rng } from './rng.ts'
import { congruent } from './rotation-solver.ts'
import type { Cube } from './rotation-solver.ts'

// Attacks that never turn a figure in the mind. Six options, so chance is 16.7%.
const N = Number(process.argv[2] ?? 300)
const r = new Rng('rotation-audit')

function best(scores: number[]): number {
  const top = Math.max(...scores)
  return r.pick(scores.flatMap((s, i) => (s === top ? [i] : [])))
}

const triangles = (c: Cube[]) => new Set(visible(c).signature.split(' '))
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length / new Set([...a, ...b]).size
const degree = (c: Cube[]) =>
  [...c].map((q) => c.filter((p) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) === 1).length).sort().join('')
const spanOf = (c: Cube[]) => [0, 1, 2].map((i) => Math.max(...c.map((q) => q[i])) - Math.min(...c.map((q) => q[i])) + 1)

const ATTACKS: Record<string, (i: RotationItem) => number> = {
  // Looks most like the reference on screen.
  lookalike: (i) => { const t = triangles(i.reference); return best(i.options.map((o) => overlap(triangles(o), t))) },
  // Looks most like the other options.
  centre: (i) => { const ts = i.options.map(triangles); return best(ts.map((a) => ts.reduce((s, b) => s + overlap(a, b), 0))) },
  // Takes up the most screen.
  largest: (i) => best(i.options.map((o) => triangles(o).size)),
  smallest: (i) => best(i.options.map((o) => -triangles(o).size)),
  // Same outer box as the reference, which any correct turn keeps.
  sameBox: (i) => { const b = spanOf(i.reference).sort().join(); return best(i.options.map((o) => (spanOf(o).sort().join() === b ? 1 : 0))) },
  // Same branching as the reference, which a turn also keeps. Mirrors share it.
  sameBranching: (i) => { const d = degree(i.reference); return best(i.options.map((o) => (degree(o) === d ? 1 : 0))) },
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(7)
console.log(`${N} items per level. Chance = 16.7%.`)
console.log(`level difficulty |${Object.keys(ATTACKS).map((a) => a.padStart(14)).join('')}`)
ROTATION_LEVELS.forEach((_, l) => {
  const level = l + 1
  const hits: Record<string, number> = {}
  let difficulty = 0
  for (let k = 0; k < N; k++) {
    const item = generateRotation(`audit-${k}`, level)
    difficulty += item.difficulty
    if (!congruent(item.reference, item.options[item.answer])) throw new Error('bad item')
    for (const [name, attack] of Object.entries(ATTACKS)) if (attack(item) === item.answer) hits[name] = (hits[name] ?? 0) + 1
  }
  console.log(`${String(level).padStart(5)} ${(difficulty / N).toFixed(1).padStart(10)} |${Object.keys(ATTACKS).map((a) => pct((hits[a] ?? 0) / N).padStart(14)).join('')}`)
})
