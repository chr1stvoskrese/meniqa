// Independent check: tests each option against the reference under all 24 rotations of
// a cube, found here by listing every axis permutation and sign with determinant +1.
// Knows nothing about how the item was built.

export type Cube = [number, number, number]

function rotations(): number[][][] {
  const out: number[][][] = []
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
  for (const p of perms) {
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        for (const sz of [1, -1]) {
          const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
          m[0][p[0]] = sx
          m[1][p[1]] = sy
          m[2][p[2]] = sz
          const det =
            m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
            m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
            m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
          if (det === 1) out.push(m)
        }
      }
    }
  }
  return out
}

const ALL = rotations()

function shapeKey(cubes: Cube[]): string {
  const min = [0, 1, 2].map((i) => Math.min(...cubes.map((c) => c[i])))
  return cubes.map((c) => c.map((v, i) => v - min[i]).join(',')).sort().join(';')
}

export function congruent(a: Cube[], b: Cube[]): boolean {
  if (a.length !== b.length) return false
  const target = shapeKey(a)
  return ALL.some((m) => shapeKey(b.map((c) => [0, 1, 2].map((i) => m[i][0] * c[0] + m[i][1] * c[1] + m[i][2] * c[2]) as Cube)) === target)
}

export type RotationSolution = { status: 'unique'; index: number } | { status: 'no-option' | 'many-options' | 'twins' }

export function solveRotation(reference: Cube[], options: Cube[][]): RotationSolution {
  const fits = options.flatMap((o, i) => (congruent(reference, o) ? [i] : []))
  if (fits.length === 0) return { status: 'no-option' }
  if (fits.length > 1) return { status: 'many-options' }
  // Two identical shapes among the options would let the right one stand out as the odd one.
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) if (congruent(options[i], options[j])) return { status: 'twins' }
  }
  return { status: 'unique', index: fits[0] }
}
