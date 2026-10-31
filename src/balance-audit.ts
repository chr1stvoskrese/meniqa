import { BALANCE_LEVELS, generateBalance } from './balance.ts'
import type { BalanceItem } from './balance.ts'
import { Rng } from './rng.ts'

// Attacks that never work out a weight. Six options, so chance is 16.7%.
const N = Number(process.argv[2] ?? 500)
const r = new Rng('balance-audit')
const size = (m: number[]) => m.reduce((a, b) => a + b, 0)

function best(scores: number[]): number {
  const top = Math.max(...scores)
  return r.pick(scores.flatMap((s, i) => (s === top ? [i] : [])))
}

const ATTACKS: Record<string, (i: BalanceItem) => number> = {
  // Option closest to all the others.
  centre: (i) => best(i.options.map((a) => -i.options.reduce((s, b) => s + a.reduce((d, c, k) => d + Math.abs(c - b[k]), 0), 0))),
  // Most common shape counts across the options.
  mode: (i) => best(i.options.map((a) => a.reduce((s, c, k) => s + i.options.filter((b) => b[k] === c).length, 0))),
  // As many shapes as on the target side.
  sameCount: (i) => best(i.options.map((a) => -Math.abs(size(a) - size(i.target)))),
  fewest: (i) => best(i.options.map((a) => -size(a))),
  most: (i) => best(i.options.map((a) => size(a))),
  // Shapes that do not appear on the target side.
  noOverlap: (i) => best(i.options.map((a) => -a.reduce((s, c, k) => s + (c > 0 && i.target[k] > 0 ? 1 : 0), 0))),
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(7)
console.log(`${N} items per level. Chance = 16.7%.`)
console.log(`level difficulty |${Object.keys(ATTACKS).map((a) => a.padStart(10)).join('')}`)
BALANCE_LEVELS.forEach((_, l) => {
  const level = l + 1
  const hits: Record<string, number> = {}
  let difficulty = 0
  for (let k = 0; k < N; k++) {
    const item = generateBalance(`audit-${k}`, level)
    difficulty += item.difficulty
    for (const [name, attack] of Object.entries(ATTACKS)) if (attack(item) === item.answer) hits[name] = (hits[name] ?? 0) + 1
  }
  console.log(`${String(level).padStart(5)} ${(difficulty / N).toFixed(1).padStart(10)} |${Object.keys(ATTACKS).map((a) => pct((hits[a] ?? 0) / N).padStart(10)).join('')}`)
})
