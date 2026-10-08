import { useCallback, useEffect, useState } from 'react'
import { api, mensajeError } from './nhost'

interface Miembro {
  user_id: string
  email: string | null
  rol: 'responsable' | 'colaborador' | 'cliente'
}

export default function Miembros({ proyectoId, userId, esResponsable }: { proyectoId: string; userId: string; esResponsable: boolean }) {
  const [miembros, setMiembros] = useState<Miembro[] | null>(null)
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<'colaborador' | 'cliente'>('colaborador')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setError('')
    try {
      setMiembros(await api<Miembro[]>(`/proyectos/${proyectoId}/miembros`))
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [proyectoId])

  useEffect(() => { cargar() }, [cargar])

  async function accion(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
      await cargar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  const agregar = (e: React.FormEvent) => {
    e.preventDefault()
    accion(async () => {
      await api(`/proyectos/${proyectoId}/miembros`, { method: 'POST', body: JSON.stringify({ email, rol }) })
      setEmail('')
    })
  }

  return (
    <section className="bg-white rounded-lg shadow p-6 space-y-3">
      <h2 className="font-semibold text-slate-900">Miembros</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {miembros === null && !error && <p className="text-slate-500">Cargando…</p>}
      <ul className="divide-y divide-slate-100">
        {miembros?.map((m) => (
          <li key={m.user_id} className="py-2 flex items-center justify-between text-sm">
            <span>{m.email ?? m.user_id}{m.user_id === userId && ' (tú)'} · <span className="text-slate-500">{m.rol}</span></span>
            {esResponsable && m.rol !== 'responsable' && (
              <button className="text-red-600 hover:underline" onClick={() => accion(() => api(`/proyectos/${proyectoId}/miembros/${m.user_id}`, { method: 'DELETE' }))}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
      {esResponsable && (
        <form onSubmit={agregar} className="flex gap-2 flex-wrap">
          <input className="input flex-1 min-w-48" type="email" required placeholder="Correo de un usuario ya registrado" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="input w-auto" value={rol} onChange={(e) => setRol(e.target.value as 'colaborador' | 'cliente')}>
            <option value="colaborador">Colaborador</option>
            <option value="cliente">Cliente</option>
          </select>
          <button className="btn">Añadir</button>
        </form>
      )}
    </section>
  )
}
