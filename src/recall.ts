import { Rng } from './rng.ts'

// Delayed recall. A few figures on one board are learned mid-test and checked at once, so
// the person takes it as done. The same check returns unannounced at the end of the test.
// Only that late check says something about memory beyond a few seconds.

export const RECALL_COUNT = 5
export const RECALL_GRID = 4
export const RECALL_DIFFICULTY = 5 // starting guess, to be fitted from answers
export const RECALL_GUESS = 1 / (RECALL_GRID * RECALL_GRID)

export type RecallSet = { pairs: { shape: number; cell: number }[] }

const polygon = (sides: number, start: number, inner = 1): string => {
  const pts: string[] = []
  const count = inner < 1 ? sides * 2 : sides
  for (let i = 0; i < count; i++) {
    const r = inner < 1 && i % 2 ? 40 * inner : 40
    const t = ((start + (360 * i) / count) * Math.PI) / 180
    pts.push(`${(50 + r * Math.cos(t)).toFixed(1)},${(50 + r * Math.sin(t)).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

const SHAPES = [
  'M50,10A40,40 0 1 1 49.9,10Z', // circle
  polygon(4, 45), // square
  polygon(3, -90), // triangle
  polygon(4, 0), // diamond
  polygon(5, -90), // pentagon
  polygon(6, 0), // hexagon
  polygon(5, -90, 0.45), // star
  'M36,10H64V36H90V64H64V90H36V64H10V36H36Z', // cross
]

export function generateRecall(seed: string): RecallSet {
  const r = new Rng(`recall:${seed}`)
  const cells = r.shuffle([...Array(RECALL_GRID * RECALL_GRID).keys()]).slice(0, RECALL_COUNT)
  const shapes = r.shuffle(SHAPES.map((_, i) => i))
  return { pairs: cells.map((cell, i) => ({ shape: shapes[i], cell })) }
}

// Each check asks in its own order, so the sequence of learning does not help.
export function recallOrder(set: RecallSet, seed: string): number[] {
  return new Rng(`recall-order:${seed}`).shuffle(set.pairs.map((_, i) => i))
}

const figure = (shape: number) => `<path d="${SHAPES[shape]}" fill="#ffffff" stroke="#111111" stroke-width="3" stroke-linejoin="round"/>`

export function figureSvg(shape: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">${figure(shape)}</svg>`
}

export function boardSvg(pairs: RecallSet['pairs']): string {
  const size = 100 / RECALL_GRID
  let lines = ''
  for (let i = 1; i < RECALL_GRID; i++) {
    lines += `<line x1="${i * size}" y1="0" x2="${i * size}" y2="100" stroke="#e4e4e4" stroke-width="0.4"/><line x1="0" y1="${i * size}" x2="100" y2="${i * size}" stroke="#e4e4e4" stroke-width="0.4"/>`
  }
  const figures = pairs
    .map(({ shape, cell }) => {
      const x = (cell % RECALL_GRID) * size
      const y = Math.floor(cell / RECALL_GRID) * size
      return `<g transform="translate(${x + 2.5} ${y + 2.5}) scale(0.2)">${figure(shape)}</g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">${lines}${figures}</svg>`
}
