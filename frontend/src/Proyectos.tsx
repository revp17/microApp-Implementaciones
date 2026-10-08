import { useCallback, useEffect, useState } from 'react'
import { gql, mensajeError } from './nhost'
import ProyectoDetalle from './ProyectoDetalle'
import ProyectoNuevo from './ProyectoNuevo'
import { CAMPOS_PROYECTO, ETIQUETA_ESTADO, type Proyecto } from './tipos'

export default function Proyectos({ userId }: { userId: string }) {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null)
  const [error, setError] = useState('')
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
      <ul className="space-y-2">
        {proyectos?.map((p) => (
          <li key={p.id}>
            <button className="w-full text-left bg-white rounded-lg shadow-sm p-4 hover:shadow" onClick={() => setVista({ tipo: 'detalle', id: p.id })}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{p.nombre}</span>
                <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{ETIQUETA_ESTADO[p.estado]}</span>
              </div>
              <div className="text-sm text-slate-600">
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
