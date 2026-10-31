// A band switches to real norms at MIN_NORM people. Exact scores beyond 70 and
// 130 need far more people, since only about 2% fall past each. Both numbers are
// starting choices, not standards.
export const MIN_NORM = 500
export const MIN_TAIL = 5000

// Adults aged 25-64 with a degree, OECD average: NCES, citing OECD, 2022.
// https://nces.ed.gov/FastFacts/display.asp?id=71
// OECD countries only, so this does not describe the whole world.
export const POPULATION_TERTIARY = 0.41

const BANDS: [number, number][] = [[16, 24], [25, 34], [35, 44], [45, 54], [55, 64], [65, 90]]

export function ageBand(age: number): [number, number] {
  return BANDS.find(([lo, hi]) => age >= lo && age <= hi) ?? BANDS[BANDS.length - 1]
}

export type NormRow = { theta: number; tertiary: boolean }
export type Norm = { mean: number; sd: number; n: number }

// Online samples hold too many graduates, so each group is weighted back to its
// population share. Under 25 many have not finished studying: no weighting.
export function computeNorm(rows: NormRow[], weightEducation: boolean): Norm | null {
  if (rows.length < MIN_NORM) return null
  const share = rows.filter((r) => r.tertiary).length / rows.length
  const usable = weightEducation && share > 0 && share < 1
  const weight = (r: NormRow) => {
    if (!usable) return 1
    return r.tertiary ? POPULATION_TERTIARY / share : (1 - POPULATION_TERTIARY) / (1 - share)
  }
  const sum = rows.reduce((s, r) => s + weight(r), 0)
  const mean = rows.reduce((s, r) => s + weight(r) * r.theta, 0) / sum
  const variance = rows.reduce((s, r) => s + weight(r) * (r.theta - mean) ** 2, 0) / sum
  const sd = Math.sqrt(variance)
  return sd > 0 ? { mean, sd, n: rows.length } : null
}

export type IqResult = { text: string; range: string; status: 'provisional' | 'norm'; value: number; low: number; high: number }

// IQ = 100 + 15 z. Without a norm, z is the ability on the assumed scale.
export function toIq(theta: number, thetaSd: number, norm: Norm | null): IqResult {
  const mean = norm?.mean ?? 0
  const sd = norm?.sd ?? 1
  const iq = (t: number) => Math.round(100 + (15 * (t - mean)) / sd)
  const value = iq(theta)
  const low = iq(theta - 1.96 * thetaSd)
  const high = iq(theta + 1.96 * thetaSd)
  const exact = (norm?.n ?? 0) >= MIN_TAIL
  const show = (x: number) => {
    if (!exact && x > 130) return '130+'
    if (!exact && x < 70) return '< 70'
    return String(x)
  }
  const openLow = !exact && low < 70
  const openHigh = !exact && high > 130
  let range = `от ${low} до ${high}`
  if (openLow) range = high < 70 ? '' : `до ${high}`
  if (openHigh) range = low > 130 ? '' : `от ${low}`
  if (openLow && openHigh) range = ''
  return {
    text: show(value),
    range,
    status: norm ? 'norm' : 'provisional',
    value,
    low,
    high,
  }
}
