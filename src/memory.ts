import { Rng } from './rng.ts'

// Remembering while working. Short true-or-false sums alternate with cells lit on a grid,
// and the cells must then be restored in order. The sums block silent rehearsal, which is
// why this measures working memory rather than how long a list can be repeated.

export type MemoryItem = {
  level: number
  difficulty: number
  guess: number
  grid: number
  cells: number[]
  questions: { text: string; answer: boolean }[]
}

export const MEMORY_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9] // cells to remember
const GRID = 4

function question(r: Rng): { text: string; answer: boolean } {
  const a = r.int(2, 12)
  const b = r.int(2, 9)
  const plus = r.next() < 0.5
  const big = plus ? a : a + b
  const truth = plus ? a + b : a
  const answer = r.next() < 0.5
  const shown = answer ? truth : truth + r.pick([-2, -1, 1, 2])
  return { text: `${big} ${plus ? '+' : '−'} ${b} = ${shown}`, answer }
}

const rowOf = (c: number) => Math.floor(c / GRID)
const colOf = (c: number) => c % GRID

// A straight line or a run along the grid is one thing to remember, not several.
function hasEasyShape(cells: number[]): boolean {
  if (cells.length < 3) return false
  let run = 1
  for (let i = 1; i < cells.length; i++) {
    const near = Math.abs(rowOf(cells[i]) - rowOf(cells[i - 1])) + Math.abs(colOf(cells[i]) - colOf(cells[i - 1])) === 1
    run = near ? run + 1 : 1
    if (run >= 3) return true
  }
  return new Set(cells.map(rowOf)).size === 1 || new Set(cells.map(colOf)).size === 1
}

export function generateMemory(seed: string, level: number): MemoryItem {
  if (!Number.isInteger(level) || level < 1 || level > MEMORY_LEVELS.length) throw new RangeError(`bad level ${level}`)
  const r = new Rng(`memory:${seed}:${level}`)
  const count = MEMORY_LEVELS[level - 1]
  const all = [...Array(GRID * GRID).keys()]
  let cells = r.shuffle(all).slice(0, count)
  for (let tries = 0; hasEasyShape(cells) && tries < 500; tries++) cells = r.shuffle(all).slice(0, count)
  const questions = cells.map(() => question(r))
  return { level, difficulty: Math.round((1.2 + (count - 2) * 1.07) * 10) / 10, guess: 0.01, grid: GRID, cells, questions }
}

// Right means every cell in its place, with at most one sum missed. Without that second
// condition, ignoring the sums and rehearsing would pay.
export function scoreMemory(item: MemoryItem, recall: number[], sums: (boolean | null)[]): boolean {
  const same = recall.length === item.cells.length && recall.every((c, i) => c === item.cells[i])
  const right = item.questions.filter((q, i) => sums[i] === q.answer).length
  return same && right >= item.questions.length - 1
}
