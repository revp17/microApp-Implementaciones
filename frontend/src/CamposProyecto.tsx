import { ESTADOS, ETIQUETA_ESTADO, type Estado } from './tipos'

export interface Datos {
  nombre: string
  sistema: string
  fecha_inicio: string
  fecha_fin_plan: string
  estado: Estado
}

// Campos comunes de crear/editar. `disabled` = solo lectura.
export default function CamposProyecto({ datos, onCambio, disabled }: { datos: Datos; onCambio: (d: Datos) => void; disabled?: boolean }) {
  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onCambio({ ...datos, [k]: e.target.value })
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
})
