import { useEffect, useState } from 'react'
import CamposProyecto, { aInput, type Datos } from './CamposProyecto'
import Miembros from './Miembros'
import { gql, mensajeError } from './nhost'
import { CAMPOS_PROYECTO, type Proyecto } from './tipos'

export default function ProyectoDetalle({ id, userId, onVolver }: { id: string; userId: string; onVolver: () => void }) {
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    gql<{ proyectos_by_pk: Proyecto | null }>(`query($id: uuid!) { proyectos_by_pk(id: $id) { ${CAMPOS_PROYECTO} } }`, { id })
      .then((d) => {
        const p = d.proyectos_by_pk
        if (!p) return setError('Proyecto no encontrado')
        setProyecto(p)
        setDatos({ nombre: p.nombre, sistema: p.sistema ?? '', fecha_inicio: p.fecha_inicio ?? '', fecha_fin_plan: p.fecha_fin_plan ?? '', estado: p.estado })
      })
      .catch((e) => setError(mensajeError(e)))
  }, [id])

  const esResponsable = proyecto?.miembros.some((m) => m.user_id === userId && m.rol === 'responsable') ?? false

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!datos) return
    setError('')
    setAviso('')
    try {
      const r = await gql<{ update_proyectos_by_pk: { id: string } | null }>(
        'mutation($id: uuid!, $s: proyectos_set_input!) { update_proyectos_by_pk(pk_columns: {id: $id}, _set: $s) { id } }',
        { id, s: aInput(datos) },
      )
      if (!r.update_proyectos_by_pk) throw new Error('No tienes permiso para editar este proyecto')
      setAviso('Cambios guardados')
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <button className="text-sm text-blue-600 hover:underline" onClick={onVolver}>← Proyectos</button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!proyecto && !error && <p className="text-slate-500">Cargando…</p>}
      {proyecto && datos && (
        <form onSubmit={guardar} className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold text-slate-900">{proyecto.nombre}</h1>
          <p className="text-sm text-slate-600">Cliente: {proyecto.cliente.nombre}</p>
          {!esResponsable && <p className="text-sm text-amber-700">Solo lectura: únicamente el responsable puede editar.</p>}
          <CamposProyecto datos={datos} onCambio={setDatos} disabled={!esResponsable} />
          {aviso && <p className="text-sm text-green-700">{aviso}</p>}
          {esResponsable && <button className="btn">Guardar</button>}
        </form>
      )}
      {proyecto && <Miembros proyectoId={id} userId={userId} esResponsable={esResponsable} />}
    </div>
  )
}
