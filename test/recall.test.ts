import assert from 'node:assert/strict'
import { test } from 'node:test'
import { figureSvg, generateRecall, placedSvg, RECALL_COUNT, recallOrder } from '../src/recall.ts'

test('same seed gives the same set, another seed gives another', () => {
  assert.deepEqual(generateRecall('a'), generateRecall('a'))
  assert.notDeepEqual(generateRecall('a'), generateRecall('b'))
})

test('each figure has its own shape and its own cell', () => {
  for (let k = 0; k < 200; k++) {
    const { pairs } = generateRecall(`t${k}`)
    assert.equal(pairs.length, RECALL_COUNT)
    assert.equal(new Set(pairs.map((p) => p.cell)).size, RECALL_COUNT)
    assert.equal(new Set(pairs.map((p) => p.shape)).size, RECALL_COUNT)
  }
})

test('no cell is favoured, so a habit of clicking one place earns nothing extra', () => {
  const counts = Array(16).fill(0)
  for (let k = 0; k < 4000; k++) for (const p of generateRecall(`u${k}`).pairs) counts[p.cell]++
  for (const c of counts) assert.ok(Math.abs(c / 4000 - 0.5) < 0.05, String(c))
})

test('the two checks ask in different orders and cover every figure', () => {
  const set = generateRecall('o')
  const a = recallOrder(set, 'first')
  const b = recallOrder(set, 'second')
  assert.deepEqual([...a].sort(), [...b].sort())
  assert.notDeepEqual(a, b)
})

test('asking shows only the figure, never its place', () => {
  const { shape, cell } = generateRecall('d').pairs[0]
  assert.ok(!figureSvg(shape).includes('translate'))
  assert.ok(placedSvg(shape, cell).includes('translate'))
})
