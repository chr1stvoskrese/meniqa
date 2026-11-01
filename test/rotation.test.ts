import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateRotation, renderRotation, ROTATION_LEVELS, visible } from '../src/rotation.ts'
import { congruent, solveRotation } from '../src/rotation-solver.ts'
import type { Cube } from '../src/rotation-solver.ts'

const levels = ROTATION_LEVELS.map((_, i) => i + 1)
const L: Cube[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1]]
const mirrored = L.map(([x, y, z]) => [-x, y, z]) as Cube[]
const turned = L.map(([x, y, z]) => [-y, x, z]) as Cube[]

test('a turned figure matches, a mirror image does not', () => {
  assert.ok(congruent(L, turned))
  assert.ok(!congruent(L, mirrored))
})

test('solver refuses no match, two matches and identical options', () => {
  const other: Cube[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0], [1, 0, 1]]
  assert.equal(solveRotation(L, [mirrored, other]).status, 'no-option')
  assert.equal(solveRotation(L, [L, turned]).status, 'many-options')
  assert.equal(solveRotation(L, [turned, other, other]).status, 'twins')
  assert.deepEqual(solveRotation(L, [other, turned, mirrored]), { status: 'unique', index: 1 })
})

test('same seed gives the same item, another seed gives another', () => {
  assert.deepEqual(generateRotation('a', 5), generateRotation('a', 5))
  assert.notDeepEqual(generateRotation('a', 5), generateRotation('b', 5))
})

test('independent solver finds exactly the stored answer on every level', () => {
  for (const level of levels) {
    for (let k = 0; k < 40; k++) {
      const item = generateRotation(`t${k}`, level)
      assert.deepEqual(solveRotation(item.reference, item.options), { status: 'unique', index: item.answer })
    }
  }
})

test('with mirrors, the options come as three mirror pairs', () => {
  for (const level of levels.filter((l) => ROTATION_LEVELS[l - 1].mirrors)) {
    const item = generateRotation('m', level)
    for (const o of item.options) {
      const flip = o.map(([x, y, z]) => [-x, y, z]) as Cube[]
      assert.equal(item.options.filter((p) => congruent(flip, p)).length, 1)
    }
  }
})

test('every cube can be seen and all views look different', () => {
  for (const level of levels) {
    for (let k = 0; k < 15; k++) {
      const item = generateRotation(`v${k}`, level)
      const views = [item.reference, ...item.options]
      for (const v of views) {
        assert.equal(visible(v).cubesSeen, v.length)
        assert.ok(visible(v).fragments <= 1)
      }
      assert.equal(new Set(views.map((v) => visible(v).signature)).size, 7)
    }
  }
})

test('all figures in an item have the same number of cubes, and the drawing has no answer', () => {
  const item = generateRotation('r', 7)
  for (const o of item.options) assert.equal(o.length, item.reference.length)
  const { panels, options } = renderRotation(item)
  assert.equal(panels.length, 1)
  assert.equal(options.length, 6)
  assert.ok(!JSON.stringify({ panels, options }).includes('answer'))
})
