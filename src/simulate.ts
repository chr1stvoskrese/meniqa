import { generateItem } from './generator.ts'
import { Rng } from './rng.ts'
import { chanceCorrect, estimateAbility } from './scoring.ts'
import type { Answer } from './scoring.ts'
import { nextLevel, SECTIONS, START_LEVEL } from './adaptive.ts'
import { generateBalance } from './balance.ts'
import { generateMemory } from './memory.ts'
import { generateRotation } from './rotation.ts'

// Simulated people who behave exactly as the model assumes. This only checks that
// the arithmetic works. It says nothing about whether the test measures real ability.

const N = Number(process.argv[2] ?? 1500)
const r = new Rng('simulate')
const difficulty = new Map<string, number>()

function difficultyOf(kind: string, level: number, k: number): number {
  const key = `${kind}:${level}:${k % 40}`
  const build = kind === 'matrix' ? generateItem : kind === 'balance' ? generateBalance : kind === 'rotation' ? generateRotation : generateMemory
  if (!difficulty.has(key)) difficulty.set(key, build(key, level).difficulty)
  return difficulty.get(key) as number
}

function gaussian(): number {
  return Math.sqrt(-2 * Math.log(1 - r.next())) * Math.cos(2 * Math.PI * r.next())
}

function run(answer: (d: number, guess: number) => boolean, k: number): { theta: number; sd: number } {
  const answers: Answer[] = []
  for (const section of SECTIONS) {
    let level = START_LEVEL
    const guess = section.kind === 'matrix' ? 1 / 8 : section.kind === 'memory' ? 0.01 : 1 / 6
    for (let i = 0; i < section.count; i++) {
      const d = difficultyOf(section.kind, level, k + i)
      const correct = answer(d, guess)
      answers.push({ difficulty: d, correct, guess })
      level = nextLevel(level, correct)
    }
  }
  return estimateAbility(answers)
}

const iq = (t: number) => 100 + 15 * t
const truth: number[] = []
const found: number[] = []
let inside = 0
let width = 0
for (let k = 0; k < N; k++) {
  const theta = gaussian()
  const est = run((d, g) => r.next() < chanceCorrect(theta, d, g), k)
  truth.push(theta)
  found.push(est.theta)
  if (Math.abs(est.theta - theta) <= 1.96 * est.sd) inside++
  width += 2 * 1.96 * est.sd * 15
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const mt = mean(truth)
const mf = mean(found)
const cov = mean(truth.map((t, i) => (t - mt) * (found[i] - mf)))
const corr = cov / Math.sqrt(mean(truth.map((t) => (t - mt) ** 2)) * mean(found.map((f) => (f - mf) ** 2)))

const guessers = Array.from({ length: N }, (_, k) => iq(run((_d, g) => r.next() < g, k).theta))
const perfect = iq(run(() => true, 0).theta)
const zero = iq(run(() => false, 0).theta)

console.log(`Simulated people: ${N}. Items per test: ${SECTIONS.reduce((s, x) => s + x.count, 0)}.`)
console.log(`Correlation, true vs estimated: ${corr.toFixed(2)}`)
console.log(`True value inside the shown range: ${((100 * inside) / N).toFixed(1)}%`)
console.log(`Average range width: ${(width / N).toFixed(0)} IQ points`)
console.log(`Random guesser, average IQ: ${mean(guessers).toFixed(0)}`)
console.log(`All correct: ${perfect.toFixed(0)}. All wrong: ${zero.toFixed(0)}.`)
