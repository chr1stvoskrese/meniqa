import { generateItem, LEVELS } from './generator.ts'
import type { DistractorMode } from './generator.ts'
import { Rng } from './rng.ts'
import { features } from './solver.ts'
import type { Item, Panel } from './types.ts'

// Attacks that never try to solve the item. A sound item set keeps each of them
// near pure chance: 1 option in 8, 12.5%.

function pickBest(scores: number[], r: Rng): number {
  const top = Math.max(...scores)
  return r.pick(scores.flatMap((s, i) => (s === top ? [i] : [])))
}

function frequency(panels: Panel[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const p of panels) for (const f of features(p)) freq.set(f, (freq.get(f) ?? 0) + 1)
  return freq
}

// Most common attribute values across the options.
function modeAttack(item: Item, r: Rng): number {
  const freq = frequency(item.options)
  return pickBest(item.options.map((o) => features(o).reduce((s, f) => s + (freq.get(f) ?? 0), 0)), r)
}

// Option closest to all the others.
function centreAttack(item: Item, r: Rng): number {
  const sets = item.options.map((o) => new Set(features(o)))
  return pickBest(sets.map((a) => sets.reduce((s, b) => s + [...a].filter((f) => b.has(f)).length, 0)), r)
}

// Option that looks most like the matrix.
function matrixAttack(item: Item, r: Rng): number {
  const freq = frequency(item.panels)
  return pickBest(item.options.map((o) => features(o).reduce((s, f) => s + (freq.has(f) ? 1 : 0), 0)), r)
}

const ATTACKS = { mode: modeAttack, centre: centreAttack, matrix: matrixAttack }
const N = Number(process.argv[2] ?? 2000)
const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(7)

const r = new Rng('audit')
for (const mode of ['balanced', 'single-change'] as DistractorMode[]) {
  console.log(`\nWrong options: ${mode}. ${N} items per level. Chance = 12.5%.`)
  console.log('level rules difficulty |    mode  centre  matrix')
  LEVELS.forEach((cfg, i) => {
    const level = i + 1
    const hits = { mode: 0, centre: 0, matrix: 0 }
    let difficulty = 0
    for (let k = 0; k < N; k++) {
      const item = generateItem(`audit-${k}`, level, mode)
      difficulty += item.difficulty
      for (const [name, attack] of Object.entries(ATTACKS)) {
        if (attack(item, r) === item.answer) hits[name as keyof typeof hits]++
      }
    }
    console.log(
      `${String(level).padStart(5)} ${String(cfg.rules).padStart(5)} ${(difficulty / N).toFixed(1).padStart(10)} |` +
        `${pct(hits.mode / N)} ${pct(hits.centre / N)} ${pct(hits.matrix / N)}`,
    )
  })
}
