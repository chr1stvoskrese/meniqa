import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BALANCE_LEVELS, generateBalance, renderBalance } from '../src/balance.ts'
import { solveBalance } from '../src/balance-solver.ts'

const levels = BALANCE_LEVELS.map((_, i) => i + 1)

test('same seed gives the same item, another seed gives another', () => {
  assert.deepEqual(generateBalance('a', 5), generateBalance('a', 5))
  assert.notDeepEqual(generateBalance('a', 5), generateBalance('b', 5))
})

test('independent solver finds exactly the stored answer on every level', () => {
  for (const level of levels) {
    for (let k = 0; k < 40; k++) {
      const item = generateBalance(`t${k}`, level)
      assert.deepEqual(solveBalance(item.scales, item.target, item.options), { status: 'unique', index: item.answer })
    }
  }
})

test('solver refuses an item that leaves the weights open', () => {
  const scale = { left: [1, 0, 0], right: [0, 1, 0] }
  assert.equal(solveBalance([scale], [1, 0, 0], [[0, 0, 1], [0, 1, 0]]).status, 'undetermined')
})

test('solver refuses two right options and no right option', () => {
  const scale = { left: [2, 0], right: [0, 1] }
  assert.equal(solveBalance([scale], [0, 1], [[2, 0], [2, 0]]).status, 'many-options')
  assert.equal(solveBalance([scale], [0, 1], [[1, 0], [0, 2]]).status, 'no-option')
})

test('options differ, shown scales really balance, levels get harder', () => {
  let last = 0
  for (const level of levels) {
    const item = generateBalance('s', level)
    assert.equal(item.options.length, 6)
    assert.equal(new Set(item.options.map((o) => o.join())).size, 6)
    assert.equal(item.scales.length, BALANCE_LEVELS[level - 1].scales)
    assert.ok(item.difficulty > last - 0.6)
    last = item.difficulty
  }
})

test('drawing shows every scale, the blank scale and all options, without the answer', () => {
  const item = generateBalance('r', 7)
  const { panels, options } = renderBalance(item)
  assert.equal(panels.length, item.scales.length + 1)
  assert.equal(options.length, 6)
  assert.ok(panels[panels.length - 1].includes('>?<'))
  assert.ok(!JSON.stringify({ panels, options }).includes('answer'))
})
