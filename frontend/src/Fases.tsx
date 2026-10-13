import { useId, useState } from 'react'
import { avanceFases, avisoFechasFase, ESTADOS_FASE, ETIQUETA_ESTADO_FASE, previasSinCompletar, type EstadoFase, type Fase } from './fases.ts'
import { gql, mensajeError } from './nhost'
import type { Proyecto } from './tipos'

type DatosProyecto = Pick<Proyecto, 'fecha_inicio' | 'fecha_fin_plan' | 'estado'>

// Sección «Fases» del detalle (ADR-0003 §5). Las fases las crea/borra la BD; aquí solo se editan estado y fechas.
export default function Fases({ fases, proyecto, esResponsable, onGuardada }: {
  fases: Fase[]
  proyecto: DatosProyecto
  esResponsable: boolean
  onGuardada: (f: Fase) => void
}) {
  const av = avanceFases(fases)
  const sinCompletar = av.total - av.completadas
  return (
    <section aria-labelledby="titulo-fases" className="bg-white rounded-lg shadow p-6 space-y-3">
      <div>
        <h2 id="titulo-fases" className="font-semibold text-slate-900">Fases</h2>
        {av.pct !== null && (
          <p className="text-sm text-slate-700" role="status">
            Avance real: <strong>{av.pct} %</strong> ({av.completadas} de {av.total} fases completadas)
          </p>
        )}
      </div>
      {fases.length === 0 ? (
        <p className="text-slate-500">Este proyecto aún no tiene fases.</p>
      ) : (
        <>
          {!esResponsable && <p className="text-sm text-amber-700">Solo lectura: únicamente el responsable puede editar.</p>}
          {proyecto.estado === 'cerrado' && sinCompletar > 0 && (
            <p className="text-sm text-slate-600">
              El proyecto está cerrado y tiene {sinCompletar} {sinCompletar === 1 ? 'fase' : 'fases'} sin completar
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {fases.map((f) => (
              <li key={f.id} className="py-3">
                <FilaFase fase={f} fases={fases} proyecto={proyecto} editable={esResponsable} onGuardada={onGuardada} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function FilaFase({ fase, fases, proyecto, editable, onGuardada }: {
  fase: Fase
  fases: Fase[]
  proyecto: DatosProyecto
  editable: boolean
  onGuardada: (f: Fase) => void
}) {
  const id = useId()
  const [estado, setEstado] = useState<EstadoFase>(fase.estado)
  const [ini, setIni] = useState(fase.fecha_inicio ?? '')
  const [fin, setFin] = useState(fase.fecha_fin_plan ?? '')
  const [guardando, setGuardando] = useState(false)
  const [confirmando, setConfirmando] = useState<string[] | null>(null) // nombres de previas sin completar (P3b)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  const hayCambios = estado !== fase.estado || ini !== (fase.fecha_inicio ?? '') || fin !== (fase.fecha_fin_plan ?? '')
  const finInvalido = !!ini && !!fin && fin < ini // 'YYYY-MM-DD' se compara bien como texto
  const avisoFechas = avisoFechasFase({ fecha_inicio: ini || null, fecha_fin_plan: fin || null }, proyecto)

  const cambiar = (fn: () => void) => { fn(); setAviso(''); setError(''); setConfirmando(null) }

  async function enviar() {
    setConfirmando(null)
    setError('')
    setAviso('')
    setGuardando(true)
    try {
      const r = await gql<{ update_fases_by_pk: Pick<Fase, 'id' | 'estado' | 'fecha_inicio' | 'fecha_fin_plan'> | null }>(
        'mutation($id: uuid!, $s: fases_set_input!) { update_fases_by_pk(pk_columns: {id: $id}, _set: $s) { id estado fecha_inicio fecha_fin_plan actualizado_en } }',
        { id: fase.id, s: { estado, fecha_inicio: ini || null, fecha_fin_plan: fin || null } },
      )
      const g = r.update_fases_by_pk
      if (!g) throw new Error('No tienes permiso para editar este proyecto')
      onGuardada({ ...fase, estado: g.estado, fecha_inicio: g.fecha_inicio, fecha_fin_plan: g.fecha_fin_plan })
      setAviso('Cambios guardados')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!hayCambios || finInvalido) return
    if (estado === 'completada' && fase.estado !== 'completada') {
      const previas = previasSinCompletar(fases, fase.id)
      if (previas.length > 0) return setConfirmando(previas.map((p) => p.nombre))
    }
    enviar()
  }

  const idError = `${id}-error`
  return (
    <form onSubmit={guardar} aria-labelledby={`${id}-nombre`} className="space-y-2">
      <h3 id={`${id}-nombre`} className="text-sm font-medium text-slate-900">{fase.nombre}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block">
          <span className="label">Estado</span>
          <select className="input" disabled={!editable} value={estado} onChange={(e) => cambiar(() => setEstado(e.target.value as EstadoFase))}>
            {ESTADOS_FASE.map((s) => <option key={s} value={s}>{ETIQUETA_ESTADO_FASE[s]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Inicio</span>
          <input className="input" type="date" disabled={!editable} value={ini} onChange={(e) => cambiar(() => setIni(e.target.value))} />
        </label>
        <label className="block">
          <span className="label">Fin planificado</span>
          <input
            className="input"
            type="date"
            disabled={!editable}
            min={ini || undefined}
            value={fin}
            aria-invalid={finInvalido || undefined}
            aria-describedby={finInvalido ? idError : undefined}
            onChange={(e) => cambiar(() => setFin(e.target.value))}
          />
        </label>
      </div>
      {finInvalido && <p id={idError} className="text-sm text-red-600">El fin no puede ser anterior al inicio</p>}
      {avisoFechas && <p className="text-sm text-amber-700">{avisoFechas}</p>}
      {confirmando && (
        <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
          <p>Hay fases anteriores sin completar: {confirmando.join(', ')}. ¿Marcar igualmente como completada?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" autoFocus onClick={enviar}>Sí, marcar como completada</button>
            <button type="button" className="btn-sec" onClick={() => setConfirmando(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {aviso && <p className="text-sm text-green-700" role="status">{aviso}</p>}
      {editable && !confirmando && (
        <button className="btn" disabled={!hayCambios || finInvalido || guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      )}
    </form>
  )
}
