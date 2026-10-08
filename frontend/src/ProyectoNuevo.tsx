import { useEffect, useState } from 'react'
import CamposProyecto, { aInput, type Datos } from './CamposProyecto'
import { gql, mensajeError } from './nhost'
import type { Cliente } from './tipos'

const NUEVO = '__nuevo__'

export default function ProyectoNuevo({ onListo, onCancelar }: { onListo: () => void; onCancelar: () => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState(NUEVO)
  const [clienteNuevo, setClienteNuevo] = useState('')
  const [datos, setDatos] = useState<Datos>({ nombre: '', sistema: '', fecha_inicio: '', fecha_fin_plan: '', estado: 'planificado' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [clienteCreado, setClienteCreado] = useState('') // evita duplicar el cliente si falla el proyecto y se reintenta

  useEffect(() => {
    gql<{ clientes: Cliente[] }>('{ clientes(order_by: {nombre: asc}) { id nombre } }')
      .then((d) => { setClientes(d.clientes); if (d.clientes.length) setClienteId(d.clientes[0].id) })
      .catch((e) => setError(mensajeError(e)))
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      let cid = clienteId
      if (clienteId === NUEVO && clienteCreado) {
        cid = clienteCreado
      } else if (clienteId === NUEVO) {
        const r = await gql<{ insert_clientes_one: Cliente }>(
          'mutation($nombre: String!) { insert_clientes_one(object: {nombre: $nombre}) { id } }',
          { nombre: clienteNuevo.trim() },
        )
        cid = r.insert_clientes_one.id
        setClienteCreado(cid)
      }
      await gql(
        'mutation($o: proyectos_insert_input!) { insert_proyectos_one(object: $o) { id } }',
        { o: { ...aInput(datos), cliente_id: cid } },
      )
      onListo()
    } catch (err) {
      setError(mensajeError(err))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold text-slate-900">Nuevo proyecto</h1>
      <label className="block">
        <span className="label">Cliente</span>
        <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          <option value={NUEVO}>+ Nuevo cliente…</option>
        </select>
      </label>
      {clienteId === NUEVO && (
        <input className="input" required maxLength={200} disabled={!!clienteCreado} placeholder="Nombre del cliente" value={clienteNuevo} onChange={(e) => setClienteNuevo(e.target.value)} />
      )}
      <CamposProyecto datos={datos} onCambio={setDatos} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn" disabled={guardando}>Crear proyecto</button>
        <button type="button" className="btn-sec" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}
