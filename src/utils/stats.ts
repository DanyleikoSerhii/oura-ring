export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function nonNull(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => v != null && !Number.isNaN(v))
}

export interface Correlation {
  r: number
  n: number
  p: number
  slope: number
  intercept: number
}

/** log-gamma (Lanczos) — нужна для неполной бета-функции. */
function logGamma(x: number): number {
  const c = [
    76.1800917294715, -86.5053203294168, 24.0140982408309, -1.23173957245015, 0.120865097386618e-2,
    -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.00000000019001
  for (const coef of c) ser += coef / ++y
  return -tmp + Math.log((2.506628274631 * ser) / x)
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAX_ITER = 200
  const EPS = 3e-12
  const FPMIN = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Регуляризованная неполная бета-функция I_x(a, b). */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  )
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaContinuedFraction(a, b, x)) / a
    : 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b
}

/** Корреляция Пирсона с двусторонним p-value (t-распределение) и линией регрессии. */
export function pearson(xs: number[], ys: number[]): Correlation | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const mx = mean(xs)!
  const my = mean(ys)!
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx
    const dy = ys[i]! - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null
  const r = sxy / Math.sqrt(sxx * syy)
  const df = n - 2
  const t = (r * Math.sqrt(df)) / Math.sqrt(Math.max(1e-12, 1 - r * r))
  const p = incompleteBeta(df / (df + t * t), df / 2, 0.5)
  const slope = sxy / sxx
  return { r, n, p, slope, intercept: my - slope * mx }
}
