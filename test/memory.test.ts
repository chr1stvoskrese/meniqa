import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateMemory, MEMORY_LEVELS, scoreMemory } from '../src/memory.ts'

const levels = MEMORY_LEVELS.map((_, i) => i + 1)

// Works the sum out from its text alone, separately from how it was made.
function evaluate(text: string): boolean {
  const m = /^(\d+) ([+−]) (\d+) = (-?\d+)$/.exec(text)
  assert.ok(m, text)
  const value = m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3])
  return value === Number(m[4])
}

test('same seed gives the same item, another seed gives another', () => {
  assert.deepEqual(generateMemory('a', 5), generateMemory('a', 5))
  assert.notDeepEqual(generateMemory('a', 5), generateMemory('b', 5))
})

test('cells are different and on the grid, and each sum is what it claims', () => {
  for (const level of levels) {
    for (let k = 0; k < 100; k++) {
      const item = generateMemory(`t${k}`, level)
      assert.equal(item.cells.length, MEMORY_LEVELS[level - 1])
      assert.equal(new Set(item.cells).size, item.cells.length)
      assert.ok(item.cells.every((c) => c >= 0 && c < item.grid * item.grid))
      for (const q of item.questions) assert.equal(evaluate(q.text), q.answer, q.text)
    }
  }
})

test('sums are about half true, so always answering one way fails them', () => {
  let yes = 0
  let n = 0
  for (let k = 0; k < 300; k++) {
    for (const q of generateMemory(`s${k}`, 8).questions) {
      n++
      if (q.answer) yes++
    }
  }
  assert.ok(Math.abs(yes / n - 0.5) < 0.05)
})

test('a run of neighbouring cells is not used', () => {
  const near = (a: number, b: number) => Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) + Math.abs(a % 4 - b % 4) === 1
  for (let k = 0; k < 200; k++) {
    const { cells } = generateMemory(`r${k}`, 3)
    assert.ok(!(near(cells[0], cells[1]) && near(cells[1], cells[2])))
  }
})

test('right needs the exact order and the sums', () => {
  const item = generateMemory('x', 3)
  const sums = item.questions.map((q) => q.answer)
  assert.ok(scoreMemory(item, item.cells, sums))
  assert.ok(!scoreMemory(item, [...item.cells].reverse(), sums))
  assert.ok(!scoreMemory(item, item.cells.slice(1), sums))
  assert.ok(scoreMemory(item, item.cells, [null, ...sums.slice(1)]))
  assert.ok(!scoreMemory(item, item.cells, sums.map(() => null)))
})
