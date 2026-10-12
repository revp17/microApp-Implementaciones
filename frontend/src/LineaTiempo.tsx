import { useEffect, useMemo, useState } from 'react'
import { ETIQUETA_ESTADO, type Proyecto } from './tipos'
import { calcularBarra, formatoFecha, marcasEje, parseFecha, posicion, rangoEje, resumenBarra, soloFecha, type EstadoBarra } from './timeline'

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

  const { barras, aparte, eje } = useMemo(() => {
    const filas = proyectos.map((p) => ({ p, r: calcularBarra(p, hoy) }))
    const barras = filas.filter((f) => f.r.estado !== 'sin_fechas' && f.r.estado !== 'fechas_invertidas')
    const aparte = filas.filter((f) => !barras.includes(f))
    const tramos = barras.map((f) => ({ inicio: parseFecha(f.p.fecha_inicio)!, fin: parseFecha(f.p.fecha_fin_plan)! }))
    // El eje siempre incluye hoy para poder comparar contra la fecha actual.
    const eje = rangoEje(tramos, hoy)
    return { barras, aparte, eje }
  }, [proyectos, hoy])

  if (proyectos.length === 0) return null

  const posHoy = eje ? posicion(hoy, eje) : 0
  const hoyEnEje = eje ? hoy >= eje.inicio && hoy <= eje.fin : false
  const marcas = eje ? marcasEje(eje) : []

  return (
    <section aria-labelledby="titulo-timeline" className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <h2 id="titulo-timeline" className="font-semibold text-slate-900 mb-3">Timeline</h2>

      {eje && (
        <>
          {/* Eje de tiempo común */}
          <div className="relative h-10 mb-2 text-xs text-slate-500 border-b border-slate-200" aria-hidden="true">
            {marcas.map((m) => (
              <span
                key={`${m.pos}-${m.etiqueta}`}
                className="absolute bottom-1 whitespace-nowrap"
                style={m.pos <= 0 ? { left: 0 } : m.pos >= 100 ? { right: 0 } : { left: `${m.pos}%`, transform: 'translateX(-50%)' }}
              >
                {m.etiqueta}
              </span>
            ))}
            {hoyEnEje && (
              <span className="absolute top-0 text-xs font-semibold text-red-700 -translate-x-1/2" style={{ left: `${posHoy}%` }}>
                Hoy
              </span>
            )}
          </div>

          <ul className="space-y-4">
            {barras.map(({ p, r }) => {
              const ini = parseFecha(p.fecha_inicio)!
              const fin = parseFecha(p.fecha_fin_plan)!
              const izq = posicion(ini, eje)
              const ancho = Math.max(posicion(fin, eje) - izq, 1)
              const resumen = resumenBarra(r)
              const descripcion = `${p.nombre}, cliente ${p.cliente.nombre}, ${ETIQUETA_ESTADO[p.estado]}, del ${formatoFecha(p.fecha_inicio)} al ${formatoFecha(p.fecha_fin_plan)}. ${resumen}.`
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
                  <div className="text-sm text-slate-600 min-w-0 break-words">
                    {p.cliente.nombre} · {formatoFecha(p.fecha_inicio)} → {formatoFecha(p.fecha_fin_plan)}
                  </div>
                  <div className={`text-sm font-medium break-words ${COLOR_TEXTO[r.estado]}`}>{resumen}</div>
                  {/* Decorativa: el control de teclado es el nombre; la barra solo añade clic con ratón/táctil. */}
                  <div
                    aria-hidden="true"
                    onClick={() => onAbrir(p.id)}
                    className="relative block w-full h-6 mt-1 cursor-pointer"
                  >
                    <span className="absolute inset-y-2 left-0 right-0 rounded bg-slate-100" />
                    <span className="absolute inset-y-2 rounded bg-slate-300 overflow-hidden" style={{ left: `${izq}%`, width: `${ancho}%` }}>
                      <span className={`block h-full ${COLOR_RELLENO[r.estado]}`} style={{ width: `${r.pct}%` }} />
                    </span>
                    {hoyEnEje && <span className="absolute inset-y-0 w-0.5 bg-red-600 -translate-x-1/2" style={{ left: `${posHoy}%` }} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {!eje && <p className="text-sm text-slate-500">Ningún proyecto tiene fechas válidas para dibujar el timeline.</p>}

      {aparte.length > 0 && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3">
          <h3 className="text-sm font-medium text-amber-800">Sin fechas planificadas ({aparte.length})</h3>
          <p className="text-xs text-amber-800 mb-1">No se pueden dibujar. Abre el proyecto para completar o corregir las fechas.</p>
          <ul className="text-sm">
            {aparte.map(({ p, r }) => (
              <li key={p.id} className="min-w-0 break-words">
                <button className="text-blue-700 hover:underline text-left min-w-0 max-w-full break-words" onClick={() => onAbrir(p.id)}>
                  {p.nombre}
                </button>
                <span className="text-slate-600"> · {p.cliente.nombre}</span>
                {r.estado === 'fechas_invertidas' && <span className="text-amber-800"> · el fin es anterior al inicio</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
