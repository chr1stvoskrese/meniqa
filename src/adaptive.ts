// How the test is put together, and the adaptive rule.
import { LEVELS } from './generator.ts'

export const SECTIONS = [
  { kind: 'matrix', count: 20, limitMs: 120_000 },
  { kind: 'balance', count: 12, limitMs: 90_000 },
  { kind: 'rotation', count: 12, limitMs: 90_000 },
  { kind: 'memory', count: 8, limitMs: 120_000 },
] as const

export const START_LEVEL = 2

// Solved: harder. Missed: easier.
export const nextLevel = (level: number, correct: boolean) => Math.max(1, Math.min(LEVELS.length, level + (correct ? 1 : -1)))
