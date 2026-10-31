export type Family = 'regular' | 'asym'
export type FigureAttr = 'shape' | 'count' | 'size' | 'fill' | 'angle'
export type Attr = FigureAttr | 'edges'
export type RuleType = 'progression' | 'rotation' | 'latin' | 'arithmetic' | 'union' | 'xor'

export type Figure = {
  kind: 'figure'
  family: Family
  shape: number
  count: number
  size: number
  fill: number
  angle: number
}
export type Lines = { kind: 'lines'; edges: number }
export type Component = Figure | Lines
export type Panel = Component[]

export type Rule = { type: RuleType; comp: number; attr: Attr; text: string }

export type Item = {
  level: number
  difficulty: number
  panels: Panel[] // 8 visible cells, row by row
  options: Panel[] // 8 candidates
  answer: number
  rules: Rule[]
  notes: string[] // easy background patterns, not counted as rules
}

export const EDGE_COUNT = 16
export const ALL_EDGES = (1 << EDGE_COUNT) - 1

export const RANGE: Record<FigureAttr, [number, number]> = {
  shape: [0, 3],
  count: [1, 9],
  size: [0, 4],
  fill: [0, 4],
  angle: [0, 7],
}
