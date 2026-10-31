import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeNorm, MIN_NORM, MIN_TAIL, toIq } from '../src/norms.ts'
import { estimateAbility } from '../src/scoring.ts'

const all = (correct: boolean, difficulty = 4.5, n = 12) => Array.from({ length: n }, () => ({ difficulty, correct }))

test('more correct answers give a higher ability and more answers less doubt', () => {
  assert.ok(estimateAbility(all(true)).theta > estimateAbility(all(false)).theta)
  assert.ok(estimateAbility(all(true, 4.5, 12)).sd < estimateAbility(all(true, 4.5, 2)).sd)
})

test('solving hard items is worth more than solving easy ones', () => {
  assert.ok(estimateAbility(all(true, 8)).theta > estimateAbility(all(true, 2)).theta)
})

test('a lucky answer on a hard item barely counts', () => {
  const wrong = all(false, 2, 11)
  const lucky = estimateAbility([...wrong, { difficulty: 8, correct: true }]).theta
  const earned = estimateAbility([...wrong, { difficulty: 2, correct: true }]).theta
  const base = estimateAbility(wrong).theta
  assert.ok(lucky - base < 0.5, `lucky moved by ${lucky - base}`)
  assert.ok(Number.isFinite(earned))
})

test('IQ formula and norm scale', () => {
  assert.equal(toIq(0, 0.3, null).value, 100)
  assert.equal(toIq(1, 0.3, null).value, 115)
  assert.equal(toIq(1, 0.3, { mean: 1, sd: 0.5, n: MIN_NORM }).value, 100)
  assert.equal(toIq(1.5, 0.3, { mean: 1, sd: 0.5, n: MIN_NORM }).value, 115)
})

test('scores past 130 and 70 stay capped until there is enough data', () => {
  assert.equal(toIq(2.5, 0.2, null).text, '130+')
  assert.equal(toIq(-2.5, 0.2, null).text, '< 70')
  assert.equal(toIq(2.5, 0.2, { mean: 0, sd: 1, n: MIN_TAIL }).text, '138')
})

test('range reads naturally at the capped ends', () => {
  assert.equal(toIq(0, 0.3, null).range, 'от 91 до 109')
  assert.equal(toIq(1.6, 0.3, null).range, 'от 115')
  assert.equal(toIq(-1.6, 0.3, null).range, 'до 85')
  assert.equal(toIq(3, 0.2, null).range, '')
})

test('no norm below the minimum sample', () => {
  const rows = Array.from({ length: MIN_NORM - 1 }, () => ({ theta: 0, tertiary: true }))
  assert.equal(computeNorm(rows, true), null)
})

test('education weighting corrects a sample with too many graduates', () => {
  const rows = [
    ...Array.from({ length: 800 }, (_, i) => ({ theta: 1 + (i % 2) * 0.1, tertiary: true })),
    ...Array.from({ length: 200 }, (_, i) => ({ theta: 0 + (i % 2) * 0.1, tertiary: false })),
  ]
  const raw = computeNorm(rows, false)
  const weighted = computeNorm(rows, true)
  assert.ok(raw && weighted)
  assert.ok(weighted.mean < raw.mean)
  assert.ok(Math.abs(weighted.mean - (0.41 * 1.05 + 0.59 * 0.05)) < 1e-9)
})
