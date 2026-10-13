// Cálculos puros de las fases de un proyecto (ADR-0003 §3–§4). Sin React ni dependencias externas.
// Las fechas llegan como 'YYYY-MM-DD' y se interpretan en hora LOCAL, igual que en timeline.ts.
import { diasEntre, formatoFecha, parseFecha, tramoBarra, type Eje } from './timeline.ts'

export const ESTADOS_FASE = ['pendiente', 'en_curso', 'completada'] as const
export type EstadoFase = (typeof ESTADOS_FASE)[number]

export const ETIQUETA_ESTADO_FASE: Record<EstadoFase, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  completada: 'Completada',
}

export interface Fase {
  id: string
  clave: string
  nombre: string
  orden: number
  estado: EstadoFase
  fecha_inicio: string | null
  fecha_fin_plan: string | null
}

/** Clave estable de la fase condicional (nunca se compara por `nombre`). */
export const CLAVE_DESARROLLO = 'desarrollo'

/** Mensajes de §3 (atributo `requiere_desarrollo`). */
export const MSG_DESARROLLO_BLOQUEADO =
  'No se puede quitar la fase Desarrollo porque ya tiene fechas o avance. Déjala en Pendiente y sin fechas e inténtalo de nuevo.'
export const MSG_AVISO_DESARROLLO = 'Se añadirá la fase Desarrollo; el avance se recalculará sobre 8 fases.'

/** completadas / total; pct null si no hay fases. Las `en_curso` no suman (P5). */
export function avanceFases(fases: { estado: EstadoFase }[]): { completadas: number; enCurso: number; total: number; pct: number | null } {
  const total = fases.length
  const completadas = fases.filter((f) => f.estado === 'completada').length
  const enCurso = fases.filter((f) => f.estado === 'en_curso').length
  return { completadas, enCurso, total, pct: total === 0 ? null : Math.round((100 * completadas) / total) }
}

const porOrden = <T extends { orden: number }>(fases: T[]) => [...fases].sort((a, b) => a.orden - b.orden)

/** Fases anteriores (por orden) a `fase` que no están completadas; para el aviso de §3 (P3b). */
export function previasSinCompletar(fases: Fase[], faseId: string): Fase[] {
  const fase = fases.find((f) => f.id === faseId)
  if (!fase) return []
  return porOrden(fases.filter((f) => f.orden < fase.orden && f.estado !== 'completada'))
}

/** Aviso no bloqueante (P4) si alguna fecha de la fase queda fuera del plazo del proyecto; null si no hay aviso. */
export function avisoFechasFase(
  f: Pick<Fase, 'fecha_inicio' | 'fecha_fin_plan'>,
  p: { fecha_inicio: string | null; fecha_fin_plan: string | null },
): string | null {
  const pIni = parseFecha(p.fecha_inicio)
  const pFin = parseFecha(p.fecha_fin_plan)
  if (!pIni || !pFin) return null
  const fuera = (s: string | null) => {
    const d = parseFecha(s)
    return d !== null && (diasEntre(pIni, d) < 0 || diasEntre(d, pFin) < 0)
  }
  if (!fuera(f.fecha_inicio) && !fuera(f.fecha_fin_plan)) return null
  return `Estas fechas quedan fuera del plazo del proyecto (${formatoFecha(p.fecha_inicio)} – ${formatoFecha(p.fecha_fin_plan)})`
}

const fechasValidas = (f: Pick<Fase, 'fecha_inicio' | 'fecha_fin_plan'>) => {
  const ini = parseFecha(f.fecha_inicio)
  const fin = parseFecha(f.fecha_fin_plan)
  return ini !== null && fin !== null && diasEntre(ini, fin) >= 0
}

/** 'fechas' si TODAS las fases tienen inicio y fin válidos (fin >= inicio); si no (o no hay fases), 'iguales'. */
export function modoTramos(fases: Fase[]): 'fechas' | 'iguales' {
  return fases.length > 0 && fases.every(fechasValidas) ? 'fechas' : 'iguales'
}

/** Modo que se dibuja de verdad: 'fechas' solo si todas las fases tienen fechas válidas Y hay eje común. */
export function modoEfectivo(fases: Fase[], eje: Eje | null): 'fechas' | 'iguales' {
  return eje && modoTramos(fases) === 'fechas' ? 'fechas' : 'iguales'
}

/**
 * Tramos del carril de fases en % del eje común (0–100), en orden ascendente
 * (en modo `fechas` los solapes se dibujan encimados y gana la de mayor orden, que va después).
 * - `fechas`: todas las fases con fechas válidas y hay eje → de posicion(inicio) a posicion(fin), ancho mínimo 1.
 * - `iguales`: reparto en partes iguales sobre `barra` (tramo del proyecto) o, si no hay, sobre 0–100.
 */
export function tramosFases(
  fases: Fase[],
  barra: { izq: number; ancho: number } | null,
  eje: Eje | null,
): { id: string; nombre: string; estado: EstadoFase; izq: number; ancho: number }[] {
  const ordenadas = porOrden(fases)
  if (ordenadas.length === 0) return []
  if (eje && modoEfectivo(ordenadas, eje) === 'fechas') {
    return ordenadas.map((f) => {
      const { izq, ancho } = tramoBarra(parseFecha(f.fecha_inicio)!, parseFecha(f.fecha_fin_plan)!, eje)
      return { id: f.id, nombre: f.nombre, estado: f.estado, izq, ancho }
    })
  }
  const base = barra ?? { izq: 0, ancho: 100 }
  const ancho = base.ancho / ordenadas.length
  return ordenadas.map((f, i) => ({ id: f.id, nombre: f.nombre, estado: f.estado, izq: base.izq + i * ancho, ancho }))
}

/** Descripción accesible del carril: «Levantamiento: Completada; Diseño: En curso; …». */
export function descripcionFases(fases: Fase[]): string {
  return porOrden(fases).map((f) => `${f.nombre}: ${ETIQUETA_ESTADO_FASE[f.estado]}`).join('; ')
}

/** La casilla de Desarrollo no se puede desmarcar si la fase tiene fechas o un estado distinto de Pendiente (§3). */
export function desarrolloBloqueado(fases: Fase[]): boolean {
  const d = fases.find((f) => f.clave === CLAVE_DESARROLLO)
  return !!d && (d.estado !== 'pendiente' || d.fecha_inicio !== null || d.fecha_fin_plan !== null)
}

/** Red de seguridad: si el error de BD menciona «Desarrollo», se muestra el mensaje de §3. */
export function mapearErrorDesarrollo(msg: string): string {
  return /Desarrollo/.test(msg) ? MSG_DESARROLLO_BLOQUEADO : msg
}
