// Ability is estimated with a 3-parameter model. The guessing parameter is what
// makes a lucky answer count for little: with 8 options, c = 1/8; with 6, 1/6.
const DEFAULT_GUESS = 1 / 8
const DISCRIMINATION = 1.2

// Starting guess: item difficulty 4.5 is average, 1.8 points is one standard
// deviation. To be replaced by values fitted from real answers.
const CENTRE = 4.5
const SPREAD = 1.8

export const itemLocation = (difficulty: number) => (difficulty - CENTRE) / SPREAD

export function chanceCorrect(theta: number, difficulty: number, guess = DEFAULT_GUESS): number {
  const logistic = 1 / (1 + Math.exp(-DISCRIMINATION * (theta - itemLocation(difficulty))))
  return guess + (1 - guess) * logistic
}

export type Answer = { difficulty: number; correct: boolean; guess?: number }

// Average over all possible abilities, weighted by how well each explains the
// answers. The spread of that weighting is the uncertainty of the estimate.
export function estimateAbility(answers: Answer[]): { theta: number; sd: number } {
  let total = 0
  let first = 0
  let second = 0
  for (let theta = -4; theta <= 4.0001; theta += 0.05) {
    let likelihood = Math.exp((-theta * theta) / 2)
    for (const a of answers) {
      const p = chanceCorrect(theta, a.difficulty, a.guess)
      likelihood *= a.correct ? p : 1 - p
    }
    total += likelihood
    first += theta * likelihood
    second += theta * theta * likelihood
  }
  const theta = first / total
  return { theta, sd: Math.sqrt(second / total - theta * theta) }
}
