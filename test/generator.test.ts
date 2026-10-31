import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateItem, LEVELS } from '../src/generator.ts'
import { features, solve } from '../src/solver.ts'

const levels = LEVELS.map((_, i) => i + 1)

test('same seed gives the same item, another seed gives another', () => {
  assert.deepEqual(generateItem('a', 5), generateItem('a', 5))
  assert.notDeepEqual(generateItem('a', 5), generateItem('b', 5))
})

test('independent solver finds exactly the stored answer on every level', () => {
  for (const level of levels) {
    for (let k = 0; k < 300; k++) {
      const item = generateItem(`t${k}`, level)
      assert.deepEqual(solve(item.panels, item.options), { status: 'unique', index: item.answer })
    }
  }
})

test('level sets the number of rules and all options differ', () => {
  for (const level of levels) {
    for (let k = 0; k < 100; k++) {
      const item = generateItem(`n${k}`, level)
      assert.equal(item.rules.length, LEVELS[level - 1].rules)
      assert.equal(new Set(item.options.map((o) => JSON.stringify(o))).size, 8)
    }
  }
})

test('inside the options, the answer never holds the majority of any attribute value', () => {
  for (const level of levels) {
    for (let k = 0; k < 200; k++) {
      const item = generateItem(`b${k}`, level)
      const counts = new Map<string, number>()
      for (const o of item.options) for (const f of features(o)) counts.set(f, (counts.get(f) ?? 0) + 1)
      for (const f of features(item.options[item.answer])) {
        const n = counts.get(f) as number
        assert.ok(n === 8 || n <= 4, `level ${level}: ${f} appears ${n} of 8`)
      }
    }
  }
})
