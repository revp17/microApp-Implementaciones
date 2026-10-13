import { useCallback, useEffect, useState } from 'react'
import CamposProyecto, { aInput, type Datos } from './CamposProyecto'
import Fases from './Fases.tsx'
import { desarrolloBloqueado, mapearErrorDesarrollo, MSG_AVISO_DESARROLLO, type Fase } from './fases.ts'
import Miembros from './Miembros'
import { gql, mensajeError } from './nhost'
import { CAMPOS_PROYECTO, type Proyecto } from './tipos'

const aDatos = (p: Proyecto): Datos => ({
  nombre: p.nombre,
  sistema: p.sistema ?? '',
  fecha_inicio: p.fecha_inicio ?? '',
  fecha_fin_plan: p.fecha_fin_plan ?? '',
  estado: p.estado,
  requiere_desarrollo: p.requiere_desarrollo,
})

export default function ProyectoDetalle({ id, userId, onVolver }: { id: string; userId: string; onVolver: () => void }) {
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmarDesarrollo, setConfirmarDesarrollo] = useState(false)
  // Cambia en cada recarga completa: remonta la sección Fases para descartar borradores de filas que ya no existen.
  const [version, setVersion] = useState(0)

  // Consulta nueva cada vez (tras cambiar `requiere_desarrollo` el trigger crea/borra la fase Desarrollo).
  const cargar = useCallback(async () => {
    const d = await gql<{ proyectos_by_pk: Proyecto | null }>(`query($id: uuid!) { proyectos_by_pk(id: $id) { ${CAMPOS_PROYECTO} } }`, { id })
    const p = d.proyectos_by_pk
    if (!p) throw new Error('Proyecto no encontrado')
    setProyecto(p)
    setDatos(aDatos(p))
    setVersion((v) => v + 1)
  }, [id])

  useEffect(() => {
    cargar().catch((e) => setError(mensajeError(e)))
  }, [cargar])

  const esResponsable = proyecto?.miembros.some((m) => m.user_id === userId && m.rol === 'responsable') ?? false

  async function enviar() {
    if (!datos || !proyecto) return
    setConfirmarDesarrollo(false)
    setError('')
    setAviso('')
    const cambiaDesarrollo = datos.requiere_desarrollo !== proyecto.requiere_desarrollo
    try {
      const r = await gql<{ update_proyectos_by_pk: { id: string } | null }>(
        'mutation($id: uuid!, $s: proyectos_set_input!) { update_proyectos_by_pk(pk_columns: {id: $id}, _set: $s) { id } }',
        { id, s: aInput(datos) },
      )
      if (!r.update_proyectos_by_pk) throw new Error('No tienes permiso para editar este proyecto')
      if (cambiaDesarrollo) {
        // El `returning` de la mutación no ve las fases tocadas por el trigger: se recarga el proyecto completo.
        await cargar()
      } else {
        setProyecto((p) => (p ? { ...p, ...aInput(datos) } : p))
      }
      setAviso('Cambios guardados')
    } catch (err) {
      const msg = mensajeError(err)
      // Al desmarcar, la BD rechaza si Desarrollo tiene fechas/avance; se muestra el mensaje de §3.
      setError(cambiaDesarrollo && !datos.requiere_desarrollo ? mapearErrorDesarrollo(msg) : msg)
    }
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!datos || !proyecto) return
    if (datos.requiere_desarrollo && !proyecto.requiere_desarrollo) return setConfirmarDesarrollo(true)
    enviar()
  }

  const alGuardarFase = (f: Fase) =>
    setProyecto((p) => (p ? { ...p, fases: p.fases.map((x) => (x.id === f.id ? f : x)) } : p))

  return (
    <div className="space-y-4 max-w-xl">
      <button className="text-sm text-blue-600 hover:underline" onClick={onVolver}>← Proyectos</button>
      {error && !proyecto && <p className="text-sm text-red-600">{error}</p>}
      {!proyecto && !error && <p className="text-slate-500">Cargando…</p>}
      {proyecto && datos && (
        <form onSubmit={guardar} className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold text-slate-900">{proyecto.nombre}</h1>
          <p className="text-sm text-slate-600">Cliente: {proyecto.cliente.nombre}</p>
          {!esResponsable && <p className="text-sm text-amber-700">Solo lectura: únicamente el responsable puede editar.</p>}
          <CamposProyecto
            datos={datos}
            onCambio={(d) => { setDatos(d); setConfirmarDesarrollo(false) }}
            disabled={!esResponsable}
            bloqueoDesarrollo={esResponsable && proyecto.requiere_desarrollo && desarrolloBloqueado(proyecto.fases)}
          />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {aviso && <p className="text-sm text-green-700" role="status">{aviso}</p>}
          {confirmarDesarrollo && (
            <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
              <p>{MSG_AVISO_DESARROLLO}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn" autoFocus onClick={enviar}>Guardar y añadir la fase</button>
                <button type="button" className="btn-sec" onClick={() => setConfirmarDesarrollo(false)}>Cancelar</button>
              </div>
            </div>
          )}
          {esResponsable && !confirmarDesarrollo && <button className="btn">Guardar</button>}
        </form>
      )}
      {proyecto && (
        <Fases key={version} fases={proyecto.fases} proyecto={proyecto} esResponsable={esResponsable} onGuardada={alGuardarFase} />
      )}
      {proyecto && <Miembros proyectoId={id} userId={userId} esResponsable={esResponsable} />}
    </div>
  )
}
