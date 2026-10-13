import { useId } from 'react'
import { MSG_DESARROLLO_BLOQUEADO } from './fases.ts'
import { ESTADOS, ETIQUETA_ESTADO, type Estado } from './tipos'

export interface Datos {
  nombre: string
  sistema: string
  fecha_inicio: string
  fecha_fin_plan: string
  estado: Estado
  requiere_desarrollo: boolean
}

type ClaveTexto = Exclude<keyof Datos, 'requiere_desarrollo'>

// Campos comunes de crear/editar. `disabled` = solo lectura.
// `bloqueoDesarrollo` = la fase Desarrollo ya tiene fechas o avance: solo se impide DESMARCAR la casilla (ADR-0003 §3);
// si ya está desmarcada (sin guardar), sigue activa para poder volver a marcarla.
export default function CamposProyecto({ datos, onCambio, disabled, bloqueoDesarrollo }: {
  datos: Datos
  onCambio: (d: Datos) => void
  disabled?: boolean
  bloqueoDesarrollo?: boolean
}) {
  const idAyuda = useId()
  const set = (k: ClaveTexto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onCambio({ ...datos, [k]: e.target.value })
  return (
    <>
      <label className="block">
        <span className="label">Nombre del proyecto</span>
        <input className="input" required maxLength={200} disabled={disabled} value={datos.nombre} onChange={set('nombre')} />
      </label>
      <label className="block">
        <span className="label">Sistema / ERP</span>
        <input className="input" maxLength={200} disabled={disabled} placeholder="p. ej. SAP Business One" value={datos.sistema} onChange={set('sistema')} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="label">Inicio</span>
          <input className="input" type="date" disabled={disabled} value={datos.fecha_inicio} onChange={set('fecha_inicio')} />
        </label>
        <label className="block">
          <span className="label">Fin planificado</span>
          <input className="input" type="date" disabled={disabled} min={datos.fecha_inicio || undefined} value={datos.fecha_fin_plan} onChange={set('fecha_fin_plan')} />
        </label>
      </div>
      <label className="block">
        <span className="label">Estado</span>
        <select className="input" disabled={disabled} value={datos.estado} onChange={set('estado')}>
          {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
        </select>
      </label>
      <div>
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0"
            disabled={disabled || (bloqueoDesarrollo && datos.requiere_desarrollo)}
            checked={datos.requiere_desarrollo}
            aria-describedby={idAyuda}
            onChange={(e) => onCambio({ ...datos, requiere_desarrollo: e.target.checked })}
          />
          <span>La implementación se basa en un desarrollo (añade la fase Desarrollo)</span>
        </label>
        <p id={idAyuda} className={`text-xs mt-1 ml-6 ${bloqueoDesarrollo ? 'text-amber-700' : 'text-slate-500'}`}>
          {bloqueoDesarrollo ? MSG_DESARROLLO_BLOQUEADO : 'Marca esta opción si intervienen desarrolladores.'}
        </p>
      </div>
    </>
  )
}

// '' -> null para enviar a la BD
export const aInput = (d: Datos) => ({
  nombre: d.nombre.trim(),
  sistema: d.sistema.trim() || null,
  fecha_inicio: d.fecha_inicio || null,
  fecha_fin_plan: d.fecha_fin_plan || null,
  estado: d.estado,
  requiere_desarrollo: d.requiere_desarrollo,
})
