import { useCallback, useEffect, useState } from 'react'
import { gql, mensajeError } from './nhost'
import ProyectoDetalle from './ProyectoDetalle'
import ProyectoNuevo from './ProyectoNuevo'
import LineaTiempo from './LineaTiempo'
import { CAMPOS_PROYECTO, ETIQUETA_ESTADO, type Proyecto } from './tipos'

export default function Proyectos({ userId }: { userId: string }) {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('')
  const [vista, setVista] = useState<{ tipo: 'lista' } | { tipo: 'nuevo' } | { tipo: 'detalle'; id: string }>({ tipo: 'lista' })

  const cargar = useCallback(async () => {
    setError('')
    try {
      const d = await gql<{ proyectos: Proyecto[] }>(`{ proyectos(order_by: {creado_en: desc}) { ${CAMPOS_PROYECTO} } }`)
      setProyectos(d.proyectos)
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Filtro por proyecto ('' = todos). Si el proyecto elegido ya no está en la lista, vuelve a "Todos".
  const seleccion = proyectos?.some((p) => p.id === filtro) ? filtro : ''
  const visibles = proyectos && (seleccion ? proyectos.filter((p) => p.id === seleccion) : proyectos)

  const volver = () => { setVista({ tipo: 'lista' }); cargar() }

  if (vista.tipo === 'nuevo') return <ProyectoNuevo onListo={volver} onCancelar={() => setVista({ tipo: 'lista' })} />
  if (vista.tipo === 'detalle') return <ProyectoDetalle id={vista.id} userId={userId} onVolver={volver} />

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Proyectos</h1>
        <button className="btn" onClick={() => setVista({ tipo: 'nuevo' })}>Nuevo proyecto</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {proyectos === null && !error && <p className="text-slate-500">Cargando…</p>}
      {proyectos?.length === 0 && <p className="text-slate-500">Aún no tienes proyectos. Crea el primero.</p>}
      {proyectos && proyectos.length > 0 && (
        <div className="mb-4 max-w-sm">
          <label className="label" htmlFor="filtro-proyecto">Proyecto</label>
          <select id="filtro-proyecto" className="input bg-white" value={seleccion} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      )}
      {visibles && <LineaTiempo proyectos={visibles} onAbrir={(id) => setVista({ tipo: 'detalle', id })} />}
      <ul className="space-y-2">
        {visibles?.map((p) => (
          <li key={p.id}>
            <button className="w-full text-left bg-white rounded-lg shadow-sm p-4 hover:shadow" onClick={() => setVista({ tipo: 'detalle', id: p.id })}>
              <div className="flex items-center justify-between min-w-0">
                <span className="font-medium text-slate-900 min-w-0 break-words">{p.nombre}</span>
                <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 shrink-0 ml-2">{ETIQUETA_ESTADO[p.estado]}</span>
              </div>
              <div className="text-sm text-slate-600 break-words">
                {p.cliente.nombre}{p.sistema ? ` · ${p.sistema}` : ''}
                {p.fecha_inicio || p.fecha_fin_plan ? ` · ${p.fecha_inicio ?? '?'} → ${p.fecha_fin_plan ?? '?'}` : ''}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
