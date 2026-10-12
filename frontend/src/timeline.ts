// Cálculos puros del timeline de proyectos. Sin dependencias ni acceso a React.
// Las fechas llegan como 'YYYY-MM-DD' y se interpretan en hora LOCAL (no UTC).

export type EstadoBarra = 'sin_fechas' | 'fechas_invertidas' | 'antes' | 'en_curso' | 'vencido' | 'cerrado'

export interface ResultadoBarra {
  estado: EstadoBarra
  /** Porcentaje transcurrido, entero acotado 0–100 (0 si no se puede dibujar). */
  pct: number
  /** antes: días hasta iniciar · en_curso: días restantes · vencido: días de retraso. */
  dias: number
}

const MS_DIA = 86_400_000
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** 'YYYY-MM-DD' -> Date local a medianoche; null si es inválida o no viene. */
export function parseFecha(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '')
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const f = new Date(y, mo - 1, d)
  // Rechaza fechas que JS "corrige" (p. ej. 2026-02-31).
  return f.getFullYear() === y && f.getMonth() === mo - 1 && f.getDate() === d ? f : null
}

/** Quita la hora: la fecha de hoy a medianoche local. */
export function soloFecha(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Días enteros de a a b (negativo si b es anterior). Inmune al cambio de horario. */
export function diasEntre(a: Date, b: Date): number {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / MS_DIA)
}

export function calcularBarra(
  p: { fecha_inicio: string | null; fecha_fin_plan: string | null; estado: string },
  hoy: Date,
): ResultadoBarra {
  const ini = parseFecha(p.fecha_inicio)
  const fin = parseFecha(p.fecha_fin_plan)
  if (!ini || !fin) return { estado: 'sin_fechas', pct: 0, dias: 0 }
  if (diasEntre(ini, fin) < 0) return { estado: 'fechas_invertidas', pct: 0, dias: 0 }

  const h = soloFecha(hoy)
  const total = diasEntre(ini, fin)
  const transcurridos = diasEntre(ini, h)
  // inicio == fin: no se divide; es 0% hasta ese día y 100% desde entonces.
  const bruto = total === 0 ? (transcurridos >= 0 ? 100 : 0) : (transcurridos / total) * 100
  // 100% solo cuando hoy >= fin; en curso se trunca (99,7% -> 99%) y, si ya pasó algún día, no baja de 1%.
  let pct: number
  if (transcurridos < 0) pct = 0
  else if (h >= fin) pct = 100
  else pct = Math.min(99, Math.max(transcurridos >= 1 ? 1 : 0, Math.floor(bruto)))

  if (p.estado === 'cerrado') return { estado: 'cerrado', pct, dias: 0 }
  if (transcurridos < 0) return { estado: 'antes', pct: 0, dias: -transcurridos }
  const restantes = diasEntre(h, fin)
  if (restantes < 0) return { estado: 'vencido', pct: 100, dias: -restantes }
  return { estado: 'en_curso', pct, dias: restantes }
}

const plural = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

/** Texto breve en español para la barra. */
export function resumenBarra(r: ResultadoBarra): string {
  switch (r.estado) {
    case 'antes': return `Inicia en ${plural(r.dias)}`
    case 'en_curso': return `${r.pct}% transcurrido · ${r.dias === 0 ? 'vence hoy' : `quedan ${plural(r.dias)}`}`
    case 'vencido': return `${plural(r.dias)} de retraso`
    case 'cerrado': return `Cerrado · ${r.pct}% del plazo`
    case 'fechas_invertidas': return 'La fecha de fin es anterior al inicio'
    default: return 'Sin fechas planificadas'
  }
}

/** Formato corto y estable: 5 mar 2026. */
export function formatoFecha(s: string | null): string {
  const f = parseFecha(s)
  return f ? `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}` : '?'
}

export interface Eje { inicio: Date; fin: Date; dias: number }

/** Eje común: del inicio más temprano al fin más tardío (incluye `extra`, p. ej. hoy). null si no hay fechas. */
export function rangoEje(tramos: { inicio: Date; fin: Date }[], extra?: Date): Eje | null {
  if (tramos.length === 0) return null
  let inicio = tramos[0].inicio
  let fin = tramos[0].fin
  for (const t of tramos) {
    if (t.inicio < inicio) inicio = t.inicio
    if (t.fin > fin) fin = t.fin
  }
  if (extra) {
    if (extra < inicio) inicio = extra
    if (extra > fin) fin = extra
  }
  return { inicio, fin, dias: diasEntre(inicio, fin) }
}

/** Posición 0–100 (%) de una fecha en el eje; 50 si el eje tiene un solo día. */
export function posicion(f: Date, eje: Eje): number {
  if (eje.dias <= 0) return 50
  return Math.min(100, Math.max(0, (diasEntre(eje.inicio, f) / eje.dias) * 100))
}

/** Marcas del eje: inicios de mes (cada 1, 2, 3, 6 o 12 meses, máx. 5); si no hay ≥2, inicio y fin. */
export function marcasEje(eje: Eje): { pos: number; etiqueta: string }[] {
  const fmt = (f: Date) => `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`
  if (eje.dias <= 0) return [{ pos: 0, etiqueta: fmt(eje.inicio) }]
  const meses: Date[] = []
  for (let f = new Date(eje.inicio.getFullYear(), eje.inicio.getMonth(), 1); f <= eje.fin; f = new Date(f.getFullYear(), f.getMonth() + 1, 1)) {
    if (f >= eje.inicio) meses.push(f)
  }
  for (const paso of [1, 2, 3, 6, 12, 24, 60]) {
    const usadas = meses.filter((f) => (f.getFullYear() * 12 + f.getMonth()) % paso === 0)
    if (usadas.length >= 2 && usadas.length <= 5) {
      return usadas.map((f) => ({ pos: posicion(f, eje), etiqueta: `${MESES[f.getMonth()]} ${f.getFullYear()}` }))
    }
  }
  return [{ pos: 0, etiqueta: fmt(eje.inicio) }, { pos: 100, etiqueta: fmt(eje.fin) }]
}
