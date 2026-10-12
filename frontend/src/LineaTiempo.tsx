import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ETIQUETA_ESTADO, type Proyecto } from './tipos'
import {
  clasificarFilas, diaDelPlazo, formatoFecha, lugarPorcentaje, marcasEje, parseFecha, porcentajeVisible, posicion, rangoEje, restanteBarra, soloFecha,
  tramoBarra, tramoRetraso,
  type EstadoBarra,
} from './timeline'

const COLOR_RELLENO: Record<EstadoBarra, string> = {
  sin_fechas: 'bg-slate-400',
  fechas_invertidas: 'bg-slate-400',
  antes: 'bg-slate-400',
  en_curso: 'bg-blue-600',
  vencido: 'bg-red-600',
  cerrado: 'bg-slate-500',
}
const COLOR_TEXTO: Record<EstadoBarra, string> = {
  sin_fechas: 'text-slate-600',
  fechas_invertidas: 'text-amber-700',
  antes: 'text-slate-600',
  en_curso: 'text-blue-700',
  vencido: 'text-red-700',
  cerrado: 'text-slate-600',
}

/** Ancla una etiqueta al borde que deje más espacio: no se sale del contenedor ni necesita medirse. */
function anclaje(pos: number, extremo: 'inicio' | 'fin'): CSSProperties {
  const alinearIzq = extremo === 'inicio' ? pos <= 50 : pos < 50
  return alinearIzq ? { left: `${pos}%` } : { right: `${100 - pos}%`, textAlign: 'right' }
}

const aISO = (f: Date) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`

export default function LineaTiempo({ proyectos, onAbrir }: { proyectos: Proyecto[]; onAbrir: (id: string) => void }) {
  // "Hoy" se recalcula al volver a la pestaña para no quedar desfasado tras medianoche.
  const [hoy, setHoy] = useState(() => soloFecha(new Date()))
  useEffect(() => {
    const refrescar = () => setHoy((prev) => {
      const ahora = soloFecha(new Date())
      return ahora.getTime() === prev.getTime() ? prev : ahora
    })
    document.addEventListener('visibilitychange', refrescar)
    return () => document.removeEventListener('visibilitychange', refrescar)
  }, [])

  // Ancho del eje en px: define cuántas marcas de mes caben sin pegarse (~80 px por marca).
  const refEje = useRef<HTMLDivElement>(null)
  const [anchoEje, setAnchoEje] = useState(320)
  useEffect(() => {
    const el = refEje.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(() => setAnchoEje(el.clientWidth))
    obs.observe(el)
    return () => obs.disconnect()
  })

  // Una fila por proyecto en el orden de la selección; el eje solo considera los que tienen fechas válidas.
  const { filas, eje } = useMemo(() => {
    const filas = clasificarFilas(proyectos, hoy)
    const tramos = filas.filter((f) => f.dibujable).map((f) => ({ inicio: parseFecha(f.p.fecha_inicio)!, fin: parseFecha(f.p.fecha_fin_plan)! }))
    // El eje siempre incluye hoy para poder comparar contra la fecha actual.
    return { filas, eje: rangoEje(tramos, hoy) }
  }, [proyectos, hoy])

  if (proyectos.length === 0) return null

  const posHoy = eje ? posicion(hoy, eje) : 0
  const marcas = eje ? marcasEje(eje, Math.min(5, Math.max(2, Math.floor(anchoEje / 80)))) : []
  const fechaHoy = formatoFecha(aISO(hoy))
  const estiloHoy: CSSProperties =
    posHoy < 25 ? { left: `${posHoy}%` } : posHoy > 75 ? { right: `${100 - posHoy}%`, textAlign: 'right' } : { left: `${posHoy}%`, transform: 'translateX(-50%)' }

  return (
    <section aria-labelledby="titulo-timeline" className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <h2 id="titulo-timeline" className="font-semibold text-slate-900">Timeline</h2>
      <p className="text-xs text-slate-500 mb-3">
        El porcentaje es el <strong>avance del plazo</strong> (tiempo transcurrido del plan), no el avance del trabajo.
      </p>

      {/* Eje de tiempo común (solo con proyectos con fechas): marcas de mes abajo y la fecha de hoy una sola vez arriba */}
      {eje && (
          <div ref={refEje} className="relative h-10 mb-2 text-xs text-slate-500 border-b border-slate-200">
            {marcas.map((m) => (
              <span
                key={`${m.pos}-${m.etiqueta}`}
                aria-hidden="true"
                className="absolute bottom-1 whitespace-nowrap"
                style={m.pos <= 0 ? { left: 0 } : m.pos >= 100 ? { right: 0 } : { left: `${m.pos}%`, transform: 'translateX(-50%)' }}
              >
                {m.etiqueta}
              </span>
            ))}
            <span className="absolute top-0 whitespace-nowrap text-xs font-semibold text-red-700" style={estiloHoy}>Hoy · {fechaHoy}</span>
          </div>
      )}

      <ul className="space-y-6">
            {filas.map(({ p, r, dibujable }) => {
              if (!eje || !dibujable) {
                const invertida = r.estado === 'fechas_invertidas'
                const aviso = invertida
                  ? 'El fin es anterior al inicio · abre el proyecto para corregirlo'
                  : 'Sin fechas planificadas · abre el proyecto para definirlas'
                return (
                  <li key={p.id}>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <button
                        className="font-medium text-slate-900 hover:underline text-left min-w-0 max-w-full break-words"
                        aria-label={`${p.nombre}, cliente ${p.cliente.nombre}, ${ETIQUETA_ESTADO[p.estado]}. ${invertida ? 'Fechas inválidas: el fin es anterior al inicio.' : 'Sin fechas planificadas.'} Abrir detalle.`}
                        onClick={() => onAbrir(p.id)}
                      >
                        {p.nombre}
                      </button>
                      <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 shrink-0">{ETIQUETA_ESTADO[p.estado]}</span>
                    </div>
                    <div className="text-sm text-slate-600 min-w-0 break-words">{p.cliente.nombre}</div>
                    <div className="text-sm font-medium text-amber-700 break-words">{aviso}</div>
                    <div aria-hidden="true" onClick={() => onAbrir(p.id)} className="w-full h-8 mt-1 rounded bg-slate-100 cursor-pointer" />
                  </li>
                )
              }
              const ini = parseFecha(p.fecha_inicio)!
              const fin = parseFecha(p.fecha_fin_plan)!
              const { izq, ancho } = tramoBarra(ini, fin, eje)
              const posFin = izq + ancho
              const cerrado = r.estado === 'cerrado'
              const pctVisible = porcentajeVisible(r)
              const pctRelleno = cerrado ? 100 : r.pct
              const lugarPct = pctVisible === null ? null : lugarPorcentaje(ancho, r.pct)
              const plazo = diaDelPlazo(ini, fin, hoy)
              const retraso = r.estado === 'vencido' ? tramoRetraso(fin, hoy, eje) : null
              const restante = restanteBarra(r)
              const diaTxt = r.estado === 'en_curso' && plazo ? `Día ${plazo.dia} de ${plazo.total}` : ''
              const descripcion =
                `${p.nombre}, cliente ${p.cliente.nombre}, ${ETIQUETA_ESTADO[p.estado]}, del ${formatoFecha(p.fecha_inicio)} al ${formatoFecha(p.fecha_fin_plan)}. ` +
                (cerrado ? 'Proyecto cerrado.' : `Avance del plazo: ${r.pct}%.${diaTxt ? ` ${diaTxt}.` : ''} ${restante}.`)
              return (
                <li key={p.id}>
                  <div className="flex flex-wrap items-center gap-x-2">
                    <button
                      className="font-medium text-slate-900 hover:underline text-left min-w-0 max-w-full break-words"
                      aria-label={`${descripcion} Abrir detalle.`}
                      onClick={() => onAbrir(p.id)}
                    >
                      {p.nombre}
                    </button>
                    <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 shrink-0">{ETIQUETA_ESTADO[p.estado]}</span>
                  </div>
                  <div className="text-sm text-slate-600 min-w-0 break-words">{p.cliente.nombre}</div>

                  {/* Avance del plazo, en grande */}
                  <div className={`flex flex-wrap items-baseline gap-x-2 ${COLOR_TEXTO[r.estado]}`}>
                    {cerrado ? (
                      <span className="text-2xl font-bold leading-tight">Cerrado</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold leading-tight">{r.pct}%</span>
                        <span className="text-sm font-medium break-words">
                          Avance del plazo{diaTxt ? ` · ${diaTxt}` : ''}{restante ? ` · ${restante}` : ''}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Barra decorativa: el control de teclado es el nombre; la barra solo añade clic con ratón/táctil */}
                  <div aria-hidden="true" onClick={() => onAbrir(p.id)} className="relative w-full h-8 mt-1 cursor-pointer">
                    <span className="absolute inset-y-0 left-0 right-0 rounded bg-slate-100" />
                    <span className="absolute inset-y-1 rounded bg-slate-300" style={{ left: `${izq}%`, width: `${ancho}%` }}>
                      <span className={`absolute inset-y-0 left-0 rounded ${COLOR_RELLENO[r.estado]}`} style={{ width: `${pctRelleno}%` }} />
                      {lugarPct && (
                        <span
                          className={`absolute inset-y-0 flex items-center px-1.5 text-xs font-bold whitespace-nowrap ${lugarPct === 'relleno' ? 'text-white justify-end' : 'text-slate-800'}`}
                          style={lugarPct === 'relleno' ? { right: `${100 - r.pct}%` } : { left: `${r.pct}%` }}
                        >
                          {r.pct}%
                        </span>
                      )}
                    </span>
                    {retraso && (
                      <span
                        className="absolute inset-y-1 rounded-r border border-red-900"
                        title="Tramo de retraso"
                        style={{
                          left: `${retraso.izq}%`,
                          width: `${retraso.ancho}%`,
                          backgroundImage: 'repeating-linear-gradient(45deg, #991b1b 0 4px, #fca5a5 4px 8px)',
                        }}
                      />
                    )}
                    <span className="absolute inset-y-0 w-0.5 bg-red-600 -translate-x-1/2" style={{ left: `${posHoy}%` }} />
                  </div>

                  {/* Fechas completas pegadas a los extremos de la barra (apiladas para no solaparse) */}
                  <div className="relative h-9 mt-0.5 text-xs text-slate-700" aria-hidden="true">
                    <span className="absolute top-0 whitespace-nowrap" style={anclaje(izq, 'inicio')}>Inicio: {formatoFecha(p.fecha_inicio)}</span>
                    <span className="absolute top-4 whitespace-nowrap" style={anclaje(posFin, 'fin')}>Fin plan: {formatoFecha(p.fecha_fin_plan)}</span>
                  </div>
                </li>
              )
            })}
      </ul>

    </section>
  )
}
