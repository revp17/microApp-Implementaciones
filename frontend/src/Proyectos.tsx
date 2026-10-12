import { useCallback, useEffect, useState } from 'react'
import { gql, mensajeError } from './nhost'
import ProyectoDetalle from './ProyectoDetalle'
import ProyectoNuevo from './ProyectoNuevo'
import LineaTiempo from './LineaTiempo'
import { CAMPOS_PROYECTO, ESTADOS, ETIQUETA_ESTADO, type Proyecto } from './tipos'
import { MAX_PROYECTOS, notaRecorte, seleccionarProyectos } from './timeline'

export default function Proyectos({ userId }: { userId: string }) {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('')
  // Estatus: 'activos' (Planificado + En curso, por defecto), un estado concreto o 'todos'. Vive en este componente,
  // que sigue montado al abrir un detalle, así que se conserva al volver.
  const [estatus, setEstatus] = useState('activos')
  // Ver todos: levanta el tope de 3. Se reinicia al cambiar de estatus.
  const [expandido, setExpandido] = useState(false)
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

  // 1) estatus + tope de 3 (mismo orden que la consulta); 2) selector "Proyecto" sobre esos visibles.
  // Si el proyecto elegido ya no está entre los visibles (p. ej. al cambiar el estatus), vuelve a "Todos".
  const { visibles: porEstatus, total } = seleccionarProyectos(proyectos ?? [], estatus, expandido ? Infinity : MAX_PROYECTOS)
  const seleccion = porEstatus.some((p) => p.id === filtro) ? filtro : ''
  const visibles = proyectos && (seleccion ? porEstatus.filter((p) => p.id === seleccion) : porEstatus)
  const nota = notaRecorte(porEstatus.length, total)
  const hayMas = total > MAX_PROYECTOS
  const etiquetaEstatus = estatus === 'activos' ? 'Planificado ni En curso' : ETIQUETA_ESTADO[estatus as keyof typeof ETIQUETA_ESTADO]

  const volver = () => { setVista({ tipo: 'lista' }); cargar() }

  if (vista.tipo === 'nuevo') return <ProyectoNuevo onListo={volver} onCancelar={() => setVista({ tipo: 'lista' })} />
  if (vista.tipo === 'detalle') return <ProyectoDetalle id={vista.id} userId={userId} onVolver={volver} />

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Proyectos</h1>
        <div className="flex flex-wrap items-end gap-3 min-w-0">
          {proyectos && proyectos.length > 0 && (
            <div className="min-w-0">
              <label className="label" htmlFor="filtro-estatus">Estatus</label>
              <select id="filtro-estatus" className="input bg-white" value={estatus} onChange={(e) => { setEstatus(e.target.value); setExpandido(false) }}>
                <option value="activos">Activos (Planificado y En curso)</option>
                {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
                <option value="todos">Todos</option>
              </select>
            </div>
          )}
          <button className="btn" onClick={() => setVista({ tipo: 'nuevo' })}>Nuevo proyecto</button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {proyectos === null && !error && <p className="text-slate-500">Cargando…</p>}
      {proyectos?.length === 0 && <p className="text-slate-500">Aún no tienes proyectos. Crea el primero.</p>}
      {proyectos && proyectos.length > 0 && total === 0 && (
        <p className="text-slate-500">No hay proyectos en estatus {etiquetaEstatus}.</p>
      )}
      <div className={hayMas ? 'flex flex-wrap items-center gap-x-3 gap-y-1 mb-3' : ''} role="status">
        {nota && <span className="text-sm text-slate-600">{nota}</span>}
        {hayMas && (
          <button type="button" className="btn-sec" onClick={() => setExpandido((v) => !v)}>
            {expandido ? `Ver solo los ${MAX_PROYECTOS} más recientes` : `Ver todos (${total})`}
          </button>
        )}
      </div>
      {proyectos && porEstatus.length > 0 && (
        <div className="mb-4 max-w-sm">
          <label className="label" htmlFor="filtro-proyecto">Proyecto</label>
          <select id="filtro-proyecto" className="input bg-white" value={seleccion} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {porEstatus.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
