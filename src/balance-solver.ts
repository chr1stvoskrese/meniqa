// Independent check: tries every assignment of whole weights and keeps those that
// satisfy all shown scales. Knows nothing about how the item was built. An option is
// right only if it balances the target under every assignment that remains.

export type Scale = { left: number[]; right: number[] }

const MAX_WEIGHT = 12

export type BalanceSolution = { status: 'unique'; index: number } | { status: 'undetermined' | 'no-weights' | 'no-option' | 'many-options' }

function assignments(n: number, visit: (w: number[]) => void): void {
  const w = Array(n).fill(1)
  const walk = (i: number) => {
    if (i === n) return visit(w)
    for (let v = 1; v <= MAX_WEIGHT; v++) {
      w[i] = v
      walk(i + 1)
    }
  }
  walk(0)
}

const weigh = (m: number[], w: number[]) => m.reduce((s, c, i) => s + c * w[i], 0)

export function solveBalance(scales: Scale[], target: number[], options: number[][]): BalanceSolution {
  const n = target.length
  const solutions: number[][] = []
  assignments(n, (w) => {
    if (scales.every((s) => weigh(s.left, w) === weigh(s.right, w))) solutions.push([...w])
  })
  if (solutions.length === 0) return { status: 'no-weights' }
  // All solutions must be scaled copies of one another, so nothing is left to guess.
  const [first] = solutions
  const proportional = solutions.every((w) => w.every((v, i) => v * first[0] === first[i] * w[0]))
  if (!proportional) return { status: 'undetermined' }
  const fits = options.flatMap((o, i) => (solutions.every((w) => weigh(o, w) === weigh(target, w)) ? [i] : []))
  if (fits.length === 0) return { status: 'no-option' }
  if (fits.length > 1) return { status: 'many-options' }
  return { status: 'unique', index: fits[0] }
}
